/**
 * SM-2 Spaced Repetition Algorithm
 * Calculates optimal review intervals to maximize long-term retention.
 */

/**
 * Calculate next SRS interval using SM-2 algorithm.
 * @param {object} current - Current SRS state
 * @param {number} current.easinessFactor - EF value (default 2.5, min 1.3)
 * @param {number} current.interval - Days until next review (default 1)
 * @param {number} current.repetitions - Successful review count (default 0)
 * @param {number} grade - Answer quality 0-5 (0=complete failure, 3=correct with difficulty, 5=perfect)
 * @returns {{ easinessFactor: number, interval: number, repetitions: number, nextReviewAt: Date }}
 */
export function calculateSRS({ easinessFactor = 2.5, interval = 1, repetitions = 0 } = {}, grade) {
  const newEF = Math.max(1.3, easinessFactor + 0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02))
  let newInterval, newRepetitions

  if (grade < 3) {
    // Failed — reset to beginning
    newRepetitions = 0
    newInterval = 1
  } else {
    // Successful review
    newRepetitions = repetitions + 1
    if (newRepetitions === 1) newInterval = 1
    else if (newRepetitions === 2) newInterval = 6
    else newInterval = Math.round(interval * newEF)
  }

  const nextReviewAt = new Date()
  nextReviewAt.setDate(nextReviewAt.getDate() + newInterval)

  return {
    easinessFactor: Math.round(newEF * 100) / 100,
    interval: newInterval,
    repetitions: newRepetitions,
    nextReviewAt,
  }
}

/**
 * Convert answer data to SM-2 grade (0-5).
 * @param {boolean} isCorrect - Whether the answer was correct
 * @param {number} timeTakenSeconds - Time the user took to answer
 * @param {number} avgTimeSeconds - User's average answering time (default 30s)
 * @returns {number} Grade 0-5
 */
export function answerToGrade(isCorrect, timeTakenSeconds, avgTimeSeconds = 30) {
  if (!isCorrect) return 1 // Incorrect = failed
  const ratio = timeTakenSeconds / Math.max(avgTimeSeconds, 5)
  if (ratio <= 0.5) return 5 // Fast and correct = perfect
  if (ratio <= 1.0) return 4 // Normal speed = good
  return 3 // Slow but correct = correct with difficulty
}
