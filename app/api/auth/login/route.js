import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import connectDB from '@/lib/db'
import User from '@/models/User'
import RefreshToken from '@/models/RefreshToken'
import { signToken, signRefreshToken, setAuthCookie, setRefreshCookie } from '@/lib/auth'
import { checkCSRF } from '@/lib/csrf'
import { checkRateLimit } from '@/lib/utils'
import { LoginSchema, parseSchema } from '@/lib/schemas'
import { logAudit } from '@/lib/audit'

// ---------------------------------------------------------------------------
// POST /api/auth/login - User login
// ---------------------------------------------------------------------------
export async function POST(request) {
  try {
    // ── CSRF Protection ────────────────────────────────────────────────
    const csrfError = checkCSRF('POST', request)
    if (csrfError) {
      return NextResponse.json(csrfError, { status: csrfError.status })
    }

    // ── Parse and validate body ────────────────────────────────────────
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { data: validated, error: validationError } = parseSchema(LoginSchema, body)
    if (validationError) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationError.messages },
        { status: validationError.status }
      )
    }

    const { email: rawEmail, password, rememberMe = true } = validated
    const email = rawEmail.toLowerCase().trim()

    // ── Rate limiting ──────────────────────────────────────────────────
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const rateLimitKey = `login:${ip}:${email}`
    const rateCheck = await checkRateLimit(rateLimitKey, 5, 300000) // 5 attempts per 5 min

    if (!rateCheck.allowed) {
      const retryAfter = Math.ceil((rateCheck.retryAfter || 300000) / 1000)
      return NextResponse.json(
        {
          error: 'Too many login attempts. Please try again later.',
          retryAfter,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfter) },
        }
      )
    }

    // ── Database lookup ────────────────────────────────────────────────
    await connectDB()

    const user = await User.findOne({ email }).select('+passwordHash')

    if (!user) {
      // Generic error to prevent user enumeration
      await logAudit({
        userId: null,
        action: 'user_login_failed',
        resourceType: 'user',
        resourceId: null,
        metadata: {
          email: email,
          ipAddress: ip,
          reason: 'user_not_found',
        },
      })
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    // ── Password verification ──────────────────────────────────────────
    const isValid = await bcrypt.compare(password, user.passwordHash)

    if (!isValid) {
      await logAudit({
        userId: user._id,
        action: 'user_login_failed',
        resourceType: 'user',
        resourceId: user._id,
        metadata: {
          email: email,
          ipAddress: ip,
          reason: 'invalid_password',
        },
      })
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    // ── Check email verification status ────────────────────────────────
    // Note: Users can still log in with unverified emails, but with restricted access
    // This is a business decision - you can enforce verification here if desired
    if (!user.emailVerified) {
      // Optional warning or limited access
      // For now, allow login but flag unverified status
    }

    // ── Update last login ──────────────────────────────────────────────
    user.lastLoginAt = new Date()
    await user.save()

    // ── Generate token ─────────────────────────────────────────────────
    const token = signToken({
      userId: user._id.toString(),
      role: user.role,
    })

    const refreshTokenValue = signRefreshToken({
      userId: user._id.toString(),
      role: user.role,
    })

    await RefreshToken.createToken(
      refreshTokenValue,
      user._id,
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      { ipAddress: ip }
    )

    // ── Prepare response ───────────────────────────────────────────────
    const response = NextResponse.json({
      message: 'Logged in successfully',
      token, // Return token for mobile clients
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

    setAuthCookie(response, token, rememberMe)
    setRefreshCookie(response, refreshTokenValue, rememberMe)

    return response
  } catch (error) {
    console.error('[auth/login] Error:', error)
    return NextResponse.json({ error: 'Login failed. Please try again.' }, { status: 500 })
  }
}
