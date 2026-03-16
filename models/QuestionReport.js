import mongoose from 'mongoose'

const questionReportSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      required: true,
      index: true,
    },
    reason: {
      type: String,
      enum: ['wrong_answer', 'unclear_text', 'outdated', 'missing_image', 'other'],
      required: true,
    },
    description: { type: String, maxlength: 500 },
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'fixed', 'dismissed'],
      default: 'pending',
      index: true,
    },
    adminNotes: { type: String },
  },
  { timestamps: true }
)

// Unique index: one report per user per question
questionReportSchema.index({ questionId: 1, userId: 1 }, { unique: true, sparse: true })

export default mongoose.models.QuestionReport ||
  mongoose.model('QuestionReport', questionReportSchema)
