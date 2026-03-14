import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import User from '@/models/User'
import { getCurrentUser } from '@/lib/auth'
import { isValidObjectId } from '@/lib/utils'

// ---------------------------------------------------------------------------
// GET /api/admin/users/[id] - Get single user
// ---------------------------------------------------------------------------
export async function GET(request, { params }) {
  try {
    const { id } = await params
    const tokenData = await getCurrentUser(request)
    if (!tokenData || tokenData.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    }

    await connectDB()

    const user = await User.findById(id).select('-passwordHash')
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ user })
  } catch (error) {
    console.error('[admin/users/:id] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/admin/users/[id] - Update user
// ---------------------------------------------------------------------------
export async function PATCH(request, { params }) {
  try {
    const { id } = await params
    const tokenData = await getCurrentUser(request)
    if (!tokenData || tokenData.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    }

    const { role, premiumOverride } = await request.json()

    await connectDB()

    // Build updates object
    const updates = {}
    if (role && ['user', 'admin'].includes(role)) {
      updates.role = role
    }
    if (typeof premiumOverride === 'boolean') {
      updates.premiumOverride = premiumOverride
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid updates provided' },
        { status: 400 }
      )
    }

    const user = await User.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true }
    ).select('-passwordHash')

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      user,
      message: 'User updated successfully',
    })
  } catch (error) {
    console.error('[admin/users/:id] PATCH error:', error)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}
