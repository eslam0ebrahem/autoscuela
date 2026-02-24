import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import User from '@/models/User'
import { getCurrentUser } from '@/lib/auth'

async function requireAdmin(request) {
  const tokenData = await getCurrentUser(request)
  if (!tokenData || tokenData.role !== 'admin') return null
  return tokenData
}

export async function PATCH(request, { params }) {
  try {
    const tokenData = await requireAdmin(request)
    if (!tokenData) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

    const { premiumOverride, role } = await request.json()
    await connectDB()

    const updateFields = {}
    if (premiumOverride !== undefined) updateFields.premiumOverride = premiumOverride
    if (role && ['user', 'admin'].includes(role)) updateFields.role = role

    const user = await User.findByIdAndUpdate(
      params.id,
      { $set: updateFields },
      { new: true }
    ).select('-passwordHash')

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    return NextResponse.json({ user })
  } catch (error) {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}
