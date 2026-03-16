/**
 * CSRF Protection Helper
 *
 * Implements CSRF protection by requiring either:
 * 1. X-Requested-With: XMLHttpRequest header (CORS-safe, browser won't send cross-origin)
 * 2. Authorization header with Bearer token (API token)
 *
 * This prevents simple form-based CSRF attacks while allowing:
 * - SPA requests (which set X-Requested-With)
 * - API requests (which use Authorization header)
 * - Server-to-server requests (which use Authorization header)
 */

/**
 * Check CSRF protection on a request
 * @param {Request} request - The Next.js request object
 * @returns {boolean} True if CSRF check passes, false otherwise
 */
export function validateCSRFToken(request) {
  // Check for X-Requested-With header (XHR/CORS-safe)
  const xRequestedWith = request.headers.get('x-requested-with')
  if (xRequestedWith?.toLowerCase() === 'xmlhttprequest') {
    return true
  }

  // Check for Authorization header with Bearer token (API token)
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return true
  }

  // Check for Cookie-based token with a custom CSRF header
  // (if using cookie auth, require explicit CSRF header or Authorization header)
  const cookieToken = request.cookies.get('vialia_token')
  if (cookieToken && authHeader?.startsWith('Bearer ')) {
    // If both cookie and header exist, header takes precedence
    return true
  }

  // If we have a cookie token but no CSRF protection headers, fail
  if (cookieToken) {
    return false
  }

  // No auth at all - allow (not an authenticated request)
  return true
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
      details: 'Missing required CSRF protection headers (X-Requested-With or Authorization)',
      status: 403,
    }
  }

  return null // CSRF check passed
}

/**
 * Example usage in API routes:
 *
 * export async function POST(request) {
 *   const csrfError = checkCSRF('POST', request)
 *   if (csrfError) {
 *     return NextResponse.json(csrfError, { status: csrfError.status })
 *   }
 *   // ... rest of handler
 * }
 */
