import { describe, it, expect } from 'vitest'
import { checkBadgeConditions, BADGES, XP, shouldResetWeeklyXP } from '@/lib/gamification'

describe('lib/gamification', () => {
  describe('XP constants', () => {
    it('should define XP reward values', () => {
      expect(XP.EXAM_PASS).toBe(10)
      expect(XP.EXAM_FAIL).toBe(5)
      expect(XP.FLASHCARD_CORRECT).toBe(1)
      expect(XP.DAILY_CHALLENGE).toBe(15)
      expect(XP.PERFECT_EXAM).toBe(25)
    })
  })

  describe('BADGES', () => {
    it('should define badge list', () => {
      expect(Array.isArray(BADGES)).toBe(true)
      expect(BADGES.length).toBeGreaterThan(0)
    })

    it('should have valid badge structure', () => {
      BADGES.forEach((badge) => {
        expect(badge.id).toBeDefined()
        expect(badge.name).toBeDefined()
        expect(badge.description).toBeDefined()
        expect(badge.icon).toBeDefined()
        expect(badge.color).toBeDefined()
        expect(badge.name.es).toBeDefined()
        expect(badge.name.en).toBeDefined()
      })
    })

    it('should have unique badge IDs', () => {
      const ids = BADGES.map((b) => b.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)
    })
  })

  describe('checkBadgeConditions', () => {
    const createMockUser = (overrides = {}) => ({
      gamification: {
        totalXP: 0,
        currentStreak: 0,
        earnedBadges: [],
        dailyChallengeStreak: 0,
        ...overrides.gamification,
      },
      aiInsights: {
        readinessScore: 0,
        ...overrides.aiInsights,
      },
      ...overrides,
    })

    it('should award first_gear on first exam', () => {
      const user = createMockUser()
      const examSession = { score: 25, mode: 'practice', passed: true }
      const badges = checkBadgeConditions(user, examSession, 0)
      expect(badges).toContain('first_gear')
    })

    it('should not re-award already earned badges', () => {
      const user = createMockUser({
        gamification: { earnedBadges: ['first_gear'] },
      })
      const examSession = { score: 25, mode: 'practice', passed: true }
      const badges = checkBadgeConditions(user, examSession, 0)
      expect(badges).not.toContain('first_gear')
    })

    it('should award flawless_drive for perfect official exam', () => {
      const user = createMockUser()
      const examSession = { score: 30, mode: 'official', passed: true }
      const badges = checkBadgeConditions(user, examSession, 0)
      expect(badges).toContain('flawless_drive')
    })

    it('should not award flawless_drive for perfect practice exam', () => {
      const user = createMockUser()
      const examSession = { score: 30, mode: 'practice', passed: true }
      const badges = checkBadgeConditions(user, examSession, 0)
      expect(badges).not.toContain('flawless_drive')
    })

    it('should award marathoner for 100+ daily questions', () => {
      const user = createMockUser()
      const badges = checkBadgeConditions(user, null, 100, { dailyAnswerCount: 100 })
      expect(badges).toContain('marathoner')
    })

    it('should award week_warrior for 7-day streak', () => {
      const user = createMockUser({ gamification: { currentStreak: 7 } })
      const badges = checkBadgeConditions(user, null, 0)
      expect(badges).toContain('week_warrior')
    })

    it('should award two_week_streak for 14-day streak', () => {
      const user = createMockUser({ gamification: { currentStreak: 14 } })
      const badges = checkBadgeConditions(user, null, 0)
      expect(badges).toContain('two_week_streak')
    })

    it('should award streak_master for 30-day streak', () => {
      const user = createMockUser({ gamification: { currentStreak: 30 } })
      const badges = checkBadgeConditions(user, null, 0)
      expect(badges).toContain('streak_master')
    })

    it('should award bilingual_driver for both languages', () => {
      const user = createMockUser()
      const badges = checkBadgeConditions(user, null, 0, {
        examLanguages: ['es', 'en'],
      })
      expect(badges).toContain('bilingual_driver')
    })

    it('should award ai_ready for readiness score >= 90', () => {
      const user = createMockUser({
        aiInsights: { readinessScore: 90 },
      })
      const badges = checkBadgeConditions(user, null, 0)
      expect(badges).toContain('ai_ready')
    })

    it('should not award ai_ready for readiness score < 90', () => {
      const user = createMockUser({
        aiInsights: { readinessScore: 89 },
      })
      const badges = checkBadgeConditions(user, null, 0)
      expect(badges).not.toContain('ai_ready')
    })

    it('should award speed_demon for official exam < 15 min', () => {
      const user = createMockUser()
      const examSession = {
        mode: 'official',
        totalTimeTakenSeconds: 899,
        passed: true,
      }
      const badges = checkBadgeConditions(user, examSession, 0)
      expect(badges).toContain('speed_demon')
    })

    it('should award five_hundred for 500+ answered questions', () => {
      const user = createMockUser()
      const badges = checkBadgeConditions(user, null, 0, { totalAnswered: 500 })
      expect(badges).toContain('five_hundred')
    })

    it('should award thousand_club for 1000 XP', () => {
      const user = createMockUser({
        gamification: { totalXP: 1000 },
      })
      const badges = checkBadgeConditions(user, null, 0)
      expect(badges).toContain('thousand_club')
    })

    it('should award comeback_kid for passing after 3 fails', () => {
      const user = createMockUser()
      const examSession = { passed: true }
      const badges = checkBadgeConditions(user, examSession, 0, {
        consecutiveFails: 3,
      })
      expect(badges).toContain('comeback_kid')
    })

    it('should award perfectionist for 5 consecutive passes', () => {
      const user = createMockUser()
      const badges = checkBadgeConditions(user, null, 0, {
        consecutivePasses: 5,
      })
      expect(badges).toContain('perfectionist')
    })

    it('should award night_owl for studying after midnight', () => {
      const user = createMockUser()
      const badges = checkBadgeConditions(user, null, 0, { studyHour: 1 })
      expect(badges).toContain('night_owl')
    })

    it('should award early_bird for studying before 7am', () => {
      const user = createMockUser()
      const badges = checkBadgeConditions(user, null, 0, { studyHour: 6 })
      expect(badges).toContain('early_bird')
    })

    it('should award mistake_hunter for 50+ corrected mistakes', () => {
      const user = createMockUser()
      const badges = checkBadgeConditions(user, null, 0, { correctedMistakes: 50 })
      expect(badges).toContain('mistake_hunter')
    })

    it('should award multiple badges at once', () => {
      const user = createMockUser({
        gamification: { currentStreak: 7, totalXP: 1000 },
      })
      const badges = checkBadgeConditions(user, null, 0)
      expect(badges).toContain('week_warrior')
      expect(badges).toContain('thousand_club')
    })
  })

  describe('shouldResetWeeklyXP', () => {
    it('should return true when resetAt is null', () => {
      expect(shouldResetWeeklyXP(null)).toBe(true)
    })

    it('should return true when resetAt is undefined', () => {
      expect(shouldResetWeeklyXP(undefined)).toBe(true)
    })

    it('should return false when resetAt is within current week', () => {
      const today = new Date()
      expect(shouldResetWeeklyXP(today)).toBe(false)
    })

    it('should return true when resetAt is before current week start', () => {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 8) // 8 days ago
      expect(shouldResetWeeklyXP(pastDate)).toBe(true)
    })
  })
})
