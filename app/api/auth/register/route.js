import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import connectDB from '@/lib/db'
import User from '@/models/User'
import { signToken, setAuthCookie } from '@/lib/auth'
import { checkRateLimit } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Validation Helpers
// ---------------------------------------------------------------------------
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD_LENGTH = 8
const MIN_NICKNAME_LENGTH = 2
const MAX_NICKNAME_LENGTH = 20
const ALLOWED_LANGUAGES = ['es', 'en']

// ---------------------------------------------------------------------------
// POST /api/auth/register - User registration
// ---------------------------------------------------------------------------
export async function POST(request) {
  try {
    const { email, password, nickname, language = 'es' } = await request.json()

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

    // ── Required fields ────────────────────────────────────────────────
    if (!email || !password || !nickname) {
      return NextResponse.json(
        { error: 'Email, password, and nickname are required' },
        { status: 400 }
      )
    }

    // ── Email validation ───────────────────────────────────────────────
    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // ── Password validation ────────────────────────────────────────────
    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
        { status: 400 }
      )
    }

    // Strong password check (optional but recommended)
    const hasUpperCase = /[A-Z]/.test(password)
    const hasLowerCase = /[a-z]/.test(password)
    const hasNumber = /[0-9]/.test(password)

    if (!hasUpperCase || !hasLowerCase || !hasNumber) {
      return NextResponse.json(
        {
          error: 'Password must contain uppercase, lowercase, and number',
        },
        { status: 400 }
      )
    }

    // ── Nickname validation ────────────────────────────────────────────
    const trimmedNickname = nickname.trim()

    if (
      trimmedNickname.length < MIN_NICKNAME_LENGTH ||
      trimmedNickname.length > MAX_NICKNAME_LENGTH
    ) {
      return NextResponse.json(
        {
          error: `Nickname must be between ${MIN_NICKNAME_LENGTH} and ${MAX_NICKNAME_LENGTH} characters`,
        },
        { status: 400 }
      )
    }

    // No special characters in nickname (alphanumeric + spaces only)
    if (!/^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ ]+$/.test(trimmedNickname)) {
      return NextResponse.json(
        { error: 'Nickname can only contain letters, numbers, and spaces' },
        { status: 400 }
      )
    }

    // ── Language validation ────────────────────────────────────────────
    if (!ALLOWED_LANGUAGES.includes(language)) {
      return NextResponse.json(
        { error: 'Language must be es or en' },
        { status: 400 }
      )
    }

    // ── Database operations ────────────────────────────────────────────
    await connectDB()

    // Check if email already exists
    const existing = await User.findOne({ email: email.toLowerCase() })
    if (existing) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      )
    }

    // Hash password with high cost factor for security
    const passwordHash = await bcrypt.hash(password, 12)

    // Create user
    const user = await User.create({
      email: email.toLowerCase(),
      passwordHash,
      nickname: trimmedNickname,
      preferences: { language },
    })

    // ── Generate token ─────────────────────────────────────────────────
    const token = signToken({
      userId: user._id.toString(),
      role: user.role,
    })

    // ── Prepare response ───────────────────────────────────────────────
    const response = NextResponse.json(
      {
        message: 'Account created successfully',
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
