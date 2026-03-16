import { describe, it, expect, vi, beforeEach } from 'vitest'
import mongoose from 'mongoose'
import { getUserSkillProfile } from '@/lib/user-skill'

// Mock the database and models
vi.mock('@/lib/db', () => ({
  default: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/models/UserAnswer', () => ({
  default: {
    aggregate: vi.fn(),
  },
}))

import UserAnswer from '@/models/UserAnswer'

describe('lib/user-skill', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getUserSkillProfile', () => {
    const mockUserId = new mongoose.Types.ObjectId().toString()

    it('should return beginner level for new user with no answers', async () => {
      UserAnswer.aggregate.mockResolvedValueOnce([]) // topic results
      UserAnswer.aggregate.mockResolvedValueOnce([]) // totals

      const profile = await getUserSkillProfile(mockUserId)

      expect(profile.overallLevel).toBe('beginner')
      expect(profile.totalAnswered).toBe(0)
      expect(profile.overallAccuracy).toBe(0)
      expect(profile.topics).toEqual([])
    })

    it('should calculate overall accuracy correctly', async () => {
      UserAnswer.aggregate.mockResolvedValueOnce([]) // topic results
      UserAnswer.aggregate.mockResolvedValueOnce([
        { total: 100, correct: 75 },
      ]) // totals

      const profile = await getUserSkillProfile(mockUserId)

      expect(profile.totalAnswered).toBe(100)
      expect(profile.overallAccuracy).toBe(75)
    })

    it('should determine easy level for 20+ answers', async () => {
      UserAnswer.aggregate.mockResolvedValueOnce([]) // topic results
      UserAnswer.aggregate.mockResolvedValueOnce([
        { total: 20, correct: 12 },
      ]) // totals

      const profile = await getUserSkillProfile(mockUserId)

      expect(profile.overallLevel).toBe('easy')
    })

    it('should determine medium level for 50+ answers with 65%+ accuracy', async () => {
      UserAnswer.aggregate.mockResolvedValueOnce([]) // topic results
      UserAnswer.aggregate.mockResolvedValueOnce([
        { total: 50, correct: 33 },
      ]) // totals (66% accuracy)

      const profile = await getUserSkillProfile(mockUserId)

      expect(profile.overallLevel).toBe('medium')
    })

    it('should determine hard level for 100+ answers with 80%+ accuracy', async () => {
      UserAnswer.aggregate.mockResolvedValueOnce([]) // topic results
      UserAnswer.aggregate.mockResolvedValueOnce([
        { total: 100, correct: 82 },
      ]) // totals (82% accuracy)

      const profile = await getUserSkillProfile(mockUserId)

      expect(profile.overallLevel).toBe('hard')
    })

    it('should determine expert level for 200+ answers with 90%+ accuracy', async () => {
      UserAnswer.aggregate.mockResolvedValueOnce([]) // topic results
      UserAnswer.aggregate.mockResolvedValueOnce([
        { total: 200, correct: 185 },
      ]) // totals (92.5% accuracy)

      const profile = await getUserSkillProfile(mockUserId)

      expect(profile.overallLevel).toBe('expert')
    })

    it('should aggregate topic data correctly', async () => {
      const mockTopicResults = [
        {
          tag: 'Señales',
          tagEn: 'Signals',
          attempted: 50,
          correct: 45,
          accuracy: 90,
          avgTime: 15.2,
        },
        {
          tag: 'Normas',
          tagEn: 'Rules',
          attempted: 30,
          correct: 20,
          accuracy: 66.7,
          avgTime: 18.5,
        },
      ]

      UserAnswer.aggregate.mockResolvedValueOnce(mockTopicResults)
      UserAnswer.aggregate.mockResolvedValueOnce([
        { total: 80, correct: 65 },
      ])

      const profile = await getUserSkillProfile(mockUserId)

      expect(profile.topics).toHaveLength(2)
      expect(profile.topics[0].tag).toBe('Señales')
      expect(profile.topics[0].accuracy).toBe(90)
      expect(profile.topics[1].tag).toBe('Normas')
      expect(profile.topics[1].accuracy).toBe(66.7)
    })

    it('should create topic levels mapping', async () => {
      const mockTopicResults = [
        {
          tag: 'Señales',
          tagEn: 'Signals',
          attempted: 50,
          correct: 45,
          accuracy: 90,
          avgTime: 15,
        },
      ]

      UserAnswer.aggregate.mockResolvedValueOnce(mockTopicResults)
      UserAnswer.aggregate.mockResolvedValueOnce([
        { total: 50, correct: 45 },
      ])

      const profile = await getUserSkillProfile(mockUserId)

      expect(profile.topicLevels).toBeDefined()
      expect(profile.topicLevels['Señales']).toBe('expert')
    })

    it('should handle edge case with zero total', async () => {
      UserAnswer.aggregate.mockResolvedValueOnce([])
      UserAnswer.aggregate.mockResolvedValueOnce([])

      const profile = await getUserSkillProfile(mockUserId)

      expect(profile.overallAccuracy).toBe(0)
      expect(profile.totalAnswered).toBe(0)
    })

    it('should call aggregate twice (once for topics, once for totals)', async () => {
      UserAnswer.aggregate.mockResolvedValueOnce([])
      UserAnswer.aggregate.mockResolvedValueOnce([])

      await getUserSkillProfile(mockUserId)

      expect(UserAnswer.aggregate).toHaveBeenCalledTimes(2)
    })
  })
})
