import mongoose from 'mongoose'

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

// Simple in-memory rate limiter per key
const rateLimitStore = new Map()

export function checkRateLimit(key, maxRequests = 10, windowMs = 60000) {
  const now = Date.now()
  const record = rateLimitStore.get(key)

  if (!record || now - record.startTime > windowMs) {
    rateLimitStore.set(key, { startTime: now, count: 1 })
    return { allowed: true, remaining: maxRequests - 1 }
  }

  record.count++
  if (record.count > maxRequests) {
    return { allowed: false, remaining: 0, retryAfter: Math.ceil((record.startTime + windowMs - now) / 1000) }
  }

  return { allowed: true, remaining: maxRequests - record.count }
}

// Cleanup stale rate limit entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, record] of rateLimitStore) {
      if (now - record.startTime > 300000) rateLimitStore.delete(key)
    }
  }, 300000)
}
