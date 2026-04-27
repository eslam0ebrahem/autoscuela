import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import ExamSession from '@/models/ExamSession'
import Question from '@/models/Question'
import { getCurrentUser } from '@/lib/auth'
import { checkCSRF } from '@/lib/csrf'
import { isValidObjectId } from '@/lib/utils'
import { getSmartHint } from '@/lib/groq'
import UserAnswer from '@/models/UserAnswer'

/**
 * GET /api/exams/[sessionId]
 * Returns the session data and the full question documents.
 */
export async function GET(request, { params }) {
  try {
    const { sessionId } = await params
    const tokenData = await getCurrentUser(request)
    if (!tokenData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()

    const session = await ExamSession.findOne({
      _id: sessionId,
      userId: tokenData.userId,
    }).lean()

    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    // Fetch full question documents
    const questions = await Question.find({ _id: { $in: session.questionIds } }).lean()

    // Sort questions to match the order in questionIds
    const questionsOrdered = session.questionIds
      .map((id) => questions.find((q) => q._id.toString() === id.toString()))
      .filter(Boolean)

    return NextResponse.json({
      session,
      questions: questionsOrdered,
    })
  } catch (error) {
    console.error('[get-session] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch session' }, { status: 500 })
  }
}

/**
 * PATCH /api/exams/[sessionId]/flag
 * Toggle flag on a question. When flagging (not unflagging), returns an AI
 * contextual tip to help the user remember why this question was tricky.
 */
export async function PATCH(request, { params }) {
  try {
    const csrfError = checkCSRF('PATCH', request)
    if (csrfError) return NextResponse.json(csrfError, { status: csrfError.status })

    const { sessionId } = await params
    const tokenData = await getCurrentUser(request)
    if (!tokenData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()

    const { questionId, flagged } = await request.json()

    if (!questionId || !isValidObjectId(questionId)) {
      return NextResponse.json({ error: 'Invalid questionId' }, { status: 400 })
    }
    if (typeof flagged !== 'boolean') {
      return NextResponse.json({ error: 'flagged must be a boolean' }, { status: 400 })
    }

    const session = await ExamSession.findOne({
      _id: sessionId,
      userId: tokenData.userId,
      status: 'in_progress',
    })
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    const answerIndex = session.answers.findIndex(
      (a) => a.questionId.toString() === questionId.toString()
    )
    if (answerIndex === -1) return NextResponse.json({ error: 'Answer not found' }, { status: 404 })

    session.answers[answerIndex].flagged = flagged
    await session.save()

    // ── AI: When flagging (not unflagging), provide a quick "why tricky" tip ──
    let aiTip = null
    if (flagged) {
      const question = await Question.findById(questionId)
        .select('question options topic_tag correct_option_idx')
        .lean()
      if (question) {
        const lang = session.language || 'es'

        // Fetch user history for this question for a better tip
        let userHistory = null
        try {
          const attempts = await UserAnswer.countDocuments({
            userId: tokenData.userId,
            questionId: question._id,
          })
          const correctCount = await UserAnswer.countDocuments({
            userId: tokenData.userId,
            questionId: question._id,
            is_correct: true,
          })
          userHistory = { attempts, correctCount }
        } catch {
          // Graceful
        }

        aiTip = await getSmartHint({
          question: question.question,
          options: question.options,
          correctIdx: question.correct_option_idx,
          lang,
          userHistory,
        }).catch(() => null)
      }
    }

    return NextResponse.json({
      success: true,
      flagged: session.answers[answerIndex].flagged,
      // ✨ AI tip explaining why this question is tricky (only when flagging)
      aiTip: aiTip ?? null,
    })
  } catch (error) {
    console.error('[flag] Error:', error)
    return NextResponse.json({ error: 'Failed to flag question' }, { status: 500 })
  }
}
