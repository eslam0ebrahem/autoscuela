import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getQuestionExplanation } from '@/lib/groq'
import Question from '@/models/Question'
import connectDB from '@/lib/db'
import { isValidObjectId } from '@/lib/utils'

export const runtime = 'nodejs'
export const maxDuration = 20

export async function POST(request) {
  try {
    const tokenData = await getCurrentUser(request)
    if (!tokenData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { questionId, selectedIdx, lang = 'es' } = await request.json()

    if (!questionId || !isValidObjectId(questionId)) {
      return NextResponse.json({ error: 'Invalid questionId' }, { status: 400 })
    }

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
