import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import UserAnswer from '@/models/UserAnswer'
import mongoose from 'mongoose'
import { isValidObjectId } from '@/lib/utils'

/**
 * DELETE /api/mistakes/[id]
 * Deletes user's incorrect answer records for a specific question
 * (Marking it as "mastered" by removing it from the mistakes queue)
 */
export async function DELETE(request, { params }) {
  try {
    const { id } = await params
    if (!id || !isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid or missing question ID' }, { status: 400 })
    }

    const tokenData = await getCurrentUser(request)
    if (!tokenData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()

    const userId = new mongoose.Types.ObjectId(tokenData.userId)
    const questionId = new mongoose.Types.ObjectId(id)

    // We only delete incorrect answers. Correct ones stay as history.
    // Once all incorrect answers are gone, the aggregation in GET /api/mistakes
    // will no longer include this question (unless they fail it again).
    const result = await UserAnswer.deleteMany({
      userId,
      questionId,
      is_correct: false,
    })

    return NextResponse.json({
      success: true,
      deletedCount: result.deletedCount,
      message: 'Mistake history cleared for this question',
    })
  } catch (error) {
    console.error('[api/mistakes/[id]] DELETE error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
