import mongoose from 'mongoose'
import connectDB from '@/lib/db'
import Question from '@/models/Question'
import UserAnswer from '@/models/UserAnswer'
import ExamSession from '@/models/ExamSession'
import { getUserSkillProfile } from '@/lib/user-skill'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const DIFFICULTY_MAP = { easy: 1, medium: 2, hard: 3 }
const SKILL_TO_DIFFICULTY = { beginner: 1, easy: 1.5, medium: 2, hard: 2.5, expert: 3 }

// How many recent sessions to check for anti-repetition
const ANTI_REPETITION_SESSIONS = 3

// Minimum answers on a question before we trust per-question accuracy
const MIN_ANSWERS_FOR_QUESTION_ACCURACY = 2

// Maximum candidate pool multiplier (e.g., count * 6 or 300, whichever is larger)
const CANDIDATE_POOL_MULTIPLIER = 6
const CANDIDATE_POOL_MIN = 300

// ---------------------------------------------------------------------------
// Mode-specific weight profiles
// ---------------------------------------------------------------------------
const WEIGHTS = {
  default: {
    weakness: 0.25,
    freshness: 0.2,
    difficulty: 0.15,
    coverage: 0.12,
    questionHistory: 0.15,
    confidence: 0.08,
    noise: 0.05,
  },
  official: {
    weakness: 0.2,
    freshness: 0.15,
    difficulty: 0.2,
    coverage: 0.2,
    questionHistory: 0.1,
    confidence: 0.1,
    noise: 0.05,
  },
  custom: {
    weakness: 0.3,
    freshness: 0.2,
    difficulty: 0.15,
    coverage: 0.1,
    questionHistory: 0.12,
    confidence: 0.08,
    noise: 0.05,
  },
  daily_challenge: {
    weakness: 0.35,
    freshness: 0.2,
    difficulty: 0.15,
    coverage: 0.1,
    questionHistory: 0.1,
    confidence: 0.05,
    noise: 0.05,
  },
  mistakes: {
    weakness: 0.15,
    freshness: 0.15,
    difficulty: 0.05,
    coverage: 0.05,
    questionHistory: 0.4,
    confidence: 0.1,
    noise: 0.1,
  },
  weak_topics: {
    weakness: 0.4,
    freshness: 0.15,
    difficulty: 0.1,
    coverage: 0.12,
    questionHistory: 0.13,
    confidence: 0.05,
    noise: 0.05,
  },
  bookmarks: {
    weakness: 0.15,
    freshness: 0.25,
    difficulty: 0.1,
    coverage: 0.1,
    questionHistory: 0.25,
    confidence: 0.1,
    noise: 0.05,
  },
  spaced_repetition: {
    weakness: 0.15,
    freshness: 0.3,
    difficulty: 0.1,
    coverage: 0.1,
    questionHistory: 0.2,
    confidence: 0.1,
    noise: 0.05,
  },
}

// ---------------------------------------------------------------------------
// Per-question performance analysis
// ---------------------------------------------------------------------------
function analyzeQuestionHistory(answers) {
  if (!answers || answers.length === 0) {
    return { accuracy: null, confidence: null, trend: 'unknown', mistakeRecency: null }
  }

  const total = answers.length
  const correct = answers.filter((a) => a.is_correct).length
  const accuracy = correct / total

  // Confidence: based on average time for correct answers
  const correctAnswers = answers.filter((a) => a.is_correct)
  const avgTime =
    correctAnswers.length > 0
      ? correctAnswers.reduce((sum, a) => sum + (a.time_taken_seconds || 30), 0) /
        correctAnswers.length
      : 30

  // Fast + correct = high confidence, slow + correct = low confidence
  let confidence = 0.5
  if (correctAnswers.length > 0) {
    if (avgTime <= 10) confidence = 1.0
    else if (avgTime <= 20) confidence = 0.8
    else if (avgTime <= 35) confidence = 0.6
    else confidence = 0.4
  }

  // Trend: are recent answers better or worse than older ones?
  let trend = 'stable'
  if (total >= 3) {
    const recentHalf = answers.slice(0, Math.ceil(total / 2))
    const olderHalf = answers.slice(Math.ceil(total / 2))
    const recentAcc = recentHalf.filter((a) => a.is_correct).length / recentHalf.length
    const olderAcc = olderHalf.filter((a) => a.is_correct).length / olderHalf.length
    if (recentAcc - olderAcc > 0.15) trend = 'improving'
    else if (olderAcc - recentAcc > 0.15) trend = 'declining'
  }

  // Most recent mistake timestamp (for mistakes mode prioritization)
  const lastMistake = answers.find((a) => !a.is_correct)
  const mistakeRecency = lastMistake ? lastMistake.createdAt : null

  // Was the mistake corrected since?
  const correctedSince =
    lastMistake && answers.length > 1
      ? answers.findIndex((a) => !a.is_correct) > 0 && answers[0].is_correct
      : false

  return { accuracy, confidence, trend, mistakeRecency, correctedSince, total }
}

