import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import connectDB from '@/lib/db'
import StudyPlan from '@/models/StudyPlan'

// ---------------------------------------------------------------------------
// POST — Save / update the study plan
// ---------------------------------------------------------------------------
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

    // Compute daily goals based on the user's available time
    const mins = Number(dailyMinutes) || 30
    const dailyGoals = {
      exams: mins >= 120 ? 4 : mins >= 60 ? 2 : 1,
      customQuestions: mins >= 120 ? 50 : mins >= 60 ? 30 : mins >= 30 ? 20 : 10,
      minutesTarget: mins,
    }

    const plan = await StudyPlan.findOneAndUpdate(
      { userId: tokenData.userId },
      {
        targetDate,
        dailyMinutes: mins,
        planData,
        dailyGoals,
        status: 'active',
        // Reset tracking when creating/updating a plan
        planStreak: 0,
        bestPlanStreak: 0,
        dailyHistory: [],
        lastGoalMetDate: null,
      },
      { upsert: true, new: true }
    )

    return NextResponse.json({ success: true, plan })
  } catch (error) {
    console.error('[POST /api/study-plan] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// GET — Retrieve the active study plan
// ---------------------------------------------------------------------------
export async function GET(request) {
  try {
    const tokenData = await getCurrentUser(request)
    if (!tokenData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const plan = await StudyPlan.findOne({ userId: tokenData.userId, status: 'active' }).lean()

    if (!plan) {
      return NextResponse.json({ plan: null })
    }

    return NextResponse.json({ plan })
  } catch (error) {
    console.error('[GET /api/study-plan] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// PATCH — Update daily goals on an existing plan
// ---------------------------------------------------------------------------
export async function PATCH(request) {
  try {
    const tokenData = await getCurrentUser(request)
    if (!tokenData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { dailyGoals, status } = body

    await connectDB()

    const updates = {}
    if (dailyGoals) {
      if (dailyGoals.exams != null) updates['dailyGoals.exams'] = dailyGoals.exams
      if (dailyGoals.customQuestions != null) updates['dailyGoals.customQuestions'] = dailyGoals.customQuestions
      if (dailyGoals.minutesTarget != null) {
        updates['dailyGoals.minutesTarget'] = dailyGoals.minutesTarget
        updates.dailyMinutes = dailyGoals.minutesTarget
      }
    }
    if (status) {
      updates.status = status
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const plan = await StudyPlan.findOneAndUpdate(
      { userId: tokenData.userId, status: 'active' },
      { $set: updates },
      { new: true }
    )

    if (!plan) {
      return NextResponse.json({ error: 'No active plan found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, plan })
  } catch (error) {
    console.error('[PATCH /api/study-plan] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
