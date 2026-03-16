import mongoose from 'mongoose'
import connectDB from '@/lib/db'
import User from '@/models/User'
import UserAnswer from '@/models/UserAnswer'

// Cache TTL: 1 hour (3600000 ms)
const SKILL_PROFILE_TTL = 3600000

/**
 * Compute a user's skill profile from their answer history.
 * Returns overall level + per-topic skill levels.
 * Uses caching: only recalculates if cache is stale (>1 hour old).
 */
export async function getUserSkillProfile(userId) {
  await connectDB()

  // ── Check cache ────────────────────────────────────────────────────
  const user = await User.findById(userId).select('skillProfile')
  const now = new Date()
  if (user?.skillProfile?.lastCalculatedAt) {
    const age = now - user.skillProfile.lastCalculatedAt
    if (age < SKILL_PROFILE_TTL) {
      // Cache is fresh; return it
      return {
        overallLevel: user.skillProfile.overallLevel || 'beginner',
        topicLevels: Object.fromEntries(user.skillProfile.topicLevels || new Map()),
        totalAnswered: user.skillProfile.totalAnswered || 0,
        overallAccuracy: user.skillProfile.overallAccuracy || 0,
        topics: user.skillProfile.topics || [],
        cached: true,
      }
    }
  }

  const objectId = new mongoose.Types.ObjectId(userId)

  const [topicResults, totals] = await Promise.all([
    UserAnswer.aggregate([
      { $match: { userId: objectId } },
      {
        $group: {
          _id: '$topic_tag.es',
          tagEn: { $first: '$topic_tag.en' },
          attempted: { $sum: 1 },
          correct: { $sum: { $cond: ['$is_correct', 1, 0] } },
          avgTime: { $avg: '$time_taken_seconds' },
        },
      },
      {
        $project: {
          tag: '$_id',
          tagEn: 1,
          attempted: 1,
          correct: 1,
          accuracy: {
            $cond: [
              { $gt: ['$attempted', 0] },
              { $round: [{ $multiply: [{ $divide: ['$correct', '$attempted'] }, 100] }, 1] },
              0,
            ],
          },
          avgTime: { $round: ['$avgTime', 1] },
          _id: 0,
        },
      },
    ]),
    UserAnswer.aggregate([
      { $match: { userId: objectId } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          correct: { $sum: { $cond: ['$is_correct', 1, 0] } },
        },
      },
    ]),
  ])

  const t = totals[0] || { total: 0, correct: 0 }
  const overallAccuracy = t.total > 0 ? Math.round((t.correct / t.total) * 100) : 0

  // Determine overall skill level
  let overallLevel = 'beginner'
  if (t.total >= 200 && overallAccuracy >= 90) overallLevel = 'expert'
  else if (t.total >= 100 && overallAccuracy >= 80) overallLevel = 'hard'
  else if (t.total >= 50 && overallAccuracy >= 65) overallLevel = 'medium'
  else if (t.total >= 20) overallLevel = 'easy'

  // Compute per-topic levels
  const topicLevels = {}
  for (const topic of topicResults) {
    if (topic.attempted >= 30 && topic.accuracy >= 90) topicLevels[topic.tag] = 'expert'
    else if (topic.attempted >= 20 && topic.accuracy >= 80) topicLevels[topic.tag] = 'hard'
    else if (topic.attempted >= 10 && topic.accuracy >= 65) topicLevels[topic.tag] = 'medium'
    else if (topic.attempted >= 5) topicLevels[topic.tag] = 'easy'
    else topicLevels[topic.tag] = 'beginner'
  }

  // ── Store in cache ────────────────────────────────────────────────
  const profileData = {
    overallLevel,
    topicLevels,
    totalAnswered: t.total,
    overallAccuracy,
    topics: topicResults,
  }

  // Update cache asynchronously (fire-and-forget)
  User.findByIdAndUpdate(userId, {
    $set: {
      'skillProfile.overallLevel': overallLevel,
      'skillProfile.topicLevels': topicLevels,
      'skillProfile.lastCalculated': new Date(),
      'skillProfile.lastCalculatedAt': new Date(),
      'skillProfile.totalAnswered': t.total,
      'skillProfile.overallAccuracy': overallAccuracy,
      'skillProfile.topics': topicResults,
    },
  }).catch((err) => console.error('[user-skill] Cache update failed:', err))

  return profileData
}
