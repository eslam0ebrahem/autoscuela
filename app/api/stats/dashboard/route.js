import { NextResponse } from 'next/server'
import mongoose from 'mongoose'
import connectDB from '@/lib/db'
import ExamSession from '@/models/ExamSession'
import UserAnswer from '@/models/UserAnswer'
import User from '@/models/User'
import { getCurrentUser } from '@/lib/auth'
import { getMadridStartOfDay } from '@/lib/gamification'

export async function GET(request) {
  try {
    const tokenData = await getCurrentUser(request)
    if (!tokenData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()

    const todayStart = getMadridStartOfDay()

    const [user, completedExams, passedExams, recentSessions, studyTimeToday] = await Promise.all([
      User.findById(tokenData.userId).select('stats').lean(),
      ExamSession.countDocuments({ userId: tokenData.userId, status: 'completed' }),
      ExamSession.countDocuments({
        userId: tokenData.userId,
        status: 'completed',
        passed: true,
      }),
      ExamSession.find({ userId: tokenData.userId, status: 'completed' })
        .sort({ completedAt: -1 })
        .limit(10)
        .select('score passed errorCount completedAt mode'),
      // Calculate study time today (sum of time_taken_seconds from today's answers)
      UserAnswer.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(tokenData.userId),
            createdAt: { $gte: todayStart },
            time_taken_seconds: { $exists: true, $gt: 0 },
          },
        },
        {
          $group: {
            _id: null,
            totalSeconds: { $sum: '$time_taken_seconds' },
            questionsToday: { $sum: 1 },
          },
        },
      ]),
    ])

    const userStats = user?.stats || { totalAnswers: 0, correctAnswers: 0, topicStats: {} }

    const totalAnswered = userStats.totalAnswers || 0
    const correctAnswers = userStats.correctAnswers || 0

    const passRate = completedExams > 0 ? Math.round((passedExams / completedExams) * 100) : 0
    const accuracy = totalAnswered > 0 ? Math.round((correctAnswers / totalAnswered) * 100) : 0

    // Study time today
    const studyData = studyTimeToday[0] || { totalSeconds: 0, questionsToday: 0 }
    const studyMinutesToday = Math.round(studyData.totalSeconds / 60)

    // Topic breakdown - derive from incremental stats instead of aggregation
    const topicStats = []
    const topicStatsMap =
      userStats.topicStats instanceof Map
        ? Object.fromEntries(userStats.topicStats)
        : userStats.topicStats || {}

    for (const [tag, stat] of Object.entries(topicStatsMap)) {
      const attempted = stat.attempted || 0
      const correct = stat.correct || 0
      const topicAccuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : 0
      topicStats.push({
        tag: { es: tag, en: tag }, // Simplify EN tag for now as it's not cached in stats
        attempted,
        correct,
        accuracy: topicAccuracy,
      })
    }

    // Sort by accuracy ascending (weakest first)
    topicStats.sort((a, b) => a.accuracy - b.accuracy)

    return NextResponse.json({
      pass_rate: passRate,
      accuracy,
      total_answered: totalAnswered,
      total_exams: completedExams,
      passed_exams: passedExams,
      recent_sessions: recentSessions,
      topic_stats: topicStats,
      study_today: {
        minutes: studyMinutesToday,
        questions: studyData.questionsToday,
      },
    })
  } catch (error) {
    console.error('Stats error:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
