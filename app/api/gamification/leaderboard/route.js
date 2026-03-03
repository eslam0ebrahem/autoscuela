import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import User from '@/models/User'
import { getCurrentUser } from '@/lib/auth'
import { shouldResetWeeklyXP, getMadridStartOfWeek } from '@/lib/gamification'

export async function GET(request) {
  try {
    const tokenData = await getCurrentUser(request)
    if (!tokenData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()

    // Lazily reset weekly XP for all users whose week has rolled over
    const currentWeekStart = getMadridStartOfWeek()
    await User.updateMany(
      {
        $or: [
          { 'gamification.weeklyXPResetAt': { $lt: currentWeekStart } },
          { 'gamification.weeklyXPResetAt': { $exists: false } },
        ],
        'gamification.weeklyXP': { $gt: 0 },
      },
      {
        $set: {
          'gamification.weeklyXP': 0,
          'gamification.weeklyXPResetAt': currentWeekStart,
        },
      }
    )

    const topUsers = await User.find({ 'gamification.weeklyXP': { $gt: 0 } })
      .sort({ 'gamification.weeklyXP': -1 })
      .limit(50)
      .select('nickname gamification.weeklyXP gamification.totalXP gamification.currentStreak')

    const leaderboard = topUsers.map((user, index) => ({
      rank: index + 1,
      nickname: user.nickname,
      weeklyXP: user.gamification.weeklyXP,
      streak: user.gamification.currentStreak,
      isCurrentUser: user._id.toString() === tokenData.userId,
    }))

    // Find current user's rank if not in top 50
    const currentUser = await User.findById(tokenData.userId).select(
      'nickname gamification.weeklyXP gamification.currentStreak'
    )
    const userRank = await User.countDocuments({
      'gamification.weeklyXP': { $gt: currentUser?.gamification?.weeklyXP || 0 },
    })

    return NextResponse.json({
      leaderboard,
      userPosition: {
        rank: userRank + 1,
        weeklyXP: currentUser?.gamification?.weeklyXP || 0,
        nickname: currentUser?.nickname,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 })
  }
}
