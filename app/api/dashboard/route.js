import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import User from '@/models/User'
import { getCurrentUser } from '@/lib/auth'
import { getMadridStartOfWeek } from '@/lib/gamification'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const LEADERBOARD_LIMIT = 10
const DEFAULT_XP_THRESHOLD = 0

// ---------------------------------------------------------------------------
// Route handler – Dashboard summary
// ---------------------------------------------------------------------------

export async function GET(request) {
  try {
    // ── Auth ────────────────────────────────────────────────────────────────
    const tokenData = await getCurrentUser(request)
    if (!tokenData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const user = await User.findById(tokenData.userId)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // ── Leaderboard (weekly) ─────────────────────────────────────────────────
    const currentWeekStart = getMadridStartOfWeek()

    const topUsers = await User.find({
      'gamification.weeklyXP': { $gt: DEFAULT_XP_THRESHOLD },
    })
      .sort({ 'gamification.weeklyXP': -1 })
      .limit(LEADERBOARD_LIMIT)
      .select('nickname gamification.weeklyXP gamification.totalXP')
      .lean() // ← faster plain objects, no Mongoose overhead

    const currentUserId = tokenData.userId

    const leaderboard = topUsers.map((u, index) => ({
      rank: index + 1,
      nickname: u.nickname ?? 'Anonymous',
      weeklyXP: u.gamification?.weeklyXP ?? 0,
      totalXP: u.gamification?.totalXP ?? 0,
      isCurrentUser: u._id.toString() === currentUserId,
    }))

    // ── Find current user's rank if outside top N ─────────────────────────────
    const userInTop = leaderboard.some((entry) => entry.isCurrentUser)
    let currentUserRank = null

    if (!userInTop && user.gamification?.weeklyXP > DEFAULT_XP_THRESHOLD) {
      const usersAbove = await User.countDocuments({
        'gamification.weeklyXP': { $gt: user.gamification.weeklyXP },
      })
      currentUserRank = usersAbove + 1
    }

    // ── Response payload ─────────────────────────────────────────────────────
    return NextResponse.json({
      insights: user.aiInsights ?? null,
      streak: user.gamification?.currentStreak ?? 0,
      badges: user.gamification?.earnedBadges ?? [],
      leaderboard,
      currentUserRank,
      readinessScore: user.aiInsights?.readinessScore ?? 0,
      weekStart: currentWeekStart.toISOString(),
    })
  } catch (error) {
    console.error('[dashboard] Unhandled error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
