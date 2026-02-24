import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import connectDB from '@/lib/db'
import User from '@/models/User'
import { signToken } from '@/lib/auth'

export async function POST(request) {
  try {
    const { email, password, nickname, language = 'es' } = await request.json()

    if (!email || !password || !nickname) {
      return NextResponse.json({ error: 'Email, password, and nickname are required' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    await connectDB()

    const existing = await User.findOne({ email: email.toLowerCase() })
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
    }

    const passwordHash = await bcrypt.hash(password, 12)

    const user = await User.create({
      email: email.toLowerCase(),
      passwordHash,
      nickname,
      preferences: { language },
    })

    const token = signToken({ userId: user._id.toString(), role: user.role })

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
        },
      },
      { status: 201 }
    )

    response.cookies.set('autoscuela_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 })
  }
}
