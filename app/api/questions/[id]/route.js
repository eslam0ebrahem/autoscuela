import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import Question from '@/models/Question'
import { getCurrentUser } from '@/lib/auth'
import { isValidObjectId } from '@/lib/utils'

/**
 * GET /api/questions/[id]
 * Returns full data for a single question
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params
    if (!id || !isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid or missing question ID' }, { status: 400 })
    }

    await connectDB()

    const question = await Question.findById(id).lean()
    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    return NextResponse.json({ question })
  } catch (error) {
    console.error('[api/questions/[id]] GET error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
