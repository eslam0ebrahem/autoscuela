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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const OFFICIAL_EXAM_QUESTIONS = 30
const OFFICIAL_EXAM_DURATION_MIN = 30
const ABANDONED_SESSION_HOURS = 2
const VALID_MODES = [
  'official',
  'custom',
  'mistakes',
  'weak_topics',
  'bookmarks',
  'spaced_repetition',
]
const VALID_ASSISTANCE_MODES = ['instant', 'exam']
const QUESTION_LIMITS = { MIN: 5, MAX: 100 }
const DURATIONS = {
  official: 30,
  custom: 60,
  mistakes: 45,
  weak_topics: 45,
  bookmarks: 45,
  spaced_repetition: 45,
}

// ---------------------------------------------------------------------------
// Helpers (unchanged)
// ---------------------------------------------------------------------------
async function checkSessionLimits(userId) {
  const activeCount = await ExamSession.countDocuments({ userId, status: 'in_progress' })
  return { allowed: activeCount < 3, activeCount }
}

async function cleanupAbandonedSessions(userId, hoursThreshold = ABANDONED_SESSION_HOURS) {
  const cutoff = new Date()
  cutoff.setHours(cutoff.getHours() - hoursThreshold)
  const result = await ExamSession.updateMany(
    { userId, status: 'in_progress', createdAt: { $lt: cutoff } },
    { $set: { status: 'abandoned', abandonedAt: new Date() } }
  )
  return result.modifiedCount ?? 0
}

function calculateExpiration(mode, questionCount) {
  if (mode !== 'official') return null
  const baseDuration = DURATIONS[mode] ?? OFFICIAL_EXAM_DURATION_MIN
  const extraTime = Math.max(0, Math.floor((questionCount - OFFICIAL_EXAM_QUESTIONS) / 10))
  const expiresAt = new Date()
  expiresAt.setMinutes(expiresAt.getMinutes() + baseDuration + extraTime)
  return expiresAt
}

function normalizeTopicFilters(topicFilter) {
  if (!topicFilter) return []
  if (Array.isArray(topicFilter)) return topicFilter.filter(Boolean)
  return [topicFilter].filter(Boolean)
}

function buildAdaptiveOptions(mode, topicFilters) {
  const options = { mode }
  switch (mode) {
    case 'custom':
    case 'weak_topics':
      options.topicFilters = topicFilters
      break
    case 'mistakes':
      options.prioritizeMistakes = true
      break
    case 'official':
      options.balanced = true
      break
  }
  return options
}

