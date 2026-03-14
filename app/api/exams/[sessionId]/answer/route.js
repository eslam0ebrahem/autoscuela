import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import ExamSession from '@/models/ExamSession'
import Question from '@/models/Question'
import UserAnswer from '@/models/UserAnswer'
import { getCurrentUser } from '@/lib/auth'
import { isValidObjectId, clamp } from '@/lib/utils'
import { getQuestionExplanation } from '@/lib/groq'

// Max ms to wait for AI explanation before returning without it
const AI_EXPLANATION_TIMEOUT_MS = 4000

export async function POST(request, { params }) {
  try {
    const { sessionId } = await params
    const tokenData = await getCurrentUser(request)
    if (!tokenData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { question_id, selected_option_idx, time_taken } = await request.json()

    if (!question_id || !isValidObjectId(question_id))
      return NextResponse.json({ error: 'Invalid question ID' }, { status: 400 })
    if (selected_option_idx == null || selected_option_idx < 0 || selected_option_idx > 3)
      return NextResponse.json({ error: 'Invalid option selection' }, { status: 400 })

    await connectDB()

    const session = await ExamSession.findOne({
      _id: sessionId,
      userId: tokenData.userId,
      status: 'in_progress',
    })
    if (!session) return NextResponse.json({ error: 'Active session not found' }, { status: 404 })

    if (!session.questionIds.some((id) => id.toString() === question_id))
      return NextResponse.json({ error: 'Question not part of this exam' }, { status: 400 })

    if (session.mode === 'official' && session.expiresAt && new Date() > session.expiresAt)
      return NextResponse.json({ error: 'Exam time has expired', expired: true }, { status: 400 })

    const existingAnswerIdx = session.answers.findIndex(
      (a) => a.questionId.toString() === question_id
    )
    if (existingAnswerIdx >= 0)
      return NextResponse.json({ error: 'Question already answered' }, { status: 400 })

    const question = await Question.findById(question_id)
    if (!question) return NextResponse.json({ error: 'Question not found' }, { status: 404 })

    const isCorrect = question.correct_option_idx === selected_option_idx
    const sanitizedTime = clamp(time_taken || 0, 0, 1800)
    const lang = session.language || 'es'

    // ── AI: Start explanation generation in parallel with DB writes ───────
    // Only for instant mode wrong answers (most educational value)
    let aiExplanationPromise = null
    if (session.assistanceMode === 'instant' && !isCorrect) {
      aiExplanationPromise = getQuestionExplanation({
        question: question.question,
        options: question.options,
        correctIdx: question.correct_option_idx - 1,
        selectedIdx: selected_option_idx - 1,
        helpHtml: question.metadata?.help_html,
        lang,
      }).catch(() => null) // never throws
    }

    // ── DB writes (in parallel with AI) ──────────────────────────────────
    try {
      await UserAnswer.create({
        userId: tokenData.userId,
        examSessionId: session._id,
        questionId: question._id,
        topic_tag: question.topic_tag || { es: 'General', en: 'General' },
        selected_option_idx,
        is_correct: isCorrect,
        time_taken_seconds: sanitizedTime,
      })
    } catch (err) {
      if (err.code === 11000)
        return NextResponse.json({ error: 'Question already answered' }, { status: 400 })
      throw err
    }

    await Question.findByIdAndUpdate(question._id, {
      $inc: { 'stats.timesAnswered': 1, ...(isCorrect ? { 'stats.timesCorrect': 1 } : {}) },
    })

    session.answers.push({
      questionId: question._id,
      selectedOptionIdx: selected_option_idx,
      isCorrect,
      timeTakenSeconds: sanitizedTime,
    })
    session.currentQuestionIndex = Math.max(session.currentQuestionIndex, session.answers.length)
    await session.save()

    // ── Build response ────────────────────────────────────────────────────
    const response = { isCorrect }

    if (session.assistanceMode === 'instant') {
      response.correctOptionIdx = question.correct_option_idx
      response.helpHtml = question.metadata?.help_html

      // ── Wait for AI explanation (with timeout) ──────────────────────
      if (aiExplanationPromise) {
        const aiExplanation = await Promise.race([
          aiExplanationPromise,
          new Promise((r) => setTimeout(() => r(null), AI_EXPLANATION_TIMEOUT_MS)),
        ])

        if (aiExplanation) {
          response.aiExplanation = aiExplanation  // { summary, correct_explanation, wrong_explanation, memory_tip, law_reference }
        }
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[answer] Error:', error)
    return NextResponse.json({ error: 'Failed to submit answer' }, { status: 500 })
  }
}
