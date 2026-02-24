import mongoose from 'mongoose'

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    nickname: { type: String, required: true, trim: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },

    preferences: {
      language: { type: String, enum: ['es', 'en'], default: 'es' },
    },

    subscription: {
      status: { type: String, enum: ['active', 'inactive', 'past_due'], default: 'inactive' },
      stripeCustomerId: { type: String },
      stripeSubscriptionId: { type: String },
      currentPeriodEnd: { type: Date },
    },

    gamification: {
      currentStreak: { type: Number, default: 0 },
      maxStreak: { type: Number, default: 0 },
      lastStudyDate: { type: Date },
      totalXP: { type: Number, default: 0 },
      weeklyXP: { type: Number, default: 0 },
      weeklyXPResetAt: { type: Date },
      earnedBadges: [{ type: String }],
      examLanguages: [{ type: String }], // tracks which languages exams were taken in
    },

    // AI insights cache
    aiInsights: {
      readinessScore: { type: Number },
      weakTopics: [{ type: String }],
      coachMessage: { type: String },
      recommendedAction: { type: mongoose.Schema.Types.Mixed },
      lastUpdated: { type: Date },
    },

    // Manual override by admin
    premiumOverride: { type: Boolean, default: false },
  },
  { timestamps: true }
)

// Virtual: is user subscribed?
userSchema.virtual('isPremium').get(function () {
  return (
    this.premiumOverride ||
    this.subscription.status === 'active' ||
    (this.subscription.status === 'past_due' && this.subscription.currentPeriodEnd > new Date())
  )
})

userSchema.set('toJSON', { virtuals: true })

export default mongoose.models.User || mongoose.model('User', userSchema)
