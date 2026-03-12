import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import ExamSession from '@/models/ExamSession'
import User from '@/models/User'
import { getCurrentUser } from '@/lib/auth'
import { checkBadgeConditions, XP, getMadridStartOfDay, shouldStreakBreak, isTodayStudied } from '@/lib/gamification'
import UserAnswer from '@/models/UserAnswer'
import { getUserSkillProfile } from '@/lib/user-skill'

const MAX_ERRORS_TO_PASS = 3

export async function POST(request, { params }) {
  try {
    const { sessionId } = await params
    const tokenData = await getCurrentUser(request)
    if (!tokenData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()

    const session = await ExamSession.findOne({
      _id: sessionId,
      userId: tokenData.userId,
      status: 'in_progress',
    })

    if (!session) return NextResponse.json({ error: 'Session not found or already completed' }, { status: 404 })

    // Calculate results
    const correctCount = session.answers.filter((a) => a.isCorrect).length
    const totalQuestions = session.questionIds.length
    const errors = totalQuestions - correctCount
    const passed = errors <= MAX_ERRORS_TO_PASS

    const totalTime = session.answers.reduce((sum, a) => sum + (a.timeTakenSeconds || 0), 0)

    session.score = correctCount
    session.errorCount = errors
    session.passed = passed
    session.status = 'completed'
    session.completedAt = new Date()
    session.totalTimeTakenSeconds = totalTime
    await session.save()

    // Update user gamification
    const user = await User.findById(tokenData.userId)
    const xpEarned = passed ? XP.EXAM_PASS : XP.EXAM_FAIL

    const streakBroken = shouldStreakBreak(user.gamification.lastStudyDate)
    let newStreak = user.gamification.currentStreak

    if (streakBroken) {
      newStreak = 1
    } else if (!isTodayStudied(user.gamification.lastStudyDate)) {
      newStreak += 1
    }

    const examLangs = user.gamification.examLanguages || []
    if (!examLangs.includes(session.language)) {
      examLangs.push(session.language)
    }

    const todayStart = getMadridStartOfDay()
    const dailyCount = await UserAnswer.countDocuments({
      userId: user._id,
      createdAt: { $gte: todayStart },
    })

    const newBadges = checkBadgeConditions(
      user,
      { ...session.toObject(), score: correctCount },
      dailyCount,
      { examLanguages: examLangs, newStreak }
    )

    // Recalculate and cache user skill profile
    const skillProfile = await getUserSkillProfile(tokenData.userId)

    await User.findByIdAndUpdate(tokenData.userId, {
      $set: {
        'gamification.currentStreak': newStreak,
        'gamification.maxStreak': Math.max(user.gamification.maxStreak || 0, newStreak),
        'gamification.lastStudyDate': new Date(),
        'gamification.examLanguages': examLangs,
        'skillProfile.overallLevel': skillProfile.overallLevel,
        'skillProfile.topicLevels': skillProfile.topicLevels,
        'skillProfile.lastCalculated': new Date(),
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
        totalTime,
        accuracy: totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0,
        skillLevel: skillProfile.overallLevel,
      },
    })
  } catch (error) {
    console.error('Submit exam error:', error)
    return NextResponse.json({ error: 'Failed to submit exam' }, { status: 500 })
  }
}
