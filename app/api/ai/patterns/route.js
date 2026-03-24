import { NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { getCurrentUser } from '@/lib/auth'
import connectDB from '@/lib/db'
import { checkRateLimit } from '@/lib/utils'
import UserAnswer from '@/models/UserAnswer'
import User from '@/models/User'
import { getMistakePatterns } from '@/lib/groq'

export const runtime = 'nodejs'
export const maxDuration = 35

const MIN_MISTAKES = 10

/**
 * GET /api/ai/patterns?lang=es
 * Analyze recurring mistake patterns to identify conceptual knowledge gaps.
 * Rate limit: 5 per day per user (expensive AI analysis).
 */
export async function GET(request) {
  try {
    const tokenData = await getCurrentUser(request)
    if (!tokenData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    // ── Rate limiting: 5 per day ──────────────────────────────────────────
    const rateCheck = await checkRateLimit(`ai:patterns:${tokenData.userId}`, 5, 86_400_000)
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Daily pattern analysis limit reached. Please try again tomorrow.' },
        { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfter || 86400) } }
      )
    }

    const lang = new URL(request.url).searchParams.get('lang') || 'es'
    const objectId = new mongoose.Types.ObjectId(tokenData.userId)

    // ── Aggregate recent wrong answers grouped by topic ────────────────────
    const mistakeGroups = await UserAnswer.aggregate([
      { $match: { userId: objectId, is_correct: false } },
      { $sort: { createdAt: -1 } },
      { $limit: 100 },
      {
        $lookup: {
          from: 'questions',
          localField: 'questionId',
          foreignField: '_id',
          as: 'question',
        },
      },
      { $unwind: { path: '$question', preserveNullAndEmpty: false } },
      {
        $group: {
          _id: '$topic_tag.es',
          count: { $sum: 1 },
          examples: {
            $push: {
              questionText: '$question.question',
            },
          },
        },
      },
      { $match: { count: { $gte: 2 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ])

    // ── Check minimum threshold ───────────────────────────────────────────
    const totalMistakes = mistakeGroups.reduce((sum, g) => sum + g.count, 0)
    if (totalMistakes < MIN_MISTAKES || mistakeGroups.length === 0) {
      return NextResponse.json({
        patterns: null,
        message:
          lang === 'es'
            ? `Necesitas al menos ${MIN_MISTAKES} respuestas incorrectas para el análisis de patrones. Tienes ${totalMistakes} hasta ahora.`
            : `You need at least ${MIN_MISTAKES} incorrect answers for pattern analysis. You have ${totalMistakes} so far.`,
        progress: totalMistakes,
        required: MIN_MISTAKES,
      })
    }

    // ── Map to plain objects for AI input ─────────────────────────────────
    const groups = mistakeGroups.map((g) => ({
      topic: g._id,
      count: g.count,
      examples: g.examples.slice(0, 3).map((e) => ({
        questionText:
          typeof e.questionText === 'object'
            ? e.questionText?.[lang] || e.questionText?.es || ''
            : e.questionText || '',
      })),
    }))

    // ── Fetch overall context for richer AI analysis ───────────────────────
    const userDoc = await User.findById(tokenData.userId).select('stats').lean()
    const totalQuestions = userDoc?.stats?.totalAnswers || null
    const overallAccuracy =
      totalQuestions > 0
        ? Math.round(((userDoc?.stats?.correctAnswers || 0) / totalQuestions) * 100)
        : null

    // ── Generate AI patterns ──────────────────────────────────────────────
    const result = await getMistakePatterns({
      mistakeGroups: groups,
      totalQuestions,
      overallAccuracy,
      lang,
    })

    return NextResponse.json({
      ...result,
      total_analyzed: totalMistakes,
      analyzed_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[api/ai/patterns] Error:', error)
    return NextResponse.json({ error: 'Failed to analyze mistake patterns' }, { status: 500 })
  }
}
