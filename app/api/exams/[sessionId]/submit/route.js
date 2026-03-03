import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import ExamSession from '@/models/ExamSession'
import User from '@/models/User'
import { getCurrentUser } from '@/lib/auth'
import { checkBadgeConditions, XP, getMadridStartOfDay, shouldStreakBreak, isTodayStudied } from '@/lib/gamification'
import UserAnswer from '@/models/UserAnswer'

const MAX_ERRORS_TO_PASS = 3

export async function POST(request, { params }) {
  try {
    const tokenData = await getCurrentUser(request)
    if (!tokenData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()

    const session = await ExamSession.findOne({
      _id: params.sessionId,
      userId: tokenData.userId,
      status: 'in_progress',
    })

    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    // Calculate results
    const correctCount = session.answers.filter((a) => a.isCorrect).length
    const totalQuestions = session.questionIds.length
    const errors = totalQuestions - correctCount
    const passed = errors <= MAX_ERRORS_TO_PASS

    session.score = correctCount
    session.errorCount = errors
    session.passed = passed
    session.status = 'completed'
    session.completedAt = new Date()
    await session.save()

    // Update user gamification
    const user = await User.findById(tokenData.userId)
    const xpEarned = passed ? XP.EXAM_PASS : XP.EXAM_FAIL

    // Update streak
    const streakBroken = shouldStreakBreak(user.gamification.lastStudyDate)
    let newStreak = user.gamification.currentStreak

    if (streakBroken) {
      newStreak = 1
    } else if (!isTodayStudied(user.gamification.lastStudyDate)) {
      newStreak += 1
    }

    // Track languages used
    const examLangs = user.gamification.examLanguages || []
    if (!examLangs.includes(session.language)) {
      examLangs.push(session.language)
    }

    // Daily answer count for Marathoner badge
    const todayStart = getMadridStartOfDay()
    const dailyCount = await UserAnswer.countDocuments({
      userId: user._id,
      createdAt: { $gte: todayStart },
    })

    // Check badges (bilingual + ai_ready now handled inside checkBadgeConditions)
    const newBadges = checkBadgeConditions(
      user,
      { ...session.toObject(), score: correctCount },
      dailyCount,
      { examLanguages: examLangs }
    )

    await User.findByIdAndUpdate(tokenData.userId, {
      $set: {
        'gamification.currentStreak': newStreak,
        'gamification.maxStreak': Math.max(user.gamification.maxStreak || 0, newStreak),
        'gamification.lastStudyDate': new Date(),
        'gamification.examLanguages': examLangs,
      },
      $inc: {
        'gamification.totalXP': xpEarned,
        'gamification.weeklyXP': xpEarned,
      },
      $addToSet: {
        'gamification.earnedBadges': { $each: newBadges },
      },
    })

    return NextResponse.json({
      result: {
        score: correctCount,
        total: totalQuestions,
        errors,
        passed,
        xpEarned,
        newBadges,
        newStreak,
      },
    })
  } catch (error) {
    console.error('Submit exam error:', error)
    return NextResponse.json({ error: 'Failed to submit exam' }, { status: 500 })
  }
}
