import connectDB from '@/lib/db'
import User from '@/models/User'
import UserAnswer from '@/models/UserAnswer'

/**
 * Compute a user's skill profile from their incremental stats.
 * Returns overall level + per-topic skill levels.
 * O(1) time complexity (no aggregations).
 */
export async function getUserSkillProfile(userId) {
  await connectDB()

  const [user, recentStats] = await Promise.all([
    User.findById(userId).select('stats').lean(),
    UserAnswer.aggregateForAI(userId, 30),
  ])

  const stats = user?.stats || { totalAnswers: 0, correctAnswers: 0, topicStats: {} }

  // Use recent stats for calculation, fall back to lifetime if no recent data
  const totalAnswered = recentStats?.total_questions > 0 ? recentStats.total_questions : stats.totalAnswers || 0
  const overallAccuracy = recentStats?.total_questions > 0 ? recentStats.overall_accuracy : (stats.totalAnswers > 0 ? Math.round((stats.correctAnswers / stats.totalAnswers) * 100) : 0)

  // Determine overall skill level based on recent performance
  let overallLevel = 'beginner'
  if (totalAnswered >= 200 && overallAccuracy >= 90) overallLevel = 'expert'
  else if (totalAnswered >= 100 && overallAccuracy >= 80) overallLevel = 'hard'
  else if (totalAnswered >= 50 && overallAccuracy >= 65) overallLevel = 'medium'
  else if (totalAnswered >= 20) overallLevel = 'easy'

  // Compute per-topic levels
  const topicLevels = {}
  const topics = []

  // Combine recent topics with lifetime topics for full coverage
  const lifetimeTopicStats = stats.topicStats || {}
  const recentTopicsMap = new Map((recentStats?.topics || []).map(t => [t.tag, t]))

  // We iterate through lifetime topics to ensure all attempted topics are present,
  // but we prioritize recent stats for the actual calculation.
  const allTags = new Set([...Object.keys(lifetimeTopicStats), ...recentTopicsMap.keys()])

  for (const tag of allTags) {
    const recentStat = recentTopicsMap.get(tag)
    const lifetimeStat = lifetimeTopicStats[tag] || {}

    const attempted = recentStat ? recentStat.attempted : (lifetimeStat.attempted || 0)
    const correct = recentStat ? recentStat.correct : (lifetimeStat.correct || 0)
    const accuracy = recentStat ? recentStat.accuracy : (attempted > 0 ? Math.round((correct / attempted) * 1000) / 10 : 0)
    const avgTime = recentStat ? recentStat.avg_time_sec : (attempted > 0 ? Math.round(((lifetimeStat.totalTime || 0) / attempted) * 10) / 10 : 0)

    let level = 'beginner'
    if (attempted >= 30 && accuracy >= 90) level = 'expert'
    else if (attempted >= 20 && accuracy >= 80) level = 'hard'
    else if (attempted >= 10 && accuracy >= 65) level = 'medium'
    else if (attempted >= 5) level = 'easy'

    topicLevels[tag] = level

    // Enhanced trend analysis: compare recent accuracy with lifetime accuracy if both exist
    let trend = 'insufficient_data'
    if (attempted >= 10) {
      if (recentStat && lifetimeStat && lifetimeStat.attempted > 0) {
        const lifetimeAcc = (lifetimeStat.correct / lifetimeStat.attempted) * 100
        const diff = recentStat.accuracy - lifetimeAcc
        if (diff >= 5) trend = 'improving'
        else if (diff <= -5) trend = 'declining'
        else trend = 'stable'
      } else {
        if (accuracy >= 80) trend = 'improving'
        else if (accuracy <= 50) trend = 'declining'
        else trend = 'stable'
      }
    }

    topics.push({
      tag,
      tagEn: tag,
      attempted,
      correct,
      accuracy,
      avgTime,
      trend,
    })
  }

  return {
    overallLevel,
    topicLevels,
    totalAnswered: stats.totalAnswers || 0, // Keep returning lifetime total for gamification
    overallAccuracy,
    topics,
  }
}

/**
 * No-op: caching is no longer needed with O(1) stats.
 */
export async function invalidateSkillProfile() {
  // Kept for backward compatibility if called elsewhere
  return Promise.resolve()
}
