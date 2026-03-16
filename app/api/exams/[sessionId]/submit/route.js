import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import ExamSession from '@/models/ExamSession'
import User from '@/models/User'
import UserAnswer from '@/models/UserAnswer'
import { getCurrentUser } from '@/lib/auth'
import {
  checkBadgeConditions,
  XP,
  getMadridStartOfDay,
  shouldStreakBreak,
  isTodayStudied,
  updateLeaderboardRank,
} from '@/lib/gamification'
import { getUserSkillProfile } from '@/lib/user-skill'
import { getExamCoachFeedback } from '@/lib/groq'

const MAX_ERRORS_TO_PASS = 3

// ---------------------------------------------------------------------------
// AI HELPER: Compute topic-level breakdown from session answers
// ---------------------------------------------------------------------------
function computeTopicBreakdown(answers) {
  const topicMap = {}

  for (const a of answers) {
    const tag = a.topic_tag?.es || a.topicTag?.es || 'General'
    if (!topicMap[tag]) {
      topicMap[tag] = { tag, correct: 0, total: 0, avgTimeSec: 0, totalTimeSec: 0 }
    }
    topicMap[tag].total++
    if (a.isCorrect) topicMap[tag].correct++
    topicMap[tag].totalTimeSec += a.timeTakenSeconds || 0
  }

  return Object.values(topicMap).map((t) => ({
    ...t,
    accuracy: t.total > 0 ? Math.round((t.correct / t.total) * 100) : 0,
    avgTimeSec: t.total > 0 ? Math.round(t.totalTimeSec / t.total) : 0,
  }))
}

// ---------------------------------------------------------------------------
// AI HELPER: Compute smart XP bonus for notable improvements
// ---------------------------------------------------------------------------
function computeAIXPBonus(session, skillProfile, passed) {
  let bonus = 0
  const reasons = []

  const accuracy =
    session.questionIds.length > 0
      ? Math.round(
          (session.answers.filter((a) => a.isCorrect).length / session.questionIds.length) * 100
        )
      : 0

  if (passed && accuracy === 100) {
    bonus += 50
    reasons.push('Perfect score!')
  } else if (passed && accuracy >= 90) {
    bonus += 25
    reasons.push('Excellent accuracy')
  }

  if (session.mode === 'mistakes' && passed) {
    bonus += 30
    reasons.push('Conquered your mistakes')
  }
  if (session.mode === 'weak_topics' && passed) {
    bonus += 20
    reasons.push('Mastered weak topics')
  }

  // Skill level up bonus
  if (skillProfile?.overallLevel >= 4) {
    bonus += 15
    reasons.push('Expert level')
  }

  return { bonus, reasons }
}

