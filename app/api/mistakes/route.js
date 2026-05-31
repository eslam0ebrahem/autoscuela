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

    // 1. Find all wrong answers for the user
    const wrongAnswers = await UserAnswer.aggregate([
      {
        $match: { userId: objectId, is_correct: false },
      },
      { $sort: { createdAt: 1 } },
      {
        $group: {
          _id: '$questionId',
          topic: { $first: '$topic_tag.es' },
          topicEn: { $first: '$topic_tag.en' },
          timesWrong: { $sum: 1 },
          lastWrong: { $max: '$createdAt' },
          lastWrongAnswerIdx: { $last: '$selected_option_idx' },
        },
      },
      {
        $project: {
          questionId: '$_id',
          topic: 1,
          topicEn: 1,
          timesWrong: 1,
          lastWrong: 1,
          lastWrongAnswerIdx: 1,
          _id: 0,
        },
      },
    ])

    // 2. Fetch correction status only for those specific wrong questions
    let correctionStatus = []
    if (wrongAnswers.length > 0) {
      const questionIds = wrongAnswers.map((w) => w.questionId)
      correctionStatus = await UserAnswer.aggregate([
        {
          $match: {
            userId: objectId,
            is_correct: true,
            questionId: { $in: questionIds },
          },
        },
        {
          $group: {
            _id: '$questionId',
            lastCorrect: { $max: '$createdAt' },
          },
        },
      ])
    }

    if (wrongAnswers.length === 0) {
      return NextResponse.json({
        mistakes: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
        stats: {
          totalMistakes: 0,
          uncorrectedCount: 0,
          correctionRate: 0,
        },
      })
    }

    // Build correction map
    const correctionMap = new Map()
    for (const c of correctionStatus) {
      correctionMap.set(c._id.toString(), c.lastCorrect)
    }

    // Mark mistakes as corrected
    const withCorrectionStatus = wrongAnswers.map((m) => {
      const lastCorrect = correctionMap.get(m.questionId.toString())
      const isCorrected = lastCorrect && lastCorrect > m.lastWrong
      return { ...m, isCorrected: isCorrected || false }
    })

    // Apply filters
    let filtered = withCorrectionStatus

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
        }
      })
      .filter(Boolean)

    const totalMistakes = withCorrectionStatus.length
    const uncorrectedCount = withCorrectionStatus.filter((m) => !m.isCorrected).length

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
