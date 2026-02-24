import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import FlashcardProgress from '@/models/FlashcardProgress'
import User from '@/models/User'
import { getCurrentUser } from '@/lib/auth'
import { XP } from '@/lib/gamification'

export async function POST(request) {
  try {
    const tokenData = await getCurrentUser(request)
    if (!tokenData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { card_id, status } = await request.json()
    // status: 'got_it' | 'needs_practice'
    const quality = status === 'got_it' ? 1 : 0

    await connectDB()

    let progress = await FlashcardProgress.findOne({
      userId: tokenData.userId,
      questionId: card_id,
    })

    if (!progress) {
      progress = new FlashcardProgress({
        userId: tokenData.userId,
        questionId: card_id,
      })
    }

    await progress.updateWithReview(quality)

    // Award XP for correct flashcard answers
    if (quality === 1) {
      await User.findByIdAndUpdate(tokenData.userId, {
        $inc: { 'gamification.totalXP': XP.FLASHCARD_CORRECT, 'gamification.weeklyXP': XP.FLASHCARD_CORRECT },
      })
    }

    return NextResponse.json({ updated: true, status: progress.status, nextReview: progress.nextReviewDate })
  } catch (error) {
    console.error('Flashcard review error:', error)
    return NextResponse.json({ error: 'Failed to update review' }, { status: 500 })
  }
}
