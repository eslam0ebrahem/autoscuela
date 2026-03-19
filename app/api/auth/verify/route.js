import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import User from '@/models/User'
import VerificationToken from '@/models/VerificationToken'
import { checkCSRF } from '@/lib/csrf'

// ---------------------------------------------------------------------------
// POST /api/auth/verify - Verify email address
// ---------------------------------------------------------------------------
// Takes a verification token and marks the user's email as verified.
// Requires: token (query or body parameter), userId (from token validation)
// ---------------------------------------------------------------------------

export async function POST(request) {
  try {
    // ── CSRF Protection ────────────────────────────────────────────────────
    const csrfError = checkCSRF('POST', request)
    if (csrfError) {
      return NextResponse.json(csrfError, { status: csrfError.status })
    }

    // ── Parse request ──────────────────────────────────────────────────────
    let body = {}
    try {
      body = await request.json()
    } catch {
      // No JSON body, check URL params instead
      const url = new URL(request.url)
      body.token = url.searchParams.get('token')
      body.userId = url.searchParams.get('userId')
    }

    const { token, userId } = body

    if (!token) {
      return NextResponse.json({ error: 'Verification token is required' }, { status: 400 })
    }

    // ── Connect to database ────────────────────────────────────────────────
    await connectDB()

    // ── Verify token and mark as used ──────────────────────────────────────
    const verificationDoc = await VerificationToken.verifyToken(token, userId)

    if (!verificationDoc) {
      // Rate limit failed attempts
      try {
        const attempts = await VerificationToken.recordAttempt(token)
        if (attempts > 5) {
          // Too many attempts, token is likely invalid
          return NextResponse.json(
            { error: 'Too many verification attempts. Please request a new verification link.' },
            { status: 429 }
          )
        }
      } catch {
        // Token not found, or other error
      }

      return NextResponse.json({ error: 'Invalid or expired verification token' }, { status: 400 })
    }

    // ── Update user email verified status ───────────────────────────────────
    const user = await User.findByIdAndUpdate(
      verificationDoc.userId,
      { emailVerified: true },
      { returnDocument: 'after', select: '-passwordHash' }
    )

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // ── Return success ─────────────────────────────────────────────────────
    return NextResponse.json({
      message: 'Email verified successfully',
      user: {
        id: user._id,
        email: user.email,
        nickname: user.nickname,
        emailVerified: user.emailVerified,
      },
    })
  } catch (error) {
    console.error('[auth/verify] Error:', error)

    return NextResponse.json(
      { error: 'Email verification failed. Please try again.' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// GET /api/auth/verify - Get verification token status
// ---------------------------------------------------------------------------
// Check if a verification token is valid (without using it)
// Query params: token, userId
// ---------------------------------------------------------------------------

export async function GET(request) {
  try {
    const url = new URL(request.url)
    const token = url.searchParams.get('token')
    const userId = url.searchParams.get('userId')

    if (!token) {
      return NextResponse.json({ error: 'Verification token is required' }, { status: 400 })
    }

    // ── Connect to database ────────────────────────────────────────────────
    await connectDB()

    // ── Get token status (without marking as used) ─────────────────────────
    const VerificationTokenModel = await import('@/models/VerificationToken').then((m) => m.default)
    const crypto = await import('crypto').then((m) => m.default)

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

    const verificationDoc = await VerificationTokenModel.findOne({
      tokenHash,
      used: false,
      expiresAt: { $gt: new Date() },
    })

    if (!verificationDoc) {
      return NextResponse.json({
        valid: false,
        message: 'Token is invalid or has expired',
      })
    }

    return NextResponse.json({
      valid: true,
      email: verificationDoc.email,
      expiresAt: verificationDoc.expiresAt,
      message: 'Token is valid',
    })
  } catch (error) {
    console.error('[auth/verify] GET error:', error)

    return NextResponse.json({ error: 'Failed to check token status' }, { status: 500 })
  }
}
