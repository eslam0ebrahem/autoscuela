import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import User from '@/models/User'
import ExamSession from '@/models/ExamSession'
import UserAnswer from '@/models/UserAnswer'
import StudyPlan from '@/models/StudyPlan'
import { getCurrentUser } from '@/lib/auth'
import { getMadridStartOfWeek, getMadridStartOfDay } from '@/lib/gamification'
import { startOfDay } from 'date-fns'
import { getUserSkillProfile } from '@/lib/user-skill'
import { computeReadinessScore } from '@/lib/services/ai/coachService'

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

    // ── Exams Taken Today ─────────────────────────────────────────────────────
    const startOfToday = getMadridStartOfDay()
    const examsTakenToday = await ExamSession.countDocuments({
      userId: tokenData.userId,
      status: 'completed',
      completedAt: { $gte: startOfToday },
    })

    // ── Pending SRS Reviews ──────────────────────────────────────────────────
    const now = new Date()
    const pendingReviewsResult = await UserAnswer.aggregate([
      { $match: { userId: user._id, 'srs.nextReviewAt': { $exists: true } } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$questionId',
          lastNextReview: { $first: '$srs.nextReviewAt' },
        },
      },
      { $match: { lastNextReview: { $lte: now } } },
      { $count: 'count' }
    ])
    const pendingReviewsCount = pendingReviewsResult[0]?.count || 0

    // ── Study Plan & Daily Progress ──────────────────────────────────────────
    const activePlan = await StudyPlan.findOne({ userId: tokenData.userId, status: 'active' }).lean()
    
    let dailyProgress = null
    if (activePlan) {
      const customQuestionsAnsweredToday = await UserAnswer.countDocuments({
        userId: tokenData.userId,
        createdAt: { $gte: startOfToday },
        examSessionId: null
      })
      
      dailyProgress = {
        exams: {
          current: examsTakenToday,
          target: activePlan.dailyGoals?.exams || 1,
        },
        customQuestions: {
          current: customQuestionsAnsweredToday,
          target: activePlan.dailyGoals?.customQuestions || 20,
        }
      }
    }

    // ── Live Readiness Score ────────────────────────────────────────────────
    const [skillProfile, studyTrends] = await Promise.all([
      getUserSkillProfile(tokenData.userId).catch(() => ({})),
      UserAnswer.getStudyTrends(tokenData.userId, 14).catch(() => null),
    ])

    const liveReadinessScore = computeReadinessScore({
      aggregatedData: { overallAccuracy: skillProfile.overallAccuracy },
      studyTrends,
      skillProfile,
    })

    // ── Response payload ─────────────────────────────────────────────────────
    return NextResponse.json({
      insights: user.aiInsights ?? null,
      streak: user.gamification?.currentStreak ?? 0,
      badges: user.gamification?.earnedBadges ?? [],
      leaderboard,
      currentUserRank,
      readinessScore: user.aiInsights?.readinessScore ?? liveReadinessScore,
      weekStart: currentWeekStart.toISOString(),
      examsTakenToday,
      activePlan,
      dailyProgress,
      pendingReviewsCount,
    })
  } catch (error) {
    console.error('[dashboard] Unhandled error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
