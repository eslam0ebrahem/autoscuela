import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import User from '@/models/User'
import Question from '@/models/Question'
import ExamSession from '@/models/ExamSession'
import { getCurrentUser } from '@/lib/auth'
import { clamp } from '@/lib/utils'
import { selectAdaptiveQuestions } from '@/lib/adaptive-selection'

const OFFICIAL_EXAM_QUESTIONS = 30
const OFFICIAL_EXAM_DURATION_MIN = 30
const ABANDONED_SESSION_HOURS = 2

export async function POST(request) {
  try {
    const tokenData = await getCurrentUser(request)
    if (!tokenData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const user = await User.findById(tokenData.userId)
    if (!user?.isPremium) {
      return NextResponse.json({ error: 'Premium subscription required' }, { status: 403 })
    }

    // Auto-cleanup old sessions
    const abandonedCutoff = new Date()
    abandonedCutoff.setHours(abandonedCutoff.getHours() - ABANDONED_SESSION_HOURS)

    await ExamSession.updateMany(
      {
        userId: user._id,
        status: 'in_progress',
        createdAt: { $lt: abandonedCutoff },
      },
      { $set: { status: 'abandoned' } }
    )

    const {
      mode = 'official',
      topic_filter = null,
      assistance_mode = 'exam',
      num_questions = OFFICIAL_EXAM_QUESTIONS,
      source = 'standard',
    } = await request.json()

    if (!['official', 'custom', 'mistakes', 'weak_topics'].includes(mode)) {
      return NextResponse.json({ error: 'Invalid exam mode' }, { status: 400 })
    }
    if (!['instant', 'exam'].includes(assistance_mode)) {
      return NextResponse.json({ error: 'Invalid assistance mode' }, { status: 400 })
    }

    const requestedCount = mode === 'official'
      ? OFFICIAL_EXAM_QUESTIONS
      : clamp(parseInt(num_questions) || OFFICIAL_EXAM_QUESTIONS, 5, 100)

    // Use adaptive selection for all modes
    const filters = mode === 'custom' || mode === 'weak_topics' ? topic_filter : null
    const questionIds = await selectAdaptiveQuestions(tokenData.userId, requestedCount, {
      topicFilters: filters,
      mode,
    })

    if (questionIds.length === 0) {
      return NextResponse.json({ error: 'No questions available for the selected filters' }, { status: 404 })
    }

    const expiresAt = new Date()
    expiresAt.setMinutes(expiresAt.getMinutes() + OFFICIAL_EXAM_DURATION_MIN)

    const session = await ExamSession.create({
      userId: user._id,
      mode,
      language: user.preferences.language,
      topicFilters: filters ? [filters].flat() : [],
      assistanceMode: assistance_mode,
      questionIds,
      expiresAt: mode === 'official' ? expiresAt : null,
    })

    return NextResponse.json({
      sessionId: session._id,
      totalQuestions: questionIds.length,
      mode,
      assistanceMode: assistance_mode,
      expiresAt: mode === 'official' ? expiresAt : null,
    })
  } catch (error) {
    console.error('Generate exam error:', error)
    return NextResponse.json({ error: 'Failed to generate exam' }, { status: 500 })
  }
}
