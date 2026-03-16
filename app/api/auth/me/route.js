import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import User from '@/models/User'
import { getCurrentUser, getTokenFromRequest, blacklistToken, clearAuthCookie } from '@/lib/auth'
import { checkCSRF } from '@/lib/csrf'

// ---------------------------------------------------------------------------
// GET /api/auth/me - Get current user session
// ---------------------------------------------------------------------------
export async function GET(request) {
  try {
    // ── Verify token ───────────────────────────────────────────────────
    const tokenData = await getCurrentUser(request)

    if (!tokenData) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // ── Fetch user data ────────────────────────────────────────────────
    await connectDB()

    const user = await User.findById(tokenData.userId).select('-passwordHash')

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
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
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      )
    }

    if (error.name === 'TokenExpiredError') {
      return NextResponse.json(
        { error: 'Session expired' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to get user' },
      { status: 500 }
    )
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
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { nickname } = await request.json()

    // ── Validation ─────────────────────────────────────────────────────
    if (!nickname) {
      return NextResponse.json(
        { error: 'Nickname is required' },
        { status: 400 }
      )
    }

    const trimmedNickname = nickname.trim()

    if (trimmedNickname.length < 2 || trimmedNickname.length > 20) {
      return NextResponse.json(
        { error: 'Nickname must be between 2 and 20 characters' },
        { status: 400 }
      )
    }

    if (!/^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ ]+$/.test(trimmedNickname)) {
      return NextResponse.json(
        { error: 'Nickname can only contain letters, numbers, and spaces' },
        { status: 400 }
      )
    }

    // ── Update user ────────────────────────────────────────────────────
    await connectDB()

    const user = await User.findByIdAndUpdate(
      tokenData.userId,
      { nickname: trimmedNickname },
      { new: true, select: '-passwordHash' }
    )

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
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
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    )
  }
}
