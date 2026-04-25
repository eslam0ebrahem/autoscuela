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

const toObjectId = (id) => new mongoose.Types.ObjectId(id)
const clamp = (n, min, max) => Math.max(min, Math.min(max, n))

function normalizeOptions(options = {}) {
  return {
    topicFilters: Array.isArray(options.topicFilters) ? options.topicFilters.filter(Boolean) : [],
    mode: options.mode || 'official',
    balanced: Boolean(options.balanced),
    mistakeQuestionIds: Array.isArray(options.mistakeQuestionIds) ? options.mistakeQuestionIds : [],
    excludeQuestionIds: Array.isArray(options.excludeQuestionIds) ? options.excludeQuestionIds : [],
    onlyNewQuestions: Boolean(options.onlyNewQuestions),
  }
}

function buildExcludeSet(ids = []) {
  return new Set(ids.map((id) => String(id)))
}

function buildQuestionHistoryMap(recentAnswers = []) {
  const map = new Map()
  for (const answer of recentAnswers) {
    const qId = String(answer.questionId)
    if (!map.has(qId)) map.set(qId, [])
    map.get(qId).push(answer)
  }
  return map
}

function buildSrsDueMap(srsDueAnswers = [], nowMs = Date.now()) {
  const map = new Map()
  for (const item of srsDueAnswers) {
    const nextReview = item?.nextReviewAt ? new Date(item.nextReviewAt) : null
    if (!nextReview) continue
    const overdueDays = Math.max(0, (nowMs - nextReview.getTime()) / (1000 * 60 * 60 * 24))
    map.set(String(item._id), overdueDays)
  }
  return map
}

function buildRecentlySeenMap(recentSessions = []) {
  const map = new Map()
  recentSessions.forEach((session, index) => {
    const recencyWeight = 1 - index / ANTI_REPETITION_SESSIONS
    for (const qId of session.questionIds || []) {
      const key = String(qId)
      const existing = map.get(key) ?? 0
      if (recencyWeight > existing) map.set(key, recencyWeight)
    }
  })
  return map
}

function buildTopicAccuracyMap(skillProfile) {
  const topicAccuracy = {}
  for (const topic of skillProfile?.topics || []) {
    topicAccuracy[topic.tag] = (topic.accuracy || 0) / 100
  }
  return topicAccuracy
}

function getTopicStatsMap(userDoc) {
  const userStats = userDoc?.stats || { totalAnswers: 0, correctAnswers: 0, topicStats: {} }
  const topicStatsMap =
    userStats.topicStats instanceof Map
      ? Object.fromEntries(userStats.topicStats)
      : userStats.topicStats || {}

  const totalHistoricalAnswers = Object.values(topicStatsMap).reduce(
    (sum, s) => sum + (s?.attempted || 0),
    0
  )

  return { userStats, topicStatsMap, totalHistoricalAnswers }
}

async function loadUserContext(userId, objectId, onlyNewQuestions, excludeSet) {
  const now = Date.now()
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000)

  if (onlyNewQuestions) {
    const answeredIds = await UserAnswer.distinct('questionId', { userId: objectId })
    answeredIds.forEach((id) => excludeSet.add(String(id)))
  }

  const [skillProfile, userDoc, recentAnswers, srsDueAnswers, recentSessions] = await Promise.all([
    getUserSkillProfile(userId),
    mongoose.models.User.findById(userId).select('stats').lean(),
    UserAnswer.find({ userId: objectId, createdAt: { $gte: thirtyDaysAgo } })
      .select('questionId is_correct time_taken_seconds createdAt')
      .sort({ createdAt: -1 })
      .limit(3000)
      .lean(),
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
    ExamSession.find({ userId: objectId, status: { $in: ['completed', 'in_progress'] } })
      .sort({ createdAt: -1 })
      .limit(ANTI_REPETITION_SESSIONS)
      .select('questionIds score status createdAt')
      .lean(),
  ])

  return {
    now,
    skillProfile: skillProfile || { topics: [], overallAccuracy: 0 },
    userDoc,
    recentAnswers,
    srsDueAnswers,
    recentSessions,
  }
}

function buildBaseQuestionQuery({ topicFilters, excludeSet }) {
  const query = { isActive: true }

  if (topicFilters.length > 0) {
    query['topic_tag.es'] = { $in: topicFilters }
  }

  if (excludeSet.size > 0 && excludeSet.size <= 500) {
    query._id = { $nin: Array.from(excludeSet).map(toObjectId) }
  }

  return query
}

