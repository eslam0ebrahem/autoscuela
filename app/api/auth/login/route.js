import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import connectDB from '@/lib/db'
import User from '@/models/User'
import { signToken, setAuthCookie } from '@/lib/auth'
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

    const { email, password, rememberMe = true } = validated

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
        userId: user?._id ?? null,
        action: 'LOGIN_FAILED',
        resourceType: 'User',
        resourceId: user?._id ?? null,
        metadata: {
          email: email,
          ipAddress: ip,
          reason: user ? 'invalid_password' : 'user_not_found',
        },
      })
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    // ── Password verification ──────────────────────────────────────────
    const isValid = await bcrypt.compare(password, user.passwordHash)

    if (!isValid) {
      await logAudit({
        userId: user?._id ?? null,
        action: 'LOGIN_FAILED',
        resourceType: 'User',
        resourceId: user?._id ?? null,
        metadata: {
          email: email,
          ipAddress: ip,
          reason: user ? 'invalid_password' : 'user_not_found',
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

    return response
  } catch (error) {
    console.error('[auth/login] Error:', error)
    return NextResponse.json({ error: 'Login failed. Please try again.' }, { status: 500 })
  }
}
