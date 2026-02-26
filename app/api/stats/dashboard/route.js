import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import ExamSession from '@/models/ExamSession'
import UserAnswer from '@/models/UserAnswer'
import { getCurrentUser } from '@/lib/auth'

export async function GET(request) {
  try {
    const tokenData = await getCurrentUser(request)
    if (!tokenData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()

    const [completedExams, totalAnswered, correctAnswers, recentSessions] = await Promise.all([
      ExamSession.countDocuments({ userId: tokenData.userId, status: 'completed' }),
      UserAnswer.countDocuments({ userId: tokenData.userId }),
      UserAnswer.countDocuments({ userId: tokenData.userId, is_correct: true }),
      ExamSession.find({ userId: tokenData.userId, status: 'completed' })
        .sort({ completedAt: -1 })
        .limit(10)
        .select('score passed errorCount completedAt mode'),
    ])

    const passedExams = await ExamSession.countDocuments({
      userId: tokenData.userId,
      status: 'completed',
      passed: true,
    })

    const passRate = completedExams > 0 ? Math.round((passedExams / completedExams) * 100) : 0
    const accuracy = totalAnswered > 0 ? Math.round((correctAnswers / totalAnswered) * 100) : 0

    // Topic breakdown
    const topicStats = await UserAnswer.aggregate([
      { $match: { userId: tokenData.userId } },
      {
        $group: {
          _id: '$topic_tag.es',
          tagObj: { $first: '$topic_tag' },
          attempted: { $sum: 1 },
          correct: { $sum: { $cond: ['$is_correct', 1, 0] } },
        },
      },
      {
        $project: {
          tag: '$tagObj',
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
    })
  } catch (error) {
    console.error('Stats error:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
