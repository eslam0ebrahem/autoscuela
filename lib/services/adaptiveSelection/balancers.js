import { EXPLORATION_RATIO, OFFICIAL_DIFFICULTY_DIST } from './constants.js'
import { analyzeQuestionHistory } from './scoring.js'

export function selectIntelligentMistakes(mistakeQuestionIds, questionHistoryMap, count) {
  const now = Date.now()

  const scored = mistakeQuestionIds.map((qId) => {
    const qIdStr = qId.toString()
    const history = questionHistoryMap.get(qIdStr)
    const analysis = history ? analyzeQuestionHistory(history) : null

    let score = 0.5

    if (analysis) {
      const mistakeCount = history.filter((a) => !a.is_correct).length
      score += Math.min(0.3, mistakeCount * 0.1) // More mistakes = higher priority

      if (analysis.mistakeRecency) {
        const daysSinceMistake = (now - analysis.mistakeRecency.getTime()) / (1000 * 60 * 60 * 24)
        score += Math.max(0, 0.2 - daysSinceMistake * 0.01) // Recent mistakes = more urgent
      }

      if (!analysis.correctedSince) score += 0.15 // Uncorrected mistakes need attention
      if (analysis.trend === 'declining') score += 0.1 // Getting worse — address urgently
    } else {
      score = 0.4 // No history — include with moderate priority
    }

    score += Math.random() * 0.1 // Small noise for variety

    return { questionId: qId, score }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, count).map((s) => s.questionId)
}

export function enforceExploration(selected, allScored, count) {
  const explorationTarget = Math.floor(count * EXPLORATION_RATIO)
  if (explorationTarget === 0) return selected

  const scoredById = new Map(allScored.map((s) => [s.questionId.toString(), s]))

  const seenSelected = []
  const unseenSelected = []

  for (const qId of selected) {
    const item = scoredById.get(qId.toString())
    if (item?.neverSeen) unseenSelected.push(qId)
    else seenSelected.push(qId)
  }

  const deficit = explorationTarget - unseenSelected.length
  if (deficit <= 0) return selected // Already meeting the exploration quota

  // Find unseen candidates not yet selected, sorted by score descending
  const selectedSet = new Set(selected.map((id) => id.toString()))
  const unseenCandidates = allScored
    .filter((s) => s.neverSeen && !selectedSet.has(s.questionId.toString()))
    .sort((a, b) => b.score - a.score)

  // Swap out the lowest-scoring seen questions for top unseen candidates
  seenSelected.sort((a, b) => {
    const scoreA = scoredById.get(a.toString())?.score ?? 0
    const scoreB = scoredById.get(b.toString())?.score ?? 0
    return scoreA - scoreB // Ascending: lowest score first
  })

  const toSwap = Math.min(deficit, unseenCandidates.length, seenSelected.length)
  const finalSelection = new Set(selected.map((id) => id.toString()))

  for (let i = 0; i < toSwap; i++) {
    finalSelection.delete(seenSelected[i].toString())
    finalSelection.add(unseenCandidates[i].questionId.toString())
  }

  // Map back to ObjectIds
  const allCandidateMap = new Map(allScored.map((s) => [s.questionId.toString(), s.questionId]))
  return Array.from(finalSelection)
    .map((id) => allCandidateMap.get(id))
    .filter(Boolean)
}

export function selectWithOfficialBalance(scored, candidates, count, weights) {
  const easyTarget = Math.round(count * OFFICIAL_DIFFICULTY_DIST.easy)
  const hardTarget = Math.round(count * OFFICIAL_DIFFICULTY_DIST.hard)
  const mediumTarget = count - easyTarget - hardTarget

  const buckets = {
    easy: scored.filter((s) => s.difficulty === 'easy').sort((a, b) => b.score - a.score),
    medium: scored.filter((s) => s.difficulty === 'medium').sort((a, b) => b.score - a.score),
    hard: scored.filter((s) => s.difficulty === 'hard').sort((a, b) => b.score - a.score),
  }

  const selected = []
  const selectedIds = new Set()

  const fillBucket = (bucket, target) => {
    let filled = 0
    for (const item of bucket) {
      if (filled >= target) break
      if (selectedIds.has(item.questionId.toString())) continue
      selected.push(item.questionId)
      selectedIds.add(item.questionId.toString())
      filled++
    }
    return filled
  }

  // Fill each difficulty bucket
  const easeFilled = fillBucket(buckets.easy, easyTarget)
  const medFilled = fillBucket(buckets.medium, mediumTarget)
  const hardFilled = fillBucket(buckets.hard, hardTarget)

  // If any bucket ran short, fill remainder from any difficulty by score
  const remaining = count - selected.length
  if (remaining > 0) {
    const fallback = scored
      .filter((s) => !selectedIds.has(s.questionId.toString()))
      .sort((a, b) => b.score - a.score)
    for (const item of fallback) {
      if (selected.length >= count) break
      selected.push(item.questionId)
    }
  }

  return enforceExploration(selected, scored, count).sort(() => Math.random() - 0.5)
}

export function selectWithCoverage(scored, candidates, count, weights, mode) {
  scored.sort((a, b) => b.score - a.score)

  const selected = []
  const topicCounts = {}
  const selectedIds = new Set()

  const allTopics = [...new Set(candidates.map((q) => q.topic_tag?.es).filter(Boolean))]
  const targetPerTopic = Math.max(1, Math.floor(count / Math.max(allTopics.length, 1)))

  // Phase 1: Guarantee at least 1 question per topic
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

  // Phase 2: Compute adjusted scores and re-sort before filling
  // FIX: previous version computed adjustedScore but never re-sorted,
  //      so coverage bonus had zero effect on selection order.
  const remaining = scored.filter((item) => !selectedIds.has(item.questionId.toString()))
  const withAdjusted = remaining.map((item) => {
    const topicCount = topicCounts[item.topicTag] || 0
    const coverageBonus = topicCount < targetPerTopic ? weights.coverage : 0
    return { ...item, adjustedScore: item.score + coverageBonus }
  })
  withAdjusted.sort((a, b) => b.adjustedScore - a.adjustedScore) // ← the actual fix

  for (const item of withAdjusted) {
    if (selected.length >= count) break
    selected.push(item.questionId)
    selectedIds.add(item.questionId.toString())
    topicCounts[item.topicTag] = (topicCounts[item.topicTag] || 0) + 1
  }

  return enforceExploration(selected, scored, count).sort(() => Math.random() - 0.5)
}
