import mongoose from 'mongoose'

const studyPlanSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    targetDate: { type: Date, required: true },
    dailyMinutes: { type: Number, required: true },
    planData: { type: mongoose.Schema.Types.Mixed, required: true },
    dailyGoals: {
      exams: { type: Number, default: 1 },
      customQuestions: { type: Number, default: 20 },
    },
    status: { type: String, enum: ['active', 'completed', 'abandoned'], default: 'active' },
  },
  { timestamps: true }
)

export default mongoose.models.StudyPlan || mongoose.model('StudyPlan', studyPlanSchema)
