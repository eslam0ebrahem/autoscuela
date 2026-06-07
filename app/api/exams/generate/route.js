import { NextResponse } from 'next/server'
import mongoose from 'mongoose'
import connectDB from '@/lib/db'
import User from '@/models/User'
import Question from '@/models/Question'
import ExamSession from '@/models/ExamSession'
import UserAnswer from '@/models/UserAnswer'
import { getCurrentUser } from '@/lib/auth'
import { checkCSRF } from '@/lib/csrf'
import { clamp, checkRateLimit } from '@/lib/utils'
import { selectAdaptiveQuestions } from '@/lib/adaptive-selection'
import { getExamRecommendation } from '@/lib/groq'
import { ExamGenerateSchema, parseSchema } from '@/lib/schemas'
import { getUserSkillProfile } from '@/lib/user-skill'

const OFFICIAL_EXAM_QUESTIONS = 30
const OFFICIAL_EXAM_DURATION_MIN = 30
const ABANDONED_SESSION_HOURS = 2
const MAX_ACTIVE_SESSIONS = 3
const QUESTION_LIMITS = { MIN: 5, MAX: 100 }

const VALID_MODES = new Set([
  'official',
  'custom',
  'mistakes',
  'weak_topics',
  'bookmarks',
  'spaced_repetition',
])

const VALID_ASSISTANCE_MODES = new Set(['instant', 'exam'])

const DURATIONS = {
  official: 30,
  custom: 60,
  mistakes: 45,
  weak_topics: 45,
  bookmarks: 45,
  spaced_repetition: 45,
}

function jsonError(error, status, extra = {}, headers = {}) {
  return NextResponse.json({ error, ...extra }, { status, headers })
}

function normalizeTopicFilters(topicFilter) {
  if (!topicFilter) return []
  if (Array.isArray(topicFilter)) return topicFilter.filter(Boolean)
  return [topicFilter].filter(Boolean)
}

function calculateExpiration(mode, questionCount, timerMinutes) {
  if (timerMinutes !== undefined && timerMinutes !== null) {
    if (timerMinutes === 0) {
      return null // No timer (unlimited)
    }
    const expiresAt = new Date()
    expiresAt.setMinutes(expiresAt.getMinutes() + timerMinutes)
    return expiresAt
  }

  const expiresAt = new Date()
  if (mode === 'official') {
    // Official exams have a strict time limit
    const baseDuration = DURATIONS[mode] ?? OFFICIAL_EXAM_DURATION_MIN
    const extraTime = Math.max(0, Math.floor((questionCount - OFFICIAL_EXAM_QUESTIONS) / 10))
    expiresAt.setMinutes(expiresAt.getMinutes() + baseDuration + extraTime)
  } else {
    // All other modes: 24-hour safety-net expiry to prevent zombie sessions
    expiresAt.setHours(expiresAt.getHours() + 24)
  }
  return expiresAt
}

async function checkSessionLimits(userId) {
  const activeCount = await ExamSession.countDocuments({ userId, status: 'in_progress' })
  return { allowed: activeCount < MAX_ACTIVE_SESSIONS, activeCount }
}

async function cleanupAbandonedSessions(userId, hoursThreshold = ABANDONED_SESSION_HOURS) {
  const cutoff = new Date(Date.now() - hoursThreshold * 60 * 60 * 1000)

  const result = await ExamSession.updateMany(
    {
      userId,
      status: 'in_progress',
      updatedAt: { $lt: cutoff },
    },
    {
      $set: {
        status: 'abandoned',
        abandonedAt: new Date(),
      },
    }
  )

  return result.modifiedCount ?? 0
}

function buildAdaptiveOptions({ mode, topicFilters, onlyNewQuestions, excludeQuestionIds = [] }) {
  const options = {
    mode,
    onlyNewQuestions: Boolean(onlyNewQuestions),
    excludeQuestionIds,
  }

  if (mode === 'official') {
    options.balanced = true
  }

  if (mode === 'custom' || mode === 'weak_topics') {
    options.topicFilters = topicFilters
  }

  return options
}

function sampleIds(ids, count) {
  return [...ids]
    .map((id) => ({ id, r: Math.random() }))
    .sort((a, b) => a.r - b.r)
    .slice(0, count)
    .map((x) => x.id)
}

