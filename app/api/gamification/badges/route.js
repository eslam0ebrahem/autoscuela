import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import User from '@/models/User'
import { getCurrentUser } from '@/lib/auth'
import { BADGES } from '@/lib/gamification'

export async function GET(request) {
  try {
    const tokenData = await getCurrentUser(request)
    if (!tokenData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()

    const user = await User.findById(tokenData.userId).select(
      'gamification.earnedBadges preferences'
    )

    const earnedBadges = user?.gamification?.earnedBadges || []
    const lang = user?.preferences?.language || 'es'

    const badgesWithStatus = BADGES.map((badge) => ({
      id: badge.id,
      name: badge.name[lang],
      description: badge.description[lang],
      icon: badge.icon,
      color: badge.color,
      unlocked: earnedBadges.includes(badge.id),
    }))

    return NextResponse.json({ badges: badgesWithStatus, earned: earnedBadges.length })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch badges' }, { status: 500 })
  }
}
