import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import User from '@/models/User'
import UserAnswer from '@/models/UserAnswer'
import { getCurrentUser } from '@/lib/auth'
import { getAIInsights } from '@/lib/groq'

const MIN_QUESTIONS_FOR_AI = 60
const CACHE_HOURS = 8

export async function GET(request) {
  try {
    const tokenData = await getCurrentUser(request)
    if (!tokenData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()

    const user = await User.findById(tokenData.userId)
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const totalAnswered = await UserAnswer.countDocuments({ userId: user._id })

    if (totalAnswered < MIN_QUESTIONS_FOR_AI) {
      return NextResponse.json({
        insights: null,
        message:
          user.preferences.language === 'es'
            ? `Responde al menos ${MIN_QUESTIONS_FOR_AI} preguntas para desbloquear el análisis IA. Has respondido ${totalAnswered} hasta ahora.`
            : `Answer at least ${MIN_QUESTIONS_FOR_AI} questions to unlock AI insights. You've answered ${totalAnswered} so far.`,
        progress: totalAnswered,
        required: MIN_QUESTIONS_FOR_AI,
      })
    }

    // Check cache
    if (user.aiInsights?.lastUpdated) {
      const hoursSinceUpdate = (Date.now() - new Date(user.aiInsights.lastUpdated).getTime()) / (1000 * 60 * 60)
      if (hoursSinceUpdate < CACHE_HOURS) {
        return NextResponse.json({ insights: user.aiInsights, cached: true })
      }
    }

    // Aggregate data for AI
    const aggregatedData = await UserAnswer.aggregateForAI(user._id)

    // Call Groq
    const insights = await getAIInsights(user.preferences.language, aggregatedData)

    // Cache in user document
    await User.findByIdAndUpdate(user._id, {
      $set: {
        'aiInsights.readinessScore': insights.readiness_score,
        'aiInsights.weakTopics': insights.weak_topics,
        'aiInsights.coachMessage': insights.coach_message,
        'aiInsights.recommendedAction': insights.recommended_action,
        'aiInsights.lastUpdated': new Date(),
      },
    })

    return NextResponse.json({ insights, cached: false })
  } catch (error) {
    console.error('AI insights error:', error)
    return NextResponse.json({ error: 'Failed to generate insights' }, { status: 500 })
  }
}
