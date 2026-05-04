import { NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/utils'

/**
 * Rate limiting middleware.
 *
 * @param {Object} options
 * @param {string} options.key - Rate limit key prefix (e.g. 'dashboard', 'ai:coach').
 *   The user ID is automatically appended: `${key}:${ctx.user.userId}`
 * @param {number} [options.max=30] - Maximum requests per window
 * @param {number} [options.windowMs=60000] - Window duration in milliseconds
 * @param {string} [options.message='Too many requests'] - Error message when rate limited
 * @param {'user'|'ip'} [options.by='user'] - Rate limit by user ID or IP address
 *
 * @example
 * compose(
 *   withAuth(),
 *   withRateLimit({ key: 'dashboard', max: 30, windowMs: 60000 }),
 *   withDB(),
 *   handler
 * )
 */
export function withRateLimit(options) {
  const {
    key,
    max = 30,
    windowMs = 60000,
    message = 'Too many requests. Please slow down.',
    by = 'user',
  } = options

  return async function rateLimitMiddleware(request, ctx) {
    let identifier
    if (by === 'ip') {
      identifier = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    } else {
      identifier = ctx.user?.userId || 'anonymous'
    }

    const rateLimitKey = `${key}:${identifier}`
    const rateCheck = await checkRateLimit(rateLimitKey, max, windowMs)

    if (!rateCheck.allowed) {
      const retryAfter = rateCheck.retryAfter || Math.ceil(windowMs / 1000)
      return NextResponse.json(
        { error: message, retryAfter },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      )
    }

    ctx.rateLimit = { remaining: rateCheck.remaining }
  }
}
