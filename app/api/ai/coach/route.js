import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getExamCoachFeedback } from '@/lib/groq'
import ExamSession from '@/models/ExamSession'
import connectDB from '@/lib/db'
import { isValidObjectId, checkRateLimit } from '@/lib/utils'
import { AICoachSchema, parseSchema } from '@/lib/schemas'

export const runtime = 'nodejs'
export const maxDuration = 25

export async function POST(request) {
  try {
    const tokenData = await getCurrentUser(request)
    if (!tokenData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── Rate limiting (2 coach calls per minute) ───────────────────────
    const rateCheck = checkRateLimit(`ai:coach:${tokenData.userId}`, 2, 60000)
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many coach requests. Please slow down.' },
        { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfter || 60) } }
      )
    }

    // ── Parse and validate body ────────────────────────────────────────
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      )
    }

    const { data: validated, error: validationError } = parseSchema(
      AICoachSchema.omit({ statsContext: true }),
      body
    )
    if (validationError) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationError.messages },
        { status: validationError.status }
      )
    }

    const { sessionId, lang } = validated

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
