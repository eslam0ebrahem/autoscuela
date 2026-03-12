import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import ExamSession from '@/models/ExamSession'
import { getCurrentUser } from '@/lib/auth'

/**
 * PATCH /api/exams/[sessionId]/flag
 * Toggle flag on a specific question in an exam session
 */
export async function PATCH(request, { params }) {
  try {
    const { sessionId } = await params
    const tokenData = await getCurrentUser(request)
    if (!tokenData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()

    const { questionId, flagged } = await request.json()

    const session = await ExamSession.findOne({
      _id: sessionId,
      userId: tokenData.userId,
      status: 'in_progress',
    })

    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    // Find and update the answer's flagged status
    const answerIndex = session.answers.findIndex((a) => a.questionId.toString() === questionId.toString())

    if (answerIndex === -1) {
      return NextResponse.json({ error: 'Answer not found' }, { status: 404 })
    }

    session.answers[answerIndex].flagged = flagged
    await session.save()

    return NextResponse.json({
      success: true,
      flagged: session.answers[answerIndex].flagged,
    })
  } catch (error) {
    console.error('Flag question error:', error)
    return NextResponse.json({ error: 'Failed to flag question' }, { status: 500 })
  }
}
