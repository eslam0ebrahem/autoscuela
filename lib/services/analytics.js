import connectDB from '@/lib/db'
import ExamSession from '@/models/ExamSession'

export async function getRecentSessions(userId, limit = 10) {
  await connectDB()
  return ExamSession.find({ userId, status: 'completed' })
    .sort({ completedAt: -1 })
    .limit(limit)
    .select('score errorCount passed mode topicBreakdown completedAt timeSpentSeconds answers')
    .lean()
}

export async function getExamSummary(session) {
  return {
    score: session.score,
    errorCount: session.errorCount,
    passed: session.passed,
    totalQuestions: session.questions?.length || 0,
    mode: session.mode,
    topicBreakdown: session.topicBreakdown || [],
    timeSpentSeconds: session.timeSpentSeconds,
    questionsDetail: (session.answers || []).map((a) => ({
      isCorrect: a.isCorrect,
      topic: a.topic_tag?.es || '',
      timeTaken: a.time_taken,
    })),
  }
}