function estimatePassProbability(skillProfile, mode, topicFilters, userStats, user) {
  if (!skillProfile?.overallLevel) return null

  const levelMap = { beginner: 1, easy: 2, medium: 3, hard: 4, expert: 5 }
  const levelNum = levelMap[skillProfile.overallLevel] || 1
  const baseProb = Math.min(95, Math.max(5, (levelNum / 5) * 100))

  const modeAdjust = {
    official: 0,
    custom: topicFilters?.length > 0 ? -5 : 0,
    mistakes: -15,
    weak_topics: -10,
    bookmarks: -5,
    spaced_repetition: -8,
  }

  let weakTopicPenalty = 0
  if (skillProfile.topics?.length > 0) {
    const weakTopics = skillProfile.topics.filter((t) => t.accuracy < 70)
    weakTopicPenalty = Math.min(10, weakTopics.length * 2)
  }

  let targetTopicPenalty = 0
  if (topicFilters?.length > 0 && skillProfile.topics?.length > 0) {
    const weakTargetTopics = skillProfile.topics.filter(
      (t) => topicFilters.includes(t.tag) && t.accuracy < 70
    )
    targetTopicPenalty = Math.min(10, weakTargetTopics.length * 3)
  }

  // More granular experience bonus based on rolling total answered
  let experienceBonus = 0
  const totalAns = userStats?.totalAnswers || 0
  if (totalAns >= 1000) experienceBonus = 15
  else if (totalAns >= 500) experienceBonus = 10
  else if (totalAns >= 200) experienceBonus = 7
  else if (totalAns >= 100) experienceBonus = 5
  else if (totalAns >= 50) experienceBonus = 2

  // More granular streak bonus
  const streak = user?.gamification?.currentStreak ?? 0
  let streakBonus = 0
  if (streak >= 30) streakBonus = 15
  else if (streak >= 14) streakBonus = 10
  else if (streak >= 7) streakBonus = 5
  else if (streak >= 3) streakBonus = 2
  
  // Trend bonus based on recent performance
  let trendBonus = 0
  if (skillProfile.topics?.length > 0) {
    const improving = skillProfile.topics.filter(t => t.trend === 'improving').length
    const declining = skillProfile.topics.filter(t => t.trend === 'declining').length
    
    // Max 10 points bonus or penalty
    trendBonus = Math.min(10, Math.max(-10, (improving - declining) * 2))
  }

  // Add a slight random jitter (-2 to +2) so it doesn't stay completely static
  const jitter = Math.floor(Math.random() * 5) - 2

  const probability = Math.round(
    Math.min(
      95,
      Math.max(
        5,
        baseProb +
          (modeAdjust[mode] ?? 0) -
          weakTopicPenalty -
          targetTopicPenalty +
          experienceBonus +
          streakBonus +
          trendBonus +
          jitter
      )
    )
  )

  return {
    probability,
    level: probability >= 80 ? 'high' : probability >= 55 ? 'medium' : 'low',
    message:
      probability >= 80
        ? 'high_confidence'
        : probability >= 55
          ? 'needs_practice'
          : 'needs_more_study',
  }
}

async function resolveMistakeQuestionIds(userId, limit) {
  const rows = await UserAnswer.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId), is_correct: false } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: '$questionId',
        latestMistakeAt: { $first: '$createdAt' },
      },
    },
    { $sort: { latestMistakeAt: -1 } },
    { $limit: Math.max(limit * 3, 30) },
  ])

  return rows.map((r) => r._id)
}

async function resolveBookmarkQuestionIds(bookmarkIds, requestedCount) {
  if (!bookmarkIds?.length) return []

  const activeQuestions = await Question.find({
    _id: { $in: bookmarkIds },
    isActive: true,
  })
    .select('_id')
    .lean()

  return sampleIds(
    activeQuestions.map((q) => q._id),
    requestedCount
  )
}

