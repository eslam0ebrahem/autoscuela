import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getExamCoachFeedback } from '@/lib/groq'
import ExamSession from '@/models/ExamSession'
import connectDB from '@/lib/db'
import { isValidObjectId, checkRateLimit } from '@/lib/utils'
import { AICoachSchema, parseSchema } from '@/lib/schemas'
import { getRecentSessions, getExamSummary } from '@/lib/services/analytics'
import { getUserSkillProfile } from '@/lib/user-skill'

export const runtime = 'nodejs'
export const maxDuration = 25

export async function POST(request) {
  try {
    const tokenData = await getCurrentUser(request)
    if (!tokenData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── Rate limiting (2 coach calls per minute) ───────────────────────
    const rateCheck = await checkRateLimit(`ai:coach:${tokenData.userId}`, 2, 60000)
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
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
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

    // ── Deduplicate: Return already generated feedback from submit task ──
    if (session.aiCoachFeedback && !session.aiCoachFeedback._fallback) {
      return NextResponse.json({ feedback: session.aiCoachFeedback })
    }

    // Build exam summary for AI
    const examSummary = await getExamSummary(session)

    // Fetch skill profile for richer AI context
    let skillProfile = null
    try {
      skillProfile = await getUserSkillProfile(tokenData.userId)
    } catch {
      // Graceful: proceed without skill profile
    }

    // Fetch last 5 completed sessions for trend analysis
    let sessionHistory = []
    try {
      const recentSessions = await getRecentSessions(tokenData.userId, 6)
      sessionHistory = recentSessions
        .filter((s) => s._id.toString() !== session._id.toString())
        .slice(0, 5)
        .reverse() // oldest first for trend analysis
    } catch {
      // Graceful: proceed without history
    }

    try {
      const feedback = await getExamCoachFeedback({
        examSummary,
        sessionHistory,
        skillProfile,
        lang,
      })
      return NextResponse.json({ feedback })
    } catch (aiError) {
      console.error('[api/ai/coach] AI generation failed:', aiError.message)
      return NextResponse.json(
        {
          success: false,
          error: 'AI features temporarily unavailable',
          message:
            lang === 'es'
              ? 'Los análisis de IA del entrenador no están disponibles en este momento. Intenta más tarde.'
              : 'AI coach analysis is temporarily unavailable. Please try again later.',
        },
        { status: 503 }
      )
    }
  } catch (error) {
    console.error('[api/ai/coach] Request error:', error)
    return NextResponse.json({ error: 'Request failed' }, { status: 500 })
  }
}
