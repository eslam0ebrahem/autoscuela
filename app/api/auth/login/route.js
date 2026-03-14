import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import connectDB from '@/lib/db'
import User from '@/models/User'
import { signToken, setAuthCookie } from '@/lib/auth'
import { checkRateLimit } from '@/lib/utils'

// ---------------------------------------------------------------------------
// POST /api/auth/login - User login
// ---------------------------------------------------------------------------
export async function POST(request) {
  try {
    const { email, password, rememberMe = true } = await request.json()

    // ── Validation ─────────────────────────────────────────────────────
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // ── Rate limiting ──────────────────────────────────────────────────
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const rateLimitKey = `login:${ip}:${email.toLowerCase()}`
    const rateCheck = checkRateLimit(rateLimitKey, 5, 300000) // 5 attempts per 5 min

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

    const user = await User.findOne({ email: email.toLowerCase() }).select(
      '+passwordHash'
    )

    if (!user) {
      // Generic error to prevent user enumeration
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // ── Password verification ──────────────────────────────────────────
    const isValid = await bcrypt.compare(password, user.passwordHash)

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
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

    setAuthCookie(response, token, rememberMe)

    return response
  } catch (error) {
    console.error('[auth/login] Error:', error)
    return NextResponse.json(
      { error: 'Login failed. Please try again.' },
      { status: 500 }
    )
  }
}
