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
 *
 * Generate a personalized week-by-week study plan based on skill profile and
 * target exam date.
 *
 * Rate limit : 5 requests per hour per user.
 * Caching    : plans are deterministic for the same inputs; we hint the client
 *              to reuse the response for 10 minutes via Cache-Control.
 */
export async function GET(request) {
  const t0 = Date.now()

  try {
    // ── 1. Auth ───────────────────────────────────────────────────────────
    const tokenData = await getCurrentUser(request)
    if (!tokenData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── 2. Validate query params early (cheap, no DB needed) ─────────────
    const { data: validated, error: validationError } = parseQueryParams(request, AIStudyPlanSchema)
    if (validationError) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationError.messages },
        { status: validationError.status }
      )
    }

    const { targetDate, dailyMinutes, lang } = validated

    // Guard: targetDate must be in the future
    const daysUntilExam = Math.ceil((new Date(targetDate) - new Date()) / (1_000 * 60 * 60 * 24))
    if (daysUntilExam < 1) {
      return NextResponse.json(
        {
          error:
            lang === 'es'
              ? 'La fecha objetivo debe ser en el futuro.'
              : 'Target date must be in the future.',
        },
        { status: 400 }
      )
    }

    await connectDB()

    // ── 3. Rate limiting BEFORE any expensive DB work ─────────────────────
    //    (avoids hitting getUserSkillProfile on every rejected request)
    const rateCheck = await checkRateLimit(`ai:study-plan:${tokenData.userId}`, 5, 3_600_000)
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many study plan requests. Please try again later.' },
        {
          status: 429,
          headers: { 'Retry-After': String(rateCheck.retryAfter ?? 3600) },
        }
      )
    }

    // ── 4. Skill profile (needed for minimum-questions gate) ─────────────
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

    // ── 5. Fetch study trends in parallel with nothing else (no blocking) ─
    //    Both getStudyPlan inputs are now ready — fire trends fetch and let
    //    getStudyPlan itself run while trends resolves.
    let studyTrends = null
    try {
      studyTrends = await UserAnswer.getStudyTrends(tokenData.userId, 14)
    } catch (trendsErr) {
      // Non-critical — proceed without trend data
      console.warn('[api/ai/study-plan] getStudyTrends failed (non-fatal):', trendsErr?.message)
    }

    // ── 6. Generate plan ──────────────────────────────────────────────────
    let plan
    try {
      plan = await getStudyPlan({ skillProfile, targetDate, dailyMinutes, studyTrends, lang })
    } catch (groqErr) {
      console.error('[api/ai/study-plan] Groq error:', groqErr)
      return NextResponse.json(
        { error: 'AI service temporarily unavailable. Please try again in a moment.' },
        { status: 503 }
      )
    }

    const generatedAt = new Date().toISOString()
    const ms = Date.now() - t0
    console.info(`[api/ai/study-plan] OK userId=${tokenData.userId} ms=${ms}`)

    // ── 7. Respond with light client-side caching ─────────────────────────
    //    Same inputs → same plan for ~10 minutes, saving unnecessary re-calls.
    return NextResponse.json(
      { plan, generatedAt, daysUntilExam },
      {
        headers: {
          'Cache-Control': 'private, max-age=600',
          'X-Response-Time': String(ms),
        },
      }
    )
  } catch (error) {
    console.error('[api/ai/study-plan] Unhandled error:', error)
    return NextResponse.json({ error: 'Failed to generate study plan' }, { status: 500 })
  }
}