function buildSrsQuery(baseQuery, srsDueMap, excludeSet) {
  const srsIds = Array.from(srsDueMap.keys())
  if (srsIds.length === 0) return null

  const query = {
    ...baseQuery,
    _id: {
      ...(baseQuery._id || {}),
      $in: srsIds.map(toObjectId),
    },
  }

  if (excludeSet.size > 0 && !query._id.$nin && excludeSet.size <= 500) {
    query._id.$nin = Array.from(excludeSet).map(toObjectId)
  }

  return query
}

function calculateHistoricalCoverageScore(topicTag, topicStatsMap, totalHistoricalAnswers) {
  if (!totalHistoricalAnswers) return 0.5
  const topicAttempts = topicStatsMap[topicTag]?.attempted || 0
  const topicProportion = topicAttempts / totalHistoricalAnswers
  const topicCount = Math.max(Object.keys(topicStatsMap).length, 1)
  const idealProportion = 1 / topicCount
  return clamp(1 - topicProportion / Math.max(idealProportion * 2, 0.01), 0, 1)
}

function scoreCandidate({
  q,
  now,
  userDifficultyTarget,
  questionHistoryMap,
  topicAccuracy,
  topicStatsMap,
  totalHistoricalAnswers,
  srsDueMap,
  recentlySeenMap,
  neverSeenIds,
  weights,
}) {
  const qId = String(q._id)
  const topicTag = q.topic_tag?.es || ''
  const qDifficulty = DIFFICULTY_MAP[q.difficulty] || 2

  const topicAcc = topicAccuracy[topicTag] ?? 0.5
  const weaknessScore = 1 - topicAcc

  const history = questionHistoryMap.get(qId)
  let freshnessScore = 1
  if (history?.length) {
    const lastSeenMs = new Date(history[0].createdAt).getTime()
    const daysSince = (now - lastSeenMs) / (1000 * 60 * 60 * 24)
    freshnessScore = Math.min(daysSince / 14, 1)
    freshnessScore *= Math.max(0.2, 1 - history.length * 0.1)
  }

  const diffDistance = Math.abs(qDifficulty - userDifficultyTarget) / 2
  const difficultyScore = 1 - diffDistance

  let questionHistoryScore = 0.5
  let confidenceScore = 0.5

  const qAnalysis = history ? analyzeQuestionHistory(history) : null
  if (qAnalysis?.accuracy != null && qAnalysis?.total >= MIN_ANSWERS_FOR_QUESTION_ACCURACY) {
    questionHistoryScore = 1 - qAnalysis.accuracy
    if (qAnalysis.trend === 'declining') questionHistoryScore = Math.min(1, questionHistoryScore + 0.2)
    if (qAnalysis.trend === 'improving') questionHistoryScore = Math.max(0, questionHistoryScore - 0.1)
  } else if (!history?.length) {
    questionHistoryScore = 0.6
  }

  if (qAnalysis?.confidence != null) {
    confidenceScore = 1 - qAnalysis.confidence
  }

  const historicalCoverageScore = calculateHistoricalCoverageScore(
    topicTag,
    topicStatsMap,
    totalHistoricalAnswers
  )

  let srsDueBoost = 0
  if (srsDueMap.has(qId)) {
    const overdueDays = srsDueMap.get(qId)
    srsDueBoost = Math.min(0.4, 0.1 + overdueDays * 0.05)
  }

  const recentlySeenStrength = recentlySeenMap.get(qId) ?? 0
  const antiRepetitionPenalty = -(recentlySeenStrength * 0.35)

  let globalDifficultyBonus = 0
  if ((q.stats?.timesAnswered || 0) > 10) {
    const globalAccuracy = q.stats.timesCorrect / q.stats.timesAnswered
    if (globalAccuracy < 0.5) globalDifficultyBonus = 0.05
  }

  const noiseScore = Math.random() * (weights.noise ?? 0.03)

  const score =
    weights.weakness * weaknessScore +
    weights.freshness * freshnessScore +
    weights.difficulty * difficultyScore +
    weights.coverage * historicalCoverageScore +
    weights.questionHistory * questionHistoryScore +
    weights.confidence * confidenceScore +
    noiseScore +
    srsDueBoost +
    antiRepetitionPenalty +
    globalDifficultyBonus

  return {
    questionId: q._id,
    topicTag,
    difficulty: q.difficulty,
    score,
    neverSeen: neverSeenIds.has(qId),
    signals: {
      weaknessScore,
      freshnessScore,
      difficultyScore,
      questionHistoryScore,
      confidenceScore,
      historicalCoverageScore,
      srsDueBoost,
      antiRepetitionPenalty,
      globalDifficultyBonus,
    },
  }
}

