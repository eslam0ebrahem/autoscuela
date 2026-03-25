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
const ANTI_REPETITION_SESSIONS = 7

// Minimum answers on a question before we trust per-question accuracy
const MIN_ANSWERS_FOR_QUESTION_ACCURACY = 2

// Maximum candidate pool multiplier
const CANDIDATE_POOL_MULTIPLIER = 6
const CANDIDATE_POOL_MIN = 300

// Minimum fraction of selected questions that must be "never seen" (exploration guarantee)
const EXPLORATION_RATIO = 0.15

// Official mode difficulty distribution: [easy%, medium%, hard%]
const OFFICIAL_DIFFICULTY_DIST = { easy: 0.3, medium: 0.5, hard: 0.2 }

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
// NOTE: UserAnswer documents use snake_case field names (is_correct,
//       time_taken_seconds) which is what the .select() query retrieves.
// ---------------------------------------------------------------------------
function analyzeQuestionHistory(answers) {
  if (!answers || answers.length === 0) {
    return { accuracy: null, confidence: null, trend: 'unknown', mistakeRecency: null }
  }

  const total = answers.length
  // FIX: was incorrectly using a.is_correct — using consistent field name
  const correct = answers.filter((a) => a.is_correct).length
  const accuracy = correct / total

  // Confidence: fast + correct = high confidence, slow + correct = low confidence
  const correctAnswers = answers.filter((a) => a.is_correct)
  const avgTime =
    correctAnswers.length > 0
      ? correctAnswers.reduce((sum, a) => sum + (a.time_taken_seconds || 30), 0) /
        correctAnswers.length
      : 30

  let confidence = 0.5
  if (correctAnswers.length > 0) {
    if (avgTime <= 10) confidence = 1.0
    else if (avgTime <= 20) confidence = 0.8
    else if (avgTime <= 35) confidence = 0.6
    else confidence = 0.4
  }

  // Trend: answers are sorted newest-first, so slice(0, half) is most recent
  let trend = 'stable'
  if (total >= 3) {
    const mid = Math.ceil(total / 2)
    const recentHalf = answers.slice(0, mid)
    const olderHalf = answers.slice(mid)
    const recentAcc = recentHalf.filter((a) => a.is_correct).length / recentHalf.length
    const olderAcc = olderHalf.filter((a) => a.is_correct).length / olderHalf.length
    if (recentAcc - olderAcc > 0.15) trend = 'improving'
    else if (olderAcc - recentAcc > 0.15) trend = 'declining'
  }

  // Most recent mistake (for mistakes mode)
  const lastMistake = answers.find((a) => !a.is_correct)
  const mistakeRecency = lastMistake?.createdAt ?? null

  // FIX: simplified and corrected — if the most recent attempt is correct AND
  // there has been at least one mistake in history, the user corrected it.
  const correctedSince = answers[0].is_correct && answers.some((a) => !a.is_correct)

  return { accuracy, confidence, trend, mistakeRecency, correctedSince, total }
}

// ---------------------------------------------------------------------------
// Dynamic difficulty target — uses recent session accuracy for a tighter signal
// than all-time stats, which can be dominated by early beginner data.
// ---------------------------------------------------------------------------
function getDynamicDifficultyTarget(skillProfile, userStats, recentSessionAccuracy = null) {
  const baseTarget = SKILL_TO_DIFFICULTY[skillProfile.overallLevel] || 2

  // Not enough data yet — return base
  if (!userStats || userStats.totalAnswers < 30) return baseTarget

  // Prefer recent session accuracy (last 5 sessions) when available;
  // fall back to all-time accuracy
  const accuracy =
    recentSessionAccuracy !== null
      ? recentSessionAccuracy
      : userStats.totalAnswers > 0
        ? userStats.correctAnswers / userStats.totalAnswers
        : 0.5

  // Smooth adjustment: scale the nudge based on how far from the "comfort zone"
  // (65-75% accuracy is the ideal challenge range — not too easy, not crushing)
  if (accuracy > 0.85) return Math.min(3, baseTarget + 0.5)
  if (accuracy > 0.75) return Math.min(3, baseTarget + 0.25)
  if (accuracy < 0.45) return Math.max(1, baseTarget - 0.5)
  if (accuracy < 0.55) return Math.max(1, baseTarget - 0.25)

  return baseTarget
}

