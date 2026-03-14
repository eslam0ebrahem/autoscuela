import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import User from '@/models/User'
import Question from '@/models/Question'
import ExamSession from '@/models/ExamSession'
import { getCurrentUser } from '@/lib/auth'
import { clamp } from '@/lib/utils'
import { selectAdaptiveQuestions } from '@/lib/adaptive-selection'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const OFFICIAL_EXAM_QUESTIONS = 30
const OFFICIAL_EXAM_DURATION_MIN = 30
const ABANDONED_SESSION_HOURS = 2

const VALID_MODES = ['official', 'custom', 'mistakes', 'weak_topics', 'bookmarks']
const VALID_ASSISTANCE_MODES = ['instant', 'exam']

const QUESTION_LIMITS = {
  MIN: 5,
  MAX: 100,
}

// Mode-specific durations (minutes)
const DURATIONS = {
  official: 30,
  custom: 60,
  mistakes: 45,
  weak_topics: 45,
  bookmarks: 45,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Check if user has active (non-abandoned) sessions and enforce limits.
 * @param {string} userId
 * @returns {Promise<{ allowed: boolean, activeCount: number }>}
 */
async function checkSessionLimits(userId) {
  const activeCount = await ExamSession.countDocuments({
    userId,
    status: 'in_progress',
  })

  // Premium users: max 3 concurrent sessions
  // Free users would be blocked by isPremium check earlier
  const MAX_CONCURRENT_SESSIONS = 3

  return {
    allowed: activeCount < MAX_CONCURRENT_SESSIONS,
    activeCount,
  }
}

/**
 * Clean up abandoned sessions for a user.
 * @param {string} userId
 * @param {number} hoursThreshold
 * @returns {Promise<number>} Number of sessions marked as abandoned
 */
async function cleanupAbandonedSessions(userId, hoursThreshold = ABANDONED_SESSION_HOURS) {
  const cutoff = new Date()
  cutoff.setHours(cutoff.getHours() - hoursThreshold)

  const result = await ExamSession.updateMany(
    {
      userId,
      status: 'in_progress',
      createdAt: { $lt: cutoff },
    },
    { $set: { status: 'abandoned', abandonedAt: new Date() } }
  )

  return result.modifiedCount ?? 0
}

/**
 * Calculate expiration time based on mode and question count.
 * @param {string} mode
 * @param {number} questionCount
 * @returns {Date|null}
 */
function calculateExpiration(mode, questionCount) {
  if (mode !== 'official') return null // Only official exams have time limits

  const baseDuration = DURATIONS[mode] ?? OFFICIAL_EXAM_DURATION_MIN
  // Add 1 minute per 10 questions above 30 for custom official exams
  const extraTime = Math.max(0, Math.floor((questionCount - OFFICIAL_EXAM_QUESTIONS) / 10))

  const expiresAt = new Date()
  expiresAt.setMinutes(expiresAt.getMinutes() + baseDuration + extraTime)

  return expiresAt
}

/**
 * Normalize topic filters to always return an array.
 * @param {any} topicFilter
 * @returns {Array<string>}
 */
function normalizeTopicFilters(topicFilter) {
  if (!topicFilter) return []
  if (Array.isArray(topicFilter)) return topicFilter.filter(Boolean)
  return [topicFilter].filter(Boolean)
}

/**
 * Build adaptive selection options based on mode.
 * @param {string} mode
 * @param {Array<string>|null} topicFilters
 * @returns {object}
 */
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
      // Official exams use balanced distribution across all topics
      options.balanced = true
      break
  }

  return options
}

// ---------------------------------------------------------------------------
// Route handler – Generate exam session
// ---------------------------------------------------------------------------

