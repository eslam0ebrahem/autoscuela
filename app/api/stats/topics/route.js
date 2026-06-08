import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import UserAnswer from '@/models/UserAnswer'
import { getCurrentUser } from '@/lib/auth'

export async function GET(request) {
  try {
    const tokenData = await getCurrentUser(request)
    if (!tokenData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()

    // Aggregate stats for the last 10 years (essentially all time)
    const aggregatedStats = await UserAnswer.aggregateForAI(tokenData.userId, 3650)

    const topics = aggregatedStats.topics.map(t => ({
      tag: { es: t.tag, en: t.tagEn || t.tag },
      attempted: t.attempted,
      correct: t.correct,
      accuracy: t.accuracy,
      avg_time_sec: t.avg_time_sec
    }))

    // Sort by accuracy ascending (weakest first)
    topics.sort((a, b) => a.accuracy - b.accuracy)

    return NextResponse.json({ topics })
  } catch (error) {
    console.error('Topic stats error:', error)
    return NextResponse.json({ error: 'Failed to fetch topic stats' }, { status: 500 })
  }
}
