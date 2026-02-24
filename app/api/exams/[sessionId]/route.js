import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import ExamSession from '@/models/ExamSession'
import Question from '@/models/Question'
import { getCurrentUser } from '@/lib/auth'

export async function GET(request, { params }) {
  try {
    const tokenData = await getCurrentUser(request)
    if (!tokenData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()

    const session = await ExamSession.findOne({
      _id: params.sessionId,
      userId: tokenData.userId,
    })

    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    // Fetch full question data (without revealing correct answer in exam mode)
    const questions = await Question.find(
      { _id: { $in: session.questionIds } },
      {
        'question.es': 1,
        'question.en': 1,
        'metadata.image_url': 1,
        'options.idx': 1,
        'options.text_es': 1,
        'options.text_en': 1,
        topic_tag: 1,
        // Only include correct_option_idx if assistance mode is instant OR if exam is completed
        ...(session.assistanceMode === 'instant' || session.status === 'completed'
          ? { correct_option_idx: 1, 'metadata.help_html': 1 }
          : {}),
      }
    )

    // Reorder questions to match session order
    const questionMap = {}
    questions.forEach((q) => {
      questionMap[q._id.toString()] = q
    })
    const orderedQuestions = session.questionIds.map((id) => questionMap[id.toString()]).filter(Boolean)

    return NextResponse.json({
      session: {
        id: session._id,
        mode: session.mode,
        status: session.status,
        language: session.language,
        assistanceMode: session.assistanceMode,
        currentQuestionIndex: session.currentQuestionIndex,
        totalQuestions: session.questionIds.length,
        answers: session.answers,
        score: session.score,
        errorCount: session.errorCount,
        passed: session.passed,
        expiresAt: session.expiresAt,
        completedAt: session.completedAt,
      },
      questions: orderedQuestions,
    })
  } catch (error) {
    console.error('Get session error:', error)
    return NextResponse.json({ error: 'Failed to fetch session' }, { status: 500 })
  }
}
