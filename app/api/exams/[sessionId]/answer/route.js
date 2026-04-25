import { NextResponse } from 'next/server'
import mongoose from 'mongoose'
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

const { window: domWindow } = new JSDOM('')
const DOMPurify = DOMPurifyFactory(domWindow)

// Max ms to wait for AI explanation before returning without it
const AI_EXPLANATION_TIMEOUT_MS = 4000

export async function POST(request, { params }) {
  try {
    const { sessionId } = await params
    const tokenData = await getCurrentUser(request)
    if (!tokenData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // ── Rate limiting (15 per 60 sec = one answer every 4 sec) ──────────
    const rateCheck = await checkRateLimit(`exam:answer:${tokenData.userId}`, 15, 60000)
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many answer submissions' },
        { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfter || 60) } }
      )
    }

    // ── Parse and validate body ────────────────────────────────────────
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { data: validated, error: validationError } = parseSchema(ExamAnswerSchema, body)
    if (validationError) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationError.messages },
        { status: validationError.status }
      )
    }

    const { question_id, selected_option_idx, time_taken } = validated

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
    let aiDeepDivePromise = null

    if (session.assistanceMode === 'instant' && !isCorrect) {
      // ── Determine if this is a repeat mistake for Deep Dive analysis ──
      const previousMistakes = await UserAnswer.find({
        userId: tokenData.userId,
        questionId: question._id,
        is_correct: false,
      })
        .sort({ createdAt: -1 })
        .limit(3)
        .lean()

      const isRepeatMistake = previousMistakes.length >= 1

      // ── Fetch user topic accuracy for better explanation ──────────────
      let userTopicAccuracy = null
      try {
        const skillProfile = await getUserSkillProfile(tokenData.userId)
        const topicStats = skillProfile.topics?.find(
          (t) => t.tag === (question.topic_tag?.es || 'General')
        )
        if (topicStats) userTopicAccuracy = topicStats.accuracy / 100
      } catch {
        // Graceful
      }

      if (isRepeatMistake) {
        // ✨ New AI Deep Dive for repeat errors
        aiDeepDivePromise = getQuestionDeepDive({
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
      }

      // Always do standard explanation too, but with richer context
      aiExplanationPromise = getQuestionExplanation({
        question: question.question,
        options: question.options,
        correctIdx: question.correct_option_idx,
        selectedIdx: selected_option_idx,
        helpHtml: question.metadata?.help_html,
        lang,
        userTopicAccuracy,
      }).catch(() => null)
    }

    // ── Atomic transaction: record UserAnswer + update ExamSession ────────
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

        session.answers.push({
          questionId: question._id,
          selectedOptionIdx: selected_option_idx,
          isCorrect,
          timeTakenSeconds: sanitizedTime,
        })
        session.currentQuestionIndex = Math.max(
          session.currentQuestionIndex,
          session.answers.length
        )
        await session.save({ session: txSession })
      })
    } catch (err) {
      if (err.code === 11000)
        return NextResponse.json({ error: 'Question already answered' }, { status: 400 })
      throw err
    }

    // ── Non-critical: update per-question stats and user incremental stats (fire outside transaction) ──
    const topicTag = question.topic_tag?.es || 'General'
    const incUserStats = {
      'stats.totalAnswers': 1,
      ...(isCorrect ? { 'stats.correctAnswers': 1 } : {}),
      [`stats.topicStats.${topicTag}.attempted`]: 1,
      ...(isCorrect ? { [`stats.topicStats.${topicTag}.correct`]: 1 } : {}),
      [`stats.topicStats.${topicTag}.totalTime`]: sanitizedTime,
    }

    Promise.all([
      Question.findByIdAndUpdate(question._id, {
        $inc: { 'stats.timesAnswered': 1, ...(isCorrect ? { 'stats.timesCorrect': 1 } : {}) },
      }).catch((err) => console.error('[answer] Question stats update failed:', err)),
      User.findByIdAndUpdate(tokenData.userId, {
        $inc: incUserStats,
      }).catch((err) => console.error('[answer] User stats update failed:', err)),
    ])

    // ── Update SRS state for this question (critical for long-term memory) ──
    try {
      const existing = await UserAnswer.findOne(
        {
          userId: tokenData.userId,
          questionId: question._id,
          _id: { $ne: savedAnswer._id }, // Ignore current record to find history
        },
        { srs: 1 }
      )
        .sort({ createdAt: -1 })
        .lean()

      const grade = answerToGrade(isCorrect, sanitizedTime)
      const newSRS = calculateSRS(existing?.srs || {}, grade)

      await UserAnswer.findByIdAndUpdate(savedAnswer._id, {
        $set: { srs: { ...newSRS, lastGrade: grade } },
      })
    } catch (srsErr) {
      console.error('[answer] SRS update failed:', srsErr)
      // SRS update failure is non-critical for the response, but we tried
    }

    // ── Build response ────────────────────────────────────────────────────
    const response = { isCorrect }

    if (session.assistanceMode === 'instant') {
      response.correctOptionIdx = question.correct_option_idx
      // ── Sanitize help_html server-side to prevent XSS ──────────────
      response.helpHtml = question.metadata?.help_html
        ? DOMPurify.sanitize(question.metadata.help_html)
        : null

      // ── Wait for AI (with timeout) ──────────────────────────────────
      if (aiExplanationPromise || aiDeepDivePromise) {
        const results = await Promise.all([
          aiExplanationPromise
            ? Promise.race([
                aiExplanationPromise,
                new Promise((r) => setTimeout(() => r(null), AI_EXPLANATION_TIMEOUT_MS)),
              ])
            : null,
          aiDeepDivePromise
            ? Promise.race([
                aiDeepDivePromise,
                new Promise((r) => setTimeout(() => r(null), AI_EXPLANATION_TIMEOUT_MS)),
              ])
            : null,
        ])

        if (results[0]) response.aiExplanation = results[0]
        if (results[1]) response.aiDeepDive = results[1]
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[answer] Error:', error)
    return NextResponse.json({ error: 'Failed to submit answer' }, { status: 500 })
  }
}