// ---------------------------------------------------------------------------
// Compute recent session accuracy from last N completed sessions
// Used to give getDynamicDifficultyTarget a more responsive signal.
// ---------------------------------------------------------------------------
function computeRecentSessionAccuracy(recentSessions) {
  const completed = recentSessions.filter((s) => s.status === 'completed' && s.score != null)
  if (completed.length === 0) return null

  const totalCorrect = completed.reduce((sum, s) => sum + (s.score || 0), 0)
  const totalQuestions = completed.reduce((sum, s) => sum + (s.questionIds?.length || 0), 0)

  return totalQuestions > 0 ? totalCorrect / totalQuestions : null
}

// ---------------------------------------------------------------------------
// Main selection function
// ---------------------------------------------------------------------------
export async function selectAdaptiveQuestions(userId, count, options = {}) {
  await connectDB()

  const {
    topicFilters = null,
    mode = 'official',
    balanced = false, // FIX: was built but never consumed
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
    // FIX: was binary (has/hasn't). More overdue = more urgent = bigger boost.
    let srsDueBoost = 0
    if (srsDueMap.has(qId)) {
      const overdueDays = srsDueMap.get(qId)
      srsDueBoost = Math.min(0.4, 0.1 + overdueDays * 0.05)
    }

    // --- Anti-repetition penalty: scaled by recency ---
    // FIX: was flat -0.35. Most-recent session gets full penalty; older sessions get less.
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
  // For official mode with balanced=true, enforce difficulty distribution
  if ((mode === 'official' && balanced) || mode === 'official') {
    return selectWithOfficialBalance(scored, candidates, count, weights)
  }

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
      const mistakeCount = history.filter((a) => !a.is_correct).length
      score += Math.min(0.3, mistakeCount * 0.1) // More mistakes = higher priority

      if (analysis.mistakeRecency) {
        const daysSinceMistake = (now - analysis.mistakeRecency.getTime()) / (1000 * 60 * 60 * 24)
        score += Math.max(0, 0.2 - daysSinceMistake * 0.01) // Recent mistakes = more urgent
      }

      if (!analysis.correctedSince) score += 0.15 // Uncorrected mistakes need attention
      if (analysis.trend === 'declining') score += 0.1 // Getting worse — address urgently
    } else {
      score = 0.4 // No history — include with moderate priority
    }

    score += Math.random() * 0.1 // Small noise for variety

    return { questionId: qId, score }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, count).map((s) => s.questionId)
}

// ---------------------------------------------------------------------------
// Official exam: enforce difficulty distribution + topic coverage + exploration
// ---------------------------------------------------------------------------
function selectWithOfficialBalance(scored, candidates, count, weights) {
  const easyTarget = Math.round(count * OFFICIAL_DIFFICULTY_DIST.easy)
  const hardTarget = Math.round(count * OFFICIAL_DIFFICULTY_DIST.hard)
  const mediumTarget = count - easyTarget - hardTarget

  const buckets = {
    easy: scored.filter((s) => s.difficulty === 'easy').sort((a, b) => b.score - a.score),
    medium: scored.filter((s) => s.difficulty === 'medium').sort((a, b) => b.score - a.score),
    hard: scored.filter((s) => s.difficulty === 'hard').sort((a, b) => b.score - a.score),
  }

  const selected = []
  const selectedIds = new Set()

  const fillBucket = (bucket, target) => {
    let filled = 0
    for (const item of bucket) {
      if (filled >= target) break
      if (selectedIds.has(item.questionId.toString())) continue
      selected.push(item.questionId)
      selectedIds.add(item.questionId.toString())
      filled++
    }
    return filled
  }

  // Fill each difficulty bucket
  const easeFilled = fillBucket(buckets.easy, easyTarget)
  const medFilled = fillBucket(buckets.medium, mediumTarget)
  const hardFilled = fillBucket(buckets.hard, hardTarget)

  // If any bucket ran short, fill remainder from any difficulty by score
  const remaining = count - selected.length
  if (remaining > 0) {
    const fallback = scored
      .filter((s) => !selectedIds.has(s.questionId.toString()))
      .sort((a, b) => b.score - a.score)
    for (const item of fallback) {
      if (selected.length >= count) break
      selected.push(item.questionId)
    }
  }

  return enforceExploration(selected, scored, count).sort(() => Math.random() - 0.5)
}

