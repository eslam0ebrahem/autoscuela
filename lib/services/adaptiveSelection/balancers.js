import { EXPLORATION_RATIO, OFFICIAL_DIFFICULTY_DIST } from './constants.js'
import { analyzeQuestionHistory } from './scoring.js'

const toId = (value) => String(value)
const clamp = (n, min, max) => Math.max(min, Math.min(max, n))

function uniqueIds(ids = []) {
  const seen = new Set()
  const out = []

  for (const id of ids) {
    const key = toId(id)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(id)
  }

  return out
}

function buildScoredMaps(allScored = []) {
  const scoredById = new Map()
  const originalIdById = new Map()

  for (const item of allScored) {
    const key = toId(item.questionId)
    scoredById.set(key, item)
    originalIdById.set(key, item.questionId)
  }

  return { scoredById, originalIdById }
}

function rankIdsByScore(ids = [], allScored = []) {
  const { scoredById, originalIdById } = buildScoredMaps(allScored)

  return uniqueIds(ids)
    .map((id) => toId(id))
    .filter((id) => scoredById.has(id))
    .sort((a, b) => {
      const scoreA = scoredById.get(a)?.score ?? 0
      const scoreB = scoredById.get(b)?.score ?? 0
      return scoreB - scoreA
    })
    .map((id) => originalIdById.get(id))
    .filter(Boolean)
}

function finalizeSelection(ids = [], allScored = [], count = 0) {
  return rankIdsByScore(ids, allScored).slice(0, Math.max(0, count))
}

function addSelection(item, selected, selectedIds) {
  const key = toId(item.questionId)
  if (selectedIds.has(key)) return false
  selected.push(item.questionId)
  selectedIds.add(key)
  return true
}

function getRanked(scored = []) {
  return [...scored].sort((a, b) => b.score - a.score)
}

function getBucketedByDifficulty(scored = []) {
  const ranked = getRanked(scored)

  return {
    easy: ranked.filter((s) => s.difficulty === 'easy'),
    medium: ranked.filter((s) => s.difficulty === 'medium'),
    hard: ranked.filter((s) => s.difficulty === 'hard'),
    other: ranked.filter((s) => !['easy', 'medium', 'hard'].includes(s.difficulty)),
  }
}

export function selectIntelligentMistakes(mistakeQuestionIds, questionHistoryMap, count) {
  const now = Date.now()

  const scored = (mistakeQuestionIds || []).map((qId) => {
    const qIdStr = toId(qId)
    const history = questionHistoryMap.get(qIdStr) || []
    const analysis = history.length ? analyzeQuestionHistory(history) : null

    let score = 0.4

    if (analysis) {
      const mistakeCount = history.filter((a) => !a.is_correct).length
      const latestAnswerWrong = history[0] && !history[0].is_correct ? 0.12 : 0
      const unresolvedBoost = analysis.correctedSince ? 0 : 0.15
      const decliningBoost = analysis.trend === 'declining' ? 0.1 : 0
      const lowConfidenceBoost =
        analysis.confidence != null ? (1 - analysis.confidence) * 0.12 : 0.05

      score += Math.min(0.3, mistakeCount * 0.08)
      score += latestAnswerWrong
      score += unresolvedBoost
      score += decliningBoost
      score += lowConfidenceBoost

      if (analysis.mistakeRecency) {
        const daysSinceMistake =
          (now - new Date(analysis.mistakeRecency).getTime()) / (1000 * 60 * 60 * 24)
        score += Math.max(0, 0.18 - daysSinceMistake * 0.01)
      }
    } else {
      score += 0.05
    }

    score += Math.random() * 0.03

    return { questionId: qId, score }
  })

  return getRanked(scored)
    .slice(0, Math.max(0, count))
    .map((s) => s.questionId)
}

