import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getQuestionExplanation } from '@/lib/groq'
import Question from '@/models/Question'
import User from '@/models/User'
import connectDB from '@/lib/db'
import { checkRateLimit } from '@/lib/utils'
import { AIExplainSchema, parseSchema } from '@/lib/schemas'
import { getUserSkillProfile } from '@/lib/user-skill'

export const runtime = 'nodejs'
export const maxDuration = 20

export async function POST(request) {
  try {
    const tokenData = await getCurrentUser(request)
    if (!tokenData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()
    const user = await User.findById(tokenData.userId).lean()
    
    if (!user?.isPremium && process.env.BYPASS_PREMIUM !== 'true') {
      return NextResponse.json({ error: 'Premium required for AI explanations' }, { status: 403 })
    }

    // ── Rate limiting (5 explanations per minute) ──────────────────────
    const rateCheck = await checkRateLimit(`ai:explain:${tokenData.userId}`, 5, 60000)
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
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
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

    // Fetch user knowledge level for this topic to tailor the explanation
    let userTopicAccuracy = null
    try {
      const skillProfile = await getUserSkillProfile(tokenData.userId)
      const topicTag = question.topic_tag?.es || 'General'
      const topicStats = skillProfile.topics?.find((t) => t.tag === topicTag)
      if (topicStats) {
        userTopicAccuracy = topicStats.accuracy / 100
      }
    } catch {
      // Graceful
    }

    try {
      const explanation = await getQuestionExplanation({
        question: question.question,
        options: question.options,
        correctIdx: question.correct_option_idx,
        selectedIdx: selectedIdx,
        helpHtml: question.metadata?.help_html,
        lang,
        userTopicAccuracy,
      })
      return NextResponse.json({ explanation })
    } catch (aiError) {
      console.error('[api/ai/explain] AI generation failed:', aiError.message)
      // Graceful degradation: show user-friendly message instead of blank response
      return NextResponse.json(
        {
          success: false,
          error: 'AI features temporarily unavailable',
          message:
            lang === 'es'
              ? 'Las explicaciones de IA no están disponibles en este momento. Intenta más tarde.'
              : 'AI explanations are temporarily unavailable. Please try again later.',
        },
        { status: 503 }
      )
    }
  } catch (error) {
    console.error('[api/ai/explain] Request error:', error)
    return NextResponse.json({ error: 'Request failed' }, { status: 500 })
  }
}
