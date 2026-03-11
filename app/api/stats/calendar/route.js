import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import UserAnswer from '@/models/UserAnswer'
import { getCurrentUser } from '@/lib/auth'
import mongoose from 'mongoose'

/**
 * GET /api/stats/calendar
 * Returns 365 days of study activity for calendar heatmap
 */
export async function GET(request) {
  try {
    const tokenData = await getCurrentUser(request)
    if (!tokenData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()

    const objectId = new mongoose.Types.ObjectId(tokenData.userId)
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - 365)

    const calendarData = await UserAnswer.aggregate([
      {
        $match: {
          userId: objectId,
          createdAt: { $gte: cutoffDate },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          questions: { $sum: 1 },
          correct: { $sum: { $cond: ['$is_correct', 1, 0] } },
          totalTime: { $sum: '$time_taken_seconds' },
        },
      },
      {
        $project: {
          date: '$_id',
          questions: 1,
          correct: 1,
          accuracy: {
            $cond: [
              { $gt: ['$questions', 0] },
              { $round: [{ $multiply: [{ $divide: ['$correct', '$questions'] }, 100] }, 0] },
              0,
            ],
          },
          minutes: { $round: [{ $divide: ['$totalTime', 60] }, 0] },
          _id: 0,
        },
      },
      { $sort: { date: 1 } },
    ])

    return NextResponse.json({
      calendarData,
      days: calendarData.length,
    })
  } catch (error) {
    console.error('Calendar stats error:', error)
    return NextResponse.json({ error: 'Failed to fetch calendar data' }, { status: 500 })
  }
}
