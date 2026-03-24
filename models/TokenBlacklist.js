import mongoose from 'mongoose'
import crypto from 'crypto'

// ---------------------------------------------------------------------------
// TokenBlacklist Schema
// ---------------------------------------------------------------------------
// Stores invalidated tokens (e.g., on logout) to prevent their reuse.
// Uses a hash of the token instead of the full token for security.
// TTL index automatically removes expired entries.
// ---------------------------------------------------------------------------

const tokenBlacklistSchema = new mongoose.Schema(
  {
    // Hash of the JWT token (SHA256)
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // User ID (for audit purposes)
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Reason for blacklisting (e.g., 'logout', 'password_change')
    reason: {
      type: String,
      enum: ['logout', 'password_change', 'admin_revoke'],
      default: 'logout',
    },

    // Expiration time (should match the token's exp claim)
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
)

// TTL index: automatically delete documents 1 second after expiresAt
tokenBlacklistSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 1 })

/**
 * Add a token to the blacklist
 * @param {string} token - The JWT token to blacklist
 * @param {string} userId - The user ID
 * @param {Date} expiresAt - When the token expires
 * @param {string} reason - Reason for blacklisting
 * @returns {Promise<Object>} The created blacklist entry
 */
tokenBlacklistSchema.statics.addToBlacklist = async function (
  token,
  userId,
  expiresAt,
  reason = 'logout'
) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

  return this.create({
    tokenHash,
    userId,
    expiresAt,
    reason,
  })
}

/**
 * Check if a token is blacklisted
 * @param {string} token - The JWT token to check
 * @returns {Promise<boolean>} True if blacklisted, false otherwise
 */
tokenBlacklistSchema.statics.isBlacklisted = async function (token) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  const entry = await this.findOne({ tokenHash })
  return !!entry
}

/**
 * Remove a token from the blacklist (optional cleanup)
 * @param {string} token - The JWT token to remove
 * @returns {Promise<Object>} Delete result
 */
tokenBlacklistSchema.statics.removeFromBlacklist = async function (token) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  return this.deleteOne({ tokenHash })
}

/**
 * Clear all blacklist entries for a user
 * @param {string} userId - The user ID
 * @returns {Promise<Object>} Delete result
 */
tokenBlacklistSchema.statics.clearUserTokens = async function (userId) {
  return this.deleteMany({ userId })
}

export default mongoose.models.TokenBlacklist ||
  mongoose.model('TokenBlacklist', tokenBlacklistSchema)