function shuffleIds(ids = []) {
  return ids
    .map((id) => ({ id, r: Math.random() }))
    .sort((a, b) => a.r - b.r)
    .map((x) => x.id)
}

export async function selectAdaptiveQuestions(userId, count, options = {}) {
  await connectDB()

  if (!userId) throw new Error('userId is required')
  const normalizedCount = clamp(Number(count) || 0, 1, 100)

  const {
    topicFilters,
    mode,
    balanced,
    mistakeQuestionIds,
    excludeQuestionIds,
    onlyNewQuestions,
  } = normalizeOptions(options)

  const objectId = toObjectId(userId)
  const excludeSet = buildExcludeSet(excludeQuestionIds)

  const {
    now,
    skillProfile,
    userDoc,
    recentAnswers,
    srsDueAnswers,
    recentSessions,
  } = await loadUserContext(userId, objectId, onlyNewQuestions, excludeSet)

  const questionHistoryMap = buildQuestionHistoryMap(recentAnswers)
  const srsDueMap = buildSrsDueMap(srsDueAnswers, now)
  const recentlySeenMap = buildRecentlySeenMap(recentSessions)
  const topicAccuracy = buildTopicAccuracyMap(skillProfile)
  const { userStats, topicStatsMap, totalHistoricalAnswers } = getTopicStatsMap(userDoc)

  const recentSessionAccuracy = computeRecentSessionAccuracy(recentSessions)
  const userDifficultyTarget = getDynamicDifficultyTarget(
    skillProfile,
    userStats,
    recentSessionAccuracy
  )

  if (mode === 'mistakes' && mistakeQuestionIds.length > 0) {
    return selectIntelligentMistakes(mistakeQuestionIds, questionHistoryMap, normalizedCount)
  }

  const baseQuery = buildBaseQuestionQuery({ topicFilters, excludeSet })
  const poolSize = Math.max(normalizedCount * CANDIDATE_POOL_MULTIPLIER, CANDIDATE_POOL_MIN)
  const srsQuery = buildSrsQuery(baseQuery, srsDueMap, excludeSet)

  const [srsCandidates, randomCandidates] = await Promise.all([
    srsQuery
      ? Question.find(srsQuery).select('_id topic_tag.es difficulty stats').lean()
      : Promise.resolve([]),
    Question.aggregate([
      { $match: baseQuery },
      { $sample: { size: poolSize } },
      { $project: { _id: 1, 'topic_tag.es': 1, difficulty: 1, stats: 1 } },
    ]),
  ])

  const candidateMap = new Map()
  for (const q of srsCandidates) {
    if (!excludeSet.has(String(q._id))) candidateMap.set(String(q._id), q)
  }
  for (const q of randomCandidates) {
    if (!excludeSet.has(String(q._id))) candidateMap.set(String(q._id), q)
  }

  const candidates = Array.from(candidateMap.values())
  if (candidates.length === 0) return []
  if (candidates.length <= normalizedCount) {
    return shuffleIds(candidates.map((q) => q._id))
  }

  const neverSeenIds = new Set(
    candidates
      .filter((q) => !questionHistoryMap.has(String(q._id)))
      .map((q) => String(q._id))
  )

  const weights = WEIGHTS[mode] || WEIGHTS.default
  const scored = candidates.map((q) =>
    scoreCandidate({
      q,
      now,
      userDifficultyTarget,
      questionHistoryMap,
      topicAccuracy,
      topicStatsMap,
      totalHistoricalAnswers,
      srsDueMap,
      recentlySeenMap,
      neverSeenIds,
      weights,
    })
  )

  if (mode === 'official') {
    return selectWithOfficialBalance(scored, candidates, normalizedCount, weights)
  }

  if (balanced) {
    return selectWithCoverage(scored, candidates, normalizedCount, weights, mode)
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, normalizedCount)
    .map((x) => x.questionId)
}