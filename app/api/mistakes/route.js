import { NextResponse } from 'next/server'
import { compose, withAuth, withDB } from '@/lib/middleware'
import UserAnswer from '@/models/UserAnswer'
import Question from '@/models/Question'
import mongoose from 'mongoose'

/**
 * GET /api/mistakes
 * Returns user's incorrectly answered questions with filters
 * Query: ?topic=X&difficulty=Y&corrected=false&page=1&limit=20
 */
export const GET = compose(
  withAuth(),
  withDB(),
  async (request, ctx) => {
    const url = new URL(request.url)
    const topic = url.searchParams.get('topic')
    const difficulty = url.searchParams.get('difficulty')
    const corrected = url.searchParams.get('corrected')
    const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1)
    const limit = Math.min(50, parseInt(url.searchParams.get('limit')) || 20)
    const skip = (page - 1) * limit

    const objectId = new mongoose.Types.ObjectId(ctx.user.userId)

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

    // Apply filters
    let filtered = mistakesProcessed

    if (topic) {
      filtered = filtered.filter((m) => m.topic === topic)
    }

    if (corrected !== null) {
      const shouldBeCorrected = corrected === 'true'
      filtered = filtered.filter((m) => m.isCorrected === shouldBeCorrected)
    }

    // Get full question data for paginated results
    const pageFiltered = filtered.slice(skip, skip + limit)
    const questionDetails = await Question.find({
      _id: { $in: pageFiltered.map((m) => m.questionId) },
    })
      .select('_id difficulty topic_tag question options metadata correct_option_idx')
      .lean()

    const questionMap = new Map()
    for (const q of questionDetails) {
      questionMap.set(q._id.toString(), q)
    }

    // Apply difficulty filter and format response
    const mistakes = pageFiltered
      .map((m) => {
        const q = questionMap.get(m.questionId.toString())
        if (!q) return null
        if (difficulty && q.difficulty !== difficulty) return null
        return {
          questionId: m.questionId,
          question: q.question,
          topic: m.topic,
          topicEn: m.topicEn,
          difficulty: q.difficulty,
          timesWrong: m.timesWrong,
          isCorrected: m.isCorrected,
          lastWrong: m.lastWrong,
          lastWrongAnswerIdx: m.lastWrongAnswerIdx,
          correct_option_idx: q.correct_option_idx,
          options: q.options,
          metadata: q.metadata,
          severityScore: m.severityScore,
        }
      })
      .filter(Boolean)

    const totalMistakes = mistakesProcessed.length
    const uncorrectedCount = mistakesProcessed.filter((m) => !m.isCorrected).length

    return NextResponse.json({
      mistakes,
      total: filtered.length,
      page,
      limit,
      totalPages: Math.ceil(filtered.length / limit),
      stats: {
        totalMistakes,
        uncorrectedCount,
        correctionRate:
          totalMistakes > 0
            ? Math.round(((totalMistakes - uncorrectedCount) / totalMistakes) * 100)
            : 0,
      },
    })
  }
)
