import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import User from '@/models/User'
import { getCurrentUser } from '@/lib/auth'
import { isValidObjectId, checkRateLimit } from '@/lib/utils'
import { AdminUserUpdateSchema, parseSchema, parsePathParams } from '@/lib/schemas'
import { z } from 'zod'

const PathParamsSchema = z.object({
  id: z.string().regex(/^[0-9a-f]{24}$/, 'Invalid MongoDB ObjectID'),
})

// ---------------------------------------------------------------------------
// GET /api/admin/users/[id] - Get single user
// ---------------------------------------------------------------------------
export async function GET(request, { params }) {
  try {
    const { id } = await params
    const tokenData = await getCurrentUser(request)
    if (!tokenData || tokenData.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    // ── Rate limiting ──────────────────────────────────────────────────
    const rateCheck = checkRateLimit(`admin:users:${tokenData.userId}:get`, 30, 60000)
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfter || 60) } }
      )
    }

    // ── Validate path params ───────────────────────────────────────────
    const { data: pathParams, error: pathError } = parsePathParams({ id }, PathParamsSchema)
    if (pathError) {
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      )
    }

    await connectDB()

    const user = await User.findById(pathParams.id).select('-passwordHash')
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ user })
  } catch (error) {
    console.error('[admin/users/:id] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/admin/users/[id] - Update user
// ---------------------------------------------------------------------------
export async function PATCH(request, { params }) {
  try {
    const { id } = await params
    const tokenData = await getCurrentUser(request)
    if (!tokenData || tokenData.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    // ── Rate limiting ──────────────────────────────────────────────────
    const rateCheck = checkRateLimit(`admin:users:${tokenData.userId}:patch`, 10, 60000)
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfter || 60) } }
      )
    }

    // ── Validate path params ───────────────────────────────────────────
    const { data: pathParams, error: pathError } = parsePathParams({ id }, PathParamsSchema)
    if (pathError) {
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      )
    }

    // ── Parse and validate body ────────────────────────────────────────
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      )
    }

    const { data: validated, error: validationError } = parseSchema(AdminUserUpdateSchema, body)
    if (validationError) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationError.messages },
        { status: validationError.status }
      )
    }

    const { role, premiumOverride } = validated

    await connectDB()

    // Build updates object
    const updates = {}
    if (role) {
      updates.role = role
    }
    if (typeof premiumOverride === 'boolean') {
      updates.premiumOverride = premiumOverride
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid updates provided' },
        { status: 400 }
      )
    }

    const user = await User.findByIdAndUpdate(
      pathParams.id,
      { $set: updates },
      { new: true }
    ).select('-passwordHash')

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      user,
      message: 'User updated successfully',
    })
  } catch (error) {
    console.error('[admin/users/:id] PATCH error:', error)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}