async function resolveSpacedRepetitionIds(userId, requestedCount, adaptiveOptions) {
  const now = new Date()
  const objectId = new mongoose.Types.ObjectId(userId)

  const dueAnswers = await UserAnswer.aggregate([
    { $match: { userId: objectId, 'srs.nextReviewAt': { $exists: true } } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: '$questionId',
        lastNextReview: { $first: '$srs.nextReviewAt' },
      },
    },
    { $match: { lastNextReview: { $lte: now } } },
    { $sort: { lastNextReview: 1 } },
    { $limit: requestedCount },
  ])

  let questionIds = dueAnswers.map((a) => a._id)

  if (questionIds.length < requestedCount) {
    const fillIds = await selectAdaptiveQuestions(userId, requestedCount - questionIds.length, {
      ...adaptiveOptions,
      excludeQuestionIds: questionIds,
    })
    questionIds = [...questionIds, ...fillIds]
  }

  return sampleIds(questionIds, requestedCount)
}

async function resolveQuestionIds({
  userId,
  mode,
  requestedCount,
  topicFilters,
  onlyNewQuestions,
  bookmarkIds,
  excludeQuestionIds = [],
}) {
  const adaptiveOptions = buildAdaptiveOptions({
    mode,
    topicFilters,
    onlyNewQuestions,
    excludeQuestionIds,
  })

  if (mode === 'bookmarks') {
    return resolveBookmarkQuestionIds(bookmarkIds, requestedCount)
  }

  if (mode === 'mistakes') {
    const mistakeQuestionIds = await resolveMistakeQuestionIds(userId, requestedCount)
    if (!mistakeQuestionIds.length) return []

    return selectAdaptiveQuestions(userId, requestedCount, {
      ...adaptiveOptions,
      mode: 'mistakes',
      mistakeQuestionIds,
    })
  }

  if (mode === 'spaced_repetition') {
    return resolveSpacedRepetitionIds(userId, requestedCount, adaptiveOptions)
  }

  return selectAdaptiveQuestions(userId, requestedCount, adaptiveOptions)
}

