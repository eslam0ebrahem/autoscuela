import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import User from '@/models/User'
import { getCurrentUser, getTokenFromRequest, blacklistToken, clearAuthCookie } from '@/lib/auth'
import { checkCSRF } from '@/lib/csrf'
import { checkRateLimit } from '@/lib/utils'
import { nicknameUpdateSchema } from '@/lib/schemas'

// ---------------------------------------------------------------------------
// GET /api/auth/me - Get current user session
// ---------------------------------------------------------------------------
export async function GET(request) {
  try {
    // ── Verify token ───────────────────────────────────────────────────
    const tokenData = await getCurrentUser(request)

    if (!tokenData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── Fetch user data ────────────────────────────────────────────────
    await connectDB()

    const user = await User.findById(tokenData.userId).select('-passwordHash')

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // ── Return user data ───────────────────────────────────────────────
    return NextResponse.json({
      user: {
        id: user._id,
        email: user.email,
        nickname: user.nickname,
        role: user.role,
        emailVerified: user.emailVerified,
        preferences: user.preferences,
        subscription: user.subscription,
        gamification: user.gamification,
        aiInsights: user.aiInsights,
        isPremium: user.isPremium,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
      },
    })
  } catch (error) {
    console.error('[auth/me] GET error:', error)

    // Handle JWT errors specifically
    if (error.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    if (error.name === 'TokenExpiredError') {
      return NextResponse.json({ error: 'Session expired' }, { status: 401 })
    }

    return NextResponse.json({ error: 'Failed to get user' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/auth/me - Logout (clear auth cookie + add token to blacklist)
// ---------------------------------------------------------------------------
export async function DELETE(request) {
  try {
    // ── CSRF Protection ────────────────────────────────────────────────
    const csrfError = checkCSRF('DELETE', request)
    if (csrfError) {
      return NextResponse.json(csrfError, { status: csrfError.status })
    }

    // ── Get token and blacklist it ─────────────────────────────────────
    const token = getTokenFromRequest(request)
    const tokenData = await getCurrentUser(request).catch(() => null)

    if (token && tokenData) {
      try {
        await blacklistToken(token, tokenData.userId, 'logout')
      } catch (blacklistError) {
        console.error('[auth/me] Failed to blacklist token:', blacklistError)
        // Continue with logout even if blacklist fails
      }
    }

    // ── Track logout in database ───────────────────────────────────────
    if (tokenData) {
      await connectDB()
      const user = await User.findById(tokenData.userId)
      if (user) {
        user.lastLogoutAt = new Date()
        await user.save()
      }
    }

    // ── Clear auth cookies ─────────────────────────────────────────────
    const response = NextResponse.json({
      message: 'Logged out successfully',
    })

    clearAuthCookie(response)

    return response
  } catch (error) {
    console.error('[auth/me] DELETE error:', error)

    // Still return success and clear cookies even on error
    const response = NextResponse.json({
      message: 'Logged out',
    })

    clearAuthCookie(response)

    return response
  }
}

// ---------------------------------------------------------------------------
// PUT /api/auth/me - Update current user (optional enhancement)
// ---------------------------------------------------------------------------
export async function PUT(request) {
  try {
    // ── CSRF Protection ────────────────────────────────────────────────
    const csrfError = checkCSRF('PUT', request)
    if (csrfError) {
      return NextResponse.json(csrfError, { status: csrfError.status })
    }

    const tokenData = await getCurrentUser(request)

    if (!tokenData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── Rate limiting ───────────────────────────────────────────────────
    const rateCheck = await checkRateLimit(`nickname:${tokenData.userId}`, 5, 60000) // 5 per minute
    if (!rateCheck.allowed) {
      const retryAfter = Math.ceil((rateCheck.retryAfter || 60000) / 1000)
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      )
    }

    const { nickname } = await request.json()

    // ── Validation ─────────────────────────────────────────────────────
    const parseResult = nicknameUpdateSchema.safeParse({ nickname })
    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.errors[0].message }, { status: 400 })
    }
    const trimmedNickname = parseResult.data.nickname.trim()

    // ── Update user ────────────────────────────────────────────────────
    await connectDB()

    const user = await User.findByIdAndUpdate(
      tokenData.userId,
      { nickname: trimmedNickname },
      { returnDocument: 'after', select: '-passwordHash' }
    )

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        email: user.email,
        nickname: user.nickname,
        role: user.role,
        emailVerified: user.emailVerified,
        preferences: user.preferences,
        subscription: user.subscription,
        gamification: user.gamification,
        isPremium: user.isPremium,
      },
    })
  } catch (error) {
    console.error('[auth/me] PUT error:', error)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}
