import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import connectDB from '@/lib/db'
import User from '@/models/User'
import { signToken, setAuthCookie } from '@/lib/auth'
import { checkRateLimit } from '@/lib/utils'

export async function POST(request) {
  try {
    const { email, password, rememberMe } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    // Rate limit by IP + email
    const ip = request.headers.get('x-forwarded-for') || 'unknown'
    const rateLimitKey = `login:${ip}:${email.toLowerCase()}`
    const rateCheck = checkRateLimit(rateLimitKey, 5, 300000) // 5 attempts per 5 min
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfter) } }
      )
    }

    await connectDB()

    const user = await User.findOne({ email: email.toLowerCase() })
    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const isValid = await bcrypt.compare(password, user.passwordHash)
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const token = signToken({ userId: user._id.toString(), role: user.role })

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
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
