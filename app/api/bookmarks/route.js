import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import User from '@/models/User'
import Question from '@/models/Question'
import { getCurrentUser } from '@/lib/auth'
import { checkCSRF } from '@/lib/csrf'
import { checkRateLimit } from '@/lib/utils'
import {
  BookmarkToggleSchema,
  BookmarkQuerySchema,
  parseSchema,
  parseQueryParams,
} from '@/lib/schemas'
import mongoose from 'mongoose'

/**
 * GET /api/bookmarks
 * Returns paginated bookmarked questions for the current user
 * Query params: limit (default 20, max 100), offset (default 0)
 */
export async function GET(request) {
  try {
    const tokenData = await getCurrentUser(request)
    if (!tokenData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // ── Rate limiting ──────────────────────────────────────────────────
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const rateCheck = await checkRateLimit(`bookmarks:${tokenData.userId}:get`, 30, 60000)
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfter || 60) } }
      )
    }

    // ── Parse query params ─────────────────────────────────────────────
    const { data: queryParams, error: queryError } = parseQueryParams(request, BookmarkQuerySchema)
    if (queryError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryError.messages },
        { status: queryError.status }
      )
    }

    const { idsOnly } = queryParams

    // ── Pagination params ──────────────────────────────────────────────
    const url = new URL(request.url)
    let limit = parseInt(url.searchParams.get('limit')) || 20
    const offset = Math.max(0, parseInt(url.searchParams.get('offset')) || 0)

    // Validate limit
    if (limit < 1) limit = 20
    if (limit > 100) limit = 100

    await connectDB()

    const user = await User.findById(tokenData.userId).lean()
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const totalCount = user.bookmarkedQuestions?.length || 0

    if (idsOnly) {
      return NextResponse.json({
        bookmarks: user.bookmarkedQuestions?.map((q) => q.toString()) || [],
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
      })
    }

    // ── Paginate question IDs ──────────────────────────────────────────
    const paginatedIds = (user.bookmarkedQuestions || []).slice(offset, offset + limit)

    const questions = await Question.find({ _id: { $in: paginatedIds } })
      .select('question options correct_option_idx topic_tag difficulty metadata')
      .lean()

    // Fire-and-forget: remove stale bookmark IDs for questions that no longer exist
    if (questions.length < paginatedIds.length) {
      const foundIds = new Set(questions.map((q) => q._id.toString()))
      const staleIds = paginatedIds.filter((id) => !foundIds.has(id.toString()))
      User.findByIdAndUpdate(tokenData.userId, { $pull: { bookmarks: { $in: staleIds } } }).catch(
        (err) => console.error('[bookmarks] stale cleanup failed:', err.message)
      )
    }

    const questionMap = new Map(questions.map((q) => [q._id.toString(), q]))

    const bookmarks = paginatedIds
      .map((id) => {
        const q = questionMap.get(id.toString())
        if (!q) return null
        return {
          _id: q._id.toString(),
          questionId: q._id.toString(),
          question: q.question,
          options: q.options,
          correct_option_idx: q.correct_option_idx,
          topic: q.topic_tag?.es || 'General',
          topicEn: q.topic_tag?.en || 'General',
          difficulty: q.difficulty,
          metadata: q.metadata,
        }
      })
      .filter(Boolean)

    return NextResponse.json({
      bookmarks,
      total: totalCount,
      limit,
      offset,
      hasMore: offset + limit < totalCount,
    })
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
    // ── CSRF Protection ────────────────────────────────────────────────
    const csrfError = checkCSRF('POST', request)
    if (csrfError) {
      return NextResponse.json(csrfError, { status: csrfError.status })
    }

    const tokenData = await getCurrentUser(request)
    if (!tokenData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // ── Rate limiting ──────────────────────────────────────────────────
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const rateCheck = await checkRateLimit(`bookmarks:${tokenData.userId}:post`, 20, 60000)
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many bookmark changes' },
        { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfter || 60) } }
      )
    }

    // ── Parse and validate body ────────────────────────────────────────
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { data: validated, error: validationError } = parseSchema(BookmarkToggleSchema, body)
    if (validationError) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationError.messages },
        { status: validationError.status }
      )
    }

    const { questionId } = validated

    await connectDB()

    const user = await User.findById(tokenData.userId)
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const isBookmarked = user.bookmarkedQuestions.some((id) => id.toString() === questionId)

    if (isBookmarked) {
      user.bookmarkedQuestions = user.bookmarkedQuestions.filter(
        (id) => id.toString() !== questionId
      )
    } else {
      user.bookmarkedQuestions.push(questionId)
    }

    await user.save()

    return NextResponse.json({
      success: true,
      isBookmarked: !isBookmarked,
    })
  } catch (error) {
    console.error('[api/bookmarks] POST error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
