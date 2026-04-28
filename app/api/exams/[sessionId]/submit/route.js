import { NextResponse } from 'next/server'
import mongoose from 'mongoose'
import connectDB from '@/lib/db'
import ExamSession from '@/models/ExamSession'
import User from '@/models/User'
import Question from '@/models/Question'
import UserAnswer from '@/models/UserAnswer'
import { getCurrentUser } from '@/lib/auth'
import {
  checkBadgeConditions,
  XP,
  getMadridStartOfDay,
  getMadridNow,
  shouldStreakBreak,
  isTodayStudied,
  shouldResetWeeklyXP,
  updateLeaderboardRank,
} from '@/lib/gamification'
import { getUserSkillProfile, invalidateSkillProfile } from '@/lib/user-skill'
import { getExamCoachFeedback, getSessionQuickSummary } from '@/lib/groq'
import { withTransaction } from '@/lib/db-utils'

const MAX_ERRORS_TO_PASS = 3

// How long to wait for AI coach before giving up (ms). Keeps fire-and-forget bounded.
const AI_COACH_TIMEOUT_MS = 15_000

// ---------------------------------------------------------------------------
// Build a questionId → topicTag lookup from the database.
// FIX: The original computeTopicBreakdown read a.topic_tag from ExamSession.answers,
//      but that field doesn't exist there — only questionId is stored. Without this
//      lookup every answer was mapped to the 'General' fallback, making topicBreakdown
//      completely useless for the review page and AI feedback.
// ---------------------------------------------------------------------------
async function buildTopicLookup(questionIds) {
  if (!questionIds?.length) return {}
  const questions = await Question.find(
    { _id: { $in: questionIds } },
    { _id: 1, 'topic_tag.es': 1 }
  ).lean()
  return Object.fromEntries(questions.map((q) => [q._id.toString(), q.topic_tag?.es || 'General']))
}

// ---------------------------------------------------------------------------
// Compute per-topic breakdown from session answers + topic lookup.
// ---------------------------------------------------------------------------
function computeTopicBreakdown(answers, topicLookup) {
  const topicMap = {}

  for (const a of answers) {
    // FIX: use the lookup map keyed by questionId instead of reading a non-existent field
    const tag = topicLookup[a.questionId?.toString()] || 'General'
    if (!topicMap[tag]) {
      topicMap[tag] = { tag, correct: 0, total: 0, totalTimeSec: 0 }
    }
    topicMap[tag].total++
    if (a.isCorrect) topicMap[tag].correct++
    topicMap[tag].totalTimeSec += a.timeTakenSeconds || 0
  }

  return Object.values(topicMap).map((t) => ({
    tag: t.tag,
    correct: t.correct,
    total: t.total,
    accuracy: t.total > 0 ? Math.round((t.correct / t.total) * 100) : 0,
    avgTimeSec: t.total > 0 ? Math.round(t.totalTimeSec / t.total) : 0,
  }))
}

// ---------------------------------------------------------------------------
// Compute smart XP bonus for notable achievements
// ---------------------------------------------------------------------------
function computeAIXPBonus(session, skillProfile, passed, accuracy) {
  let bonus = 0
  const reasons = []

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
  if (session.mode === 'official' && passed) {
    bonus += 10
    reasons.push('Passed official exam')
  }

  // Expert-level skill bonus
  const levelNum = { beginner: 1, easy: 2, medium: 3, hard: 4, expert: 5 }
  if ((levelNum[skillProfile?.overallLevel] ?? 0) >= 4) {
    bonus += 15
    reasons.push('Expert level')
  }

  // Speed bonus: finished in under half the expected time with high accuracy
  const expectedTimeSec = session.questionIds.length * 60
  const actualTime = session.answers.reduce((sum, a) => sum + (a.timeTakenSeconds || 0), 0)
  if (passed && accuracy >= 80 && actualTime < expectedTimeSec / 2) {
    bonus += 10
    reasons.push('Speed run')
  }

  return { bonus, reasons }
}

