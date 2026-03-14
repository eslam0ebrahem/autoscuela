import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import User from '@/models/User'
import Question from '@/models/Question'
import { getCurrentUser } from '@/lib/auth'
import mongoose from 'mongoose'

/**
 * GET /api/bookmarks
 * Returns all bookmarked questions for the current user
 */
export async function GET(request) {
  try {
    const tokenData = await getCurrentUser(request)
    if (!tokenData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()

    const user = await User.findById(tokenData.userId)
      .populate({
        path: 'bookmarkedQuestions',
        select: 'question options correct_option_idx topic_tag difficulty metadata',
      })
      .lean()

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const { searchParams } = new URL(request.url)
    const idsOnly = searchParams.get('idsOnly') === 'true'

    if (idsOnly) {
      return NextResponse.json({ bookmarks: user.bookmarkedQuestions?.map(q => q._id.toString()) || [] })
    }

    const bookmarks = (user.bookmarkedQuestions || []).map(q => ({
      _id: q._id.toString(),
      questionId: q._id.toString(),
      question: q.question,
      options: q.options,
      correct_option_idx: q.correct_option_idx,
      topic: q.topic_tag?.es || 'General',
      topicEn: q.topic_tag?.en || 'General',
      difficulty: q.difficulty,
      metadata: q.metadata,
    }))

    return NextResponse.json({ bookmarks })
  } catch (error) {
    console.error('[api/bookmarks] GET error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

/**
 * POST /api/bookmarks
 * Toggles a question in the user's bookmarks
 */
export async function POST(request) {
  try {
    const tokenData = await getCurrentUser(request)
    if (!tokenData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { questionId } = await request.json()
    if (!questionId) return NextResponse.json({ error: 'Missing questionId' }, { status: 400 })

    await connectDB()

    const user = await User.findById(tokenData.userId)
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const isBookmarked = user.bookmarkedQuestions.some(id => id.toString() === questionId)

    if (isBookmarked) {
      user.bookmarkedQuestions = user.bookmarkedQuestions.filter(id => id.toString() !== questionId)
    } else {
      user.bookmarkedQuestions.push(questionId)
    }

    await user.save()

    return NextResponse.json({ 
      success: true, 
      isBookmarked: !isBookmarked 
    })
  } catch (error) {
    console.error('[api/bookmarks] POST error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
