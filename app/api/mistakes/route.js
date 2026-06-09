import { NextResponse } from 'next/server'
import { compose, withAuth, withDB } from '@/lib/middleware'
import UserAnswer from '@/models/UserAnswer'
import Question from '@/models/Question'
import mongoose from 'mongoose'
import { calculateMistakesSeverity } from '@/lib/mistakes'

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

    // 1 & 2. Fetch and calculate Severity Score using the shared helper
    const mistakesProcessed = await calculateMistakesSeverity(ctx.user.userId)

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
