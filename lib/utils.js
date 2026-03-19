import mongoose from 'mongoose'
import connectDB from '@/lib/db'

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
    const RateLimit = (await import('@/models/RateLimit')).default
    const now = new Date()
    const windowEnd = new Date(now.getTime() + windowMs)

    // Atomically increment counter, creating if not exists
    // If document expired (expiresAt < now), upsert creates a new one
    let doc
    try {
      doc = await RateLimit.findOneAndUpdate(
        { key, expiresAt: { $gt: now } },
        {
          $inc: { count: 1 },
          $setOnInsert: { expiresAt: windowEnd },
        },
        { upsert: true, new: true }
      )
    } catch (dupErr) {
      // Duplicate key on concurrent upsert — retry once
      if (dupErr.code === 11000) {
        doc = await RateLimit.findOneAndUpdate(
          { key, expiresAt: { $gt: now } },
          { $inc: { count: 1 } },
          { new: true }
        )
      } else throw dupErr
    }

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
