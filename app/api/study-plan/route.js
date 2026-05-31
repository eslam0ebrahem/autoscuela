import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import connectDB from '@/lib/db'
import StudyPlan from '@/models/StudyPlan'
import { parseSchema } from '@/lib/schemas'

const StudyPlanPostSchema = z.object({
  targetDate: z.string().min(1),
  dailyMinutes: z.number().int().min(5).max(480).or(z.string().regex(/^\d+$/).transform(Number)),
  planData: z.record(z.any()),
})

// Zod schema for PATCH body validation
const StudyPlanPatchSchema = z.object({
  dailyGoals: z.object({
    exams: z.number().int().min(1).max(10).optional(),
    customQuestions: z.number().int().min(5).max(200).optional(),
    minutesTarget: z.number().int().min(5).max(480).optional(),
  }).optional(),
  status: z.enum(['active', 'completed', 'abandoned']).optional(),
}).refine(
  (data) => data.dailyGoals || data.status,
  { message: 'At least one of dailyGoals or status must be provided' }
)

// ---------------------------------------------------------------------------
// POST — Save / update the study plan
// ---------------------------------------------------------------------------
export async function POST(request) {
  try {
    const tokenData = await getCurrentUser(request)
    if (!tokenData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { data: validated, error: validationError } = parseSchema(StudyPlanPostSchema, body)
    if (validationError) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationError.messages },
        { status: validationError.status }
      )
    }

    const { targetDate, dailyMinutes, planData } = validated

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
      { upsert: true, returnDocument: 'after' }
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

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { data: validated, error: validationError } = parseSchema(StudyPlanPatchSchema, body)
    if (validationError) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationError.messages },
        { status: validationError.status }
      )
    }

    const { dailyGoals, status } = validated

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

    const plan = await StudyPlan.findOneAndUpdate(
      { userId: tokenData.userId, status: 'active' },
      { $set: updates },
      { returnDocument: 'after' }
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
