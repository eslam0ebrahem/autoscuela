import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import connectDB from '@/lib/db'
import User from '@/models/User'
import { getCurrentUser } from '@/lib/auth'

export async function GET(request) {
  try {
    const tokenData = await getCurrentUser(request)
    if (!tokenData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()
    const user = await User.findById(tokenData.userId).select('preferences nickname email')
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    return NextResponse.json({
      preferences: user.preferences,
      nickname: user.nickname,
      email: user.email,
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 })
  }
}

export async function PUT(request) {
  try {
    const tokenData = await getCurrentUser(request)
    if (!tokenData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { language, nickname, theme, soundEnabled, currentPassword, newPassword } =
      await request.json()

    await connectDB()

    const updates = {}

    // Language
    if (language && ['es', 'en'].includes(language)) {
      updates['preferences.language'] = language
    }

    // Theme
    if (theme && ['light', 'dark', 'system'].includes(theme)) {
      updates['preferences.theme'] = theme
    }

    // Sound
    if (typeof soundEnabled === 'boolean') {
      updates['preferences.soundEnabled'] = soundEnabled
    }

    // Nickname
    if (nickname) {
      const trimmed = nickname.trim()
      if (trimmed.length < 2 || trimmed.length > 20) {
        return NextResponse.json({ error: 'Nickname must be 2-20 characters' }, { status: 400 })
      }
      updates.nickname = trimmed
    }

    // Password change
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json({ error: 'Current password required' }, { status: 400 })
      }
      if (newPassword.length < 8) {
        return NextResponse.json(
          { error: 'New password must be at least 8 characters' },
          { status: 400 }
        )
      }

      const user = await User.findById(tokenData.userId)
      const isValid = await bcrypt.compare(currentPassword, user.passwordHash)
      if (!isValid) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })
      }

      updates.passwordHash = await bcrypt.hash(newPassword, 12)
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ message: 'No changes to apply' })
    }

    const user = await User.findByIdAndUpdate(
      tokenData.userId,
      { $set: updates },
      { returnDocument: 'after' }
    ).select('-passwordHash')

    return NextResponse.json({
      message: 'Settings updated',
      user: {
        nickname: user.nickname,
        preferences: user.preferences,
      },
    })
  } catch (error) {
    console.error('Update preferences error:', error)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}
