import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import User from '@/models/User'
import Question from '@/models/Question'
import { getCurrentUser } from '@/lib/auth'
import { isValidObjectId } from '@/lib/utils'

export async function GET(req) {
  try {
    await connectDB()
    const session = await getCurrentUser(req)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(req.url)
    const populate = url.searchParams.get('populate')

    let query = User.findById(session.userId)
    if (populate === 'true') {
      query = query.populate({
        path: 'bookmarkedQuestions',
        match: { isActive: true }
      })
    }
    const user = await query

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ bookmarks: user.bookmarkedQuestions || [] })
  } catch (error) {
    console.error('Error fetching bookmarks:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(req) {
  try {
    await connectDB()
    const session = await getCurrentUser(req)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { questionId } = await req.json()
    if (!questionId || !isValidObjectId(questionId)) {
      return NextResponse.json({ error: 'Valid questionId is required' }, { status: 400 })
    }

    const questionExists = await Question.exists({ _id: questionId, isActive: true })
    if (!questionExists) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    const user = await User.findById(session.userId)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!user.bookmarkedQuestions) {
      user.bookmarkedQuestions = []
    }

    // Fix: use toString() for proper ObjectId comparison
    const isBookmarked = user.bookmarkedQuestions.some(id => id.toString() === questionId)

    if (isBookmarked) {
      user.bookmarkedQuestions = user.bookmarkedQuestions.filter((id) => id.toString() !== questionId)
    } else {
      user.bookmarkedQuestions.push(questionId)
    }

    await user.save()

    return NextResponse.json({
      success: true,
      isBookmarked: !isBookmarked,
      bookmarksCount: user.bookmarkedQuestions.length,
    })
  } catch (error) {
    console.error('Error toggling bookmark:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