export async function POST(request) {
  try {
    const csrfError = checkCSRF('POST', request)
    if (csrfError) {
      return NextResponse.json(csrfError, { status: csrfError.status })
    }

    const tokenData = await getCurrentUser(request)
    if (!tokenData?.userId) {
      return jsonError('Unauthorized', 401)
    }

    const rateCheck = await checkRateLimit(`exam:generate:${tokenData.userId}`, 2, 60_000)
    if (!rateCheck.allowed) {
      return jsonError(
        'Too many exam generation requests',
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

    const { data: validated, error: validationError } = parseSchema(ExamGenerateSchema, body)
    if (validationError) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationError.messages },
        { status: validationError.status }
      )
    }

    const {
      mode,
      topic_filter,
      assistance_mode,
      num_questions,
      only_new_questions,
      source,
      timer_minutes,
    } = validated

    if (!VALID_MODES.has(mode)) {
      return jsonError('Invalid mode', 400)
    }

    if (!VALID_ASSISTANCE_MODES.has(assistance_mode)) {
      return jsonError('Invalid assistance mode', 400)
    }

    const topicFilters = normalizeTopicFilters(topic_filter)
    const requestedCount =
      mode === 'official'
        ? OFFICIAL_EXAM_QUESTIONS
        : clamp(num_questions ?? QUESTION_LIMITS.MIN, QUESTION_LIMITS.MIN, QUESTION_LIMITS.MAX)

    await connectDB()

    const user = await User.findById(tokenData.userId)
    if (!user) {
      return jsonError('User not found', 404)
    }

    if (!user.isPremium && process.env.BYPASS_PREMIUM !== 'true') {
      return NextResponse.json(
        {
          error: 'Premium subscription required',
          message: 'Upgrade to premium to access exams and AI features.',
        },
        { status: 403 }
      )
    }

    await cleanupAbandonedSessions(user._id)

    const { allowed, activeCount } = await checkSessionLimits(user._id)
    if (!allowed) {
      return NextResponse.json(
        {
          error: 'Session limit reached',
          message: `You have ${activeCount} active exams. Please complete one first.`,
          activeCount,
        },
        { status: 429 }
      )
    }

    const bookmarkIds = mode === 'bookmarks' ? user.bookmarkedQuestions || [] : []
    if (mode === 'bookmarks' && bookmarkIds.length === 0) {
      return NextResponse.json(
        {
          error: 'No bookmarks found',
          message: "You haven't bookmarked any questions yet. Save some during exams!",
        },
        { status: 404 }
      )
    }

    // Fetch dynamic skill profile
    const skillProfile = await getUserSkillProfile(user._id)

    let questionIds = []
    
    if ((mode === 'official' || mode === 'custom') && topicFilters.length === 0) {
      const weakTopics = (skillProfile?.topics || [])
        .filter(t => t.accuracy < 70)
        .map(t => t.tag)

      if (weakTopics.length > 0) {
        const weakCount = Math.floor(requestedCount * 0.35) // 35% from weak spots

        const weakIds = await resolveQuestionIds({
          userId: tokenData.userId,
          mode: 'weak_topics',
          requestedCount: weakCount,
          topicFilters: weakTopics,
          onlyNewQuestions: only_new_questions,
          bookmarkIds,
        })

        const regularCount = requestedCount - weakIds.length

        const regularIds = await resolveQuestionIds({
          userId: tokenData.userId,
          mode,
          requestedCount: regularCount,
          topicFilters,
          onlyNewQuestions: only_new_questions,
          bookmarkIds: [],
          excludeQuestionIds: weakIds,
        })

        questionIds = sampleIds([...new Set([...weakIds, ...regularIds])], requestedCount)
      }
    }

    if (questionIds.length === 0) {
      questionIds = await resolveQuestionIds({
        userId: tokenData.userId,
        mode,
        requestedCount,
        topicFilters,
        onlyNewQuestions: only_new_questions,
        bookmarkIds,
      })
    }
    const language = user.preferences?.language ?? 'es'

    if (questionIds.length === 0) {
      if (mode === 'spaced_repetition') {
        return NextResponse.json(
          {
            error: 'no_reviews_due',
            message:
              language === 'es'
                ? '¡Excelente! No tienes preguntas pendientes de repaso. Vuelve más tarde.'
                : 'Great job! No questions due for review. Come back later.',
          },
          { status: 200 }
        )
      }

      return NextResponse.json(
        {
          error: 'No questions available',
          message:
            mode === 'custom' && topicFilters.length > 0
              ? 'No questions found for the selected topics. Try broadening your filters.'
              : mode === 'mistakes'
                ? "You haven't made any mistakes yet. Take some practice exams first!"
                : mode === 'bookmarks'
                  ? "You don't have active bookmarked questions available."
                  : 'No questions available. Please contact support.',
        },
        { status: 404 }
      )
    }

    const expiresAt = calculateExpiration(mode, questionIds.length, timer_minutes)
    
    const passPrediction = estimatePassProbability(
      skillProfile,
      mode,
      topicFilters,
      user.stats,
      user
    )

    const session = await ExamSession.create({
      userId: user._id,
      mode,
      language,
      topicFilters,
      assistanceMode: assistance_mode,
      questionIds,
      expiresAt,
      source,
      aiPassPrediction: passPrediction,
    })

    void getExamRecommendation({
      recentStats: {
        mode,
        topicFilters,
        skillLevel: user.skillProfile?.overallLevel,
        passProb: passPrediction?.probability,
        lang: language,
      },
      lang: language,
      sessionId: session._id.toString(),
    })
      .then((rec) => {
        if (rec && !rec._fallback) {
          return ExamSession.findByIdAndUpdate(session._id, {
            $set: { aiSessionTip: rec?.tip ?? null },
          })
        }
      })
      .catch((err) => {
        console.error('[exam-generate] AI recommendation failed (non-critical):', err?.message)
      })

    return NextResponse.json({
      examId: session._id,
      sessionId: session._id,
      totalQuestions: questionIds.length,
      mode,
      assistanceMode: assistance_mode,
      expiresAt,
      duration: timer_minutes !== undefined ? timer_minutes : (expiresAt ? DURATIONS[mode] : null),
      topicFilters: topicFilters.length > 0 ? topicFilters : null,
      aiPassPrediction: passPrediction,
    })
  } catch (error) {
    console.error('[exam-generate] Unhandled error:', error)
    return NextResponse.json(
      { error: 'Failed to generate exam. Please try again later.' },
      { status: 500 }
    )
  }
}