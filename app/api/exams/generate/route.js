import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import User from '@/models/User'
import Question from '@/models/Question'
import ExamSession from '@/models/ExamSession'
import { getCurrentUser } from '@/lib/auth'

const OFFICIAL_EXAM_QUESTIONS = 30
const OFFICIAL_EXAM_DURATION_MIN = 30

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

    const {
      mode = 'official',
      topic_filter = null,
      assistance_mode = 'exam',
      num_questions = OFFICIAL_EXAM_QUESTIONS,
    } = await request.json()

    // Build query
    const query = { isActive: true }
    if (mode === 'custom' && topic_filter && topic_filter.length > 0) {
      query['topic_tag.es'] = { $in: Array.isArray(topic_filter) ? topic_filter : [topic_filter] }
    }

    // Get random questions
    const totalAvailable = await Question.countDocuments(query)
    const limit = mode === 'official' ? OFFICIAL_EXAM_QUESTIONS : Math.min(num_questions, totalAvailable)

    const questions = await Question.aggregate([
      { $match: query },
      { $sample: { size: limit } },
      { $project: { _id: 1, topic_tag: 1 } }, // Only send IDs initially for security
    ])

    if (questions.length === 0) {
      return NextResponse.json({ error: 'No questions available for the selected filters' }, { status: 404 })
    }

    const expiresAt = new Date()
    expiresAt.setMinutes(expiresAt.getMinutes() + OFFICIAL_EXAM_DURATION_MIN)

    const session = await ExamSession.create({
      userId: user._id,
      mode,
      language: user.preferences.language,
      topicFilters: topic_filter ? [topic_filter].flat() : [],
      assistanceMode: assistance_mode,
      questionIds: questions.map((q) => q._id),
      expiresAt: mode === 'official' ? expiresAt : null,
    })

    return NextResponse.json({
      sessionId: session._id,
      totalQuestions: questions.length,
      mode,
      assistanceMode: assistance_mode,
      expiresAt: mode === 'official' ? expiresAt : null,
    })
  } catch (error) {
    console.error('Generate exam error:', error)
    return NextResponse.json({ error: 'Failed to generate exam' }, { status: 500 })
  }
}

