const freeze = (obj) => Object.freeze(obj)

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

function normalizeWeights(weights, fallbackNoise = 0.05) {
  const base = {
    weakness: 0,
    freshness: 0,
    difficulty: 0,
    coverage: 0,
    questionHistory: 0,
    confidence: 0,
    noise: fallbackNoise,
    ...weights,
  }

  const total = Object.values(base).reduce((sum, n) => sum + (Number(n) || 0), 0)
  if (total <= 0) return freeze(base)

  const normalized = Object.fromEntries(
    Object.entries(base).map(([key, value]) => [key, Number((value / total).toFixed(4))])
  )

  return freeze(normalized)
}

// ----------------------------------------------------------------------------
// Difficulty model
// ----------------------------------------------------------------------------
export const DIFFICULTY_MAP = freeze({
  easy: 1,
  medium: 2,
  hard: 3,
})

export const DIFFICULTY_LABELS = freeze(Object.keys(DIFFICULTY_MAP))

export const SKILL_TO_DIFFICULTY = freeze({
  beginner: 1,
  easy: 1.5,
  medium: 2,
  hard: 2.5,
  expert: 3,
})

export const DEFAULT_DIFFICULTY_TARGET = 2
export const MIN_DIFFICULTY_TARGET = 1
export const MAX_DIFFICULTY_TARGET = 3

// ----------------------------------------------------------------------------
// Selection engine tuning
// ----------------------------------------------------------------------------
export const DEFAULT_MODE = 'official'

export const VALID_MODES = freeze([
  'default',
  'official',
  'custom',
  'daily_challenge',
  'mistakes',
  'weak_topics',
  'bookmarks',
  'spaced_repetition',
])

export const MODE_ALIASES = freeze({
  daily: 'daily_challenge',
  weak: 'weak_topics',
  weakTopics: 'weak_topics',
  spaced: 'spaced_repetition',
  srs: 'spaced_repetition',
})

export function normalizeMode(mode) {
  const raw = String(mode || DEFAULT_MODE).trim()
  return MODE_ALIASES[raw] || (VALID_MODES.includes(raw) ? raw : DEFAULT_MODE)
}

// How many recent sessions to inspect for anti-repetition logic
export const ANTI_REPETITION_SESSIONS = 7

// Minimum answers on a question before trusting question-level accuracy
export const MIN_ANSWERS_FOR_QUESTION_ACCURACY = 2

// Candidate pool sizing
export const CANDIDATE_POOL_MULTIPLIER = 6
export const CANDIDATE_POOL_MIN = 300
export const CANDIDATE_POOL_MAX = 1200

export function getCandidatePoolSize(requestedCount) {
  const safeCount = clamp(Number(requestedCount) || 0, 1, 100)
  return clamp(
    safeCount * CANDIDATE_POOL_MULTIPLIER,
    CANDIDATE_POOL_MIN,
    CANDIDATE_POOL_MAX
  )
}

// Exploration guarantee: minimum share of never-seen questions
export const EXPLORATION_RATIO = 0.15
export const MIN_EXPLORATION_RATIO = 0.05
export const MAX_EXPLORATION_RATIO = 0.3

export function getExplorationTarget(count, ratio = EXPLORATION_RATIO) {
  const safeCount = Math.max(0, Number(count) || 0)
  const safeRatio = clamp(Number(ratio) || 0, MIN_EXPLORATION_RATIO, MAX_EXPLORATION_RATIO)
  return Math.floor(safeCount * safeRatio)
}

// Official-mode difficulty distribution
export const OFFICIAL_DIFFICULTY_DIST = freeze({
  easy: 0.3,
  medium: 0.5,
  hard: 0.2,
})

export function getOfficialDifficultyTargets(count) {
  const safeCount = Math.max(0, Number(count) || 0)
  const easy = Math.round(safeCount * OFFICIAL_DIFFICULTY_DIST.easy)
  const hard = Math.round(safeCount * OFFICIAL_DIFFICULTY_DIST.hard)
  const medium = Math.max(0, safeCount - easy - hard)

  return freeze({ easy, medium, hard })
}

// ----------------------------------------------------------------------------
// Bonus / penalty tuning
// Centralize values that were previously hardcoded inside engine/balancers
// ----------------------------------------------------------------------------
export const SCORE_BONUSES = freeze({
  unseenQuestionHistoryBoost: 0.6,
  globalHardQuestionBonus: 0.05,

  srsBaseBoost: 0.1,
  srsPerOverdueDayBoost: 0.05,
  srsMaxBoost: 0.4,

  antiRepetitionPenaltyMax: 0.35,

  decliningTrendBoost: 0.2,
  improvingTrendPenalty: 0.1,

  mistakeModeRecentWrongBoost: 0.12,
  mistakeModeUnresolvedBoost: 0.15,
  mistakeModeDecliningBoost: 0.1,
  mistakeModeLowConfidenceMaxBoost: 0.12,
  mistakeModeMistakeCountStep: 0.08,
  mistakeModeMistakeCountCap: 0.3,
  mistakeModeRecentMistakeMaxBoost: 0.18,
  mistakeModeRecentMistakeDecayPerDay: 0.01,
})

// ----------------------------------------------------------------------------
// Mode-specific weights
// ----------------------------------------------------------------------------
const RAW_WEIGHTS = {
  default: {
    weakness: 0.25,
    freshness: 0.2,
    difficulty: 0.15,
    coverage: 0.12,
    questionHistory: 0.15,
    confidence: 0.08,
    noise: 0.05,
  },
  official: {
    weakness: 0.2,
    freshness: 0.15,
    difficulty: 0.2,
    coverage: 0.2,
    questionHistory: 0.1,
    confidence: 0.1,
    noise: 0.05,
  },
  custom: {
    weakness: 0.3,
    freshness: 0.2,
    difficulty: 0.15,
    coverage: 0.1,
    questionHistory: 0.12,
    confidence: 0.08,
    noise: 0.05,
  },
  daily_challenge: {
    weakness: 0.35,
    freshness: 0.2,
    difficulty: 0.15,
    coverage: 0.1,
    questionHistory: 0.1,
    confidence: 0.05,
    noise: 0.05,
  },
  mistakes: {
    weakness: 0.15,
    freshness: 0.15,
    difficulty: 0.05,
    coverage: 0.05,
    questionHistory: 0.4,
    confidence: 0.1,
    noise: 0.1,
  },
  weak_topics: {
    weakness: 0.4,
    freshness: 0.15,
    difficulty: 0.1,
    coverage: 0.12,
    questionHistory: 0.13,
    confidence: 0.05,
    noise: 0.05,
  },
  bookmarks: {
    weakness: 0.15,
    freshness: 0.25,
    difficulty: 0.1,
    coverage: 0.1,
    questionHistory: 0.25,
    confidence: 0.1,
    noise: 0.05,
  },
  spaced_repetition: {
    weakness: 0.15,
    freshness: 0.3,
    difficulty: 0.1,
    coverage: 0.1,
    questionHistory: 0.2,
    confidence: 0.1,
    noise: 0.05,
  },
}

export const WEIGHT_KEYS = freeze([
  'weakness',
  'freshness',
  'difficulty',
  'coverage',
  'questionHistory',
  'confidence',
  'noise',
])

export const WEIGHTS = freeze(
  Object.fromEntries(
    Object.entries(RAW_WEIGHTS).map(([mode, weights]) => [mode, normalizeWeights(weights)])
  )
)

export function getWeights(mode) {
  return WEIGHTS[normalizeMode(mode)] || WEIGHTS.default
}