import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getQuestionExplanation } from '@/lib/groq'
import Question from '@/models/Question'
import connectDB from '@/lib/db'
import { isValidObjectId, checkRateLimit } from '@/lib/utils'
import { AIExplainSchema, parseSchema } from '@/lib/schemas'

export const runtime = 'nodejs'
export const maxDuration = 20

export async function POST(request) {
  try {
    const tokenData = await getCurrentUser(request)
    if (!tokenData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── Rate limiting (5 explanations per minute) ──────────────────────
    const rateCheck = checkRateLimit(`ai:explain:${tokenData.userId}`, 5, 60000)
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many explanation requests. Please slow down.' },
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
      AIExplainSchema.omit({ sessionId: true }),
      body
    )
    if (validationError) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationError.messages },
        { status: validationError.status }
      )
    }

    const { questionId, selectedIdx, lang } = validated

    await connectDB()
    const question = await Question.findById(questionId).lean()

    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    const explanation = await getQuestionExplanation({
      question: question.question,
      options: question.options,
      correctIdx: question.correct_option_idx - 1,
      selectedIdx: selectedIdx -1,
      helpHtml: question.metadata?.help_html,
      lang,
    })

    return NextResponse.json({ explanation })
  } catch (error) {
    console.error('[api/ai/explain] Error:', error)
    return NextResponse.json({ error: 'Explanation generation failed' }, { status: 500 })
  }
}