export function enforceExploration(selected, allScored, count) {
  const safeCount = Math.max(0, count)
  const explorationTarget = Math.floor(safeCount * EXPLORATION_RATIO)
  if (explorationTarget <= 0) return finalizeSelection(selected, allScored, safeCount)

  const { scoredById, originalIdById } = buildScoredMaps(allScored)

  const selectedIds = uniqueIds(selected).map((id) => toId(id))
  const selectedSet = new Set(selectedIds)

  const unseenSelected = selectedIds.filter((id) => scoredById.get(id)?.neverSeen)
  const seenSelected = selectedIds.filter((id) => !scoredById.get(id)?.neverSeen)

  const deficit = explorationTarget - unseenSelected.length
  if (deficit <= 0) {
    return finalizeSelection(selected, allScored, safeCount)
  }

  const unseenCandidates = getRanked(
    allScored.filter((s) => s.neverSeen && !selectedSet.has(toId(s.questionId)))
  )

  const replaceableSeen = [...seenSelected].sort((a, b) => {
    const scoreA = scoredById.get(a)?.score ?? 0
    const scoreB = scoredById.get(b)?.score ?? 0
    return scoreA - scoreB
  })

  const toSwap = Math.min(deficit, unseenCandidates.length, replaceableSeen.length)
  const finalIds = new Set(selectedIds)

  for (let i = 0; i < toSwap; i++) {
    finalIds.delete(replaceableSeen[i])
    finalIds.add(toId(unseenCandidates[i].questionId))
  }

  return finalizeSelection(
    Array.from(finalIds).map((id) => originalIdById.get(id)).filter(Boolean),
    allScored,
    safeCount
  )
}

export function selectWithOfficialBalance(scored, candidates, count, weights) {
  const safeCount = Math.max(0, count)
  const ranked = getRanked(scored)
  const buckets = getBucketedByDifficulty(ranked)

  const easyTarget = Math.round(safeCount * OFFICIAL_DIFFICULTY_DIST.easy)
  const hardTarget = Math.round(safeCount * OFFICIAL_DIFFICULTY_DIST.hard)
  const mediumTarget = safeCount - easyTarget - hardTarget

  const selected = []
  const selectedIds = new Set()

  const fillBucket = (bucket, target) => {
    let filled = 0
    for (const item of bucket) {
      if (filled >= target || selected.length >= safeCount) break
      if (addSelection(item, selected, selectedIds)) filled++
    }
  }

  fillBucket(buckets.easy, easyTarget)
  fillBucket(buckets.medium, mediumTarget)
  fillBucket(buckets.hard, hardTarget)

  const fallback = [...buckets.easy, ...buckets.medium, ...buckets.hard, ...buckets.other]
    .filter((item) => !selectedIds.has(toId(item.questionId)))
    .sort((a, b) => b.score - a.score)

  for (const item of fallback) {
    if (selected.length >= safeCount) break
    addSelection(item, selected, selectedIds)
  }

  return enforceExploration(selected, ranked, safeCount)
}

export function selectWithCoverage(scored, candidates, count, weights, mode) {
  const safeCount = Math.max(0, count)
  const ranked = getRanked(scored)

  const selected = []
  const selectedIds = new Set()
  const topicCounts = {}

  const allTopics = [
    ...new Set(
      (candidates || [])
        .map((q) => q?.topic_tag?.es)
        .filter(Boolean)
    ),
  ]

  const targetPerTopic = Math.max(1, Math.floor(safeCount / Math.max(allTopics.length, 1)))
  const coverageWeight = weights?.coverage ?? 0

  if (allTopics.length <= safeCount && mode !== 'mistakes') {
    for (const topic of allTopics) {
      const bestForTopic = ranked.find(
        (item) =>
          item.topicTag === topic &&
          !selectedIds.has(toId(item.questionId))
      )

      if (bestForTopic && addSelection(bestForTopic, selected, selectedIds)) {
        topicCounts[topic] = (topicCounts[topic] || 0) + 1
      }
    }
  }

  while (selected.length < safeCount) {
    const remaining = ranked.filter((item) => !selectedIds.has(toId(item.questionId)))
    if (!remaining.length) break

      const bestNext = remaining
      .map((item) => {
        const topic = item.topicTag || '__unknown__'
        const alreadySelectedInTopic = topicCounts[topic] || 0
        const topicDeficit = Math.max(0, targetPerTopic - alreadySelectedInTopic)
        const coverageBonus = topicDeficit > 0 ? coverageWeight * topicDeficit : 0
        const baseScore = typeof item.score === 'number' && !isNaN(item.score) ? item.score : 0

        return {
          ...item,
          adjustedScore: baseScore + coverageBonus,
        }
      })
      .sort((a, b) => b.adjustedScore - a.adjustedScore)[0]

    if (!bestNext) break

    if (addSelection(bestNext, selected, selectedIds)) {
      const topic = bestNext.topicTag || '__unknown__'
      topicCounts[topic] = (topicCounts[topic] || 0) + 1
    }
  }

  return enforceExploration(selected, ranked, safeCount)
}