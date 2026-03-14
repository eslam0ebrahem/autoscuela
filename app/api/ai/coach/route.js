import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getExamCoachFeedback } from '@/lib/groq'
import ExamSession from '@/models/ExamSession'
import connectDB from '@/lib/db'
import { isValidObjectId } from '@/lib/utils'

export const runtime = 'nodejs'
export const maxDuration = 25

export async function POST(request) {
  try {
    const tokenData = await getCurrentUser(request)
    if (!tokenData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sessionId, lang = 'es' } = await request.json()

    if (!sessionId || !isValidObjectId(sessionId)) {
      return NextResponse.json({ error: 'Invalid sessionId' }, { status: 400 })
    }

    await connectDB()
    const session = await ExamSession.findById(sessionId).lean()

    if (!session || session.userId?.toString() !== tokenData.userId) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Build exam summary for AI
    const examSummary = {
      score: session.score,
      errorCount: session.errorCount,
      passed: session.passed,
      totalQuestions: session.questions?.length || 0,
      mode: session.mode,
      topicBreakdown: session.topicBreakdown || [],
      timeSpentSeconds: session.timeSpentSeconds,
      questionsDetail: (session.answers || []).map((a) => ({
        isCorrect: a.isCorrect,
        topic: a.topic_tag?.es || '',
        timeTaken: a.time_taken,
      })),
    }

    const feedback = await getExamCoachFeedback({ examSummary, lang })

    return NextResponse.json({ feedback })
  } catch (error) {
    console.error('[api/ai/coach] Error:', error)
    return NextResponse.json({ error: 'Coach feedback failed' }, { status: 500 })
  }
}