// ---------------------------------------------------------------------------
// Calculate dynamic difficulty target based on user's improvement trend
// ---------------------------------------------------------------------------
function getDynamicDifficultyTarget(skillProfile, userStats) {
  const baseTarget = SKILL_TO_DIFFICULTY[skillProfile.overallLevel] || 2

  if (!userStats || userStats.totalAnswers < 30) return baseTarget

  const overallAccuracy = userStats.correctAnswers / userStats.totalAnswers

  // If accuracy is very high (>85%), nudge difficulty up
  if (overallAccuracy > 0.85 && baseTarget < 3) {
    return Math.min(3, baseTarget + 0.3)
  }

  // If accuracy is low (<55%), nudge difficulty down
  if (overallAccuracy < 0.55 && baseTarget > 1) {
    return Math.max(1, baseTarget - 0.3)
  }

  return baseTarget
}

// ---------------------------------------------------------------------------
// Main selection function
// ---------------------------------------------------------------------------
export async function selectAdaptiveQuestions(userId, count, options = {}) {
  await connectDB()

  const {
    topicFilters = null,
    mode = 'official',
    mistakeQuestionIds = null,
    excludeQuestionIds = [],
  } = options
  const objectId = new mongoose.Types.ObjectId(userId)
  const excludeSet = new Set(excludeQuestionIds.map((id) => id.toString()))

  // ── 1. Gather user context (parallel) ────────────────────────────────
  const now = Date.now()
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000)

  const [skillProfile, userDoc, recentAnswers, srsDueAnswers, recentSessions] = await Promise.all([
    getUserSkillProfile(userId),
    // Fetch user stats and topic stats for historical coverage
    mongoose.models.User.findById(userId).select('stats').lean(),
    // Per-question answer history (last 30 days, sorted newest first)
    UserAnswer.find({ userId: objectId, createdAt: { $gte: thirtyDaysAgo } })
      .select('questionId is_correct time_taken_seconds createdAt')
      .sort({ createdAt: -1 })
      .limit(3000)
      .lean(),
    // SRS due questions
    UserAnswer.aggregate([
      { $match: { userId: objectId, 'srs.nextReviewAt': { $lte: new Date(now) } } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: '$questionId' } },
    ]),
    // Anti-repetition: get question IDs from last N sessions
    ExamSession.find({ userId: objectId, status: { $in: ['completed', 'in_progress'] } })
      .sort({ createdAt: -1 })
      .limit(ANTI_REPETITION_SESSIONS)
      .select('questionIds')
      .lean(),
  ])

  // ── 2. Build lookup maps ─────────────────────────────────────────────

  // Per-question answer history map: questionId -> [answers sorted newest first]
  const questionHistoryMap = new Map()
  for (const answer of recentAnswers) {
    const qId = answer.questionId.toString()
    if (!questionHistoryMap.has(qId)) {
      questionHistoryMap.set(qId, [])
    }
    questionHistoryMap.get(qId).push(answer)
  }

  // SRS due set
  const srsDueIds = new Set(srsDueAnswers.map((a) => a._id.toString()))

  // Anti-repetition set: questions seen in last N sessions
  const recentlySeenIds = new Set()
  for (const session of recentSessions) {
    for (const qId of session.questionIds || []) {
      recentlySeenIds.add(qId.toString())
    }
  }

  // Topic-level accuracy from skill profile
  const topicAccuracy = {}
  for (const topic of skillProfile.topics) {
    topicAccuracy[topic.tag] = topic.accuracy / 100
  }

  // Historical topic distribution from user stats
  const userStats = userDoc?.stats || { totalAnswers: 0, correctAnswers: 0, topicStats: {} }
  const topicStatsMap =
    userStats.topicStats instanceof Map
      ? Object.fromEntries(userStats.topicStats)
      : userStats.topicStats || {}

  const totalHistoricalAnswers = Object.values(topicStatsMap).reduce(
    (sum, s) => sum + (s.attempted || 0),
    0
  )

  // Dynamic difficulty target
  const userDifficultyTarget = getDynamicDifficultyTarget(skillProfile, userStats)

  // ── 3. Handle special modes that bypass scoring ──────────────────────

  // Mistakes mode with intelligent prioritization
  if (mode === 'mistakes' && mistakeQuestionIds?.length > 0) {
    return selectIntelligentMistakes(mistakeQuestionIds, questionHistoryMap, count)
  }

  // ── 4. Build candidate pool ──────────────────────────────────────────
  const query = { isActive: true }
  if (topicFilters?.length > 0) {
    query['topic_tag.es'] = { $in: topicFilters }
  }

  const poolSize = Math.max(count * CANDIDATE_POOL_MULTIPLIER, CANDIDATE_POOL_MIN)

  const srsDueCandidatesQuery = {
    ...query,
    _id: { $in: Array.from(srsDueIds).map((id) => new mongoose.Types.ObjectId(id)) },
  }

  const [srsCandidates, randomCandidates] = await Promise.all([
    Question.find(srsDueCandidatesQuery).select('_id topic_tag.es difficulty stats').lean(),
    Question.aggregate([
      { $match: query },
      { $sample: { size: poolSize } },
      { $project: { _id: 1, 'topic_tag.es': 1, difficulty: 1, stats: 1 } },
    ]),
  ])

  // Merge and deduplicate
  const candidateMap = new Map()
  for (const q of srsCandidates) candidateMap.set(q._id.toString(), q)
  for (const q of randomCandidates) candidateMap.set(q._id.toString(), q)

  const candidates = Array.from(candidateMap.values())

  if (candidates.length === 0) return []
  if (candidates.length <= count) {
    return candidates.map((q) => q._id).sort(() => Math.random() - 0.5)
  }

  // ── 5. Score every candidate ─────────────────────────────────────────
  const weights = WEIGHTS[mode] || WEIGHTS.default

  const scored = candidates.map((q) => {
    const topicTag = q.topic_tag?.es || ''
    const qDifficulty = DIFFICULTY_MAP[q.difficulty] || 2
    const qId = q._id.toString()

    // --- Weakness score (topic-level) ---
    const topicAcc = topicAccuracy[topicTag] ?? 0.5
    const weaknessScore = 1 - topicAcc

    // --- Freshness score (recency + repetition penalty) ---
    const history = questionHistoryMap.get(qId)
    let freshnessScore = 1.0
    if (history && history.length > 0) {
      const lastSeenMs = history[0].createdAt.getTime()
      const daysSince = (now - lastSeenMs) / (1000 * 60 * 60 * 24)
      freshnessScore = Math.min(daysSince / 14, 1.0) // Longer decay window (14 days vs 7)
      freshnessScore *= Math.max(0.2, 1 - history.length * 0.1) // Diminishing returns
    }

    // --- Difficulty match score ---
    const diffDistance = Math.abs(qDifficulty - userDifficultyTarget) / 2
    const difficultyScore = 1 - diffDistance

    // --- Per-question history score ---
    let questionHistoryScore = 0.5 // Neutral for unseen questions
    const qAnalysis = history ? analyzeQuestionHistory(history) : null

    if (
      qAnalysis &&
      qAnalysis.accuracy !== null &&
      qAnalysis.total >= MIN_ANSWERS_FOR_QUESTION_ACCURACY
    ) {
      // Low personal accuracy = high priority to practice
      questionHistoryScore = 1 - qAnalysis.accuracy

      // Boost questions with declining trend (getting worse at them)
      if (qAnalysis.trend === 'declining')
        questionHistoryScore = Math.min(1, questionHistoryScore + 0.2)
      // Deprioritize questions with improving trend (already learning them)
      if (qAnalysis.trend === 'improving')
        questionHistoryScore = Math.max(0, questionHistoryScore - 0.1)
    } else if (!history || history.length === 0) {
      // Never-seen questions get a moderate boost to ensure discovery
      questionHistoryScore = 0.6
    }

    // --- Confidence score (prioritize low-confidence questions) ---
    let confidenceScore = 0.5
    if (qAnalysis && qAnalysis.confidence !== null) {
      // Low confidence = priority (user is unsure about this question)
      confidenceScore = 1 - qAnalysis.confidence
    }

    // --- Coverage score (historical topic distribution) ---
    let historicalCoverageScore = 0.5
    if (totalHistoricalAnswers > 0) {
      const topicAttempts = topicStatsMap[topicTag]?.attempted || 0
      const topicProportion = topicAttempts / totalHistoricalAnswers
      const idealProportion = 1 / Math.max(Object.keys(topicStatsMap).length, 1)
      // Under-practiced topics get a boost
      historicalCoverageScore = Math.min(
        1,
        Math.max(0, 1 - topicProportion / Math.max(idealProportion * 2, 0.01))
      )
    }

    // --- Noise ---
    const noiseScore = Math.random()

    // --- Bonuses and penalties ---
    const srsDueBoost = srsDueIds.has(qId) ? 0.25 : 0
    const antiRepetitionPenalty = recentlySeenIds.has(qId) ? -0.35 : 0

    // --- Global question difficulty (how hard is it for everyone?) ---
    // Questions with low global accuracy are inherently harder — factor this in
    let globalDifficultyBonus = 0
    if (q.stats?.timesAnswered > 10) {
      const globalAccuracy = q.stats.timesCorrect / q.stats.timesAnswered
      // Slightly boost questions that many people get wrong (they're tricky)
      if (globalAccuracy < 0.5) globalDifficultyBonus = 0.05
    }

    // --- Weighted composite score ---
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

    return { questionId: q._id, topicTag, score: baseScore }
  })

  // ── 6. Select with balanced topic coverage ───────────────────────────
  return selectWithCoverage(scored, candidates, count, weights, mode)
}

