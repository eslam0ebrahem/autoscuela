/**
 * CSRF Protection Helper
 *
 * Implements CSRF protection by requiring ANY of:
 * 1. X-Requested-With: XMLHttpRequest header (legacy SPA pattern)
 * 2. Authorization header with Bearer token (API clients)
 * 3. Same-origin request — Origin or Referer matches the Host header
 *    (browsers automatically send Origin/Referer on cross-origin requests,
 *     so a matching value guarantees the request came from the same site)
 *
 * Cookies are SameSite=strict, which already prevents cross-site cookie
 * submission. The Origin/Referer check is a defence-in-depth layer that
 * lets all same-origin SPA fetches through without requiring every page to
 * manually add a custom header.
 */

/**
 * Check CSRF protection on a request
 * @param {Request} request - The Next.js request object
 * @returns {boolean} True if CSRF check passes, false otherwise
 */
export function validateCSRFToken(request) {
  // ── 1. X-Requested-With header (XHR/CORS-safe, legacy pattern) ────────
  const xRequestedWith = request.headers.get('x-requested-with')
  if (xRequestedWith?.toLowerCase() === 'xmlhttprequest') {
    return true
  }

  // ── 2. Authorization header with Bearer token (API clients) ────────────
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return true
  }

  // ── 3. Same-origin check via Origin / Referer header ──────────────────
  // Browsers always include Origin on cross-origin requests. If Origin is
  // present and matches the Host, the request is same-origin → safe.
  // If Origin is absent (same-origin navigation or privacy mode), fall back
  // to Referer. An absent Origin on a non-navigation POST is same-origin.
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
  const origin = request.headers.get('origin')

  if (origin) {
    try {
      const originHost = new URL(origin).host
      if (originHost === host) return true
    } catch {
      // malformed Origin — fall through to deny
    }
  } else {
    // Origin absent: check Referer as fallback
    const referer = request.headers.get('referer')
    if (referer) {
      try {
        const refererHost = new URL(referer).host
        if (refererHost === host) return true
      } catch {
        // malformed Referer — fall through to deny
      }
    }
    // If neither Origin nor Referer is present, deny by default.
    // Same-origin SPA fetches always include Origin/Referer.
    // Server-to-server calls should use Bearer auth (handled above).
  }

  return false
}

/**
 * Middleware to enforce CSRF protection
 * Add to API route handlers that modify state (POST, PATCH, DELETE, PUT)
 * @param {string} method - HTTP method
 * @param {Request} request - Next.js request
 * @returns {Object|null} Error response object if CSRF check fails, null if passes
 */
export function checkCSRF(method, request) {
  // Only check state-changing methods
  const stateChangingMethods = ['POST', 'PATCH', 'DELETE', 'PUT']
  if (!stateChangingMethods.includes(method.toUpperCase())) {
    return null // No CSRF check needed for GET, HEAD, OPTIONS
  }

  // Validate CSRF token
  if (!validateCSRFToken(request)) {
    return {
      error: 'CSRF validation failed',
      details: 'Request origin could not be verified',
      status: 403,
    }
  }

  return null // CSRF check passed
}
