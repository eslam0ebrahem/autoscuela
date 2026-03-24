import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getExamRecommendation } from '@/lib/groq'
import connectDB from '@/lib/db'
import { checkRateLimit } from '@/lib/utils'
import { AIRecommendSchema, parseQueryParams } from '@/lib/schemas'
import { getRecentSessions } from '@/lib/services/analytics'
import { getUserSkillProfile } from '@/lib/user-skill'

export const runtime = 'nodejs'
export const maxDuration = 15

export async function GET(request) {
  try {
    const tokenData = await getCurrentUser(request)
    if (!tokenData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── Rate limiting (10 recommendations per hour) ─────────────────────
    const rateCheck = await checkRateLimit(`ai:recommend:${tokenData.userId}`, 10, 3600000)
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many recommendation requests. Please try later.' },
        { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfter || 3600) } }
      )
    }

    // ── Parse and validate query params ────────────────────────────────
    const { data: queryParams, error: queryError } = parseQueryParams(request, AIRecommendSchema)
    if (queryError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryError.messages },
        { status: queryError.status }
      )
    }

    const { lang } = queryParams

    await connectDB()

    // Fetch skill profile for richer context
    let skillProfile = null
    try {
      skillProfile = await getUserSkillProfile(tokenData.userId)
    } catch {
      // Graceful
    }

    // Aggregate last 10 exams for context
    const recentSessions = await getRecentSessions(tokenData.userId, 10)

    if (recentSessions.length === 0) {
      return NextResponse.json({
        recommendation: {
          recommended_mode: 'official',
          reason:
            lang === 'es'
              ? 'Empieza con el examen oficial para evaluar tu nivel.'
              : 'Start with the official exam to assess your level.',
          suggested_topics: [],
          suggested_question_count: 30,
          urgency: 'medium',
          tip:
            lang === 'es'
              ? '¡Completa tu primer examen para análisis personalizados!'
              : 'Complete your first exam for personalized analysis!',
          warm_up_suggestion: null,
          expected_outcome: null,
          alternative_mode: null,
          _fallback: true,
        },
      })
    }

    const recentStats = {
      totalExams: recentSessions.length,
      averageScore: Math.round(
        recentSessions.reduce((s, e) => s + (e.score || 0), 0) / recentSessions.length
      ),
      passRate: Math.round(
        (recentSessions.filter((e) => e.passed).length / recentSessions.length) * 100
      ),
      recentErrors: recentSessions
        .slice(0, 3)
        .map((e) => ({ mode: e.mode, score: e.score, errors: e.errorCount })),
      topicBreakdown: recentSessions[0]?.topicBreakdown || [],
    }

    const recommendation = await getExamRecommendation({ recentStats, skillProfile, lang })
    return NextResponse.json({ recommendation })
  } catch (error) {
    console.error('[api/ai/recommend] Error:', error)
    return NextResponse.json({ error: 'Recommendation failed' }, { status: 500 })
  }
}
