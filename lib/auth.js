import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'
import connectDB from '@/lib/db'

const JWT_SECRET = process.env.JWT_SECRET

if (!JWT_SECRET) {
  throw new Error('Please define the JWT_SECRET environment variable')
}

// Token expiry times
const ACCESS_TOKEN_EXPIRY = '7d' // Increased from 15m to 7d
const REFRESH_TOKEN_EXPIRY = '30d' // Increased from 7d to 30d
const COOKIE_NAME = 'vialia_token'
const REFRESH_COOKIE_NAME = 'vialia_refresh'

/**
 * Sign an access token (short-lived)
 * @param {Object} payload - Token payload
 * @returns {string} Signed JWT token
 */
export function signAccessToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY })
}

/**
 * Sign a refresh token (longer-lived)
 * @param {Object} payload - Token payload
 * @returns {string} Signed JWT token
 */
export function signRefreshToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY })
}

/**
 * Legacy: sign token (kept for backwards compatibility, uses access token expiry)
 * @param {Object} payload - Token payload
 * @returns {string} Signed JWT token
 */
export function signToken(payload) {
  return signAccessToken(payload)
}

/**
 * Verify a token and check blacklist
 * @param {string} token - JWT token to verify
 * @param {boolean} checkBlacklist - Whether to check blacklist (default: true)
 * @returns {Object|null} Decoded token or null if invalid
 */
export async function verifyToken(token, checkBlacklist = true) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET)

    // Check if token is blacklisted
    if (checkBlacklist) {
      await connectDB()
      const TokenBlacklist = await import('@/models/TokenBlacklist').then((m) => m.default)
      const isBlacklisted = await TokenBlacklist.isBlacklisted(token)
      if (isBlacklisted) {
        return null
      }
    }

    return decoded
  } catch {
    return null
  }
}

/**
 * Set access token cookie
 * @param {Object} res - Next.js response object
 * @param {string} token - Access token
 * @param {boolean} rememberMe - Whether to set long-lived cookie (default: true)
 */
export function setAuthCookie(res, token, rememberMe = true) {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  }

  if (rememberMe) {
    // Access token now stays for 7 days
    cookieOptions.maxAge = 7 * 24 * 60 * 60 // 7 days
  }

  res.cookies.set(COOKIE_NAME, token, cookieOptions)
}

/**
 * Set refresh token cookie
 * @param {Object} res - Next.js response object
 * @param {string} token - Refresh token
 * @param {boolean} rememberMe - Whether to set long-lived cookie (default: true)
 */
export function setRefreshCookie(res, token, rememberMe = true) {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  }

  if (rememberMe) {
    cookieOptions.maxAge = 30 * 24 * 60 * 60 // 30 days
  }

  res.cookies.set(REFRESH_COOKIE_NAME, token, cookieOptions)
}

/**
 * Get token from request (cookie or Authorization header)
 * @param {Request} request - Next.js request
 * @returns {string|null} Token or null
 */
export function getTokenFromRequest(request) {
  // From access token cookie
  const cookie = request.cookies.get(COOKIE_NAME)
  if (cookie) return cookie.value

  // From Authorization header
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }

  return null
}

/**
 * Get refresh token from request
 * @param {Request} request - Next.js request
 * @returns {string|null} Refresh token or null
 */
export function getRefreshTokenFromRequest(request) {
  const cookie = request.cookies.get(REFRESH_COOKIE_NAME)
  if (cookie) return cookie.value
  return null
}

/**
 * Get current user from request
 * @param {Request} request - Next.js request
 * @returns {Promise<Object|null>} Decoded token data or null
 */
export async function getCurrentUser(request) {
  const token = getTokenFromRequest(request)
  if (!token) return null
  return verifyToken(token, true) // Check blacklist
}

/**
 * Clear both auth and refresh cookies
 * @param {Object} response - Next.js response object
 */
export function clearAuthCookie(response) {
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    maxAge: 0,
    path: '/',
  })

  response.cookies.set(REFRESH_COOKIE_NAME, '', {
    httpOnly: true,
    maxAge: 0,
    path: '/',
  })
}

/**
 * Add token to blacklist (for logout)
 * @param {string} token - Token to blacklist
 * @param {string} userId - User ID
 * @param {string} reason - Reason for blacklisting (default: 'logout')
 * @returns {Promise<Object>} Blacklist entry
 */
export async function blacklistToken(token, userId, reason = 'logout') {
  const TokenBlacklist = await import('@/models/TokenBlacklist').then((m) => m.default)

  // Decode to get expiration
  const decoded = jwt.decode(token)
  const expiresAt = decoded?.exp
    ? new Date(decoded.exp * 1000)
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  return TokenBlacklist.addToBlacklist(token, userId, expiresAt, reason)
}
