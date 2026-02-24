import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import Question from '@/models/Question'
import { getCurrentUser } from '@/lib/auth'

async function requireAdmin(request) {
  const tokenData = await getCurrentUser(request)
  if (!tokenData || tokenData.role !== 'admin') return null
  return tokenData
}

export async function GET(request, { params }) {
  try {
    const tokenData = await requireAdmin(request)
    if (!tokenData) return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    await connectDB()
    const q = await Question.findById(params.id)
    if (!q) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ question: q })
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function PUT(request, { params }) {
  try {
    const tokenData = await requireAdmin(request)
    if (!tokenData) return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    const data = await request.json()
    await connectDB()
    const q = await Question.findByIdAndUpdate(params.id, { $set: data }, { new: true })
    if (!q) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ question: q })
  } catch (error) {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  try {
    const tokenData = await requireAdmin(request)
    if (!tokenData) return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    await connectDB()
    // Soft delete
    await Question.findByIdAndUpdate(params.id, { isActive: false })
    return NextResponse.json({ message: 'Question deactivated' })
  } catch (error) {
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
