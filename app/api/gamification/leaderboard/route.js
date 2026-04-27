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

    // Lazily reset weekly XP for all users whose week has rolled over.
    // This updateMany is idempotent under concurrent requests: the filter matches
    // only users where weeklyXPResetAt < currentWeekStart (or missing). The $set
    // immediately writes weeklyXPResetAt = currentWeekStart, so any subsequent
    // concurrent call finds 0 matching documents and is a no-op. No mutex needed.
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
          'gamification.rank': 0, // Reset rank after weekly reset
        },
      }
    )

    // ── OPTIMIZED: Get top users using pre-calculated rank field (instant query)
    const topUsers = await User.find({ 'gamification.weeklyXP': { $gt: 0 } })
      .sort({ 'gamification.weeklyXP': -1 })
      .limit(50)
      .select(
        'nickname gamification.weeklyXP gamification.totalXP gamification.currentStreak gamification.rank'
      )
      .lean()

    const leaderboard = topUsers.map((user, index) => ({
      rank: index + 1,
      nickname: user.nickname,
      weeklyXP: user.gamification.weeklyXP,
      streak: user.gamification.currentStreak,
      isCurrentUser: user._id.toString() === tokenData.userId,
    }))

    const currentUser = await User.findById(tokenData.userId)
      .select('nickname gamification.weeklyXP gamification.currentStreak gamification.rank')
      .lean()

    let userRank = 0
    const currentUserIndex = topUsers.findIndex(
      (u) => u._id.toString() === tokenData.userId
    )
    
    if (currentUserIndex !== -1) {
      userRank = currentUserIndex + 1
    } else if (currentUser?.gamification?.weeklyXP > 0) {
      // Calculate exact rank for users outside top 50 to avoid stale cached ranks
      userRank = (await User.countDocuments({ 'gamification.weeklyXP': { $gt: currentUser.gamification.weeklyXP } })) + 1
    }

    return NextResponse.json({
      leaderboard,
      userPosition: {
        rank: userRank > 0 ? userRank : 'unranked',
        weeklyXP: currentUser?.gamification?.weeklyXP || 0,
        nickname: currentUser?.nickname,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 })
  }
}
