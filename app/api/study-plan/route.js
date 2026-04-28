import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import connectDB from '@/lib/db'
import StudyPlan from '@/models/StudyPlan'

export async function POST(request) {
  try {
    const tokenData = await getCurrentUser(request)
    if (!tokenData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { targetDate, dailyMinutes, planData } = await request.json()

    if (!targetDate || !planData) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    await connectDB()

    const dailyGoals = {
      exams: dailyMinutes >= 60 ? 2 : 1,
      customQuestions: dailyMinutes >= 30 ? 20 : 10,
    }

    const plan = await StudyPlan.findOneAndUpdate(
      { userId: tokenData.userId },
      {
        targetDate,
        dailyMinutes,
        planData,
        dailyGoals,
        status: 'active',
      },
      { upsert: true, new: true }
    )

    return NextResponse.json({ success: true, plan })
  } catch (error) {
    console.error('[POST /api/study-plan] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
