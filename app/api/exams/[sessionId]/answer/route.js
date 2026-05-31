import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import ExamSession from '@/models/ExamSession'
import Question from '@/models/Question'
import UserAnswer from '@/models/UserAnswer'
import User from '@/models/User'
import { getCurrentUser } from '@/lib/auth'
import { isValidObjectId, clamp, checkRateLimit } from '@/lib/utils'
import { getQuestionExplanation, getQuestionDeepDive } from '@/lib/groq'
import { withTransaction } from '@/lib/db-utils'
import { ExamAnswerSchema, parseSchema } from '@/lib/schemas'
import { getUserSkillProfile } from '@/lib/user-skill'
import { JSDOM } from 'jsdom'
import DOMPurifyFactory from 'dompurify'
import { calculateSRS, answerToGrade } from '@/lib/srs'
import { checkCSRF } from '@/lib/csrf'

const { window: domWindow } = new JSDOM('')
const DOMPurify = DOMPurifyFactory(domWindow)

const AI_EXPLANATION_TIMEOUT_MS = 4000
const RATE_LIMIT_MAX = 15
const RATE_LIMIT_WINDOW_MS = 60_000
const MAX_ANSWER_TIME_SEC = 1800

function jsonError(message, status, extra = {}, headers = {}) {
  return NextResponse.json({ error: message, ...extra }, { status, headers })
}

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(null), ms))])
}

function sanitizeHelpHtml(html) {
  return html ? DOMPurify.sanitize(html) : null
}

function getTopicTag(question) {
  return question?.topic_tag?.es || 'General'
}

async function getAIContext({ userId, question, lang }) {
  const [previousMistakes, skillProfile] = await Promise.all([
    UserAnswer.find({
      userId,
      questionId: question._id,
      is_correct: false,
    })
      .sort({ createdAt: -1 })
      .limit(3)
      .lean(),
    getUserSkillProfile(userId).catch(() => null),
  ])

  const topicTag = getTopicTag(question)
  const topicStats = skillProfile?.topics?.find((t) => t.tag === topicTag)
  const userTopicAccuracy =
    typeof topicStats?.accuracy === 'number' ? topicStats.accuracy / 100 : null

  return {
    previousMistakes,
    isRepeatMistake: previousMistakes.length >= 1,
    userTopicAccuracy,
  }
}

function buildAIJobs({
  enabled,
  isCorrect,
  isRepeatMistake,
  previousMistakes,
  userTopicAccuracy,
  question,
  selectedOptionIdx,
  lang,
}) {
  if (!enabled || isCorrect) {
    return { explanationPromise: null, deepDivePromise: null }
  }

  const explanationPromise = getQuestionExplanation({
    question: question.question,
    options: question.options,
    correctIdx: question.correct_option_idx,
    selectedIdx: selectedOptionIdx,
    helpHtml: question.metadata?.help_html,
    lang,
    userTopicAccuracy,
  }).catch(() => null)

  const deepDivePromise = isRepeatMistake
    ? getQuestionDeepDive({
        question: question.question,
        options: question.options,
        correctIdx: question.correct_option_idx,
        userAnswerHistory: previousMistakes.map((m) => ({
          selected: m.selected_option_idx,
          correct: m.is_correct,
          timeSec: m.time_taken_seconds,
        })),
        helpHtml: question.metadata?.help_html,
        lang,
      }).catch(() => null)
    : null

  return { explanationPromise, deepDivePromise }
}

async function updateQuestionAndUserStats({ question, userId, isCorrect, sanitizedTime }) {
  const topicTag = getTopicTag(question)
  const incUserStats = {
    'stats.totalAnswers': 1,
    ...(isCorrect ? { 'stats.correctAnswers': 1 } : {}),
    [`stats.topicStats.${topicTag}.attempted`]: 1,
    ...(isCorrect ? { [`stats.topicStats.${topicTag}.correct`]: 1 } : {}),
    [`stats.topicStats.${topicTag}.totalTime`]: sanitizedTime,
  }

  await Promise.allSettled([
    Question.findByIdAndUpdate(question._id, {
      $inc: {
        'stats.timesAnswered': 1,
        ...(isCorrect ? { 'stats.timesCorrect': 1 } : {}),
      },
    }),
    User.findByIdAndUpdate(userId, {
      $inc: incUserStats,
    }),
  ])
}

async function updateAnswerSRS({ savedAnswerId, userId, questionId, isCorrect, sanitizedTime }) {
  const existing = await UserAnswer.findOne(
    {
      userId,
      questionId,
      _id: { $ne: savedAnswerId },
    },
    { srs: 1 }
  )
    .sort({ createdAt: -1 })
    .lean()

  const grade = answerToGrade(isCorrect, sanitizedTime)
  const newSRS = calculateSRS(existing?.srs || {}, grade)

  await UserAnswer.findByIdAndUpdate(savedAnswerId, {
    $set: {
      srs: {
        ...newSRS,
        lastGrade: grade,
      },
    },
  })
}

