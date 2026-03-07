import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import Question from '@/models/Question'
import { getCurrentUser } from '@/lib/auth'
import { escapeRegex, parsePositiveInt } from '@/lib/utils'

async function requireAdmin(request) {
  const tokenData = await getCurrentUser(request)
  if (!tokenData || tokenData.role !== 'admin') {
    return null
  }
  return tokenData
}

// GET - list questions with pagination
export async function GET(request) {
  try {
    const tokenData = await requireAdmin(request)
    if (!tokenData) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

    await connectDB()
    const url = new URL(request.url)
    const page = parsePositiveInt(url.searchParams.get('page'), 1)
    const limit = Math.min(parsePositiveInt(url.searchParams.get('limit'), 20), 100)
    const search = url.searchParams.get('search') || ''
    const topic = url.searchParams.get('topic') || ''
    const active = url.searchParams.get('active')

    const query = {}
    if (search) query['question.es'] = { $regex: escapeRegex(search), $options: 'i' }
    if (topic) query['topic_tag.es'] = topic
    if (active !== null && active !== undefined && active !== '') {
      query.isActive = active === 'true'
    }

    const [questions, total] = await Promise.all([
      Question.find(query)
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ exam_id: 1, question_number: 1 }),
      Question.countDocuments(query),
    ])

    return NextResponse.json({ questions, total, page, totalPages: Math.ceil(total / limit) })
  } catch (error) {
    console.error('Admin questions error:', error)
    return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 })
  }
}

// POST - bulk import JSON
export async function POST(request) {
  try {
    const tokenData = await requireAdmin(request)
    if (!tokenData) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

    const { questions } = await request.json()

    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: 'Invalid data: questions array required' }, { status: 400 })
    }

    if (questions.length > 500) {
      return NextResponse.json({ error: 'Maximum 500 questions per import' }, { status: 400 })
    }

    await connectDB()

    const results = { inserted: 0, updated: 0, errors: [] }

    for (const q of questions) {
      try {
        // Validate required fields
        if (!q.exam_id || !q.question_number || !q.question?.es || !q.question?.en || !q.options?.length) {
          results.errors.push({ question: q.question_number, error: 'Missing required fields' })
          continue
        }

        const existing = await Question.findOne({
          exam_id: q.exam_id,
          question_number: q.question_number,
        })

        await Question.findOneAndUpdate(
          { exam_id: q.exam_id, question_number: q.question_number },
          { $set: q },
          { upsert: true, new: true, runValidators: true }
        )

        if (existing) {
          results.updated++
        } else {
          results.inserted++
        }
      } catch (err) {
        results.errors.push({ question: q.question_number, error: err.message })
      }
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json({ error: 'Import failed' }, { status: 500 })
  }
}
