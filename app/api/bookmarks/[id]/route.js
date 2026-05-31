import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import User from '@/models/User'
import { getCurrentUser } from '@/lib/auth'
import { isValidObjectId } from '@/lib/utils'
import { checkCSRF } from '@/lib/csrf'

/**
 * DELETE /api/bookmarks/[id]
 * Removes a question from user's bookmarks
 */
export async function DELETE(request, { params }) {
  try {
    const { id } = await params
    if (!id || !isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid or missing question ID' }, { status: 400 })
    }

    const tokenData = await getCurrentUser(request)
    if (!tokenData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const csrfError = checkCSRF('DELETE', request)
    if (csrfError) return NextResponse.json(csrfError, { status: csrfError.status })

    await connectDB()

    const user = await User.findById(tokenData.userId)
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Remove from array
    user.bookmarkedQuestions = user.bookmarkedQuestions.filter(
      (bookmarkId) => bookmarkId.toString() !== id
    )

    await user.save()

    return NextResponse.json({
      success: true,
      message: 'Question removed from bookmarks',
    })
  } catch (error) {
    console.error('[api/bookmarks/[id]] DELETE error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