export async function POST(request, { params }) {
  try {
    const { sessionId } = await params

    if (!isValidObjectId(sessionId)) {
      return jsonError('Invalid session id', 400)
    }

    const tokenData = await getCurrentUser(request)
    if (!tokenData?.userId) {
      return jsonError('Unauthorized', 401)
    }

    const csrfError = checkCSRF('POST', request)
    if (csrfError) return jsonError(csrfError.error, csrfError.status, { details: csrfError.details })

    const rateCheck = await checkRateLimit(
      `exam:answer:${tokenData.userId}`,
      RATE_LIMIT_MAX,
      RATE_LIMIT_WINDOW_MS
    )

    if (!rateCheck.allowed) {
      return jsonError(
        'Too many answer submissions',
        429,
        {},
        { 'Retry-After': String(rateCheck.retryAfter || 60) }
      )
    }

    let body
    try {
      body = await request.json()
    } catch {
      return jsonError('Invalid JSON body', 400)
    }

    const { data: validated, error: validationError } = parseSchema(ExamAnswerSchema, body)
    if (validationError) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationError.messages },
        { status: validationError.status }
      )
    }

    const { question_id, selected_option_idx, time_taken } = validated

    if (!isValidObjectId(question_id)) {
      return jsonError('Invalid question id', 400)
    }

    await connectDB()

    const [session, question] = await Promise.all([
      ExamSession.findOne({
        _id: sessionId,
        userId: tokenData.userId,
        status: 'in_progress',
      }),
      Question.findById(question_id),
    ])

    if (!session) {
      return jsonError('Active session not found', 404)
    }

    if (!question) {
      return jsonError('Question not found', 404)
    }

    const questionBelongsToSession = session.questionIds.some(
      (id) => id.toString() === question_id
    )
    if (!questionBelongsToSession) {
      return jsonError('Question not part of this exam', 400)
    }

    if (
      session.mode === 'official' &&
      session.expiresAt &&
      new Date() > new Date(session.expiresAt)
    ) {
      return jsonError('Exam time has expired', 400, { expired: true })
    }

    const alreadyAnswered = session.answers.some(
      (a) => a.questionId.toString() === question_id
    )
    if (alreadyAnswered) {
      return jsonError('Question already answered', 400)
    }

    const isCorrect = question.correct_option_idx === selected_option_idx
    const sanitizedTime = clamp(Number(time_taken) || 0, 0, MAX_ANSWER_TIME_SEC)
    const lang = session.language || 'es'
    const instantMode = session.assistanceMode === 'instant'

    let explanationPromise = null
    let deepDivePromise = null

    if (instantMode && !isCorrect) {
      const { previousMistakes, isRepeatMistake, userTopicAccuracy } = await getAIContext({
        userId: tokenData.userId,
        question,
        lang,
      })

      const jobs = buildAIJobs({
        enabled: true,
        isCorrect,
        isRepeatMistake,
        previousMistakes,
        userTopicAccuracy,
        question,
        selectedOptionIdx: selected_option_idx,
        lang,
      })

      explanationPromise = jobs.explanationPromise
      deepDivePromise = jobs.deepDivePromise
    }

    let savedAnswer

    try {
      await withTransaction(async (txSession) => {
        const [created] = await UserAnswer.create(
          [
            {
              userId: tokenData.userId,
              examSessionId: session._id,
              questionId: question._id,
              topic_tag: question.topic_tag || { es: 'General', en: 'General' },
              selected_option_idx,
              is_correct: isCorrect,
              time_taken_seconds: sanitizedTime,
            },
          ],
          { session: txSession }
        )

        savedAnswer = created

        await ExamSession.findByIdAndUpdate(
          sessionId,
          {
            $push: {
              answers: {
                questionId: question._id,
                selectedOptionIdx: selected_option_idx,
                isCorrect,
                timeTakenSeconds: sanitizedTime,
              }
            },
            $set: {
              currentQuestionIndex: Math.max(
                session.currentQuestionIndex || 0,
                session.answers.length + 1
              )
            }
          },
          { session: txSession }
        )
      })
    } catch (err) {
      if (err?.code === 11000) {
        return jsonError('Question already answered', 400)
      }
      throw err
    }

    void updateQuestionAndUserStats({
      question,
      userId: tokenData.userId,
      isCorrect,
      sanitizedTime,
    }).catch((err) => {
      console.error('[answer] Non-critical stats update failed:', err)
    })

    void updateAnswerSRS({
      savedAnswerId: savedAnswer._id,
      userId: tokenData.userId,
      questionId: question._id,
      isCorrect,
      sanitizedTime,
    }).catch((err) => {
      console.error('[answer] SRS update failed:', err)
    })

    const response = {
      isCorrect,
    }

    if (instantMode) {
      response.correctOptionIdx = question.correct_option_idx
      response.helpHtml = sanitizeHelpHtml(question.metadata?.help_html)

      if (explanationPromise || deepDivePromise) {
        const [aiExplanation, aiDeepDive] = await Promise.all([
          explanationPromise ? withTimeout(explanationPromise, AI_EXPLANATION_TIMEOUT_MS) : null,
          deepDivePromise ? withTimeout(deepDivePromise, AI_EXPLANATION_TIMEOUT_MS) : null,
        ])

        if (aiExplanation) response.aiExplanation = aiExplanation
        if (aiDeepDive) response.aiDeepDive = aiDeepDive
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[answer] Error:', error)
    return jsonError('Failed to submit answer', 500)
  }
}