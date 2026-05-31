import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import Question from '@/models/Question'
import { getCurrentUser } from '@/lib/auth'
import { isValidObjectId } from '@/lib/utils'
import { checkCSRF } from '@/lib/csrf'

// ---------------------------------------------------------------------------
// Helper: Require Admin
// ---------------------------------------------------------------------------
async function requireAdmin(request) {
  const tokenData = await getCurrentUser(request)
  if (!tokenData || tokenData.role !== 'admin') return null
  return tokenData
}

// ---------------------------------------------------------------------------
// GET /api/admin/questions/[id] - Get single question
// ---------------------------------------------------------------------------
export async function GET(request, { params }) {
  try {
    const { id } = await params
    const tokenData = await requireAdmin(request)
    if (!tokenData) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid question ID' }, { status: 400 })
    }

    await connectDB()

    const question = await Question.findById(id)
    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    return NextResponse.json({ question })
  } catch (error) {
    console.error('[admin/questions/:id] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch question' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// PUT /api/admin/questions/[id] - Update question
// ---------------------------------------------------------------------------
export async function PUT(request, { params }) {
  try {
    const { id } = await params
    const tokenData = await requireAdmin(request)
    if (!tokenData) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid question ID' }, { status: 400 })
    }

    const csrfError = checkCSRF('PUT', request)
    if (csrfError) return NextResponse.json(csrfError, { status: csrfError.status })

    let data
    try {
      data = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    // Prevent overwriting protected fields
    delete data._id
    delete data.stats
    delete data.createdAt

    await connectDB()

    const question = await Question.findByIdAndUpdate(
      id,
      { $set: data },
      { returnDocument: 'after', runValidators: true }
    )

    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    return NextResponse.json({
      question,
      message: 'Question updated successfully',
    })
  } catch (error) {
    console.error('[admin/questions/:id] PUT error:', error)
    return NextResponse.json({ error: 'Update failed: ' + error.message }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/admin/questions/[id] - Soft delete (deactivate)
// ---------------------------------------------------------------------------
export async function DELETE(request, { params }) {
  try {
    const { id } = await params
    const tokenData = await requireAdmin(request)
    if (!tokenData) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const csrfError = checkCSRF('DELETE', request)
    if (csrfError) return NextResponse.json(csrfError, { status: csrfError.status })

    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid question ID' }, { status: 400 })
    }

    await connectDB()

    // Soft delete - set isActive to false
    const question = await Question.findByIdAndUpdate(
      id,
      { $set: { isActive: false } },
      { returnDocument: 'after' }
    )

    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    return NextResponse.json({ message: 'Question deactivated successfully' })
  } catch (error) {
    console.error('[admin/questions/:id] DELETE error:', error)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
