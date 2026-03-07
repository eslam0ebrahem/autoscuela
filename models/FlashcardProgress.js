import mongoose from 'mongoose'

const flashcardProgressSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
    status: { type: String, enum: ['new', 'learning', 'mastered'], default: 'new' },
    nextReviewDate: { type: Date, default: Date.now },
    reviewCount: { type: Number, default: 0 },
    easeFactor: { type: Number, default: 2.5 },
    interval: { type: Number, default: 1 },
    consecutiveCorrect: { type: Number, default: 0 },
  },
  { timestamps: true }
)

flashcardProgressSchema.index({ userId: 1, questionId: 1 }, { unique: true })
flashcardProgressSchema.index({ userId: 1, nextReviewDate: 1 })
flashcardProgressSchema.index({ userId: 1, status: 1 })

// Improved SM-2 Spaced Repetition Algorithm
flashcardProgressSchema.methods.updateWithReview = function (quality) {
  // quality: 0 = failed (needs practice), 1 = passed (got it)
  this.reviewCount += 1

  if (quality === 0) {
    // Failed: reset interval, decrease ease factor
    this.status = 'learning'
    this.interval = 1
    this.consecutiveCorrect = 0
    this.easeFactor = Math.max(1.3, this.easeFactor - 0.2)
  } else {
    // Passed: increase interval using SM-2 schedule
    this.consecutiveCorrect += 1

    if (this.consecutiveCorrect === 1) {
      this.interval = 1
    } else if (this.consecutiveCorrect === 2) {
      this.interval = 3
    } else if (this.consecutiveCorrect === 3) {
      this.interval = 7
    } else {
      this.interval = Math.min(365, Math.round(this.interval * this.easeFactor))
      this.easeFactor = Math.min(3.0, this.easeFactor + 0.05)
    }

    // Status transitions
    if (this.interval >= 21) {
      this.status = 'mastered'
    } else if (this.consecutiveCorrect >= 2) {
      this.status = 'learning'
    }
  }

  const nextDate = new Date()
  nextDate.setDate(nextDate.getDate() + this.interval)
  this.nextReviewDate = nextDate

  return this.save()
}

export default mongoose.models.FlashcardProgress ||
  mongoose.model('FlashcardProgress', flashcardProgressSchema)
