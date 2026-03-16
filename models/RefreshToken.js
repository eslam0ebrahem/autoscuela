import mongoose from 'mongoose'
import crypto from 'crypto'

// ---------------------------------------------------------------------------
// RefreshToken Schema
// ---------------------------------------------------------------------------
// Stores refresh tokens (longer-lived, rotatable credentials) separately from access tokens.
// Allows implementing token rotation and revocation without affecting the user's session
// until they try to refresh.
// ---------------------------------------------------------------------------

const refreshTokenSchema = new mongoose.Schema(
  {
    // Hash of the refresh token (SHA256) - stored for security
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

    // Family ID for token rotation tracking (all tokens in same rotation share this)
    familyId: {
      type: String,
      required: true,
      index: true,
    },

    // When this refresh token expires
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },

    // IP address from which token was issued (for security checks)
    ipAddress: {
      type: String,
    },

    // User agent (optional, for additional security checks)
    userAgent: {
      type: String,
    },

    // Whether this token has been revoked
    revoked: {
      type: Boolean,
      default: false,
      index: true,
    },

    // If rotated, the new token hash (for tracking token rotation)
    rotatedBy: {
      type: String, // hash of the new token
    },

    // When the token was rotated
    rotatedAt: {
      type: Date,
    },
  },
  { timestamps: true }
)

// TTL index: automatically delete documents 1 second after expiresAt
refreshTokenSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 1 }
)

/**
 * Create a new refresh token
 * @param {string} token - The refresh token value
 * @param {string} userId - The user ID
 * @param {Date} expiresAt - When the token expires
 * @param {Object} options - Additional options (ipAddress, userAgent)
 * @returns {Promise<Object>} The created refresh token document
 */
refreshTokenSchema.statics.createToken = async function (token, userId, expiresAt, options = {}) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  const familyId = crypto.randomBytes(16).toString('hex')

  return this.create({
    tokenHash,
    userId,
    familyId,
    expiresAt,
    ipAddress: options.ipAddress,
    userAgent: options.userAgent,
  })
}

/**
 * Verify a refresh token exists and is valid
 * @param {string} token - The refresh token
 * @returns {Promise<Object|null>} The token document if valid, null otherwise
 */
refreshTokenSchema.statics.verifyToken = async function (token) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

  const doc = await this.findOne({
    tokenHash,
    revoked: false,
    expiresAt: { $gt: new Date() },
  })

  return doc
}

/**
 * Rotate a token (revoke old, issue new)
 * @param {string} oldToken - The old refresh token
 * @param {string} newToken - The new refresh token
 * @param {Date} newExpiresAt - Expiration of new token
 * @returns {Promise<Object>} The new token document
 */
refreshTokenSchema.statics.rotateToken = async function (oldToken, newToken, newExpiresAt) {
  const oldHash = crypto.createHash('sha256').update(oldToken).digest('hex')
  const newHash = crypto.createHash('sha256').update(newToken).digest('hex')

  // Find the old token
  const oldDoc = await this.findOne({ tokenHash: oldHash })
  if (!oldDoc) {
    throw new Error('Refresh token not found')
  }

  // Mark old token as rotated
  oldDoc.revoked = true
  oldDoc.rotatedBy = newHash
  oldDoc.rotatedAt = new Date()
  await oldDoc.save()

  // Create new token with same family ID for tracking rotation
  const newDoc = await this.create({
    tokenHash: newHash,
    userId: oldDoc.userId,
    familyId: oldDoc.familyId,
    expiresAt: newExpiresAt,
    ipAddress: oldDoc.ipAddress,
    userAgent: oldDoc.userAgent,
  })

  return newDoc
}

/**
 * Revoke all tokens in a family (if theft is suspected)
 * @param {string} familyId - The family ID
 * @returns {Promise<Object>} Update result
 */
refreshTokenSchema.statics.revokeFamily = async function (familyId) {
  return this.updateMany(
    { familyId },
    { revoked: true, rotatedAt: new Date() }
  )
}

/**
 * Revoke all tokens for a user
 * @param {string} userId - The user ID
 * @returns {Promise<Object>} Update result
 */
refreshTokenSchema.statics.revokeUserTokens = async function (userId) {
  return this.updateMany(
    { userId },
    { revoked: true, rotatedAt: new Date() }
  )
}

/**
 * Cleanup: remove all expired tokens (TTL index does this automatically, but this is for manual cleanup)
 * @returns {Promise<Object>} Delete result
 */
refreshTokenSchema.statics.cleanupExpired = async function () {
  return this.deleteMany({
    expiresAt: { $lt: new Date() },
  })
}

export default mongoose.models.RefreshToken || mongoose.model('RefreshToken', refreshTokenSchema)
