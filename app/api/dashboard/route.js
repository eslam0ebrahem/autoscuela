import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import User from '@/models/User'
import { getCurrentUser } from '@/lib/auth'
import { getMadridStartOfWeek } from '@/lib/gamification'

export async function GET(request) {
  try {
    const tokenData = await getCurrentUser(request)
    if (!tokenData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()

    const user = await User.findById(tokenData.userId)
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Leaderboard (weekly)
    const currentWeekStart = getMadridStartOfWeek()
    const topUsers = await User.find({ 'gamification.weeklyXP': { $gt: 0 } })
      .sort({ 'gamification.weeklyXP': -1 })
      .limit(10)
      .select('nickname gamification.weeklyXP gamification.totalXP')

    const leaderboard = topUsers.map((u, i) => ({
      nickname: u.nickname,
      xp: u.gamification.weeklyXP,
      isCurrentUser: u._id.toString() === tokenData.userId
    }))

    return NextResponse.json({
      insights: user.aiInsights || null,
      streak: user.gamification.currentStreak || 0,
      badges: user.gamification.earnedBadges || [],
      leaderboard,
      readinessScore: user.aiInsights?.readinessScore || 0,
    })
  } catch (error) {
    console.error('Dashboard API Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
