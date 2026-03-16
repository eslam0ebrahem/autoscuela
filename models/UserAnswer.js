import mongoose from 'mongoose'

const userAnswerSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    examSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'ExamSession', index: true },
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
    topic_tag: {
      es: { type: String, required: true },
      en: { type: String, required: true },
    },
    selected_option_idx: { type: Number, required: true, min: 0, max: 3 },
    is_correct: { type: Boolean, required: true },
    time_taken_seconds: { type: Number, min: 0 },
  },
  { timestamps: true }
)

userAnswerSchema.index({ userId: 1, createdAt: -1 })
userAnswerSchema.index({ userId: 1, 'topic_tag.es': 1 })
userAnswerSchema.index({ examSessionId: 1, questionId: 1 }, { unique: true, sparse: true })

// Static: aggregate user performance for AI
userAnswerSchema.statics.aggregateForAI = async function (userId, days = 30) {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - days)

  const [topicResults, totals] = await Promise.all([
    this.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          createdAt: { $gte: cutoffDate },
        },
      },
      {
        $group: {
          _id: '$topic_tag.es',
          tagEn: { $first: '$topic_tag.en' },
          attempted: { $sum: 1 },
          correct: { $sum: { $cond: ['$is_correct', 1, 0] } },
          avg_time_sec: { $avg: '$time_taken_seconds' },
        },
      },
      {
        $project: {
          tag: '$_id',
          tagEn: 1,
          attempted: 1,
          correct: 1,
          accuracy: { $round: [{ $multiply: [{ $divide: ['$correct', '$attempted'] }, 100] }, 1] },
          avg_time_sec: { $round: ['$avg_time_sec', 1] },
          _id: 0,
        },
      },
      { $sort: { accuracy: 1 } },
    ]),
    this.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          createdAt: { $gte: cutoffDate },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          correct: { $sum: { $cond: ['$is_correct', 1, 0] } },
        },
      },
    ]),
  ])

  const t = totals[0] || { total: 0, correct: 0 }

  return {
    total_questions: t.total,
    overall_accuracy: t.total > 0 ? Math.round((t.correct / t.total) * 100) : 0,
    topics: topicResults,
  }
}

// Static: get study trends for last N days
userAnswerSchema.statics.getStudyTrends = async function (userId, days = 14) {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - days)

  return this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        createdAt: { $gte: cutoffDate },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        questions: { $sum: 1 },
        correct: { $sum: { $cond: ['$is_correct', 1, 0] } },
        totalTime: { $sum: '$time_taken_seconds' },
      },
    },
    {
      $project: {
        date: '$_id',
        questions: 1,
        correct: 1,
        accuracy: { $round: [{ $multiply: [{ $divide: ['$correct', '$questions'] }, 100] }, 0] },
        minutes: { $round: [{ $divide: ['$totalTime', 60] }, 0] },
        _id: 0,
      },
    },
    { $sort: { date: 1 } },
  ])
}

export default mongoose.models.UserAnswer || mongoose.model('UserAnswer', userAnswerSchema)
