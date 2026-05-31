import { NextResponse } from 'next/server'
import mongoose from 'mongoose'
import connectDB from '@/lib/db'
import User from '@/models/User'
import ExamSession from '@/models/ExamSession'
import UserAnswer from '@/models/UserAnswer'
import StudyPlan from '@/models/StudyPlan'
import { getCurrentUser } from '@/lib/auth'
import { getMadridStartOfWeek, getMadridStartOfDay } from '@/lib/gamification'
import { getUserSkillProfile } from '@/lib/user-skill'
import { computeReadinessScore } from '@/lib/services/ai/coachService'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const LEADERBOARD_LIMIT = 10
const DEFAULT_XP_THRESHOLD = 0

// ---------------------------------------------------------------------------
// Helper – get today's date string in YYYY-MM-DD (Madrid timezone)
// ---------------------------------------------------------------------------
function getTodayDateString() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date())
}

// ---------------------------------------------------------------------------
// Helper – compute daily plan progress
// ---------------------------------------------------------------------------
async function computeDailyProgress(userId, startOfToday, activePlan) {
  // 1. Completed exams today (official mode only for plan tracking)
  const examsTakenToday = await ExamSession.countDocuments({
    userId,
    status: 'completed',
    completedAt: { $gte: startOfToday },
  })

  // 2. Total questions answered today (all modes — the user is studying)
  const questionsAnsweredToday = await UserAnswer.countDocuments({
    userId,
    createdAt: { $gte: startOfToday },
  })

  // 3. Minutes studied today — sum time_taken_seconds for today's answers
  const minutesResult = await UserAnswer.aggregate([
    {
      $match: {
        userId: typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId,
        createdAt: { $gte: startOfToday },
      },
    },
    { $group: { _id: null, totalSeconds: { $sum: '$time_taken_seconds' } } },
  ])
  const minutesStudied = Math.round((minutesResult[0]?.totalSeconds || 0) / 60)

  const examsTarget = activePlan.dailyGoals?.exams || 1
  const questionsTarget = activePlan.dailyGoals?.customQuestions || 20
  const minutesTarget = activePlan.dailyGoals?.minutesTarget || activePlan.dailyMinutes || 30

  const examsPercent = examsTarget > 0 ? Math.min(100, Math.round((examsTakenToday / examsTarget) * 100)) : 100
  const questionsPercent = questionsTarget > 0 ? Math.min(100, Math.round((questionsAnsweredToday / questionsTarget) * 100)) : 100
  const minutesPercent = minutesTarget > 0 ? Math.min(100, Math.round((minutesStudied / minutesTarget) * 100)) : 100

  const goalsMet = examsTakenToday >= examsTarget &&
    questionsAnsweredToday >= questionsTarget &&
    minutesStudied >= minutesTarget

  return {
    exams: { current: examsTakenToday, target: examsTarget, percent: examsPercent },
    questions: { current: questionsAnsweredToday, target: questionsTarget, percent: questionsPercent },
    minutes: { current: minutesStudied, target: minutesTarget, percent: minutesPercent },
    goalsMet,
    overallPercent: Math.round((examsPercent + questionsPercent + minutesPercent) / 3),
  }
}

// ---------------------------------------------------------------------------
// Helper – update daily history on the plan & compute plan streak
// ---------------------------------------------------------------------------
async function updatePlanDailyHistory(planId, dailyProgress) {
  const todayStr = getTodayDateString()
  const plan = await StudyPlan.findById(planId)
  if (!plan) return null

  // Upsert today's entry in dailyHistory
  const existingIdx = plan.dailyHistory.findIndex((h) => h.date === todayStr)
  const todayLog = {
    date: todayStr,
    examsCompleted: dailyProgress.exams.current,
    questionsAnswered: dailyProgress.questions.current,
    minutesStudied: dailyProgress.minutes.current,
    goalsMet: dailyProgress.goalsMet,
  }

  if (existingIdx >= 0) {
    plan.dailyHistory[existingIdx] = todayLog
  } else {
    plan.dailyHistory.push(todayLog)
  }

  // Recompute plan streak (consecutive days with goalsMet, ending today or yesterday)
  const sortedHistory = [...plan.dailyHistory].sort((a, b) => b.date.localeCompare(a.date))
  let streak = 0
  const today = new Date()

  for (let i = 0; i < 365; i++) {
    const checkDate = new Date(today.getTime() - i * 24 * 60 * 60 * 1000)
    const checkStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Madrid',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(checkDate)
    const entry = sortedHistory.find((h) => h.date === checkStr)

    if (entry?.goalsMet) {
      streak++
    } else if (i === 0) {
      // Today hasn't been fully logged yet or goals not met — skip and check from yesterday
      continue
    } else {
      break
    }
  }

  plan.planStreak = streak
  if (streak > (plan.bestPlanStreak || 0)) {
    plan.bestPlanStreak = streak
  }
  if (dailyProgress.goalsMet) {
    plan.lastGoalMetDate = todayStr
  }

  await plan.save()

  return {
    planStreak: plan.planStreak,
    bestPlanStreak: plan.bestPlanStreak || 0,
    daysCompleted: plan.dailyHistory.filter((h) => h.goalsMet).length,
    dailyHistory: plan.dailyHistory.slice(-7), // last 7 days for the frontend
  }
}

// ---------------------------------------------------------------------------
// Helper – compute plan-level stats
// ---------------------------------------------------------------------------
function computePlanStats(activePlan) {
  const now = new Date()
  const target = new Date(activePlan.targetDate)
  const created = new Date(activePlan.createdAt)

  const totalDays = Math.max(1, Math.ceil((target - created) / (1000 * 60 * 60 * 24)))
  const daysElapsed = Math.max(0, Math.ceil((now - created) / (1000 * 60 * 60 * 24)))
  const daysRemaining = Math.max(0, Math.ceil((target - now) / (1000 * 60 * 60 * 24)))
  const timelinePercent = Math.min(100, Math.round((daysElapsed / totalDays) * 100))

  return { totalDays, daysElapsed, daysRemaining, timelinePercent }
}

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
    let planStats = null
    let planTracking = null

    if (activePlan) {
      dailyProgress = await computeDailyProgress(tokenData.userId, startOfToday, activePlan)
      planStats = computePlanStats(activePlan)

      // Update daily history asynchronously (fire-and-forget for speed)
      // We still await because we need the streak data
      planTracking = await updatePlanDailyHistory(activePlan._id, dailyProgress)
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
      activePlan: activePlan ? {
        _id: activePlan._id,
        targetDate: activePlan.targetDate,
        dailyMinutes: activePlan.dailyMinutes,
        dailyGoals: activePlan.dailyGoals,
        status: activePlan.status,
        createdAt: activePlan.createdAt,
      } : null,
      dailyProgress,
      planStats,
      planTracking,
      pendingReviewsCount,
      studyTrends,
    })
  } catch (error) {
    console.error('[dashboard] Unhandled error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
