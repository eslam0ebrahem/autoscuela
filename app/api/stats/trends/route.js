import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import UserAnswer from '@/models/UserAnswer'
import { getCurrentUser } from '@/lib/auth'
import { parsePositiveInt } from '@/lib/utils'

export async function GET(request) {
  try {
    const tokenData = await getCurrentUser(request)
    if (!tokenData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(request.url)
    const days = Math.min(parsePositiveInt(url.searchParams.get('days'), 14), 90)

    await connectDB()

    const trends = await UserAnswer.getStudyTrends(tokenData.userId, days)

    return NextResponse.json({ trends, days })
  } catch (error) {
    console.error('Trends error:', error)
    return NextResponse.json({ error: 'Failed to fetch trends' }, { status: 500 })
  }
}
