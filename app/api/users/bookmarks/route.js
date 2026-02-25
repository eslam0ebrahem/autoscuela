import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import User from '@/models/User'
import Question from '@/models/Question' // Required for populate to work
import { getCurrentUser } from '@/lib/auth'

export async function GET(req) {
    try {
        await dbConnect()
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
                match: { isActive: true } // Only populate active questions
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
        await dbConnect()
        const session = await getCurrentUser(req)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { questionId } = await req.json()
        if (!questionId) {
            return NextResponse.json({ error: 'questionId is required' }, { status: 400 })
        }

        const user = await User.findById(session.userId)
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        // Initialize array if it doesn't exist
        if (!user.bookmarkedQuestions) {
            user.bookmarkedQuestions = []
        }

        const isBookmarked = user.bookmarkedQuestions.includes(questionId)

        if (isBookmarked) {
            // Remove bookmark
            user.bookmarkedQuestions = user.bookmarkedQuestions.filter((id) => id.toString() !== questionId)
        } else {
            // Add bookmark
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
