import NodeCache from 'node-cache'

// Global cache instance (persists across Next.js API route invocations in development,
// and survives lambda lifecycle within the same instance in production).
// stdTTL: 14 days (in seconds), checkperiod: 1 hour
export const aiCache = new NodeCache({ stdTTL: 14 * 24 * 60 * 60, checkperiod: 3600 })

/**
 * Wraps an AI function to check the cache before executing.
 * @param {string} key - Cache key.
 * @param {Function} fetchFn - The actual AI function returning a promise.
 * @param {number} [ttl] - Optional TTL override in seconds.
 * @returns {Promise<any>}
 */
export async function withCache(key, fetchFn, ttl) {
  if (process.env.NODE_ENV !== 'production' && process.env.DISABLE_AI_CACHE === 'true') {
    return fetchFn()
  }

  const cached = aiCache.get(key)
  if (cached) {
    console.debug(`[ai-cache] HIT for key: ${key}`)
    return cached
  }

  console.debug(`[ai-cache] MISS for key: ${key}`)
  const result = await fetchFn()

  // Only cache if it's not a fallback response
  if (result && !result._fallback) {
    if (ttl !== undefined) {
      aiCache.set(key, result, ttl)
    } else {
      aiCache.set(key, result)
    }
  }

  return result
}

/**
 * Manually flush the cache if needed (e.g., via admin route).
 */
export function flushAiCache() {
  aiCache.flushAll()
}
