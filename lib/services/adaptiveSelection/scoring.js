import { SKILL_TO_DIFFICULTY } from './constants.js'

const clamp = (n, min, max) => Math.max(min, Math.min(max, n))

function getAnswerCorrect(a) {
  if (typeof a?.is_correct === 'boolean') return a.is_correct
  if (typeof a?.isCorrect === 'boolean') return a.isCorrect
  return false
}

function getAnswerTimeSec(a) {
  const value = a?.time_taken_seconds ?? a?.timeTakenSeconds ?? a?.timeSec ?? null
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function getAnswerDate(a) {
  if (!a?.createdAt) return null
  const d = new Date(a.createdAt)
  return Number.isNaN(d.getTime()) ? null : d
}

function getSessionQuestionCount(session) {
  if (Array.isArray(session?.questionIds) && session.questionIds.length > 0) {
    return session.questionIds.length
  }
  if (typeof session?.questionCount === 'number' && session.questionCount > 0) {
    return session.questionCount
  }
  return null
}

function normalizeSessionAccuracy(score, questionCount = null) {
  if (typeof score !== 'number' || !Number.isFinite(score)) return null

  if (score >= 0 && score <= 1) return score
  if (score > 1 && score <= 100) return score / 100

  if (questionCount && score >= 0 && score <= questionCount) {
    return score / questionCount
  }

  return null
}

function computeConfidenceFromCorrectAnswers(correctAnswers) {
  if (!correctAnswers.length) return 0.5

  const times = correctAnswers
    .map(getAnswerTimeSec)
    .filter((n) => typeof n === 'number' && n > 0)

  if (!times.length) return 0.6

  const avgTime = times.reduce((sum, n) => sum + n, 0) / times.length

  if (avgTime <= 10) return 1.0
  if (avgTime <= 18) return 0.85
  if (avgTime <= 28) return 0.7
  if (avgTime <= 40) return 0.55
  return 0.4
}

function computeTrend(answers) {
  const total = answers.length
  if (total < 3) return 'stable'

  const mid = Math.ceil(total / 2)
  const recentHalf = answers.slice(0, mid)
  const olderHalf = answers.slice(mid)

  if (!recentHalf.length || !olderHalf.length) return 'stable'

  const recentAcc = recentHalf.filter(getAnswerCorrect).length / recentHalf.length
  const olderAcc = olderHalf.filter(getAnswerCorrect).length / olderHalf.length
  const delta = recentAcc - olderAcc

  if (delta > 0.15) return 'improving'
  if (delta < -0.15) return 'declining'
  return 'stable'
}

export function analyzeQuestionHistory(answers) {
  if (!Array.isArray(answers) || answers.length === 0) {
    return {
      accuracy: null,
      confidence: null,
      trend: 'unknown',
      mistakeRecency: null,
      correctedSince: false,
      total: 0,
      correct: 0,
      incorrect: 0,
      lastOutcome: null,
      streak: 0,
    }
  }

  const normalized = [...answers]
  const total = normalized.length
  const correct = normalized.filter(getAnswerCorrect).length
  const incorrect = total - correct
  const accuracy = total > 0 ? correct / total : null

  const correctAnswers = normalized.filter(getAnswerCorrect)
  const confidence = computeConfidenceFromCorrectAnswers(correctAnswers)
  const trend = computeTrend(normalized)

  const lastMistake = normalized.find((a) => !getAnswerCorrect(a))
  const mistakeRecency = getAnswerDate(lastMistake)

  const latestCorrect = getAnswerCorrect(normalized[0])
  const correctedSince = latestCorrect && normalized.some((a) => !getAnswerCorrect(a))

  let streak = 0
  for (const answer of normalized) {
    if (getAnswerCorrect(answer) === latestCorrect) streak++
    else break
  }

  return {
    accuracy,
    confidence,
    trend,
    mistakeRecency,
    correctedSince,
    total,
    correct,
    incorrect,
    lastOutcome: latestCorrect ? 'correct' : 'incorrect',
    streak,
  }
}

export function getDynamicDifficultyTarget(
  skillProfile,
  userStats,
  recentSessionAccuracy = null
) {
  const baseTarget = SKILL_TO_DIFFICULTY[skillProfile?.overallLevel] || 2

  if (!userStats || (userStats.totalAnswers || 0) < 30) {
    return baseTarget
  }

  const allTimeAccuracy =
    userStats.totalAnswers > 0
      ? (userStats.correctAnswers || 0) / userStats.totalAnswers
      : 0.5

  const effectiveAccuracy =
    recentSessionAccuracy != null
      ? recentSessionAccuracy * 0.7 + allTimeAccuracy * 0.3
      : allTimeAccuracy

  let target = baseTarget

  if (effectiveAccuracy >= 0.9) target += 0.5
  else if (effectiveAccuracy >= 0.8) target += 0.25
  else if (effectiveAccuracy <= 0.4) target -= 0.5
  else if (effectiveAccuracy <= 0.55) target -= 0.25

  const weakTopics = (skillProfile?.topics || []).filter((t) => (t.accuracy || 0) < 60).length
  if (weakTopics >= 4) target -= 0.15

  return clamp(target, 1, 3)
}

export function computeRecentSessionAccuracy(recentSessions) {
  const completed = (recentSessions || []).filter(
    (s) => s?.status === 'completed' && s?.score != null
  )

  if (!completed.length) return null

  let weightedAccuracy = 0
  let totalWeight = 0

  for (const session of completed) {
    const questionCount = getSessionQuestionCount(session)
    const accuracy = normalizeSessionAccuracy(session.score, questionCount)
    if (accuracy == null) continue

    const weight = questionCount || 1
    weightedAccuracy += accuracy * weight
    totalWeight += weight
  }

  if (!totalWeight) return null
  return clamp(weightedAccuracy / totalWeight, 0, 1)
}