// ---------------------------------------------------------------------------
// Wrap a promise with a timeout. Rejects with a timeout error if the
// promise does not resolve within `ms` milliseconds.
// ---------------------------------------------------------------------------
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)),
  ])
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

    // ── Topic breakdown ─────────────────────────────────────────────────
    // FIX: fetch actual topic tags from the Question collection before computing breakdown
    const topicLookup = await buildTopicLookup(session.questionIds)
    const topicBreakdown = computeTopicBreakdown(session.answers, topicLookup)

    // ── Gamification ─────────────────────────────────────────────────────
    const user = await User.findById(tokenData.userId)
    const skillProfile = await getUserSkillProfile(tokenData.userId)

    // Pass accuracy into XP bonus so it doesn't re-compute it internally
    const { bonus: aiBonus, reasons: bonusReasons } = computeAIXPBonus(
      session,
      skillProfile,
      passed,
      accuracy
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

    // Check if weekly XP should reset
    const weeklyXPNeedsReset = shouldResetWeeklyXP(user.gamification?.weeklyXPResetAt)

    const todayStart = getMadridStartOfDay()
    const dailyCount = await UserAnswer.countDocuments({
      userId: user._id,
      createdAt: { $gte: todayStart },
    })

    // ── Gather full badge context (#5: most badges were unreachable) ──────
    const totalAnswered = (user.stats?.totalAnswers || 0) + totalQuestions
    const avgTimePerQuestion = totalTime > 0 && totalQuestions > 0
      ? Math.round(totalTime / totalQuestions)
      : 0

    // Study hour for Night Owl / Early Bird badges
    const madridNow = getMadridNow()
    const studyHour = madridNow.getHours()

    // Consecutive fails/passes for Comeback Kid / Perfectionist badges
    let consecutiveFails = 0
    let consecutivePasses = 0
    try {
      const recentExams = await ExamSession.find({
        userId: user._id,
        status: 'completed',
        _id: { $ne: session._id },
      })
        .sort({ completedAt: -1 })
        .limit(10)
        .select('passed')
        .lean()

      // Count consecutive fails before this exam (for comeback_kid)
      for (const ex of recentExams) {
        if (!ex.passed) consecutiveFails++
        else break
      }
      // Count consecutive passes including current (for perfectionist)
      if (passed) {
        consecutivePasses = 1
        for (const ex of recentExams) {
          if (ex.passed) consecutivePasses++
          else break
        }
      }
    } catch { /* non-critical */ }

    // Topic accuracies for Topic Master badge
    const topicAccuracies = skillProfile.topics?.map((t) => ({
      tag: t.tag,
      accuracy: t.accuracy,
      attempted: t.attempted,
    })) || []

    // Unique topics answered for Encyclopedia badge
    const uniqueTopicsAnswered = topicAccuracies.length
    let totalTopics = 0
    try {
      totalTopics = await Question.distinct('topic_tag.es', { isActive: true }).then((r) => r.length)
    } catch { /* non-critical */ }

    // Corrected mistakes count for Mistake Hunter badge
    let correctedMistakes = 0
    try {
      // Count questions that were once wrong but now have a correct answer as most recent
      correctedMistakes = await UserAnswer.aggregate([
        { $match: { userId: user._id } },
        { $sort: { createdAt: -1 } },
        { $group: {
          _id: '$questionId',
          latestCorrect: { $first: '$is_correct' },
          hadMistake: { $max: { $cond: [{ $eq: ['$is_correct', false] }, 1, 0] } },
        }},
        { $match: { latestCorrect: true, hadMistake: 1 } },
        { $count: 'total' },
      ]).then((r) => r[0]?.total || 0)
    } catch { /* non-critical */ }

    // Mastered flashcards logic removed

    const newBadges = checkBadgeConditions(
      { ...user.toObject(), gamification: { ...user.gamification.toObject?.() ?? user.gamification, totalXP: (user.gamification?.totalXP || 0) + xpEarned } },
      { ...session.toObject(), score: correctCount },
      dailyCount,
      {
        examLanguages: examLangs,
        newStreak,
        totalAnswered,
        consecutiveFails,
        consecutivePasses,
        topicAccuracies,
        uniqueTopicsAnswered,
        totalTopics,
        avgTimePerQuestion,
        studyHour,
        correctedMistakes,
      }
    )

    // ── Atomic transaction: update ExamSession + User together ──────────
    try {
      await withTransaction(async (txSession) => {
        session.score = correctCount
        session.errorCount = errors
        session.passed = passed
        session.status = 'completed'
        session.completedAt = new Date()
        session.totalTimeTakenSeconds = totalTime
        session.topicBreakdown = topicBreakdown
        await session.save({ session: txSession })

        const userUpdate = {
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
        }

        // Fix #6: Reset weekly XP when the week has rolled over
        if (weeklyXPNeedsReset) {
          userUpdate.$set['gamification.weeklyXP'] = xpEarned // Reset to just this session's XP
          userUpdate.$set['gamification.weeklyXPResetAt'] = new Date()
          delete userUpdate.$inc['gamification.weeklyXP'] // Don't increment — we set it above
        }

        await User.findByIdAndUpdate(
          tokenData.userId,
          userUpdate,
          { session: txSession, returnDocument: 'after' }
        )
      })
    } catch (err) {
      if (err.code === 11000)
        return NextResponse.json({ error: 'Question already answered' }, { status: 400 })
      console.error('[submit] Transaction failed:', err)
      throw err
    }

    // ── Fire-and-forget: leaderboard rank update (non-critical) ──────────
    updateLeaderboardRank(tokenData.userId).catch((err) =>
      console.error('[submit] Rank update failed (non-critical):', err)
    )

    // ── Fire-and-forget: invalidate skill profile cache (non-critical) ───
    invalidateSkillProfile(tokenData.userId).catch((err) =>
      console.error('[submit] Skill profile invalidation failed (non-critical):', err)
    )

    // ── Fire-and-forget: AI coach feedback ───────────────────────────────
    // Runs in background so submission response stays instant.
    // FIX: wrapped in withTimeout so a slow AI call can't run forever.
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
        topic: topicLookup[a.questionId?.toString()] || 'General', // FIX: use lookup
        timeTaken: a.timeTakenSeconds,
      })),
    }

    Promise.resolve()
      .then(async () => {
        let sessionHistory = []
        try {
          sessionHistory = await ExamSession.find({
            userId: tokenData.userId,
            status: 'completed',
            _id: { $ne: session._id },
          })
            .sort({ completedAt: -1 })
            .limit(5)
            .select('score errorCount passed completedAt mode')
            .lean()
          sessionHistory.reverse()
        } catch {
          // Proceed without history
        }

        const [feedback, quickSummary] = await withTimeout(
          Promise.all([
            getExamCoachFeedback({ examSummary, sessionHistory, lang }),
            getSessionQuickSummary({
              correctCount,
              totalCount: totalQuestions,
              timeSeconds: totalTime,
              mode: session.mode,
              topicBreakdown,
              lang,
            }),
          ]),
          AI_COACH_TIMEOUT_MS
        )

        if (feedback && !feedback._fallback) {
          await ExamSession.findByIdAndUpdate(session._id, {
            $set: {
              aiCoachFeedback: feedback,
              aiQuickSummary: quickSummary,
              aiCoachGeneratedAt: new Date(),
            },
          })
        }
      })
      .catch((err) => {
        console.error('[submit] AI coach fire-and-forget failed (non-critical):', err.message)
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
        aiXPBonus: aiBonus > 0 ? { bonus: aiBonus, reasons: bonusReasons } : null,
        aiCoachReady: false, // Populated asynchronously — poll session for updates
      },
    })
  } catch (error) {
    console.error('[submit] Error:', error)
    return NextResponse.json({ error: 'Failed to submit exam' }, { status: 500 })
  }
}
