import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import ExamSession from '@/models/ExamSession'
import Question from '@/models/Question'
import UserAnswer from '@/models/UserAnswer'
import { getCurrentUser } from '@/lib/auth'

export async function POST(request, { params }) {
  try {
    const tokenData = await getCurrentUser(request)
    if (!tokenData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { question_id, selected_option_idx, time_taken } = await request.json()

    await connectDB()

    const session = await ExamSession.findOne({
      _id: params.sessionId,
      userId: tokenData.userId,
      status: 'in_progress',
    })

    if (!session) return NextResponse.json({ error: 'Active session not found' }, { status: 404 })

    // Check timer for official exams
    if (session.mode === 'official' && session.expiresAt && new Date() > session.expiresAt) {
      return NextResponse.json({ error: 'Exam time has expired' }, { status: 400 })
    }

    const question = await Question.findById(question_id)
    if (!question) return NextResponse.json({ error: 'Question not found' }, { status: 404 })

    const isCorrect = question.correct_option_idx === selected_option_idx

    // Log to UserAnswer collection (feeds AI)
    await UserAnswer.create({
      userId: tokenData.userId,
      examSessionId: session._id,
      questionId: question._id,
      topic_tag: question.topic_tag || { es: 'General', en: 'General' },
      selected_option_idx,
      is_correct: isCorrect,
      time_taken_seconds: time_taken,
    })

    // Update session answers
    const existingAnswerIdx = session.answers.findIndex(
      (a) => a.questionId.toString() === question_id
    )

    if (existingAnswerIdx >= 0) {
      session.answers[existingAnswerIdx] = {
        questionId: question._id,
        selectedOptionIdx: selected_option_idx,
        isCorrect,
        timeTakenSeconds: time_taken,
      }
    } else {
      session.answers.push({
        questionId: question._id,
        selectedOptionIdx: selected_option_idx,
        isCorrect,
        timeTakenSeconds: time_taken,
      })
    }

    session.currentQuestionIndex = Math.max(session.currentQuestionIndex, session.answers.length)
    await session.save()

    const response = { isCorrect }

    // In instant feedback mode, also return correct answer + explanation
    if (session.assistanceMode === 'instant') {
      response.correctOptionIdx = question.correct_option_idx
      response.helpHtml = question.metadata?.help_html
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Submit answer error:', error)
    return NextResponse.json({ error: 'Failed to submit answer' }, { status: 500 })
  }
}
