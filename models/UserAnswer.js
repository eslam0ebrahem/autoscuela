import mongoose from 'mongoose'

const userAnswerSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    examSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'ExamSession' },
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
    topic_tag: {
      es: { type: String, required: true },
      en: { type: String, required: true }
    },
    selected_option_idx: { type: Number, required: true },
    is_correct: { type: Boolean, required: true },
    time_taken_seconds: { type: Number },
  },
  { timestamps: true }
)

userAnswerSchema.index({ userId: 1, createdAt: -1 })
userAnswerSchema.index({ userId: 1, 'topic_tag.es': 1 })

// Static: aggregate user performance for AI
userAnswerSchema.statics.aggregateForAI = async function (userId) {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const results = await this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        createdAt: { $gte: thirtyDaysAgo },
      },
    },
    {
      $group: {
        _id: '$topic_tag.es',
        attempted: { $sum: 1 },
        correct: { $sum: { $cond: ['$is_correct', 1, 0] } },
        avg_time_sec: { $avg: '$time_taken_seconds' },
      },
    },
    {
      $project: {
        tag: '$_id',
        attempted: 1,
        correct: 1,
        avg_time_sec: { $round: ['$avg_time_sec', 1] },
        _id: 0,
      },
    },
  ])

  const totalAnswers = await this.countDocuments({
    userId: new mongoose.Types.ObjectId(userId),
    createdAt: { $gte: thirtyDaysAgo },
  })

  const totalCorrect = await this.countDocuments({
    userId: new mongoose.Types.ObjectId(userId),
    is_correct: true,
    createdAt: { $gte: thirtyDaysAgo },
  })

  return {
    total_questions: totalAnswers,
    overall_accuracy: totalAnswers > 0 ? Math.round((totalCorrect / totalAnswers) * 100) : 0,
    topics: results,
  }
}

export default mongoose.models.UserAnswer || mongoose.model('UserAnswer', userAnswerSchema)