// ---------------------------------------------------------------------------
// AI HELPER: Estimate pass probability from skill profile (local, no AI call)
// ---------------------------------------------------------------------------
function estimatePassProbability(skillProfile, mode, topicFilters) {
  if (!skillProfile?.overallLevel) return null

  // Map skill level (0-5) to base pass probability
  const baseProb = Math.min(95, Math.max(5, (skillProfile.overallLevel / 5) * 100))

  // Adjust for mode difficulty
  const modeAdjust = {
    official: 0,
    custom: topicFilters?.length > 0 ? -5 : 0,
    mistakes: -15, // Mistake reviews are harder
    weak_topics: -10,
    bookmarks: -5,
  }

  const adjustedProb = Math.round(Math.min(95, Math.max(5, baseProb + (modeAdjust[mode] ?? 0))))

  return {
    probability: adjustedProb,
    level: adjustedProb >= 80 ? 'high' : adjustedProb >= 55 ? 'medium' : 'low',
    message:
      adjustedProb >= 80
        ? 'high_confidence'
        : adjustedProb >= 55
          ? 'needs_practice'
          : 'needs_more_study',
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------
export async function POST(request) {
  try {
    // ── CSRF Protection ────────────────────────────────────────────────
    const csrfError = checkCSRF('POST', request)
    if (csrfError) {
      return NextResponse.json(csrfError, { status: csrfError.status })
    }

    // ── Auth ──────────────────────────────────────────────────────────────
    const tokenData = await getCurrentUser(request)
    if (!tokenData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // ── Rate limiting (2 per 60 sec to prevent abuse) ────────────────────
    const rateCheck = await checkRateLimit(`exam:generate:${tokenData.userId}`, 2, 60000)
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many exam generation requests' },
        { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfter || 60) } }
      )
    }

    await connectDB()

    const user = await User.findById(tokenData.userId)
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    if (!user.isPremium) {
      return NextResponse.json(
        {
          error: 'Premium subscription required',
          message: 'Upgrade to premium to access exams and AI features.',
        },
        { status: 403 }
      )
    }

    // ── Cleanup abandoned sessions ─────────────────────────────────────
    const abandonedCount = await cleanupAbandonedSessions(user._id)

    // ── Check session limits ──────────────────────────────────────────
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

    // ── Parse & validate body ─────────────────────────────────────────
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { data: validated, error: validationError } = parseSchema(ExamGenerateSchema, body)
    if (validationError) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationError.messages },
        { status: validationError.status }
      )
    }

    const { mode, topic_filter, assistance_mode, num_questions, source } = validated

    // ── Question count ─────────────────────────────────────────────────
    const requestedCount = mode === 'official' ? OFFICIAL_EXAM_QUESTIONS : num_questions

    // ── Bookmarks mode ─────────────────────────────────────────────────
    let bookmarkIds = []
    if (mode === 'bookmarks') {
      bookmarkIds = user.bookmarkedQuestions || []
      if (bookmarkIds.length === 0) {
        return NextResponse.json(
          {
            error: 'No bookmarks found',
            message: "You haven't bookmarked any questions yet. Save some during exams!",
          },
          { status: 404 }
        )
      }
    }

    // ── Select questions ──────────────────────────────────────────────
    const topicFilters = normalizeTopicFilters(topic_filter)
    const adaptiveOptions = buildAdaptiveOptions(mode, topicFilters)
    const language = user.preferences?.language ?? 'en'

    let questionIds
    if (mode === 'spaced_repetition') {
      const now = new Date()
      const objectId = new mongoose.Types.ObjectId(tokenData.userId)
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
      const dueIds = dueAnswers.map((a) => a._id)
      if (dueIds.length === 0) {
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
      questionIds = dueIds.slice(0, requestedCount).sort(() => Math.random() - 0.5)
    } else {
      try {
        questionIds = await selectAdaptiveQuestions(tokenData.userId, requestedCount, {
          ...adaptiveOptions,
          mistakeQuestionIds: mode === 'bookmarks' ? bookmarkIds : null,
        })
      } catch (error) {
        console.error('[exam-generate] Adaptive selection failed:', error)
        return NextResponse.json(
          { error: 'Failed to select questions. Please try again.' },
          { status: 500 }
        )
      }
    }

    if (questionIds.length === 0) {
      return NextResponse.json(
        {
          error: 'No questions available',
          message:
            mode === 'custom' && topicFilters.length > 0
              ? 'No questions found for the selected topics. Try broadening your filters.'
              : mode === 'mistakes'
                ? "You haven't made any mistakes yet. Take some practice exams first!"
                : 'No questions available. Please contact support.',
        },
        { status: 404 }
      )
    }

    // ── Calculate expiration ──────────────────────────────────────────
    const expiresAt = calculateExpiration(mode, questionIds.length)

    // ── AI: Estimate pass probability (local, instant, no API call) ───
    const passPrediction = estimatePassProbability(user.skillProfile, mode, topicFilters)

    // ── Create session ────────────────────────────────────────────────
    const session = await ExamSession.create({
      userId: user._id,
      mode,
      language: user.preferences?.language ?? 'en',
      topicFilters,
      assistanceMode: assistance_mode,
      questionIds,
      expiresAt,
      source,
    })

    // ── AI: Fire-and-forget session tip (stored in session, used on setup confirmation) ──
    // If AI fails, session still succeeds with null tip (graceful degradation)
    const lang = user.preferences?.language ?? 'en'
    getExamRecommendation({
      recentStats: {
        mode,
        topicFilters,
        skillLevel: user.skillProfile?.overallLevel,
        passProb: passPrediction?.probability,
        lang,
      },
      lang,
    })
      .then((rec) => {
        if (rec && !rec._fallback) {
          ExamSession.findByIdAndUpdate(session._id, {
            $set: { aiSessionTip: rec?.tip ?? null },
          }).catch(() => {}) // Silently fail - non-critical
        }
      })
      .catch((err) => {
        console.error('[exam-generate] AI recommendation failed (non-critical):', err.message)
        // Session continues without AI tip
      })

    // ── Response ──────────────────────────────────────────────────────
    return NextResponse.json({
      examId: session._id,
      sessionId: session._id,
      totalQuestions: questionIds.length,
      mode,
      assistanceMode: assistance_mode,
      expiresAt,
      duration: expiresAt ? DURATIONS[mode] : null,
      topicFilters: topicFilters.length > 0 ? topicFilters : null,
      // ✨ AI-powered additions
      aiPassPrediction: passPrediction, // { probability, level, message }
    })
  } catch (error) {
    console.error('[exam-generate] Unhandled error:', error)
    return NextResponse.json(
      { error: 'Failed to generate exam. Please try again later.' },
      { status: 500 }
    )
  }
}
