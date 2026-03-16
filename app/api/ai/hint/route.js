import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getSmartHint } from '@/lib/groq'
import Question from '@/models/Question'
import connectDB from '@/lib/db'
import { isValidObjectId, checkRateLimit } from '@/lib/utils'
import { AIHintSchema, parseSchema } from '@/lib/schemas'

export const runtime = 'nodejs'
export const maxDuration = 15

export async function POST(request) {
  try {
    const tokenData = await getCurrentUser(request)
    if (!tokenData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── Rate limiting (3 hints per minute to control Groq cost) ────────
    const rateCheck = checkRateLimit(`ai:hint:${tokenData.userId}`, 3, 60000)
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many hint requests. Please slow down.' },
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
      AIHintSchema.omit({ sessionId: true }),
      body
    )
    if (validationError) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationError.messages },
        { status: validationError.status }
      )
    }

    const { questionId, lang } = validated

    await connectDB()
    const question = await Question.findById(questionId).lean()

    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    try {
      const hint = await getSmartHint({
        question: question.question,
        options: question.options,
        correctIdx: question.correct_option_idx - 1,
        lang,
      })
      return NextResponse.json({ hint })
    } catch (aiError) {
      console.error('[api/ai/hint] AI generation failed:', aiError.message)
      // Graceful degradation: show user-friendly message instead of blank response
      return NextResponse.json(
        {
          success: false,
          error: 'AI features temporarily unavailable',
          message:
            lang === 'es'
              ? 'Los consejos de IA no están disponibles en este momento. Intenta más tarde.'
              : 'AI hints are temporarily unavailable. Please try again later.',
        },
        { status: 503 }
      )
    }
  } catch (error) {
    console.error('[api/ai/hint] Request error:', error)
    return NextResponse.json({ error: 'Request failed' }, { status: 500 })
  }
}
