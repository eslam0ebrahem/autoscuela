import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import ExamSession from '@/models/ExamSession'
import { getCurrentUser } from '@/lib/auth'

export async function GET(request) {
  try {
    const tokenData = await getCurrentUser(request)
    if (!tokenData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = 10

    await connectDB()

    const sessions = await ExamSession.find({
      userId: tokenData.userId,
      status: 'completed',
    })
      .sort({ completedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('mode score errors passed completedAt language topicFilters createdAt')

    const total = await ExamSession.countDocuments({
      userId: tokenData.userId,
      status: 'completed',
    })

    return NextResponse.json({
      sessions,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 })
  }
}
