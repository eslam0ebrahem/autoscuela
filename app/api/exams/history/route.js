import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import ExamSession from '@/models/ExamSession'
import { getCurrentUser } from '@/lib/auth'
import { parsePositiveInt } from '@/lib/utils'

// ---------------------------------------------------------------------------
// AI HELPER: Compute local performance trend from sessions (no API call)
// ---------------------------------------------------------------------------
function computeLocalTrend(sessions) {
  if (sessions.length < 2) {
    return { trend: 'insufficient_data', improvementRate: null, streakDays: 0, bestScore: null }
  }

  // Sort oldest-first for trend calculation
  const sorted = [...sessions].sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt))

  const scores = sorted.map((s) => s.score ?? 0)
  const passRate = Math.round((sessions.filter((s) => s.passed).length / sessions.length) * 100)
  const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
  const bestScore = Math.max(...scores)
  const recentAvg = scores.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, scores.length)
  const olderAvg =
    scores.slice(0, -3).length > 0
      ? scores.slice(0, -3).reduce((a, b) => a + b, 0) / scores.slice(0, -3).length
      : recentAvg

  const improvementRate =
    olderAvg > 0
      ? Math.round(((recentAvg - olderAvg) / olderAvg) * 100 * 10) / 10 // one decimal
      : 0

  const trend = improvementRate > 5 ? 'improving' : improvementRate < -5 ? 'declining' : 'stable'

  // Consecutive study days
  const uniqueDays = [...new Set(sessions.map((s) => new Date(s.completedAt).toDateString()))]
    .length

  // Topic weakness analysis from all sessions
  const topicErrors = {}
  for (const s of sessions) {
    for (const tb of s.topicBreakdown ?? []) {
      if (!topicErrors[tb.tag]) topicErrors[tb.tag] = { tag: tb.tag, errors: 0, total: 0 }
      topicErrors[tb.tag].errors += tb.total - tb.correct
      topicErrors[tb.tag].total += tb.total
    }
  }

  const weakTopics = Object.values(topicErrors)
    .filter((t) => t.total >= 3)
    .sort((a, b) => b.errors / b.total - a.errors / a.total)
    .slice(0, 3)
    .map((t) => ({ tag: t.tag, errorRate: Math.round((t.errors / t.total) * 100) }))

  return {
    trend,
    improvementRate,
    passRate,
    avgScore,
    bestScore,
    studyDays: uniqueDays,
    weakTopics,
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------
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
        .select(
          'mode score errorCount passed completedAt language topicFilters totalTimeTakenSeconds topicBreakdown createdAt'
        ),
      ExamSession.countDocuments(query),
    ])

    // ── AI: Compute local trend (no API call, instant) ────────────────────
    const aiTrend = computeLocalTrend(sessions)

    return NextResponse.json({
      sessions,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      // ✨ AI-powered additions
      aiTrend, // { trend, improvementRate, passRate, avgScore, bestScore, studyDays, weakTopics }
    })
  } catch (error) {
    console.error('[history] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 })
  }
}
