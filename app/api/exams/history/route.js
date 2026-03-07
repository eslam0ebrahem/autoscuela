import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import ExamSession from '@/models/ExamSession'
import { getCurrentUser } from '@/lib/auth'
import { parsePositiveInt } from '@/lib/utils'

export async function GET(request) {
  try {
    const tokenData = await getCurrentUser(request)
    if (!tokenData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(request.url)
    const page = parsePositiveInt(url.searchParams.get('page'), 1)
    const limit = Math.min(parsePositiveInt(url.searchParams.get('limit'), 10), 50)

    await connectDB()

    const query = { userId: tokenData.userId, status: 'completed' }

    const [sessions, total] = await Promise.all([
      ExamSession.find(query)
        .sort({ completedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('mode score errorCount passed completedAt language topicFilters totalTimeTakenSeconds createdAt'),
      ExamSession.countDocuments(query),
    ])

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
