import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import User from '@/models/User'
import ExamSession from '@/models/ExamSession'
import UserAnswer from '@/models/UserAnswer'
import Question from '@/models/Question'
import mongoose from 'mongoose'
import { selectAdaptiveQuestions } from '@/lib/adaptive-selection'
import { checkCSRF } from '@/lib/csrf'

/**
 * POST /api/mistakes/practice
 * Generates an exam session from user's mistakes
 */
export async function POST(request) {
  try {
    const tokenData = await getCurrentUser(request)
    if (!tokenData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const csrfError = checkCSRF('POST', request)
    if (csrfError) return NextResponse.json(csrfError, { status: csrfError.status })

    await connectDB()

    const user = await User.findById(tokenData.userId)
    if (!user?.isPremium) {
      return NextResponse.json({ error: 'Premium subscription required' }, { status: 403 })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const {
      topic_filter = null,
      difficulty_filter = null,
      corrected_filter = false, // false = practice uncorrected mistakes only
      count = 30,
    } = body

    const objectId = new mongoose.Types.ObjectId(tokenData.userId)

    // Get wrong answers
    const wrongAnswers = await UserAnswer.aggregate([
      {
        $match: {
          userId: objectId,
          is_correct: false,
        },
      },
      {
        $group: {
          _id: '$questionId',
          topic: { $first: '$topic_tag.es' },
          timesWrong: { $sum: 1 },
          lastWrong: { $max: '$createdAt' },
        },
      },
    ])

    if (wrongAnswers.length === 0) {
      return NextResponse.json({ error: 'No mistakes found to practice' }, { status: 404 })
    }

    // Check which have been corrected
    const questionIds = wrongAnswers.map((m) => m._id)
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

    // Filter to uncorrected only (if requested)
    let filtered = wrongAnswers.filter((m) => {
      const lastCorrect = correctedMap.get(m._id.toString())
      const isCorrected = lastCorrect && lastCorrect > m.lastWrong
      // If corrected_filter is strictly true, we might include both or only corrected depending on intended UX.
      // Usually toggle "Include corrected" means include both.
      return corrected_filter ? true : !isCorrected
    })

    // Fetch difficulties from Question model for filtering
    const questionDocs = await Question.find({ _id: { $in: questionIds } }).select('_id difficulty').lean()
    const difficultyMap = new Map()
    for (const q of questionDocs) {
      difficultyMap.set(q._id.toString(), q.difficulty)
    }

    // Apply difficulty filter
    if (difficulty_filter) {
      filtered = filtered.filter((m) => difficultyMap.get(m._id.toString()) === difficulty_filter)
    }

    // Apply topic filter
    if (topic_filter) {
      filtered = filtered.filter((m) => m.topic === topic_filter)
    }

    if (filtered.length === 0) {
      return NextResponse.json({ error: 'No mistakes match the selected filters' }, { status: 404 })
    }

    const mistakeQuestionIds = filtered.map((m) => m._id)

    // Use adaptive selection with mistake mode to shuffle and select
    const selectedIds = await selectAdaptiveQuestions(
      tokenData.userId,
      Math.min(count, mistakeQuestionIds.length),
      {
        mode: 'mistakes',
        mistakeQuestionIds,
      }
    )

    // Create exam session
    const session = await ExamSession.create({
      userId: user._id,
      mode: 'mistakes',
      language: user.preferences.language,
      assistanceMode: 'exam',
      questionIds: selectedIds,
    })

    return NextResponse.json({
      sessionId: session._id,
      totalQuestions: selectedIds.length,
      mode: 'mistakes',
    })
  } catch (error) {
    console.error('Mistakes practice error:', error)
    return NextResponse.json({ error: 'Failed to create practice exam' }, { status: 500 })
  }
}
