import mongoose from 'mongoose'

const dailyLogSchema = new mongoose.Schema(
  {
    date: { type: String, required: true }, // YYYY-MM-DD
    examsCompleted: { type: Number, default: 0 },
    questionsAnswered: { type: Number, default: 0 },
    minutesStudied: { type: Number, default: 0 },
    goalsMet: { type: Boolean, default: false },
  },
  { _id: false }
)

const studyPlanSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    targetDate: { type: Date, required: true },
    dailyMinutes: { type: Number, required: true },
    planData: { type: mongoose.Schema.Types.Mixed, required: true },
    dailyGoals: {
      exams: { type: Number, default: 1 },
      customQuestions: { type: Number, default: 20 },
      minutesTarget: { type: Number, default: 30 },
    },
    status: { type: String, enum: ['active', 'completed', 'abandoned'], default: 'active' },

    // ── Enhanced tracking ──────────────────────────────────────────────────
    planStreak: { type: Number, default: 0 }, // consecutive days goals met
    bestPlanStreak: { type: Number, default: 0 }, // all-time best within this plan
    dailyHistory: [dailyLogSchema], // log of each day's progress
    lastGoalMetDate: { type: String }, // YYYY-MM-DD — last day the user met all goals
  },
  { timestamps: true }
)

export default mongoose.models.StudyPlan || mongoose.model('StudyPlan', studyPlanSchema)
