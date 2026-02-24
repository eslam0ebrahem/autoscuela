import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import User from '@/models/User'
import { getCurrentUser } from '@/lib/auth'
import { shouldStreakBreak, BADGES } from '@/lib/gamification'

export async function GET(request) {
  try {
    const tokenData = await getCurrentUser(request)
    if (!tokenData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()

    const user = await User.findById(tokenData.userId).select('gamification')
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const streakBroken = shouldStreakBreak(user.gamification.lastStudyDate)

    // If streak is broken, reset it
    if (streakBroken && user.gamification.currentStreak > 0) {
      await User.findByIdAndUpdate(tokenData.userId, {
        $set: { 'gamification.currentStreak': 0 },
      })
    }

    return NextResponse.json({
      currentStreak: streakBroken ? 0 : user.gamification.currentStreak,
      maxStreak: user.gamification.maxStreak,
      totalXP: user.gamification.totalXP,
      weeklyXP: user.gamification.weeklyXP,
      lastStudyDate: user.gamification.lastStudyDate,
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch streak' }, { status: 500 })
  }
}
