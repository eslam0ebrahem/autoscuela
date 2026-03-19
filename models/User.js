import mongoose from 'mongoose'

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    nickname: { type: String, required: true, trim: true, minlength: 2, maxlength: 20 },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },

    // Email verification
    emailVerified: { type: Boolean, default: false },
    emailVerifiedAt: { type: Date },

    preferences: {
      language: { type: String, enum: ['es', 'en'], default: 'es' },
      theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
      soundEnabled: { type: Boolean, default: true },
    },

    subscription: {
      status: {
        type: String,
        enum: ['active', 'inactive', 'past_due', 'canceled'],
        default: 'inactive',
      },
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
      examLanguages: [{ type: String }],
      dailyChallengeCompletedAt: { type: Date },
      dailyChallengeStreak: { type: Number, default: 0 },
      rank: { type: Number, default: 0 }, // Pre-calculated leaderboard rank (0 = not ranked)
    },

    // AI insights cache
    aiInsights: {
      readinessScore: { type: Number },
      weakTopics: [{ type: String }],
      coachMessage: { type: String },
      recommendedAction: { type: mongoose.Schema.Types.Mixed },
      predictedReadyDate: { type: Date },
      improvementRate: { type: Number },
      studyTips: [{ type: String }],
      topicPriorityOrder: [{ type: String }],
      lastUpdated: { type: Date },
    },

    // Manual override by admin
    premiumOverride: { type: Boolean, default: false },

    // Bookmarked Questions
    bookmarkedQuestions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }],

    // Study history for trends
    studyHistory: [
      {
        date: { type: Date },
        questionsAnswered: { type: Number, default: 0 },
        correctAnswers: { type: Number, default: 0 },
        minutesStudied: { type: Number, default: 0 },
      },
    ],

    // User skill profile (v4) with caching
    skillProfile: {
      overallLevel: {
        type: String,
        enum: ['beginner', 'easy', 'medium', 'hard', 'expert'],
        default: 'beginner',
      },
      topicLevels: { type: Map, of: String },
      lastCalculated: { type: Date },
      lastCalculatedAt: { type: Date }, // TTL tracking: recalculate if >1 hour old
    },
  },
  { timestamps: true }
)

// Virtual: is user subscribed?
userSchema.virtual('isPremium').get(function () {
  if (this.premiumOverride) return true
  if (this.subscription.status === 'active') return true
  // Grace period: allow access during past_due only if still within billing period
  if (this.subscription.status === 'past_due' && this.subscription.currentPeriodEnd) {
    return new Date(this.subscription.currentPeriodEnd) > new Date()
  }
  return false
})

userSchema.set('toJSON', { virtuals: true })

// Indexes for leaderboard and admin
userSchema.index({ 'gamification.weeklyXP': -1, _id: 1 })
userSchema.index({ 'gamification.totalXP': -1, _id: 1 })

export default mongoose.models.User || mongoose.model('User', userSchema)
