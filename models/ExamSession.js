import mongoose from 'mongoose'

const examSessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    mode: {
      type: String,
      enum: ['official', 'custom', 'daily_challenge', 'mistakes', 'weak_topics'],
      required: true,
    },
    status: {
      type: String,
      enum: ['in_progress', 'completed', 'abandoned'],
      default: 'in_progress',
    },
    language: { type: String, enum: ['es', 'en'], default: 'es' },
    topicFilters: [{ type: String }],
    assistanceMode: { type: String, enum: ['instant', 'exam'], default: 'exam' },

    // Array of question IDs to lock test order
    questionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }],

    // User answers stored here for review
    answers: [
      {
        questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
        selectedOptionIdx: { type: Number },
        isCorrect: { type: Boolean },
        timeTakenSeconds: { type: Number },
        flagged: { type: Boolean, default: false },
      },
    ],

    currentQuestionIndex: { type: Number, default: 0 },
    score: { type: Number },
    errorCount: { type: Number },
    passed: { type: Boolean },
    completedAt: { type: Date },
    expiresAt: { type: Date },

    // Total time tracking
    totalTimeTakenSeconds: { type: Number },

    // ✨ AI-powered additions
    aiSessionTip: { type: String },
    aiCoachFeedback: { type: Object }, // { headline, summary, strengths, weaknesses, next_step, confidence_boost, verdict }
    aiCoachGeneratedAt: { type: Date },
  },
  { timestamps: true }
)

examSessionSchema.index({ userId: 1, status: 1 })
examSessionSchema.index({ userId: 1, completedAt: -1 })
examSessionSchema.index({ status: 1, createdAt: 1 })

export default mongoose.models.ExamSession || mongoose.model('ExamSession', examSessionSchema)
