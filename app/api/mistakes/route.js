import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import UserAnswer from '@/models/UserAnswer'
import Question from '@/models/Question'
import mongoose from 'mongoose'

/**
 * GET /api/mistakes
 * Returns user's incorrectly answered questions with filters
 * Query: ?topic=X&difficulty=Y&corrected=false&page=1&limit=20
 */
export async function GET(request) {
  try {
    const tokenData = await getCurrentUser(request)
    if (!tokenData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()

    const url = new URL(request.url)
    const topic = url.searchParams.get('topic')
    const difficulty = url.searchParams.get('difficulty')
    const corrected = url.searchParams.get('corrected')
    const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1)
    const limit = Math.min(50, parseInt(url.searchParams.get('limit')) || 20)
    const skip = (page - 1) * limit

    const objectId = new mongoose.Types.ObjectId(tokenData.userId)

    // Get all wrong answers grouped by questionId
    const wrongAnswers = await UserAnswer.aggregate([
      {
        $match: {
          userId: objectId,
          is_correct: false,
        },
      },
      { $sort: { createdAt: 1 } }, // Ensure $last gets the actual last one
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

    // Check which mistakes have been corrected (answered correctly more recently)
    const questionIds = wrongAnswers.map((m) => m.questionId)
    const correctedMistakes = await UserAnswer.aggregate([
      {
        $match: {
          userId: objectId,
          questionId: { $in: questionIds },
          is_correct: true,
        },
      },
      {
        $group: {
          _id: '$questionId',
          lastCorrect: { $max: '$createdAt' },
        },
      },
    ])

    const correctedMap = new Map()
    for (const m of correctedMistakes) {
      correctedMap.set(m._id.toString(), m.lastCorrect)
    }

    // Mark mistakes as corrected or uncorrected
    const withCorrectionStatus = wrongAnswers.map((m) => {
      const lastCorrect = correctedMap.get(m.questionId.toString())
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

    // Get full question data for filtered results
    const pageFiltered = filtered.slice(skip, skip + limit)
    const questionDetails = await Question.find({
      _id: { $in: pageFiltered.map((m) => m.questionId) },
    }).select('_id difficulty topic_tag question options metadata correct_option_idx')

    const questionMap = new Map()
    for (const q of questionDetails) {
      questionMap.set(q._id.toString(), q)
    }

    // Apply difficulty filter (after getting question data)
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
        correctionRate: totalMistakes > 0 ? Math.round(((totalMistakes - uncorrectedCount) / totalMistakes) * 100) : 0,
      },
    })
  } catch (error) {
    console.error('Mistakes API error:', error)
    return NextResponse.json({ error: 'Failed to fetch mistakes' }, { status: 500 })
  }
}
