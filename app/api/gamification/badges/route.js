import { NextResponse } from 'next/server'
import User from '@/models/User'
import { compose, withAuth, withDB } from '@/lib/middleware'
import { BADGES } from '@/lib/gamification'

export const GET = compose(
  withAuth(),
  withDB(),
  async (_request, ctx) => {
    const user = await User.findById(ctx.user.userId).select(
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
  }
)
