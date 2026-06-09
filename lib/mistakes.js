import mongoose from 'mongoose'
import UserAnswer from '@/models/UserAnswer'
import Question from '@/models/Question'

/**
 * Calculates severity scores for all mistakes made by a user.
 * Groups by questionId, calculates a severity score from 0-100 based on:
 * - Error rate
 * - Frequency of mistakes
 * - Recency of the last mistake
 * - Whether it has been corrected since the last mistake
 *
 * @param {string} userId - The ID of the user.
 * @returns {Promise<Array>} Array of mistake objects, sorted by severityScore descending.
 */
export async function calculateMistakesSeverity(userId) {
  const objectId = new mongoose.Types.ObjectId(userId)

  // 1. Fetch all answers for the user to compute error rates and severity
  const rawAnswers = await UserAnswer.aggregate([
    { $match: { userId: objectId } },
    { $sort: { createdAt: 1 } },
    {
      $group: {
        _id: '$questionId',
        topic: { $last: '$topic_tag.es' },
        topicEn: { $last: '$topic_tag.en' },
        attempts: {
          $push: {
            is_correct: '$is_correct',
            createdAt: '$createdAt',
            selected_option_idx: '$selected_option_idx'
          }
        }
      }
    }
  ])

  const now = new Date()

  // 2. Process and calculate Severity Score
  const mistakesProcessed = rawAnswers.map(m => {
    const wrongAttempts = m.attempts.filter(a => !a.is_correct)
    if (wrongAttempts.length === 0) return null

    const totalAttempts = m.attempts.length
    const timesWrong = wrongAttempts.length
    const lastWrongAttempt = wrongAttempts[wrongAttempts.length - 1]
    const lastWrong = lastWrongAttempt.createdAt
    const lastWrongAnswerIdx = lastWrongAttempt.selected_option_idx

    const correctAttempts = m.attempts.filter(a => a.is_correct)
    const lastCorrect = correctAttempts.length > 0 ? correctAttempts[correctAttempts.length - 1].createdAt : null

    const isCorrected = lastCorrect && lastCorrect > lastWrong

    // ── Severity Score Formula (0-100) ──
    const errorRate = timesWrong / totalAttempts
    let severityScore = errorRate * 50 // Max 50 points based on error rate

    // Frequency penalty (up to 30 points)
    severityScore += Math.min(timesWrong * 10, 30)

    // Recency penalty (20 points if within last 7 days)
    const daysSinceLastWrong = (now - lastWrong) / (1000 * 60 * 60 * 24)
    if (daysSinceLastWrong <= 7) {
      severityScore += 20
    }

    // Correction bonus
    if (isCorrected) {
      severityScore -= 50
    }

    severityScore = Math.max(0, Math.min(100, Math.round(severityScore)))

    return {
      questionId: m._id,
      topic: m.topic,
      topicEn: m.topicEn,
      totalAttempts,
      timesWrong,
      lastWrong,
      lastWrongAnswerIdx,
      isCorrected: !!isCorrected,
      severityScore
    }
  }).filter(Boolean)

  // Sort by severityScore descending, then by lastWrong descending
  mistakesProcessed.sort((a, b) => b.severityScore - a.severityScore || b.lastWrong - a.lastWrong)

  return mistakesProcessed
}
