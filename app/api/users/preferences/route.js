import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import User from '@/models/User'
import { getCurrentUser } from '@/lib/auth'

export async function PUT(request) {
  try {
    const tokenData = await getCurrentUser(request)
    if (!tokenData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { language, nickname } = await request.json()

    await connectDB()

    const updateFields = {}
    if (language && ['es', 'en'].includes(language)) {
      updateFields['preferences.language'] = language
    }
    if (nickname) {
      const trimmed = nickname.trim()
      if (trimmed.length < 2 || trimmed.length > 20) {
        return NextResponse.json({ error: 'Nickname must be between 2 and 20 characters' }, { status: 400 })
      }
      updateFields.nickname = trimmed
    }

    const user = await User.findByIdAndUpdate(tokenData.userId, { $set: updateFields }, { new: true }).select(
      '-passwordHash'
    )

    return NextResponse.json({ user })
  } catch (error) {
    console.error('Update preferences error:', error)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}