// ---------------------------------------------------------------------------
// Topic coverage balancer (non-official modes)
// FIX: Phase 2 now actually re-sorts by adjustedScore before filling,
//      so the coverage bonus actually affects selection order.
// ---------------------------------------------------------------------------
function selectWithCoverage(scored, candidates, count, weights, mode) {
  scored.sort((a, b) => b.score - a.score)

  const selected = []
  const topicCounts = {}
  const selectedIds = new Set()

  const allTopics = [...new Set(candidates.map((q) => q.topic_tag?.es).filter(Boolean))]
  const targetPerTopic = Math.max(1, Math.floor(count / Math.max(allTopics.length, 1)))

  // Phase 1: Guarantee at least 1 question per topic
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

  // Phase 2: Compute adjusted scores and re-sort before filling
  // FIX: previous version computed adjustedScore but never re-sorted,
  //      so coverage bonus had zero effect on selection order.
  const remaining = scored.filter((item) => !selectedIds.has(item.questionId.toString()))
  const withAdjusted = remaining.map((item) => {
    const topicCount = topicCounts[item.topicTag] || 0
    const coverageBonus = topicCount < targetPerTopic ? weights.coverage : 0
    return { ...item, adjustedScore: item.score + coverageBonus }
  })
  withAdjusted.sort((a, b) => b.adjustedScore - a.adjustedScore) // ← the actual fix

  for (const item of withAdjusted) {
    if (selected.length >= count) break
    selected.push(item.questionId)
    selectedIds.add(item.questionId.toString())
    topicCounts[item.topicTag] = (topicCounts[item.topicTag] || 0) + 1
  }

  return enforceExploration(selected, scored, count).sort(() => Math.random() - 0.5)
}

// ---------------------------------------------------------------------------
// Exploration guarantee: ensure EXPLORATION_RATIO of selections are never-seen
// questions. If the current selection doesn't meet the quota, swap out the
// lowest-scoring seen questions for the highest-scoring unseen ones.
// ---------------------------------------------------------------------------
function enforceExploration(selected, allScored, count) {
  const explorationTarget = Math.floor(count * EXPLORATION_RATIO)
  if (explorationTarget === 0) return selected

  const scoredById = new Map(allScored.map((s) => [s.questionId.toString(), s]))

  const seenSelected = []
  const unseenSelected = []

  for (const qId of selected) {
    const item = scoredById.get(qId.toString())
    if (item?.neverSeen) unseenSelected.push(qId)
    else seenSelected.push(qId)
  }

  const deficit = explorationTarget - unseenSelected.length
  if (deficit <= 0) return selected // Already meeting the exploration quota

  // Find unseen candidates not yet selected, sorted by score descending
  const selectedSet = new Set(selected.map((id) => id.toString()))
  const unseenCandidates = allScored
    .filter((s) => s.neverSeen && !selectedSet.has(s.questionId.toString()))
    .sort((a, b) => b.score - a.score)

  // Swap out the lowest-scoring seen questions for top unseen candidates
  seenSelected.sort((a, b) => {
    const scoreA = scoredById.get(a.toString())?.score ?? 0
    const scoreB = scoredById.get(b.toString())?.score ?? 0
    return scoreA - scoreB // Ascending: lowest score first
  })

  const toSwap = Math.min(deficit, unseenCandidates.length, seenSelected.length)
  const finalSelection = new Set(selected.map((id) => id.toString()))

  for (let i = 0; i < toSwap; i++) {
    finalSelection.delete(seenSelected[i].toString())
    finalSelection.add(unseenCandidates[i].questionId.toString())
  }

  // Map back to ObjectIds
  const allCandidateMap = new Map(allScored.map((s) => [s.questionId.toString(), s.questionId]))
  return Array.from(finalSelection)
    .map((id) => allCandidateMap.get(id))
    .filter(Boolean)
}
