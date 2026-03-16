import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import connectDB from '@/lib/db'
import User from '@/models/User'
import VerificationToken from '@/models/VerificationToken'
import { signToken, setAuthCookie } from '@/lib/auth'
import { sendVerificationEmail } from '@/lib/email'
import { checkCSRF } from '@/lib/csrf'
import { checkRateLimit } from '@/lib/utils'
import { RegisterSchema, parseSchema } from '@/lib/schemas'

// ---------------------------------------------------------------------------
// POST /api/auth/register - User registration
// ---------------------------------------------------------------------------
export async function POST(request) {
  try {
    // ── CSRF Protection ────────────────────────────────────────────────
    const csrfError = checkCSRF('POST', request)
    if (csrfError) {
      return NextResponse.json(csrfError, { status: csrfError.status })
    }

    // ── Rate limiting ──────────────────────────────────────────────────
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const rateCheck = checkRateLimit(`register:${ip}`, 3, 600000) // 3 per 10 min

    if (!rateCheck.allowed) {
      const retryAfter = Math.ceil((rateCheck.retryAfter || 600000) / 1000)
      return NextResponse.json(
        {
          error: 'Too many registration attempts. Please try again later.',
          retryAfter,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfter) },
        }
      )
    }

    // ── Parse and validate body ────────────────────────────────────────
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      )
    }

    const { data: validated, error: validationError } = parseSchema(RegisterSchema, body)
    if (validationError) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationError.messages },
        { status: validationError.status }
      )
    }

    const { email, password, nickname, language = 'en' } = validated

    // ── Database operations ────────────────────────────────────────────
    await connectDB()

    // Check if email already exists
    const existing = await User.findOne({ email })
    if (existing) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      )
    }

    // Hash password with high cost factor for security
    const passwordHash = await bcrypt.hash(password, 12)

    // Create user (email not yet verified)
    const user = await User.create({
      email,
      passwordHash,
      nickname,
      emailVerified: false,
      preferences: { language },
    })

    // ── Generate verification token ────────────────────────────────────
    const { token: verificationToken, doc: verificationDoc } = await VerificationToken.createToken(
      user._id,
      email,
      24 * 60 * 60 * 1000, // 24 hours
      'email_verification'
    )

    // ── Send verification email ────────────────────────────────────────
    const verificationUrl = `${process.env.APP_URL || 'http://localhost:3000'}/auth/verify?token=${verificationToken}&userId=${user._id}`

    try {
      await sendVerificationEmail(email, verificationUrl, language)
    } catch (emailError) {
      console.error('[auth/register] Failed to send verification email:', emailError)
      // Don't fail the registration if email sending fails
      // User can request a new verification email later
    }

    // ── Generate access token ──────────────────────────────────────────
    const token = signToken({
      userId: user._id.toString(),
      role: user.role,
    })

    // ── Prepare response ───────────────────────────────────────────────
    const response = NextResponse.json(
      {
        message: 'Account created successfully. Please verify your email to unlock all features.',
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
      },
      { status: 201 }
    )

    setAuthCookie(response, token, true) // Remember user by default

    return response
  } catch (error) {
    console.error('[auth/register] Error:', error)

    // Handle duplicate key error (race condition)
    if (error.code === 11000) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Registration failed. Please try again.' },
      { status: 500 }
    )
  }
}
