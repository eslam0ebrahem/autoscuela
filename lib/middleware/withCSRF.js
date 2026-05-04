import { NextResponse } from 'next/server'
import { checkCSRF } from '@/lib/csrf'

/**
 * CSRF protection middleware for state-changing methods (POST, PUT, PATCH, DELETE).
 * Automatically checks the request's HTTP method and validates CSRF token.
 *
 * @example
 * compose(withCSRF(), withAuth(), withDB(), handler)
 */
export function withCSRF() {
  return async function csrfMiddleware(request, _ctx) {
    const csrfError = checkCSRF(request.method, request)
    if (csrfError) {
      return NextResponse.json(csrfError, { status: csrfError.status })
    }
  }
}
