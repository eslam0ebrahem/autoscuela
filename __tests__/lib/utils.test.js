import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import mongoose from 'mongoose'
import {
  escapeRegex,
  isValidObjectId,
  clamp,
  parsePositiveInt,
  checkRateLimit,
} from '@/lib/utils'

describe('lib/utils', () => {
  describe('escapeRegex', () => {
    it('should escape regex special characters', () => {
      const input = 'hello.world+test?'
      const result = escapeRegex(input)
      expect(result).toBe('hello\\.world\\+test\\?')
    })

    it('should handle empty string', () => {
      const result = escapeRegex('')
      expect(result).toBe('')
    })

    it('should escape all special regex characters', () => {
      const input = '.*+?^${}()|[]\\'
      const result = escapeRegex(input)
      expect(result).toMatch(/^[\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\]+$/)
    })

    it('should preserve normal characters', () => {
      const input = 'abcABC123'
      const result = escapeRegex(input)
      expect(result).toBe('abcABC123')
    })
  })

  describe('isValidObjectId', () => {
    it('should return true for valid ObjectId', () => {
      const validId = new mongoose.Types.ObjectId().toString()
      expect(isValidObjectId(validId)).toBe(true)
    })

    it('should return false for invalid ObjectId', () => {
      expect(isValidObjectId('not-a-valid-id')).toBe(false)
    })

    it('should return false for empty string', () => {
      expect(isValidObjectId('')).toBe(false)
    })

    it('should handle ObjectId objects', () => {
      const objectId = new mongoose.Types.ObjectId()
      expect(isValidObjectId(objectId)).toBe(true)
    })
  })

  describe('clamp', () => {
    it('should return value if within range', () => {
      expect(clamp(5, 0, 10)).toBe(5)
    })

    it('should return min if value is below range', () => {
      expect(clamp(-5, 0, 10)).toBe(0)
    })

    it('should return max if value is above range', () => {
      expect(clamp(15, 0, 10)).toBe(10)
    })

    it('should work with negative ranges', () => {
      expect(clamp(-5, -10, -1)).toBe(-5)
      expect(clamp(-15, -10, -1)).toBe(-10)
      expect(clamp(5, -10, -1)).toBe(-1)
    })

    it('should work with decimal values', () => {
      expect(clamp(5.5, 0, 10)).toBe(5.5)
      expect(clamp(10.1, 0, 10)).toBe(10)
    })
  })

  describe('parsePositiveInt', () => {
    it('should parse valid positive integer string', () => {
      expect(parsePositiveInt('42')).toBe(42)
    })

    it('should return default for NaN', () => {
      expect(parsePositiveInt('not-a-number')).toBe(1)
    })

    it('should return default for negative numbers', () => {
      expect(parsePositiveInt('-5')).toBe(1)
    })

    it('should return default for zero', () => {
      expect(parsePositiveInt('0')).toBe(1)
    })

    it('should use provided default value', () => {
      expect(parsePositiveInt('invalid', 99)).toBe(99)
      expect(parsePositiveInt('-1', 50)).toBe(50)
    })

    it('should handle decimal strings', () => {
      expect(parsePositiveInt('3.9')).toBe(3)
      expect(parsePositiveInt('5.1')).toBe(5)
    })

    it('should handle empty string', () => {
      expect(parsePositiveInt('')).toBe(1)
    })
  })

  describe('checkRateLimit', () => {
    beforeEach(() => {
      // Clear rate limit store between tests
      vi.clearAllMocks()
    })

    it('should allow first request', () => {
      const result = checkRateLimit('user-123', 10, 60000)
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(9)
    })

    it('should block when exceeding max requests', () => {
      const key = 'user-456'
      // Make requests up to the limit
      for (let i = 0; i < 10; i++) {
        checkRateLimit(key, 10, 60000)
      }
      // Next request should be blocked
      const result = checkRateLimit(key, 10, 60000)
      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
      expect(result.retryAfter).toBeDefined()
    })

    it('should track remaining requests', () => {
      const key = 'user-789'
      const r1 = checkRateLimit(key, 5, 60000)
      expect(r1.remaining).toBe(4)

      const r2 = checkRateLimit(key, 5, 60000)
      expect(r2.remaining).toBe(3)

      const r3 = checkRateLimit(key, 5, 60000)
      expect(r3.remaining).toBe(2)
    })

    it('should reset counter after window expires', async () => {
      const key = 'user-reset-test'
      const windowMs = 100 // 100ms window for faster testing

      const r1 = checkRateLimit(key, 2, windowMs)
      expect(r1.allowed).toBe(true)

      const r2 = checkRateLimit(key, 2, windowMs)
      expect(r2.allowed).toBe(true)

      const r3 = checkRateLimit(key, 2, windowMs)
      expect(r3.allowed).toBe(false)

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 150))

      const r4 = checkRateLimit(key, 2, windowMs)
      expect(r4.allowed).toBe(true)
      expect(r4.remaining).toBe(1)
    })

    it('should use default maxRequests of 10', () => {
      const key = 'user-defaults'
      let lastResult
      for (let i = 0; i < 10; i++) {
        lastResult = checkRateLimit(key)
      }
      expect(lastResult.allowed).toBe(true)

      const blocked = checkRateLimit(key)
      expect(blocked.allowed).toBe(false)
    })

    it('should use different keys independently', () => {
      const r1 = checkRateLimit('user-1', 2, 60000)
      expect(r1.allowed).toBe(true)

      const r2 = checkRateLimit('user-1', 2, 60000)
      expect(r2.allowed).toBe(true)

      const r3 = checkRateLimit('user-1', 2, 60000)
      expect(r3.allowed).toBe(false)

      // Different key should not be affected
      const r4 = checkRateLimit('user-2', 2, 60000)
      expect(r4.allowed).toBe(true)
    })
  })
})
