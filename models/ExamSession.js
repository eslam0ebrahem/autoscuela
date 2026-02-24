import mongoose from 'mongoose'

const examSessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    mode: { type: String, enum: ['official', 'custom'], required: true },
    status: { type: String, enum: ['in_progress', 'completed', 'abandoned'], default: 'in_progress' },
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
    score: { type: Number }, // out of total questions
    errors: { type: Number },
    passed: { type: Boolean },
    completedAt: { type: Date },
    expiresAt: { type: Date }, // For official mode timer
  },
  { timestamps: true }
)

examSessionSchema.index({ userId: 1, status: 1 })
examSessionSchema.index({ userId: 1, completedAt: -1 })

export default mongoose.models.ExamSession || mongoose.model('ExamSession', examSessionSchema)
