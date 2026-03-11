import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import QuestionReport from '@/models/QuestionReport'
import User from '@/models/User'
import mongoose from 'mongoose'

/**
 * POST /api/questions/report
 * Create a report for a question
 */
export async function POST(request) {
  try {
    const tokenData = await getCurrentUser(request)
    if (!tokenData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()

    const { questionId, reason, description } = await request.json()

    if (!questionId || !reason) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!['wrong_answer', 'unclear_text', 'outdated', 'missing_image', 'other'].includes(reason)) {
      return NextResponse.json({ error: 'Invalid reason' }, { status: 400 })
    }

    // Check if user already reported this question
    const existing = await QuestionReport.findOne({
      userId: tokenData.userId,
      questionId,
    })

    if (existing) {
      return NextResponse.json({ error: 'You already reported this question' }, { status: 400 })
    }

    const report = await QuestionReport.create({
      userId: tokenData.userId,
      questionId,
      reason,
      description: description || '',
    })

    return NextResponse.json({
      success: true,
      reportId: report._id,
    })
  } catch (error) {
    console.error('Question report error:', error)
    return NextResponse.json({ error: 'Failed to create report' }, { status: 500 })
  }
}

/**
 * GET /api/questions/report
 * Admin: list reports with filters
 */
export async function GET(request) {
  try {
    const tokenData = await getCurrentUser(request)
    if (!tokenData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()

    const user = await User.findById(tokenData.userId).select('role')
    if (user?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const url = new URL(request.url)
    const status = url.searchParams.get('status') || 'pending'
    const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1)
    const limit = Math.min(50, parseInt(url.searchParams.get('limit')) || 20)
    const skip = (page - 1) * limit

    const [reports, total] = await Promise.all([
      QuestionReport.find({ status })
        .populate('userId', 'email nickname')
        .populate('questionId', 'question topic_tag')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      QuestionReport.countDocuments({ status }),
    ])

    return NextResponse.json({
      reports,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('Reports list error:', error)
    return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 })
  }
}
