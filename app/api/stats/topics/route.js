import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import User from '@/models/User'
import { getCurrentUser } from '@/lib/auth'

export async function GET(request) {
  try {
    const tokenData = await getCurrentUser(request)
    if (!tokenData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()

    const user = await User.findById(tokenData.userId).select('stats').lean()
    const userStats = user?.stats || { topicStats: {} }

    const topics = []
    const topicStatsMap =
      userStats.topicStats instanceof Map
        ? Object.fromEntries(userStats.topicStats)
        : userStats.topicStats || {}

    for (const [tag, stat] of Object.entries(topicStatsMap)) {
      const attempted = stat.attempted || 0
      const correct = stat.correct || 0
      const topicAccuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : 0
      topics.push({
        tag: { es: tag, en: tag }, // Simplify EN tag for now as it's not cached in stats
        attempted,
        correct,
        accuracy: topicAccuracy,
      })
    }

    // Sort by accuracy ascending (weakest first)
    topics.sort((a, b) => a.accuracy - b.accuracy)

    return NextResponse.json({ topics })
  } catch (error) {
    console.error('Topic stats error:', error)
    return NextResponse.json({ error: 'Failed to fetch topic stats' }, { status: 500 })
  }
}
