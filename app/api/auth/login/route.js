import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import connectDB from '@/lib/db'
import User from '@/models/User'
import { signToken, setAuthCookie } from '@/lib/auth'

export async function POST(request) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
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

    setAuthCookie(response, token)

    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
