import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import Question from '@/models/Question'
import { getCurrentUser } from '@/lib/auth'

export async function GET(request) {
  try {
    const tokenData = await getCurrentUser(request)
    if (!tokenData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()

    // Aggregate unique topic tags with counts
    const decks = await Question.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$topic_tag.es', tagObj: { $first: '$topic_tag' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $project: { tag: '$tagObj', count: 1, _id: 0 } },
    ])

    return NextResponse.json({ decks: decks.filter((d) => d.tag) })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch decks' }, { status: 500 })
  }
}
