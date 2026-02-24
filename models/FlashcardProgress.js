import mongoose from 'mongoose'

const flashcardProgressSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
    status: { type: String, enum: ['new', 'learning', 'mastered'], default: 'new' },
    nextReviewDate: { type: Date, default: Date.now },
    reviewCount: { type: Number, default: 0 },
    easeFactor: { type: Number, default: 2.5 }, // SM-2 algorithm ease factor
    interval: { type: Number, default: 1 }, // days until next review
  },
  { timestamps: true }
)

flashcardProgressSchema.index({ userId: 1, questionId: 1 }, { unique: true })
flashcardProgressSchema.index({ userId: 1, nextReviewDate: 1 })

// SM-2 Spaced Repetition Algorithm
flashcardProgressSchema.methods.updateWithReview = function (quality) {
  // quality: 0 = failed (needs practice), 1 = passed (got it)
  this.reviewCount += 1

  if (quality === 0) {
    // Failed: reset to learning
    this.status = 'learning'
    this.interval = 1
    this.easeFactor = Math.max(1.3, this.easeFactor - 0.2)
  } else {
    // Passed
    if (this.reviewCount === 1) {
      this.interval = 1
    } else if (this.reviewCount === 2) {
      this.interval = 6
    } else {
      this.interval = Math.round(this.interval * this.easeFactor)
      this.easeFactor = Math.max(1.3, this.easeFactor + 0.1)
    }

    this.status = this.interval >= 21 ? 'mastered' : 'learning'
  }

  const nextDate = new Date()
  nextDate.setDate(nextDate.getDate() + this.interval)
  this.nextReviewDate = nextDate

  return this.save()
}

export default mongoose.models.FlashcardProgress ||
  mongoose.model('FlashcardProgress', flashcardProgressSchema)
