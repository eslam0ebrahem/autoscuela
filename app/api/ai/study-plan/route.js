import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import connectDB from '@/lib/db'
import { checkRateLimit } from '@/lib/utils'
import { getUserSkillProfile } from '@/lib/user-skill'
import { getStudyPlan } from '@/lib/groq'
import { AIStudyPlanSchema, parseQueryParams } from '@/lib/schemas'
import UserAnswer from '@/models/UserAnswer'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * GET /api/ai/study-plan?targetDate=YYYY-MM-DD&dailyMinutes=30&lang=es
 * Generate a personalized week-by-week study plan based on skill profile and target exam date.
 * Rate limit: 5 per hour per user.
 */
export async function GET(request) {
  try {
    const tokenData = await getCurrentUser(request)
    if (!tokenData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    // ── Rate limiting: 5 per hour ─────────────────────────────────────────
    const rateCheck = await checkRateLimit(`ai:study-plan:${tokenData.userId}`, 5, 3_600_000)
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many study plan requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfter || 3600) } }
      )
    }

    // ── Validate query params ─────────────────────────────────────────────
    const { data: validated, error: validationError } = parseQueryParams(request, AIStudyPlanSchema)
    if (validationError) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationError.messages },
        { status: validationError.status }
      )
    }

    const { targetDate, dailyMinutes, lang } = validated

    // ── Minimum questions gate ────────────────────────────────────────────
    const skillProfile = await getUserSkillProfile(tokenData.userId)
    if (skillProfile.totalAnswered < 10) {
      return NextResponse.json(
        {
          plan: null,
          message:
            lang === 'es'
              ? `Responde al menos 10 preguntas antes de generar un plan. Has respondido ${skillProfile.totalAnswered} hasta ahora.`
              : `Answer at least 10 questions before generating a plan. You've answered ${skillProfile.totalAnswered} so far.`,
          progress: skillProfile.totalAnswered,
          required: 10,
        },
        { status: 422 }
      )
    }

    // ── Fetch study trends for consistency context ─────────────────────────
    let studyTrends = null
    try {
      studyTrends = await UserAnswer.getStudyTrends(tokenData.userId, 14)
    } catch {
      // Graceful: proceed without trends
    }

    // ── Generate plan ─────────────────────────────────────────────────────
    const plan = await getStudyPlan({ skillProfile, targetDate, dailyMinutes, studyTrends, lang })

    return NextResponse.json({
      plan,
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[api/ai/study-plan] Error:', error)
    return NextResponse.json({ error: 'Failed to generate study plan' }, { status: 500 })
  }
}