// ---------------------------------------------------------------------------
// Intelligent mistakes selection
// ---------------------------------------------------------------------------
function selectIntelligentMistakes(mistakeQuestionIds, questionHistoryMap, count) {
  const now = Date.now()

  const scored = mistakeQuestionIds.map((qId) => {
    const qIdStr = qId.toString()
    const history = questionHistoryMap.get(qIdStr)
    const analysis = history ? analyzeQuestionHistory(history) : null

    let score = 0.5

    if (analysis) {
      // More mistakes = higher priority
      const mistakeCount = history.filter((a) => !a.is_correct).length
      score += Math.min(0.3, mistakeCount * 0.1)

      // Recent mistakes = higher priority
      if (analysis.mistakeRecency) {
        const daysSinceMistake = (now - analysis.mistakeRecency.getTime()) / (1000 * 60 * 60 * 24)
        score += Math.max(0, 0.2 - daysSinceMistake * 0.01)
      }

      // Not yet corrected = higher priority
      if (!analysis.correctedSince) {
        score += 0.15
      }

      // Declining trend = urgent
      if (analysis.trend === 'declining') {
        score += 0.1
      }
    } else {
      // No history at all — still include with moderate priority
      score = 0.4
    }

    // Small amount of noise for variety
    score += Math.random() * 0.1

    return { questionId: qId, score }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, count).map((s) => s.questionId)
}

// ---------------------------------------------------------------------------
// Topic coverage balancer
// ---------------------------------------------------------------------------
function selectWithCoverage(scored, candidates, count, weights, mode) {
  scored.sort((a, b) => b.score - a.score)

  const selected = []
  const topicCounts = {}
  const selectedIds = new Set()

  const allTopics = [...new Set(candidates.map((q) => q.topic_tag?.es).filter(Boolean))]
  const targetPerTopic = Math.max(1, Math.floor(count / Math.max(allTopics.length, 1)))

  // Phase 1: Guarantee at least 1 question per topic (for balanced exams)
  if (allTopics.length <= count && mode !== 'mistakes') {
    for (const topic of allTopics) {
      const bestForTopic = scored.find(
        (s) => s.topicTag === topic && !selectedIds.has(s.questionId.toString())
      )
      if (bestForTopic) {
        selected.push(bestForTopic.questionId)
        selectedIds.add(bestForTopic.questionId.toString())
        topicCounts[topic] = (topicCounts[topic] || 0) + 1
      }
    }
  }

  // Phase 2: Fill remaining slots with highest-scoring questions + coverage bonus
  for (const item of scored) {
    if (selected.length >= count) break
    if (selectedIds.has(item.questionId.toString())) continue

    const topicCount = topicCounts[item.topicTag] || 0
    const coverageBonus = topicCount < targetPerTopic ? weights.coverage : 0
    item.adjustedScore = item.score + coverageBonus

    selected.push(item.questionId)
    selectedIds.add(item.questionId.toString())
    topicCounts[item.topicTag] = topicCount + 1
  }

  // Shuffle final selection so question order is unpredictable
  return selected.sort(() => Math.random() - 0.5)
}
