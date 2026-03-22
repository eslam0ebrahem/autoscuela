import mongoose from 'mongoose'
import connectDB from '@/lib/db'
import Question from '@/models/Question'
import UserAnswer from '@/models/UserAnswer'
import { getUserSkillProfile } from '@/lib/user-skill'

const DIFFICULTY_MAP = { easy: 1, medium: 2, hard: 3 }
const SKILL_TO_DIFFICULTY = { beginner: 1, easy: 1.5, medium: 2, hard: 2.5, expert: 3 }

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

export async function selectAdaptiveQuestions(userId, count, options = {}) {
  await connectDB()

  const { topicFilters = null, mode = 'official', mistakeQuestionIds = null } = options
  const objectId = new mongoose.Types.ObjectId(userId)

  if (mode === 'mistakes' && mistakeQuestionIds?.length > 0) {
    const shuffled = [...mistakeQuestionIds].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, count)
  }

  // 1. Get user skill profile (O(1))
  const skillProfile = await getUserSkillProfile(userId)
  const userDifficultyTarget = SKILL_TO_DIFFICULTY[skillProfile.overallLevel] || 2

  const topicAccuracy = {}
  for (const topic of skillProfile.topics) {
    topicAccuracy[topic.tag] = topic.accuracy / 100
  }

  // 2. Fetch user's recent answers and SRS state
  const now = Date.now()
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000)

  const [recentAnswers, srsDueAnswers] = await Promise.all([
    UserAnswer.aggregate([
      { $match: { userId: objectId, createdAt: { $gte: sevenDaysAgo } } },
      { $group: { _id: '$questionId', lastSeen: { $max: '$createdAt' }, timesSeen: { $sum: 1 } } },
    ]),
    UserAnswer.aggregate([
      { $match: { userId: objectId, 'srs.nextReviewAt': { $lte: new Date(now) } } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: '$questionId' } },
    ]),
  ])

  const recentMap = new Map()
  for (const r of recentAnswers) {
    recentMap.set(r._id.toString(), { lastSeen: r.lastSeen, timesSeen: r.timesSeen })
  }
  const srsDueIds = new Set(srsDueAnswers.map((a) => a._id.toString()))

  // 3. To prevent transferring the entire Question collection over the network,
  // we first randomly sample a candidate pool that is large enough to contain variety,
  // but small enough to be extremely fast. We also guarantee SRS due questions are included.

  const query = { isActive: true }
  if (topicFilters?.length > 0) {
    query['topic_tag.es'] = { $in: topicFilters }
  }

  const srsDueCandidatesQuery = {
    ...query,
    _id: { $in: Array.from(srsDueIds).map((id) => new mongoose.Types.ObjectId(id)) },
  }

  const [srsCandidates, randomCandidates] = await Promise.all([
    Question.find(srsDueCandidatesQuery).select('_id topic_tag.es difficulty').lean(),
    Question.aggregate([
      { $match: query },
      { $sample: { size: Math.max(count * 5, 200) } },
      { $project: { _id: 1, 'topic_tag.es': 1, difficulty: 1 } },
    ]),
  ])

  // Merge candidates (deduplicate)
  const candidateMap = new Map()
  for (const q of srsCandidates) candidateMap.set(q._id.toString(), q)
  for (const q of randomCandidates) candidateMap.set(q._id.toString(), q)

  const candidates = Array.from(candidateMap.values())

  if (candidates.length === 0) return []
  if (candidates.length <= count)
    return candidates.map((q) => q._id).sort(() => Math.random() - 0.5)

  // 4. Score candidates in memory (fast because candidate pool is capped to ~count*5)
  const weights = WEIGHTS[mode] || WEIGHTS.default

  const scored = candidates.map((q) => {
    const topicTag = q.topic_tag?.es || ''
    const qDifficulty = DIFFICULTY_MAP[q.difficulty] || 2
    const qId = q._id.toString()

    const accuracy = topicAccuracy[topicTag] ?? 0.5
    const weaknessScore = 1 - accuracy

    let freshnessScore = 1.0
    const recent = recentMap.get(qId)
    if (recent) {
      const daysSince = (now - recent.lastSeen.getTime()) / (1000 * 60 * 60 * 24)
      freshnessScore = Math.min(daysSince / 7, 1.0)
      freshnessScore *= Math.max(0.3, 1 - recent.timesSeen * 0.15)
    }

    const diffDistance = Math.abs(qDifficulty - userDifficultyTarget) / 2
    const difficultyScore = 1 - diffDistance

    const noiseScore = Math.random()
    const srsDueBoost = srsDueIds.has(qId) ? 0.3 : 0

    const baseScore =
      weights.weakness * weaknessScore +
      weights.freshness * freshnessScore +
      weights.difficulty * difficultyScore +
      weights.noise * noiseScore +
      srsDueBoost

    return { questionId: q._id, topicTag, score: baseScore }
  })

  // 5. Select with topic coverage balancing
  scored.sort((a, b) => b.score - a.score)

  const selected = []
  const topicCounts = {}
  const selectedIds = new Set()

  const allTopics = [...new Set(candidates.map((q) => q.topic_tag?.es).filter(Boolean))]
  const targetPerTopic = Math.max(1, Math.floor(count / allTopics.length))

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

  for (const item of scored) {
    if (selected.length >= count) break
    if (selectedIds.has(item.questionId.toString())) continue

    const topicCount = topicCounts[item.topicTag] || 0
    const coverageBonus = topicCount < targetPerTopic ? weights.coverage : 0
    item.adjustedScore = item.score + coverageBonus

    selected.push(item.questionId)
    selectedIds.add(item.questionId.toString())
    topicCounts[item.topicTag] = topicCount + 1
  }

  return selected.sort(() => Math.random() - 0.5)
}