export async function POST(request) {
  try {
    // ── Auth ────────────────────────────────────────────────────────────────
    const tokenData = await getCurrentUser(request)
    if (!tokenData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const user = await User.findById(tokenData.userId)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!user.isPremium) {
      return NextResponse.json(
        { 
          error: 'Premium subscription required',
          message: 'Upgrade to premium to create custom exams and access AI features.'
        },
        { status: 403 }
      )
    }

    // ── Cleanup abandoned sessions ──────────────────────────────────────────
    const abandonedCount = await cleanupAbandonedSessions(user._id)
    if (abandonedCount > 0) {
      console.log(`[exam-generate] Cleaned up ${abandonedCount} abandoned sessions for user ${user._id}`)
    }

    // ── Check session limits ────────────────────────────────────────────────
    const { allowed, activeCount } = await checkSessionLimits(user._id)
    if (!allowed) {
      return NextResponse.json(
        {
          error: 'Session limit reached',
          message: `You have ${activeCount} active exams. Please complete or abandon one before starting a new exam.`,
          activeCount,
        },
        { status: 429 }
      )
    }

    // ── Parse & validate request body ───────────────────────────────────────
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      )
    }

    const {
      mode = 'official',
      topic_filter = null,
      assistance_mode = 'exam',
      num_questions = OFFICIAL_EXAM_QUESTIONS,
      source = 'standard', // Reserved for future use (official/community questions)
    } = body

    // Validate mode
    if (!VALID_MODES.includes(mode)) {
      return NextResponse.json(
        { 
          error: 'Invalid exam mode',
          validModes: VALID_MODES,
        },
        { status: 400 }
      )
    }

    // Validate assistance mode
    if (!VALID_ASSISTANCE_MODES.includes(assistance_mode)) {
      return NextResponse.json(
        { 
          error: 'Invalid assistance mode',
          validModes: VALID_ASSISTANCE_MODES,
        },
        { status: 400 }
      )
    }

    // ── Determine question count ────────────────────────────────────────────
    const requestedCount = mode === 'official'
      ? OFFICIAL_EXAM_QUESTIONS
      : clamp(
          parseInt(num_questions, 10) || OFFICIAL_EXAM_QUESTIONS,
          QUESTION_LIMITS.MIN,
          QUESTION_LIMITS.MAX
        )

    // ── Handle Bookmarks Mode ───────────────────────────────────────────────
    let bookmarkIds = []
    if (mode === 'bookmarks') {
      bookmarkIds = user.bookmarkedQuestions || []
      if (bookmarkIds.length === 0) {
        return NextResponse.json(
          { 
            error: 'No bookmarks found',
            message: "You haven't bookmarked any questions yet. Save some during exams to practice them here!"
          },
          { status: 404 }
        )
      }
    }

    // ── Prepare filters and adaptive options ────────────────────────────────
    const topicFilters = normalizeTopicFilters(topic_filter)
    const adaptiveOptions = buildAdaptiveOptions(mode, topicFilters)

    // ── Select questions using adaptive algorithm ───────────────────────────
    let questionIds
    try {
      questionIds = await selectAdaptiveQuestions(
        tokenData.userId,
        requestedCount,
        {
          ...adaptiveOptions,
          mistakeQuestionIds: mode === 'bookmarks' ? bookmarkIds : null
        }
      )
    } catch (error) {
      console.error('[exam-generate] Adaptive selection failed:', error)
      return NextResponse.json(
        { error: 'Failed to select questions. Please try again.' },
        { status: 500 }
      )
    }

    if (questionIds.length === 0) {
      return NextResponse.json(
        {
          error: 'No questions available',
          message: mode === 'custom' && topicFilters.length > 0
            ? 'No questions found for the selected topics. Try broadening your filters.'
            : mode === 'mistakes'
            ? "You haven't made any mistakes yet. Take some practice exams first!"
            : 'No questions available. Please contact support.',
        },
        { status: 404 }
      )
    }

    // ── Calculate expiration ────────────────────────────────────────────────
    const expiresAt = calculateExpiration(mode, questionIds.length)

    // ── Create exam session ─────────────────────────────────────────────────
    const session = await ExamSession.create({
      userId: user._id,
      mode,
      language: user.preferences?.language ?? 'en',
      topicFilters,
      assistanceMode: assistance_mode,
      questionIds,
      expiresAt,
      source, // Track question source for future analytics
    })

    // ── Response ────────────────────────────────────────────────────────────
    return NextResponse.json({
      examId: session._id,
      sessionId: session._id, // Backward compatibility
      totalQuestions: questionIds.length,
      mode,
      assistanceMode: assistance_mode,
      expiresAt,
      duration: expiresAt ? DURATIONS[mode] : null,
      topicFilters: topicFilters.length > 0 ? topicFilters : null,
    })
  } catch (error) {
    console.error('[exam-generate] Unhandled error:', error)
    return NextResponse.json(
      { error: 'Failed to generate exam. Please try again later.' },
      { status: 500 }
    )
  }
}
