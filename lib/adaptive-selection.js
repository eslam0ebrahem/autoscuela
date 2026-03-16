import mongoose from 'mongoose'
import connectDB from '@/lib/db'
import Question from '@/models/Question'
import UserAnswer from '@/models/UserAnswer'
import { getUserSkillProfile } from '@/lib/user-skill'

const DIFFICULTY_MAP = { easy: 1, medium: 2, hard: 3 }
const SKILL_TO_DIFFICULTY = { beginner: 1, easy: 1.5, medium: 2, hard: 2.5, expert: 3 }

// Scoring weights per mode
const WEIGHTS = {
  default: { weakness: 0.35, freshness: 0.25, difficulty: 0.2, coverage: 0.15, noise: 0.05 },
  daily_challenge: {
    weakness: 0.45,
    freshness: 0.2,
    difficulty: 0.15,
    coverage: 0.15,
    noise: 0.05,
  },
  mistakes: { weakness: 0.1, freshness: 0.3, difficulty: 0.1, coverage: 0.1, noise: 0.4 },
  weak_topics: { weakness: 0.5, freshness: 0.2, difficulty: 0.1, coverage: 0.15, noise: 0.05 },
}

/**
 * Select questions adaptively based on user performance.
 * Replaces random $sample with intelligent scoring.
 *
 * @param {string} userId
 * @param {number} count - Number of questions to select
 * @param {object} options
 * @param {string[]} options.topicFilters - Optional topic filter (for custom mode)
 * @param {string} options.mode - 'official', 'custom', 'daily_challenge', 'mistakes', 'weak_topics'
 * @param {string[]} options.mistakeQuestionIds - Pre-selected question IDs for mistake mode
 * @returns {Promise<string[]>} Array of question ObjectIds
 */
export async function selectAdaptiveQuestions(userId, count, options = {}) {
  await connectDB()

  const { topicFilters = null, mode = 'official', mistakeQuestionIds = null } = options
  const objectId = new mongoose.Types.ObjectId(userId)

  // If mistake mode with pre-selected IDs, just shuffle and return
  if (mode === 'mistakes' && mistakeQuestionIds?.length > 0) {
    const shuffled = [...mistakeQuestionIds].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, count)
  }

  // 1. Get user skill profile (reuse cached or compute)
  const skillProfile = await getUserSkillProfile(userId)
  const userDifficultyTarget = SKILL_TO_DIFFICULTY[skillProfile.overallLevel] || 2

  // 2. Build topic accuracy map
  const topicAccuracy = {}
  for (const topic of skillProfile.topics) {
    topicAccuracy[topic.tag] = topic.accuracy / 100 // 0-1 scale
  }

  // 3. Get recently seen questions (last 7 days)
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const recentAnswers = await UserAnswer.aggregate([
    { $match: { userId: objectId, createdAt: { $gte: sevenDaysAgo } } },
    {
      $group: {
        _id: '$questionId',
        lastSeen: { $max: '$createdAt' },
        timesSeen: { $sum: 1 },
      },
    },
  ])

  const recentMap = new Map()
  for (const r of recentAnswers) {
    recentMap.set(r._id.toString(), {
      lastSeen: r.lastSeen,
      timesSeen: r.timesSeen,
    })
  }

  // 4. Fetch all candidate questions
  const query = { isActive: true }
  if (topicFilters?.length > 0) {
    query['topic_tag.es'] = { $in: topicFilters }
  }

  const candidates = await Question.find(query).select('_id topic_tag.es difficulty').lean()

  if (candidates.length === 0) return []
  if (candidates.length <= count) {
    return candidates.map((q) => q._id).sort(() => Math.random() - 0.5)
  }

  // 5. Score each candidate
  const weights = WEIGHTS[mode] || WEIGHTS.default
  const now = Date.now()

  const scored = candidates.map((q) => {
    const topicTag = q.topic_tag?.es || ''
    const qDifficulty = DIFFICULTY_MAP[q.difficulty] || 2
    const qId = q._id.toString()

    // Weakness score: lower user accuracy on topic = higher score
    const accuracy = topicAccuracy[topicTag] ?? 0.5
    const weaknessScore = 1 - accuracy

    // Freshness score: longer since last seen = higher score
    let freshnessScore = 1.0 // Never seen = max
    const recent = recentMap.get(qId)
    if (recent) {
      const daysSince = (now - recent.lastSeen.getTime()) / (1000 * 60 * 60 * 24)
      freshnessScore = Math.min(daysSince / 7, 1.0)
      // Penalize questions seen many times recently
      freshnessScore *= Math.max(0.3, 1 - recent.timesSeen * 0.15)
    }

    // Difficulty match: closer to user's target = higher score
    const diffDistance = Math.abs(qDifficulty - userDifficultyTarget) / 2
    const difficultyScore = 1 - diffDistance

    // Random noise for variety
    const noiseScore = Math.random()

    // Total score (coverage added in selection phase)
    const baseScore =
      weights.weakness * weaknessScore +
      weights.freshness * freshnessScore +
      weights.difficulty * difficultyScore +
      weights.noise * noiseScore

    return { questionId: q._id, topicTag, score: baseScore }
  })

  // 6. Select with topic coverage balancing
  scored.sort((a, b) => b.score - a.score)

  const selected = []
  const topicCounts = {}
  const selectedIds = new Set()

  // Get unique topics for coverage calculation
  const allTopics = [...new Set(candidates.map((q) => q.topic_tag?.es).filter(Boolean))]
  const targetPerTopic = Math.max(1, Math.floor(count / allTopics.length))

  // First pass: ensure minimum 1 per topic (if possible and enough slots)
  if (allTopics.length <= count && mode !== 'mistakes') {
    for (const topic of allTopics) {
      const bestForTopic = scored.find(
        (s) => s.topicTag === topic && !selectedIds.has(s.questionId.toString())
      )
      if (bestForTopic) {
        selected.push(bestForTopic.questionId)
        selectedIds.add(bestForTopic.questionId.toString())
        topicCounts[topic] = (topicCounts[topic] || 0) + 1
      }
    }
  }

  // Second pass: fill remaining slots by score with coverage bonus
  for (const item of scored) {
    if (selected.length >= count) break
    if (selectedIds.has(item.questionId.toString())) continue

    // Coverage bonus: topics with fewer selections get priority
    const topicCount = topicCounts[item.topicTag] || 0
    const coverageBonus = topicCount < targetPerTopic ? weights.coverage : 0
    item.adjustedScore = item.score + coverageBonus

    selected.push(item.questionId)
    selectedIds.add(item.questionId.toString())
    topicCounts[item.topicTag] = topicCount + 1
  }

  // Shuffle final selection so order isn't predictable
  return selected.sort(() => Math.random() - 0.5)
}
