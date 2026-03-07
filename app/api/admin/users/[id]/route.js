import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import User from '@/models/User'
import { getCurrentUser } from '@/lib/auth'
import { isValidObjectId } from '@/lib/utils'

export async function GET(request, { params }) {
  try {
    const tokenData = await getCurrentUser(request)
    if (!tokenData || tokenData.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    if (!isValidObjectId(params.id)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    }

    await connectDB()

    const user = await User.findById(params.id).select('-passwordHash')
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    return NextResponse.json({ user })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 })
  }
}

export async function PUT(request, { params }) {
  try {
    const tokenData = await getCurrentUser(request)
    if (!tokenData || tokenData.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    if (!isValidObjectId(params.id)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    }

    const { role, premiumOverride } = await request.json()

    await connectDB()

    const updates = {}
    if (role && ['user', 'admin'].includes(role)) {
      updates.role = role
    }
    if (typeof premiumOverride === 'boolean') {
      updates.premiumOverride = premiumOverride
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid updates provided' }, { status: 400 })
    }

    const user = await User.findByIdAndUpdate(params.id, { $set: updates }, { new: true }).select(
      '-passwordHash'
    )

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    return NextResponse.json({ user, message: 'User updated successfully' })
  } catch (error) {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}
