import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import User from '@/models/User'
import { getCurrentUser } from '@/lib/auth'

export async function GET(request) {
  try {
    const tokenData = await getCurrentUser(request)
    if (!tokenData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const user = await User.findById(tokenData.userId).select('-passwordHash')
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      user: {
        id: user._id,
        email: user.email,
        nickname: user.nickname,
        role: user.role,
        preferences: user.preferences,
        subscription: user.subscription,
        gamification: user.gamification,
        aiInsights: user.aiInsights,
        isPremium: user.isPremium,
      },
    })
  } catch (error) {
    console.error('Get user error:', error)
    return NextResponse.json({ error: 'Failed to get user' }, { status: 500 })
  }
}

export async function DELETE(request) {
  // Logout
  const response = NextResponse.json({ message: 'Logged out' })
  response.cookies.set('vialia_token', '', {
    httpOnly: true,
    maxAge: 0,
    path: '/',
  })
  return response
}