// ---------------------------------------------------------------------------
// Route Handler
// ---------------------------------------------------------------------------
export async function POST(request, { params }) {
  try {
    const { sessionId } = await params
    const tokenData = await getCurrentUser(request)
    if (!tokenData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()

    const session = await ExamSession.findOne({
      _id: sessionId,
      userId: tokenData.userId,
      status: 'in_progress',
    })
    if (!session)
      return NextResponse.json({ error: 'Session not found or already completed' }, { status: 404 })

    // ── Calculate results ───────────────────────────────────────────────
    const correctCount = session.answers.filter((a) => a.isCorrect).length
    const totalQuestions = session.questionIds.length
    const errors = totalQuestions - correctCount
    const passed = errors <= MAX_ERRORS_TO_PASS
    const totalTime = session.answers.reduce((sum, a) => sum + (a.timeTakenSeconds || 0), 0)
    const accuracy = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0
    const lang = session.language || 'es'

    // ── Topic breakdown (AI context + cached for review page) ───────────
    const topicBreakdown = computeTopicBreakdown(session.answers)

    // ── Update session ──────────────────────────────────────────────────
    session.score = correctCount
    session.errorCount = errors
    session.passed = passed
    session.status = 'completed'
    session.completedAt = new Date()
    session.totalTimeTakenSeconds = totalTime
    session.topicBreakdown = topicBreakdown
    await session.save()

    // ── Gamification ────────────────────────────────────────────────────
    const user = await User.findById(tokenData.userId)
    const skillProfile = await getUserSkillProfile(tokenData.userId)
    const { bonus: aiBonus, reasons: bonusReasons } = computeAIXPBonus(
      session,
      skillProfile,
      passed
    )
    const xpEarned = (passed ? XP.EXAM_PASS : XP.EXAM_FAIL) + aiBonus

    const streakBroken = shouldStreakBreak(user.gamification.lastStudyDate)
    let newStreak = user.gamification.currentStreak
    if (streakBroken) {
      newStreak = 1
    } else if (!isTodayStudied(user.gamification.lastStudyDate)) {
      newStreak += 1
    }

    const examLangs = user.gamification.examLanguages || []
    if (!examLangs.includes(session.language)) examLangs.push(session.language)

    const todayStart = getMadridStartOfDay()
    const dailyCount = await UserAnswer.countDocuments({
      userId: user._id,
      createdAt: { $gte: todayStart },
    })
    const newBadges = checkBadgeConditions(
      user,
      { ...session.toObject(), score: correctCount },
      dailyCount,
      { examLanguages: examLangs, newStreak }
    )

    await User.findByIdAndUpdate(tokenData.userId, {
      $set: {
        'gamification.currentStreak': newStreak,
        'gamification.maxStreak': Math.max(user.gamification.maxStreak || 0, newStreak),
        'gamification.lastStudyDate': new Date(),
        'gamification.examLanguages': examLangs,
        'skillProfile.overallLevel': skillProfile.overallLevel,
        'skillProfile.topicLevels': skillProfile.topicLevels,
        'skillProfile.lastCalculated': new Date(),
      },
      $inc: {
        'gamification.totalXP': xpEarned,
        'gamification.weeklyXP': xpEarned,
      },
      $addToSet: { 'gamification.earnedBadges': { $each: newBadges } },
    })

    // ── Fire-and-forget: Update leaderboard rank (non-critical) ──
    updateLeaderboardRank(tokenData.userId).catch((err) =>
      console.error('[submit] Rank update failed (non-critical):', err)
    )

    // ── AI: Fire-and-forget coach feedback (stored in session for review page) ──
    // This runs in background so exam submission response is instant
    const examSummary = {
      score: correctCount,
      errorCount: errors,
      passed,
      totalQuestions,
      accuracy,
      mode: session.mode,
      topicBreakdown,
      timeSpentSeconds: totalTime,
      questionsDetail: session.answers.map((a) => ({
        isCorrect: a.isCorrect,
        topic: a.topic_tag?.es || 'General',
        timeTaken: a.timeTakenSeconds,
      })),
    }

    getExamCoachFeedback({ examSummary, lang })
      .then((feedback) => {
        if (feedback && !feedback._fallback) {
          ExamSession.findByIdAndUpdate(session._id, {
            $set: { aiCoachFeedback: feedback, aiCoachGeneratedAt: new Date() },
          }).catch(() => {}) // Silently fail - non-critical
        }
      })
      .catch((err) => {
        console.error('[submit] AI coach fire-and-forget failed (non-critical):', err.message)
        // Exam submission succeeds even if coach feedback fails
      })

    // ── Response ────────────────────────────────────────────────────────
    return NextResponse.json({
      result: {
        score: correctCount,
        total: totalQuestions,
        errors,
        passed,
        xpEarned,
        newBadges,
        newStreak,
        totalTime,
        accuracy,
        skillLevel: skillProfile.overallLevel,
        topicBreakdown,
        // ✨ AI-powered additions
        aiXPBonus: aiBonus > 0 ? { bonus: aiBonus, reasons: bonusReasons } : null,
        aiCoachReady: false, // Will be populated asynchronously in session
      },
    })
  } catch (error) {
    console.error('[submit] Error:', error)
    return NextResponse.json({ error: 'Failed to submit exam' }, { status: 500 })
  }
}
