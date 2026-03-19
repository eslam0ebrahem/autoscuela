import mongoose from 'mongoose'

const rateLimitSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    count: { type: Number, default: 1 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: false, versionKey: false }
)

// TTL index: MongoDB auto-deletes documents after expiresAt
rateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export default mongoose.models.RateLimit || mongoose.model('RateLimit', rateLimitSchema)
