import connectDB from '@/lib/db'
import User from '@/models/User'

/**
 * Compute a user's skill profile from their incremental stats.
 * Returns overall level + per-topic skill levels.
 * O(1) time complexity (no aggregations).
 */
export async function getUserSkillProfile(userId) {
  await connectDB()

  const user = await User.findById(userId).select('stats').lean()
  const stats = user?.stats || { totalAnswers: 0, correctAnswers: 0, topicStats: {} }

  const totalAnswered = stats.totalAnswers || 0
  const totalCorrect = stats.correctAnswers || 0
  const overallAccuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0

  // Determine overall skill level
  let overallLevel = 'beginner'
  if (totalAnswered >= 200 && overallAccuracy >= 90) overallLevel = 'expert'
  else if (totalAnswered >= 100 && overallAccuracy >= 80) overallLevel = 'hard'
  else if (totalAnswered >= 50 && overallAccuracy >= 65) overallLevel = 'medium'
  else if (totalAnswered >= 20) overallLevel = 'easy'

  // Compute per-topic levels
  const topicLevels = {}
  const topics = []

  const topicStats = stats.topicStats || {}
  for (const [tag, stat] of Object.entries(topicStats)) {
    const attempted = stat.attempted || 0
    const correct = stat.correct || 0
    const accuracy = attempted > 0 ? Math.round((correct / attempted) * 1000) / 10 : 0
    const avgTime = attempted > 0 ? Math.round(((stat.totalTime || 0) / attempted) * 10) / 10 : 0

    let level = 'beginner'
    if (attempted >= 30 && accuracy >= 90) level = 'expert'
    else if (attempted >= 20 && accuracy >= 80) level = 'hard'
    else if (attempted >= 10 && accuracy >= 65) level = 'medium'
    else if (attempted >= 5) level = 'easy'

    topicLevels[tag] = level
    topics.push({
      tag,
      tagEn: tag,
      attempted,
      correct,
      accuracy,
      avgTime,
      // Trend: with incremental stats we approximate trend from accuracy vs threshold
      trend:
        attempted >= 20
          ? accuracy >= 80
            ? 'improving'
            : accuracy <= 50
              ? 'declining'
              : 'stable'
          : 'insufficient_data',
    })
  }

  return {
    overallLevel,
    topicLevels,
    totalAnswered,
    overallAccuracy,
    topics,
  }
}

/**
 * No-op: caching is no longer needed with O(1) stats.
 */
export async function invalidateSkillProfile(userId) {
  // Kept for backward compatibility if called elsewhere
  return Promise.resolve()
}
