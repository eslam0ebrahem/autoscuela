import { describe, it, expect, vi, beforeEach } from 'vitest'
import mongoose from 'mongoose'
import { getUserSkillProfile } from '@/lib/user-skill'
import User from '@/models/User'

// Mock the database and models
vi.mock('@/lib/db', () => ({
  default: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/models/User', () => ({
  default: {
    findById: vi.fn(),
  },
}))

describe('lib/user-skill', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getUserSkillProfile', () => {
    const mockUserId = new mongoose.Types.ObjectId().toString()

    const mockUserFindById = (stats) => {
      User.findById.mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue({ stats }),
        }),
      })
    }

    it('should return beginner level for new user with no answers', async () => {
      mockUserFindById({ totalAnswers: 0, correctAnswers: 0, topicStats: {} })

      const profile = await getUserSkillProfile(mockUserId)

      expect(profile.overallLevel).toBe('beginner')
      expect(profile.totalAnswered).toBe(0)
      expect(profile.overallAccuracy).toBe(0)
      expect(profile.topics).toEqual([])
    })

    it('should calculate overall accuracy correctly', async () => {
      mockUserFindById({ totalAnswers: 100, correctAnswers: 75, topicStats: {} })

      const profile = await getUserSkillProfile(mockUserId)

      expect(profile.totalAnswered).toBe(100)
      expect(profile.overallAccuracy).toBe(75)
    })

    it('should determine easy level for 20+ answers', async () => {
      mockUserFindById({ totalAnswers: 20, correctAnswers: 12, topicStats: {} })

      const profile = await getUserSkillProfile(mockUserId)

      expect(profile.overallLevel).toBe('easy')
    })

    it('should determine medium level for 50+ answers with 65%+ accuracy', async () => {
      mockUserFindById({ totalAnswers: 50, correctAnswers: 33, topicStats: {} })

      const profile = await getUserSkillProfile(mockUserId)

      expect(profile.overallLevel).toBe('medium')
    })

    it('should determine hard level for 100+ answers with 80%+ accuracy', async () => {
      mockUserFindById({ totalAnswers: 100, correctAnswers: 82, topicStats: {} })

      const profile = await getUserSkillProfile(mockUserId)

      expect(profile.overallLevel).toBe('hard')
    })

    it('should determine expert level for 200+ answers with 90%+ accuracy', async () => {
      mockUserFindById({ totalAnswers: 200, correctAnswers: 185, topicStats: {} })

      const profile = await getUserSkillProfile(mockUserId)

      expect(profile.overallLevel).toBe('expert')
    })

    it('should aggregate topic data correctly', async () => {
      mockUserFindById({
        totalAnswers: 80,
        correctAnswers: 65,
        topicStats: {
          Señales: { attempted: 50, correct: 45, totalTime: 15 * 50 },
          Normas: { attempted: 30, correct: 20, totalTime: 18.5 * 30 },
        },
      })

      const profile = await getUserSkillProfile(mockUserId)

      expect(profile.topics).toHaveLength(2)
      // They are pushed in object key iteration order, so let's just find them
      const senales = profile.topics.find((t) => t.tag === 'Señales')
      expect(senales.accuracy).toBe(90)
      const normas = profile.topics.find((t) => t.tag === 'Normas')
      expect(normas.accuracy).toBe(66.7)
    })

    it('should create topic levels mapping', async () => {
      mockUserFindById({
        totalAnswers: 50,
        correctAnswers: 45,
        topicStats: {
          Señales: { attempted: 50, correct: 45, totalTime: 15 * 50 },
        },
      })

      const profile = await getUserSkillProfile(mockUserId)

      expect(profile.topicLevels).toBeDefined()
      expect(profile.topicLevels['Señales']).toBe('expert')
    })

    it('should handle edge case with zero total', async () => {
      mockUserFindById(null) // no stats at all

      const profile = await getUserSkillProfile(mockUserId)

      expect(profile.overallAccuracy).toBe(0)
      expect(profile.totalAnswered).toBe(0)
    })
  })
})
