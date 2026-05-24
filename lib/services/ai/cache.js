import NodeCache from 'node-cache'

// Global cache instance (persists across Next.js API route invocations in development,
// and survives lambda lifecycle within the same instance in production).
// We disable built-in TTL so we can manually manage stale-while-revalidate logic.
export const aiCache = new NodeCache({ stdTTL: 0, checkperiod: 0 })

/**
 * Wraps an AI function to check the cache before executing.
 * If the API fails (e.g., 429 Rate Limit), it falls back to stale cache if available.
 * @param {string} key - Cache key.
 * @param {Function} fetchFn - The actual AI function returning a promise.
 * @param {number} [ttlSeconds] - TTL in seconds (default 14 days).
 * @returns {Promise<any>}
 */
export async function withCache(key, fetchFn, ttlSeconds = 14 * 24 * 60 * 60) {
  if (process.env.NODE_ENV !== 'production' && process.env.DISABLE_AI_CACHE === 'true') {
    return fetchFn()
  }

  const cached = aiCache.get(key)
  const now = Date.now()

  if (cached && cached.expiresAt > now) {
    console.debug(`[ai-cache] HIT for key: ${key}`)
    return cached.value
  }

  console.debug(`[ai-cache] MISS (or expired) for key: ${key}`)
  try {
    const result = await fetchFn()
    
    // If the underlying function returned a fallback, treat it as a failure
    if (result && result._fallback && cached) {
      console.warn(`[ai-cache] API returned fallback, returning STALE cache instead for key: ${key}`)
      return cached.value
    }
    
    // Only cache if it's not a fallback response
    if (result && !result._fallback) {
      aiCache.set(key, { value: result, expiresAt: now + ttlSeconds * 1000 })
    }
    
    return result
  } catch (error) {
    if (cached) {
      console.warn(`[ai-cache] API failed (${error?.message || 'unknown'}), returning STALE cache for key: ${key}`)
      return cached.value
    }
    throw error
  }
}

/**
 * Manually flush the cache if needed (e.g., via admin route).
 */
export function flushAiCache() {
  aiCache.flushAll()
}
