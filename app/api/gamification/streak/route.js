import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import User from '@/models/User'
import { getCurrentUser } from '@/lib/auth'
import { shouldStreakBreak, shouldResetWeeklyXP, getMadridStartOfWeek } from '@/lib/gamification'

export async function GET(request) {
  try {
    const tokenData = await getCurrentUser(request)
    if (!tokenData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()

    const user = await User.findById(tokenData.userId).select('gamification')
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const updates = {}

    // Check and reset weekly XP if week rolled over
    if (shouldResetWeeklyXP(user.gamification.weeklyXPResetAt)) {
      updates['gamification.weeklyXP'] = 0
      updates['gamification.weeklyXPResetAt'] = getMadridStartOfWeek()
    }

    // If streak is broken, reset it
    const streakBroken = shouldStreakBreak(user.gamification.lastStudyDate)
    if (streakBroken && user.gamification.currentStreak > 0) {
      updates['gamification.currentStreak'] = 0
    }

    // Apply updates if any
    if (Object.keys(updates).length > 0) {
      await User.findByIdAndUpdate(tokenData.userId, { $set: updates })
    }

    return NextResponse.json({
      currentStreak: streakBroken ? 0 : user.gamification.currentStreak,
      maxStreak: user.gamification.maxStreak,
      totalXP: user.gamification.totalXP,
      weeklyXP: updates['gamification.weeklyXP'] === 0 ? 0 : user.gamification.weeklyXP,
      lastStudyDate: user.gamification.lastStudyDate,
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch streak' }, { status: 500 })
  }
}
