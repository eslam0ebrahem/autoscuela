import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import User from '@/models/User'
import UserAnswer from '@/models/UserAnswer'
import ExamSession from '@/models/ExamSession'
import { getCurrentUser } from '@/lib/auth'
import { getAIInsights } from '@/lib/groq'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const MIN_QUESTIONS_FOR_AI = 60
const CACHE_HOURS = 4

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Milliseconds since a Date object. */
const hoursSince = (date) => (Date.now() - new Date(date).getTime()) / 3_600_000

/**
 * Map snake_case AI insight keys to the camelCase schema.
 */
function normalizeInsights(insights) {
  return {
    readinessScore: insights.readiness_score,
    weakTopics: insights.weak_topics,
    coachMessage: insights.coach_message,
    recommendedAction: insights.recommended_action,
    predictedReadyDate: insights.predicted_ready_date,
    improvementRate: insights.improvement_rate,
    studyTips: insights.study_tips,
    topicPriorityOrder: insights.topic_priority_order,
    lastUpdated: new Date(),
  }
}

/**
 * Convert normalized insights to MongoDB update document.
 */
function insightsToUpdateDoc(normalized) {
  const update = {}
  for (const [key, value] of Object.entries(normalized)) {
    update[`aiInsights.${key}`] = value
  }
  return update
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(request) {
  try {
    // ── Auth ────────────────────────────────────────────────────────────────
    const tokenData = await getCurrentUser(request)
    if (!tokenData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const user = await User.findById(tokenData.userId)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const lang = user.preferences?.language ?? 'en'

    // ── Minimum questions gate ───────────────────────────────────────────────
    const totalAnswered = await UserAnswer.countDocuments({ userId: user._id })

    if (totalAnswered < MIN_QUESTIONS_FOR_AI) {
      const message =
        lang === 'es'
          ? `Responde al menos ${MIN_QUESTIONS_FOR_AI} preguntas para desbloquear el análisis IA. Has respondido ${totalAnswered} hasta ahora.`
          : `Answer at least ${MIN_QUESTIONS_FOR_AI} questions to unlock AI insights. You've answered ${totalAnswered} so far.`

      return NextResponse.json({
        insights: null,
        message,
        progress: totalAnswered,
        required: MIN_QUESTIONS_FOR_AI,
      })
    }

    // ── Cache check (skip with ?force=true during dev / manual refresh) ──────
    const { searchParams } = new URL(request.url)
    const forceRefresh = searchParams.get('force') === 'true'

    if (!forceRefresh && user.aiInsights?.lastUpdated) {
      if (hoursSince(user.aiInsights.lastUpdated) < CACHE_HOURS) {
        // Check if a newer exam was completed after the cache was made
        const latestExam = await ExamSession.findOne({ userId: user._id, status: 'completed' })
          .sort({ completedAt: -1 })
          .select('completedAt')
          .lean()
        const cacheDate = user.aiInsights.lastUpdated
        if (!latestExam?.completedAt || latestExam.completedAt <= cacheDate) {
          return NextResponse.json({
            insights: user.aiInsights,
            cached: true,
            cachedAt: cacheDate,
          })
        }
        // Newer exam exists — fall through to regenerate insights
      }
    }

    // ── Aggregate & call Groq ────────────────────────────────────────────────
    const [aggregatedData, studyTrends] = await Promise.all([
      UserAnswer.aggregateForAI(user._id),
      UserAnswer.getStudyTrends(user._id, 14).catch(() => null),
    ])

    if (!aggregatedData || Object.keys(aggregatedData).length === 0) {
      return NextResponse.json(
        { error: 'Not enough data to generate insights. Keep practicing!' },
        { status: 422 }
      )
    }

    const insights = await getAIInsights(lang, aggregatedData, studyTrends)

    // ── Persist to cache ─────────────────────────────────────────────────────
    const normalized = normalizeInsights(insights)
    await User.findByIdAndUpdate(user._id, { $set: insightsToUpdateDoc(normalized) })

    return NextResponse.json({ insights: normalized, cached: false })
  } catch (error) {
    console.error('[ai-insights] Unhandled error:', error)
    return NextResponse.json(
      { error: 'Failed to generate insights. Please try again later.' },
      { status: 500 }
    )
  }
}
