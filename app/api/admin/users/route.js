import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import User from '@/models/User'
import { getCurrentUser } from '@/lib/auth'
import { escapeRegex, parsePositiveInt } from '@/lib/utils'

export async function GET(request) {
  try {
    const tokenData = await getCurrentUser(request)
    if (!tokenData || tokenData.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    await connectDB()

    const url = new URL(request.url)
    const page = parsePositiveInt(url.searchParams.get('page'), 1)
    const limit = Math.min(parsePositiveInt(url.searchParams.get('limit'), 20), 100)
    const search = url.searchParams.get('search') || ''
    const role = url.searchParams.get('role') || ''
    const sort = url.searchParams.get('sort') || '-createdAt'

    const query = {}
    if (search) {
      const escaped = escapeRegex(search)
      query.$or = [
        { email: { $regex: escaped, $options: 'i' } },
        { nickname: { $regex: escaped, $options: 'i' } },
      ]
    }
    if (role && ['user', 'admin'].includes(role)) {
      query.role = role
    }

    const sortObj = {}
    if (sort.startsWith('-')) {
      sortObj[sort.slice(1)] = -1
    } else {
      sortObj[sort] = 1
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .select('-passwordHash')
        .sort(sortObj)
        .skip((page - 1) * limit)
        .limit(limit),
      User.countDocuments(query),
    ])

    return NextResponse.json({ users, total, page, totalPages: Math.ceil(total / limit) })
  } catch (error) {
    console.error('Admin users error:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}
