import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import User from '@/models/User'
import { getCurrentUser } from '@/lib/auth'

async function requireAdmin(request) {
  const tokenData = await getCurrentUser(request)
  if (!tokenData || tokenData.role !== 'admin') return null
  return tokenData
}

export async function GET(request) {
  try {
    const tokenData = await requireAdmin(request)
    if (!tokenData) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

    const url = new URL(request.url)
    const search = url.searchParams.get('search') || ''
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = 20

    await connectDB()

    const query = search ? { email: { $regex: search, $options: 'i' } } : {}

    const users = await User.find(query)
      .skip((page - 1) * limit)
      .limit(limit)
      .select('-passwordHash')
      .sort({ createdAt: -1 })

    const total = await User.countDocuments(query)

    return NextResponse.json({ users, total, page, totalPages: Math.ceil(total / limit) })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}
