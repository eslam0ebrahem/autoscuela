import mongoose from 'mongoose'
import crypto from 'crypto'

// ---------------------------------------------------------------------------
// VerificationToken Schema
// ---------------------------------------------------------------------------
// Stores one-time verification tokens sent via email for email verification.
// Tokens are single-use and expire after 24 hours.
// ---------------------------------------------------------------------------

const verificationTokenSchema = new mongoose.Schema(
  {
    // Hash of the verification token (for security, we store hash not the token)
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // User ID
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Email address to verify
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    // Type of verification
    type: {
      type: String,
      enum: ['email_verification', 'password_reset'],
      default: 'email_verification',
    },

    // When this token expires
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },

    // Whether the token has been used
    used: {
      type: Boolean,
      default: false,
      index: true,
    },

    // When it was used (if at all)
    usedAt: {
      type: Date,
    },

    // How many times it was attempted (for rate limiting)
    attempts: {
      type: Number,
      default: 0,
    },

    // Last attempt timestamp
    lastAttemptAt: {
      type: Date,
    },
  },
  { timestamps: true }
)

// TTL index: automatically delete documents 1 second after expiresAt
verificationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 1 })

/**
 * Create a new verification token
 * @param {string} userId - The user ID
 * @param {string} email - The email to verify
 * @param {number} expiresInMs - How long until token expires (default: 24 hours)
 * @param {string} type - Type of verification (default: 'email_verification')
 * @returns {Promise<Object>} Object with token and document
 */
verificationTokenSchema.statics.createToken = async function (
  userId,
  email,
  expiresInMs = 24 * 60 * 60 * 1000,
  type = 'email_verification'
) {
  // Generate random token
  const token = crypto.randomBytes(32).toString('hex')
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

  const expiresAt = new Date(Date.now() + expiresInMs)

  const doc = await this.create({
    tokenHash,
    userId,
    email,
    type,
    expiresAt,
  })

  return { token, doc }
}

/**
 * Verify a token and mark it as used
 * @param {string} token - The verification token
 * @param {string} userId - The user ID (for security check)
 * @returns {Promise<Object|null>} The token document if valid, null otherwise
 */
verificationTokenSchema.statics.verifyToken = async function (token, userId) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

  const doc = await this.findOne({
    tokenHash,
    userId,
    used: false,
    expiresAt: { $gt: new Date() },
  })

  if (!doc) {
    return null
  }

  // Mark as used
  doc.used = true
  doc.usedAt = new Date()
  await doc.save()

  return doc
}

/**
 * Track failed verification attempt (for rate limiting)
 * @param {string} token - The verification token
 * @returns {Promise<number>} Number of attempts
 */
verificationTokenSchema.statics.recordAttempt = async function (token) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

  const doc = await this.findOneAndUpdate(
    { tokenHash },
    {
      $inc: { attempts: 1 },
      lastAttemptAt: new Date(),
    },
    { returnDocument: 'after' }
  )

  return doc?.attempts || 0
}

/**
 * Get active token for a user (unused, not expired)
 * @param {string} userId - The user ID
 * @param {string} type - Type of verification
 * @returns {Promise<Object|null>} The token document if exists
 */
verificationTokenSchema.statics.getActiveToken = async function (
  userId,
  type = 'email_verification'
) {
  return this.findOne({
    userId,
    type,
    used: false,
    expiresAt: { $gt: new Date() },
  })
}

/**
 * Cleanup: remove all expired tokens (TTL index does this automatically)
 * @returns {Promise<Object>} Delete result
 */
verificationTokenSchema.statics.cleanupExpired = async function () {
  return this.deleteMany({
    expiresAt: { $lt: new Date() },
  })
}

/**
 * Revoke all unused tokens for a user (e.g., when user changes email)
 * @param {string} userId - The user ID
 * @param {string} type - Type of verification
 * @returns {Promise<Object>} Update result
 */
verificationTokenSchema.statics.revokeUserTokens = async function (
  userId,
  type = 'email_verification'
) {
  return this.updateMany(
    { userId, type, used: false },
    { expiresAt: new Date() } // Expire immediately
  )
}

export default mongoose.models.VerificationToken ||
  mongoose.model('VerificationToken', verificationTokenSchema)
