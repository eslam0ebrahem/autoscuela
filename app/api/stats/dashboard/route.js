import { NextResponse } from 'next/server'
import mongoose from 'mongoose'
import connectDB from '@/lib/db'
import ExamSession from '@/models/ExamSession'
import UserAnswer from '@/models/UserAnswer'
import { getCurrentUser } from '@/lib/auth'
import { getMadridStartOfDay } from '@/lib/gamification'

export async function GET(request) {
  try {
    const tokenData = await getCurrentUser(request)
    if (!tokenData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()

    const todayStart = getMadridStartOfDay()

    const [completedExams, totalAnswered, correctAnswers, recentSessions, studyTimeToday] =
      await Promise.all([
        ExamSession.countDocuments({ userId: tokenData.userId, status: 'completed' }),
        UserAnswer.countDocuments({ userId: tokenData.userId }),
        UserAnswer.countDocuments({ userId: tokenData.userId, is_correct: true }),
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

    const passedExams = await ExamSession.countDocuments({
      userId: tokenData.userId,
      status: 'completed',
      passed: true,
    })

    const passRate = completedExams > 0 ? Math.round((passedExams / completedExams) * 100) : 0
    const accuracy = totalAnswered > 0 ? Math.round((correctAnswers / totalAnswered) * 100) : 0

    // Study time today
    const studyData = studyTimeToday[0] || { totalSeconds: 0, questionsToday: 0 }
    const studyMinutesToday = Math.round(studyData.totalSeconds / 60)

    // Topic breakdown
    const topicStats = await UserAnswer.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(tokenData.userId) } },
      {
        $group: {
          _id: '$topic_tag.es',
          tagEn: { $first: '$topic_tag.en' },
          attempted: { $sum: 1 },
          correct: { $sum: { $cond: ['$is_correct', 1, 0] } },
        },
      },
      {
        $project: {
          tag: { es: '$_id', en: '$tagEn' },
          attempted: 1,
          correct: 1,
          accuracy: {
            $round: [{ $multiply: [{ $divide: ['$correct', '$attempted'] }, 100] }, 0],
          },
          _id: 0,
        },
      },
      { $sort: { accuracy: 1 } },
    ])

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
