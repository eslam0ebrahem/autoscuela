import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import User from '@/models/User'
import RefreshToken from '@/models/RefreshToken'
import {
  getRefreshTokenFromRequest,
  signAccessToken,
  signRefreshToken,
  setAuthCookie,
  setRefreshCookie,
  verifyRefreshToken,
} from '@/lib/auth'
import { checkCSRF } from '@/lib/csrf'

// ---------------------------------------------------------------------------
// POST /api/auth/refresh - Refresh access token
// ---------------------------------------------------------------------------
// Takes a refresh token and issues a new access token.
// Optionally rotates the refresh token (token rotation security pattern).
// ---------------------------------------------------------------------------

export async function POST(request) {
  try {
    // ── CSRF Protection ────────────────────────────────────────────────────
    const csrfError = checkCSRF('POST', request)
    if (csrfError) {
      return NextResponse.json(csrfError, { status: csrfError.status })
    }

    // ── Get refresh token ──────────────────────────────────────────────────
    const refreshToken = getRefreshTokenFromRequest(request)

    if (!refreshToken) {
      return NextResponse.json({ error: 'Refresh token not provided' }, { status: 401 })
    }

    // ── Verify refresh token ───────────────────────────────────────────────
    const tokenData = verifyRefreshToken(refreshToken)
    if (!tokenData) {
      return NextResponse.json({ error: 'Invalid refresh token' }, { status: 401 })
    }

    // ── Connect to DB and get user ─────────────────────────────────────────
    await connectDB()

    const user = await User.findById(tokenData.userId).select('-passwordHash')

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // ── Check refresh token validity in DB ─────────────────────────────────
    const storedToken = await RefreshToken.verifyToken(refreshToken)

    if (!storedToken) {
      // Token not found, revoked, or expired
      return NextResponse.json(
        { error: 'Refresh token is invalid or has expired' },
        { status: 401 }
      )
    }

    // ── Generate new access token ──────────────────────────────────────────
    const newAccessToken = signAccessToken({
      userId: user._id.toString(),
      role: user.role,
    })

    // ── Rotate refresh token (advanced security) ───────────────────────────
    // This prevents refresh token reuse (if the token is ever stolen)
    const newRefreshToken = signRefreshToken({
      userId: user._id.toString(),
      role: user.role,
    })

    try {
      await RefreshToken.rotateToken(
        refreshToken,
        newRefreshToken,
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      )
    } catch (rotateError) {
      console.error('[auth/refresh] Token rotation failed:', rotateError)
      // Continue with new access token even if rotation fails
    }

    // ── Prepare response ───────────────────────────────────────────────────
    const response = NextResponse.json({
      message: 'Token refreshed successfully',
      accessToken: newAccessToken,
      user: {
        id: user._id,
        email: user.email,
        nickname: user.nickname,
        role: user.role,
        preferences: user.preferences,
        subscription: user.subscription,
        gamification: user.gamification,
        isPremium: user.isPremium,
      },
    })

    // Set new access token in cookie
    setAuthCookie(response, newAccessToken, true)

    // Set new refresh token cookie (rotation enabled)
    setRefreshCookie(response, newRefreshToken, true)

    return response
  } catch (error) {
    console.error('[auth/refresh] Error:', error)

    return NextResponse.json({ error: 'Failed to refresh token' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// GET /api/auth/refresh - Check token validity (optional)
// ---------------------------------------------------------------------------
// Simple endpoint to check if the current token is still valid
// and how much time is remaining.
// ---------------------------------------------------------------------------

export async function GET(request) {
  try {
    // No CSRF check needed for GET

    // ── Get access token ───────────────────────────────────────────────────
    const token =
      request.headers.get('authorization')?.substring(7) ||
      request.cookies.get('vialia_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 })
    }

    // ── Decode token (without verification) ────────────────────────────────
    const decoded = jwt.decode(token)

    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token format' }, { status: 400 })
    }

    // ── Calculate time remaining ───────────────────────────────────────────
    const now = Date.now() / 1000
    const expiresIn = decoded.exp - now

    if (expiresIn <= 0) {
      return NextResponse.json({ error: 'Token expired', expiresIn: 0 }, { status: 401 })
    }

    // Warn if expiring soon (within 1 minute)
    const expiringSoon = expiresIn < 60

    return NextResponse.json({
      valid: true,
      expiresIn: Math.floor(expiresIn),
      expiringSoon,
      message: expiringSoon ? 'Token expiring soon, consider refreshing' : 'Token is valid',
    })
  } catch (error) {
    console.error('[auth/refresh] GET error:', error)

    return NextResponse.json({ error: 'Failed to check token' }, { status: 500 })
  }
}
