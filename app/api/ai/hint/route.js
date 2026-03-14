import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getSmartHint } from '@/lib/groq'
import Question from '@/models/Question'
import connectDB from '@/lib/db'
import { isValidObjectId } from '@/lib/utils'

export const runtime = 'nodejs'
export const maxDuration = 15

export async function POST(request) {
  try {
    const tokenData = await getCurrentUser(request)
    if (!tokenData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { questionId, lang = 'es' } = await request.json()

    if (!questionId || !isValidObjectId(questionId)) {
      return NextResponse.json({ error: 'Invalid questionId' }, { status: 400 })
    }

    await connectDB()
    const question = await Question.findById(questionId).lean()

    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    const hint = await getSmartHint({
      question: question.question,
      options: question.options,
      correctIdx: question.correct_option_idx -1,
      lang,
    })

    return NextResponse.json({ hint })
  } catch (error) {
    console.error('[api/ai/hint] Error:', error)
    return NextResponse.json({ error: 'Hint generation failed' }, { status: 500 })
  }
}
