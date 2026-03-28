import { SKILL_TO_DIFFICULTY } from './constants.js'

export function analyzeQuestionHistory(answers) {
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

export function getDynamicDifficultyTarget(skillProfile, userStats, recentSessionAccuracy = null) {
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

export function computeRecentSessionAccuracy(recentSessions) {
  const completed = recentSessions.filter((s) => s.status === 'completed' && s.score != null)
  if (completed.length === 0) return null

  const totalCorrect = completed.reduce((sum, s) => sum + (s.score || 0), 0)
  const totalQuestions = completed.reduce((sum, s) => sum + (s.questionIds?.length || 0), 0)

  return totalQuestions > 0 ? totalCorrect / totalQuestions : null
}
