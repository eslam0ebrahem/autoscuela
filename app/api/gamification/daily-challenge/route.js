import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import User from '@/models/User'
import Question from '@/models/Question'
import ExamSession from '@/models/ExamSession'
import { getCurrentUser } from '@/lib/auth'
import { getMadridStartOfDay, XP } from '@/lib/gamification'
import { selectAdaptiveQuestions } from '@/lib/adaptive-selection'

const DAILY_CHALLENGE_QUESTIONS = 10

export async function GET(request) {
  try {
    const tokenData = await getCurrentUser(request)
    if (!tokenData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()

    const user = await User.findById(tokenData.userId).select('gamification')
    const todayStart = getMadridStartOfDay()

    const completedToday =
      user.gamification.dailyChallengeCompletedAt &&
      new Date(user.gamification.dailyChallengeCompletedAt) >= todayStart

    // Check if there's an in-progress daily challenge
    const activeSession = await ExamSession.findOne({
      userId: tokenData.userId,
      mode: 'daily_challenge',
      status: 'in_progress',
      createdAt: { $gte: todayStart },
    })

    return NextResponse.json({
      completedToday,
      activeSessionId: activeSession?._id || null,
      streak: user.gamification.dailyChallengeStreak || 0,
      xpReward: XP.DAILY_CHALLENGE,
    })
  } catch (error) {
    console.error('Daily challenge error:', error)
    return NextResponse.json({ error: 'Failed to fetch daily challenge' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const tokenData = await getCurrentUser(request)
    if (!tokenData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()

    const user = await User.findById(tokenData.userId)
    if (!user?.isPremium) {
      return NextResponse.json({ error: 'Premium required' }, { status: 403 })
    }

    const todayStart = getMadridStartOfDay()

    // Check if already completed today
    if (
      user.gamification.dailyChallengeCompletedAt &&
      new Date(user.gamification.dailyChallengeCompletedAt) >= todayStart
    ) {
      return NextResponse.json(
        { error: 'Daily challenge already completed today' },
        { status: 400 }
      )
    }

    // Check for existing in-progress session
    const existing = await ExamSession.findOne({
      userId: user._id,
      mode: 'daily_challenge',
      status: 'in_progress',
      createdAt: { $gte: todayStart },
    })

    if (existing) {
      return NextResponse.json({ sessionId: existing._id, resumed: true })
    }

    // Pick questions using adaptive selection focusing on weak areas
    const questionIds = await selectAdaptiveQuestions(user._id, DAILY_CHALLENGE_QUESTIONS, {
      mode: 'daily_challenge',
    })

    if (questionIds.length === 0) {
      return NextResponse.json({ error: 'No questions available' }, { status: 404 })
    }

    const session = await ExamSession.create({
      userId: user._id,
      mode: 'daily_challenge',
      language: user.preferences.language,
      assistanceMode: 'instant',
      questionIds,
    })

    return NextResponse.json({
      sessionId: session._id,
      totalQuestions: questionIds.length,
    })
  } catch (error) {
    console.error('Start daily challenge error:', error)
    return NextResponse.json({ error: 'Failed to start daily challenge' }, { status: 500 })
  }
}
