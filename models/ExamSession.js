import mongoose from 'mongoose'

const examSessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    mode: {
      type: String,
      enum: [
        'official',
        'custom',
        'daily_challenge',
        'mistakes',
        'weak_topics',
        'bookmarks',
        'spaced_repetition',
      ],
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

    // Origin of the exam (e.g. 'web', 'mobile', 'api')
    // FIX: field was written in route.js but missing from schema
    source: { type: String },

    // Array of question IDs — locks test order at creation time
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

    // Set when a session transitions from in_progress to abandoned
    // FIX: written by cleanupAbandonedSessions() but missing from schema
    abandonedAt: { type: Date },

    // Total time tracking
    totalTimeTakenSeconds: { type: Number },

    // Per-topic breakdown computed at submission time
    // FIX: written by submit route but missing from schema — caused silent data loss
    topicBreakdown: [
      {
        tag: { type: String },
        correct: { type: Number },
        total: { type: Number },
        accuracy: { type: Number }, // 0–100
        avgTimeSec: { type: Number },
      },
    ],

    // ── AI-powered fields ─────────────────────────────────────────────────
    // Short tip shown before the exam starts (fire-and-forget from generate)
    aiSessionTip: { type: String },

    // Pass probability estimated at session creation: { probability, level, message }
    aiPassPrediction: {
      probability: { type: Number },
      level: { type: String, enum: ['high', 'medium', 'low'] },
      message: { type: String },
    },

    // One-liner result shown immediately after submission (fire-and-forget from submit)
    aiQuickSummary: {
      one_liner: { type: String },
      emoji_verdict: { type: String },
      micro_tip: { type: String },
    },

    // Full coach feedback populated asynchronously after submission
    aiCoachFeedback: {
      headline: { type: String },
      summary: { type: String },
      strengths: [{ type: String }],
      weaknesses: [{ type: String }],
      next_step: { type: String },
      confidence_boost: { type: String },
      verdict: { type: String },
    },
    aiCoachGeneratedAt: { type: Date },
  },
  { timestamps: true }
)

examSessionSchema.index({ userId: 1, status: 1 })
examSessionSchema.index({ userId: 1, completedAt: -1 })
examSessionSchema.index({ status: 1, createdAt: 1 })

export default mongoose.models.ExamSession || mongoose.model('ExamSession', examSessionSchema)
