import mongoose from 'mongoose'
import connectDB from '@/lib/db'
import Question from '@/models/Question'
import UserAnswer from '@/models/UserAnswer'
import ExamSession from '@/models/ExamSession'
import { getUserSkillProfile } from '@/lib/user-skill'

import {
  DIFFICULTY_MAP,
  ANTI_REPETITION_SESSIONS,
  MIN_ANSWERS_FOR_QUESTION_ACCURACY,
  CANDIDATE_POOL_MULTIPLIER,
  CANDIDATE_POOL_MIN,
  WEIGHTS,
} from './constants.js'

import {
  analyzeQuestionHistory,
  getDynamicDifficultyTarget,
  computeRecentSessionAccuracy,
} from './scoring.js'

import {
  selectIntelligentMistakes,
  selectWithOfficialBalance,
  selectWithCoverage,
} from './balancers.js'

export async function selectAdaptiveQuestions(userId, count, options = {}) {
  await connectDB()

  const {
    topicFilters = null,
    mode = 'official',
    balanced = false,
    mistakeQuestionIds = null,
    excludeQuestionIds = [],
    onlyNewQuestions = false,
  } = options
  const objectId = new mongoose.Types.ObjectId(userId)
  const excludeSet = new Set(excludeQuestionIds.map((id) => id.toString()))

  // ── 1. Gather user context (parallel) ────────────────────────────────
  const now = Date.now()
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000)

  // If onlyNewQuestions is requested, we need ALL previously answered questions
  let allAnsweredIds = []
  if (onlyNewQuestions) {
    allAnsweredIds = await UserAnswer.distinct('questionId', { userId: objectId })
    allAnsweredIds.forEach((id) => excludeSet.add(id.toString()))
  }

  const [skillProfile, userDoc, recentAnswers, srsDueAnswers, recentSessions] = await Promise.all([
    getUserSkillProfile(userId),
    mongoose.models.User.findById(userId).select('stats').lean(),
    // Per-question answer history (last 30 days, newest first)
    UserAnswer.find({ userId: objectId, createdAt: { $gte: thirtyDaysAgo } })
      .select('questionId is_correct time_taken_seconds createdAt')
      .sort({ createdAt: -1 })
      .limit(3000)
      .lean(),
    // SRS due questions — fetch with nextReviewAt so we can compute overdue days
    UserAnswer.aggregate([
      { $match: { userId: objectId, 'srs.nextReviewAt': { $exists: true } } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$questionId',
          nextReviewAt: { $first: '$srs.nextReviewAt' },
        },
      },
    ]),
    // Anti-repetition + recent session accuracy
    ExamSession.find({ userId: objectId, status: { $in: ['completed', 'in_progress'] } })
      .sort({ createdAt: -1 })
      .limit(ANTI_REPETITION_SESSIONS)
      .select('questionIds score status')
      .lean(),
  ])

  // ── 2. Build lookup maps ─────────────────────────────────────────────

  // Per-question answer history map: questionId -> [answers newest first]
  const questionHistoryMap = new Map()
  for (const answer of recentAnswers) {
    const qId = answer.questionId.toString()
    if (!questionHistoryMap.has(qId)) questionHistoryMap.set(qId, [])
    questionHistoryMap.get(qId).push(answer)
  }

  // SRS due map: questionId -> overdueDays (for proportional boost)
  const srsDueMap = new Map()
  for (const a of srsDueAnswers) {
    const nextReview = a.nextReviewAt ? new Date(a.nextReviewAt) : null
    if (!nextReview) continue
    const overdueDays = Math.max(0, (now - nextReview.getTime()) / (1000 * 60 * 60 * 24))
    srsDueMap.set(a._id.toString(), overdueDays)
  }

  // Anti-repetition: questions seen in last N sessions, weighted by recency
  // Session 0 (most recent) = full penalty, session 6 = small penalty
  const recentlySeenMap = new Map() // questionId -> penaltyStrength [0, 1]
  recentSessions.forEach((session, sessionIndex) => {
    const recencyWeight = 1 - sessionIndex / ANTI_REPETITION_SESSIONS // 1.0 → 0.14
    for (const qId of session.questionIds || []) {
      const qStr = qId.toString()
      // Keep the highest (most recent) penalty per question
      const existing = recentlySeenMap.get(qStr) ?? 0
      if (recencyWeight > existing) recentlySeenMap.set(qStr, recencyWeight)
    }
  })

  // Topic-level accuracy from skill profile
  const topicAccuracy = {}
  for (const topic of skillProfile.topics) {
    topicAccuracy[topic.tag] = topic.accuracy / 100
  }

  // Historical topic distribution
  const userStats = userDoc?.stats || { totalAnswers: 0, correctAnswers: 0, topicStats: {} }
  const topicStatsMap =
    userStats.topicStats instanceof Map
      ? Object.fromEntries(userStats.topicStats)
      : userStats.topicStats || {}

  const totalHistoricalAnswers = Object.values(topicStatsMap).reduce(
    (sum, s) => sum + (s.attempted || 0),
    0
  )

  // Dynamic difficulty — prefer recent session accuracy over all-time
  const recentSessionAccuracy = computeRecentSessionAccuracy(recentSessions)
  const userDifficultyTarget = getDynamicDifficultyTarget(
    skillProfile,
    userStats,
    recentSessionAccuracy
  )

  // ── 3. Handle special modes that bypass scoring ──────────────────────
  if (mode === 'mistakes' && mistakeQuestionIds?.length > 0) {
    return selectIntelligentMistakes(mistakeQuestionIds, questionHistoryMap, count)
  }

  // ── 4. Build candidate pool ──────────────────────────────────────────
  const query = { isActive: true }

  // Apply exclude set to the DB query when it's small enough to be efficient
  if (excludeSet.size > 0 && excludeSet.size <= 500) {
    query._id = { $nin: Array.from(excludeSet).map((id) => new mongoose.Types.ObjectId(id)) }
  }

  if (topicFilters?.length > 0) {
    query['topic_tag.es'] = { $in: topicFilters }
  }

  const poolSize = Math.max(count * CANDIDATE_POOL_MULTIPLIER, CANDIDATE_POOL_MIN)

  const srsDueCandidatesQuery = {
    ...query,
    _id: {
      $in: Array.from(srsDueMap.keys()).map((id) => new mongoose.Types.ObjectId(id)),
    },
  }

  const [srsCandidates, randomCandidates] = await Promise.all([
    srsDueMap.size > 0
      ? Question.find(srsDueCandidatesQuery).select('_id topic_tag.es difficulty stats').lean()
      : Promise.resolve([]),
    Question.aggregate([
      { $match: query },
      { $sample: { size: poolSize } },
      { $project: { _id: 1, 'topic_tag.es': 1, difficulty: 1, stats: 1 } },
    ]),
  ])

  // Merge, deduplicate, and apply runtime excludeSet for large sets
  const candidateMap = new Map()
  for (const q of srsCandidates) {
    if (!excludeSet.has(q._id.toString())) candidateMap.set(q._id.toString(), q)
  }
  for (const q of randomCandidates) {
    if (!excludeSet.has(q._id.toString())) candidateMap.set(q._id.toString(), q)
  }

  const candidates = Array.from(candidateMap.values())

  if (candidates.length === 0) return []
  if (candidates.length <= count) {
    return candidates.map((q) => q._id).sort(() => Math.random() - 0.5)
  }

  // Identify never-seen questions for exploration guarantee
  const neverSeenIds = new Set(
    candidates.filter((q) => !questionHistoryMap.has(q._id.toString())).map((q) => q._id.toString())
  )

  // ── 5. Score every candidate ─────────────────────────────────────────
  const weights = WEIGHTS[mode] || WEIGHTS.default

  const scored = candidates.map((q) => {
    const topicTag = q.topic_tag?.es || ''
    const qDifficulty = DIFFICULTY_MAP[q.difficulty] || 2
    const qId = q._id.toString()

    // --- Weakness score (topic-level accuracy) ---
    const topicAcc = topicAccuracy[topicTag] ?? 0.5
    const weaknessScore = 1 - topicAcc

    // --- Freshness score ---
    const history = questionHistoryMap.get(qId)
    let freshnessScore = 1.0
    if (history && history.length > 0) {
      const lastSeenMs = history[0].createdAt.getTime()
      const daysSince = (now - lastSeenMs) / (1000 * 60 * 60 * 24)
      freshnessScore = Math.min(daysSince / 14, 1.0)
      freshnessScore *= Math.max(0.2, 1 - history.length * 0.1)
    }

    // --- Difficulty match score ---
    const diffDistance = Math.abs(qDifficulty - userDifficultyTarget) / 2
    const difficultyScore = 1 - diffDistance

    // --- Per-question history score ---
    let questionHistoryScore = 0.5
    const qAnalysis = history ? analyzeQuestionHistory(history) : null

    if (qAnalysis?.accuracy != null && qAnalysis?.total >= MIN_ANSWERS_FOR_QUESTION_ACCURACY) {
      questionHistoryScore = 1 - qAnalysis.accuracy
      if (qAnalysis.trend === 'declining')
        questionHistoryScore = Math.min(1, questionHistoryScore + 0.2)
      if (qAnalysis.trend === 'improving')
        questionHistoryScore = Math.max(0, questionHistoryScore - 0.1)
    } else if (!history || history.length === 0) {
      questionHistoryScore = 0.6 // Unseen questions get a moderate boost
    }

    // --- Confidence score ---
    let confidenceScore = 0.5
    if (qAnalysis?.confidence != null) {
      confidenceScore = 1 - qAnalysis.confidence
    }

    // --- Coverage score (under-practiced topics get a boost) ---
    let historicalCoverageScore = 0.5
    if (totalHistoricalAnswers > 0) {
      const topicAttempts = topicStatsMap[topicTag]?.attempted || 0
      const topicProportion = topicAttempts / totalHistoricalAnswers
      const idealProportion = 1 / Math.max(Object.keys(topicStatsMap).length, 1)
      historicalCoverageScore = Math.min(
        1,
        Math.max(0, 1 - topicProportion / Math.max(idealProportion * 2, 0.01))
      )
    }

    // --- Noise (prevents deterministic ordering) ---
    const noiseScore = Math.random()

    // --- SRS boost: proportional to how overdue (capped at +0.4) ---
    let srsDueBoost = 0
    if (srsDueMap.has(qId)) {
      const overdueDays = srsDueMap.get(qId)
      srsDueBoost = Math.min(0.4, 0.1 + overdueDays * 0.05)
    }

    // --- Anti-repetition penalty: scaled by recency ---
    const recentlySeenStrength = recentlySeenMap.get(qId) ?? 0
    const antiRepetitionPenalty = -(recentlySeenStrength * 0.35)

    // --- Global difficulty bonus (questions many users find hard deserve attention) ---
    let globalDifficultyBonus = 0
    if (q.stats?.timesAnswered > 10) {
      const globalAccuracy = q.stats.timesCorrect / q.stats.timesAnswered
      if (globalAccuracy < 0.5) globalDifficultyBonus = 0.05
    }

    const baseScore =
      weights.weakness * weaknessScore +
      weights.freshness * freshnessScore +
      weights.difficulty * difficultyScore +
      weights.coverage * historicalCoverageScore +
      weights.questionHistory * questionHistoryScore +
      weights.confidence * confidenceScore +
      weights.noise * noiseScore +
      srsDueBoost +
      antiRepetitionPenalty +
      globalDifficultyBonus

    return {
      questionId: q._id,
      topicTag,
      difficulty: q.difficulty,
      score: baseScore,
      neverSeen: neverSeenIds.has(qId),
    }
  })

  // ── 6. Select with balanced topic coverage ───────────────────────────
  if ((mode === 'official' && balanced) || mode === 'official') {
    return selectWithOfficialBalance(scored, candidates, count, weights)
  }

  return selectWithCoverage(scored, candidates, count, weights, mode)
}
