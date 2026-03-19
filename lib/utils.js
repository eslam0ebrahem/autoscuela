import mongoose from 'mongoose'
import connectDB from '@/lib/db'
import RateLimit from '@/models/RateLimit'

// Escape special regex characters to prevent ReDoS / injection
export function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Validate MongoDB ObjectId
export function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id)
}

// Clamp a number between min and max
export function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max)
}

// Parse positive integer from string with default
export function parsePositiveInt(str, defaultVal = 1) {
  const num = parseInt(str, 10)
  return isNaN(num) || num < 1 ? defaultVal : num
}

export async function checkRateLimit(key, maxRequests = 10, windowMs = 60000) {
  try {
    await connectDB()
    const now = new Date()
    const windowEnd = new Date(now.getTime() + windowMs)

    // Use an aggregation pipeline update to atomically handle both the
    // increment case (window still active) and the reset case (window
    // expired but TTL index hasn't deleted the document yet).
    const doc = await RateLimit.findOneAndUpdate(
      { key },
      [
        {
          $set: {
            // Reset count to 1 if window expired, otherwise increment
            count: {
              $cond: {
                if: { $gt: ['$expiresAt', now] },
                then: { $add: ['$count', 1] },
                else: 1,
              },
            },
            // Reset expiresAt if window expired, otherwise keep existing
            expiresAt: {
              $cond: {
                if: { $gt: ['$expiresAt', now] },
                then: '$expiresAt',
                else: windowEnd,
              },
            },
          },
        },
      ],
      { upsert: true, returnDocument: 'after' }
    )

    if (!doc || doc.count > maxRequests) {
      const retryAfter = doc ? Math.ceil((doc.expiresAt - now) / 1000) : Math.ceil(windowMs / 1000)
      return { allowed: false, remaining: 0, retryAfter }
    }

    return {
      allowed: true,
      remaining: Math.max(0, maxRequests - doc.count),
    }
  } catch (err) {
    console.error('[rate-limit] DB error, failing open:', err.message)
    return { allowed: true, remaining: maxRequests - 1 }
  }
}
