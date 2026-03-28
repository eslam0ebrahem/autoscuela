export const DIFFICULTY_MAP = { easy: 1, medium: 2, hard: 3 }
export const SKILL_TO_DIFFICULTY = { beginner: 1, easy: 1.5, medium: 2, hard: 2.5, expert: 3 }

// How many recent sessions to check for anti-repetition
export const ANTI_REPETITION_SESSIONS = 7

// Minimum answers on a question before we trust per-question accuracy
export const MIN_ANSWERS_FOR_QUESTION_ACCURACY = 2

// Maximum candidate pool multiplier
export const CANDIDATE_POOL_MULTIPLIER = 6
export const CANDIDATE_POOL_MIN = 300

// Minimum fraction of selected questions that must be "never seen" (exploration guarantee)
export const EXPLORATION_RATIO = 0.15

// Official mode difficulty distribution: [easy%, medium%, hard%]
export const OFFICIAL_DIFFICULTY_DIST = { easy: 0.3, medium: 0.5, hard: 0.2 }

// Mode-specific weight profiles
export const WEIGHTS = {
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
