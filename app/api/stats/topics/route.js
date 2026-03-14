import { NextResponse } from 'next/server'
import mongoose from 'mongoose'
import connectDB from '@/lib/db'
import UserAnswer from '@/models/UserAnswer'
import { getCurrentUser } from '@/lib/auth'

export async function GET(request) {
  try {
    const tokenData = await getCurrentUser(request)
    if (!tokenData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()

    // Topic breakdown
    const topics = await UserAnswer.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(tokenData.userId) } },
      {
        $group: {
          _id: '$topic_tag.es',
          tagEn: { $first: '$topic_tag.en' },
          attempted: { $sum: 1 },
          correct: { $sum: { $cond: ['$is_correct', 1, 0] } },
        },
      },
      {
        $project: {
          tag: { es: '$_id', en: '$tagEn' },
          attempted: 1,
          correct: 1,
          accuracy: {
            $round: [{ $multiply: [{ $divide: ['$correct', '$attempted'] }, 100] }, 0],
          },
          _id: 0,
        },
      },
      { $sort: { accuracy: 1 } },
    ])

    return NextResponse.json({ topics })
  } catch (error) {
    console.error('Topic stats error:', error)
    return NextResponse.json({ error: 'Failed to fetch topic stats' }, { status: 500 })
  }
}
