import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

/**
 * Authentication middleware.
 * Verifies the JWT from cookies/Authorization header and injects
 * `ctx.user` with `{ userId, role }`.
 *
 * @param {Object} [options]
 * @param {boolean} [options.optional=false] - If true, missing auth is not an error;
 *   ctx.user will be null instead of returning 401.
 * @param {string} [options.role] - If provided, requires the user to have this role.
 *
 * @example
 * compose(withAuth(), withDB(), handler)
 * compose(withAuth({ role: 'admin' }), withDB(), handler)
 * compose(withAuth({ optional: true }), withDB(), handler)
 */
export function withAuth(options = {}) {
  const { optional = false, role } = options

  return async function authMiddleware(request, ctx) {
    const tokenData = await getCurrentUser(request)

    if (!tokenData) {
      if (optional) {
        ctx.user = null
        return // Continue to next middleware
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Role check
    if (role && tokenData.role !== role) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    ctx.user = tokenData
  }
}
