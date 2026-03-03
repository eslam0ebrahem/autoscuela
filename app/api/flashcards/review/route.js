import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import FlashcardProgress from '@/models/FlashcardProgress'
import User from '@/models/User'
import { getCurrentUser } from '@/lib/auth'
import { XP, shouldStreakBreak, isTodayStudied } from '@/lib/gamification'

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

    // Update streak and XP (flashcard reviews should count as study activity)
    const user = await User.findById(tokenData.userId).select('gamification')

    const streakBroken = shouldStreakBreak(user.gamification.lastStudyDate)
    let newStreak = user.gamification.currentStreak

    if (streakBroken) {
      newStreak = 1
    } else if (!isTodayStudied(user.gamification.lastStudyDate)) {
      newStreak += 1
    }

    const xpUpdate = quality === 1 ? XP.FLASHCARD_CORRECT : 0

    await User.findByIdAndUpdate(tokenData.userId, {
      $set: {
        'gamification.currentStreak': newStreak,
        'gamification.maxStreak': Math.max(user.gamification.maxStreak || 0, newStreak),
        'gamification.lastStudyDate': new Date(),
      },
      $inc: {
        'gamification.totalXP': xpUpdate,
        'gamification.weeklyXP': xpUpdate,
      },
    })

    return NextResponse.json({
      updated: true,
      status: progress.status,
      nextReview: progress.nextReviewDate,
      streakUpdated: true,
      newStreak,
    })
  } catch (error) {
    console.error('Flashcard review error:', error)
    return NextResponse.json({ error: 'Failed to update review' }, { status: 500 })
  }
}
