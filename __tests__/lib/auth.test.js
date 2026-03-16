import { describe, it, expect, beforeEach, vi } from 'vitest'
import jwt from 'jsonwebtoken'
import { signToken, verifyToken, getTokenFromRequest, getCurrentUser } from '@/lib/auth'

describe('lib/auth', () => {
  const testPayload = { userId: '123', email: 'test@example.com' }

  describe('signToken', () => {
    it('should sign a token with valid payload', () => {
      const token = signToken(testPayload)
      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
    })

    it('should create a valid JWT token', () => {
      const token = signToken(testPayload)
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      expect(decoded.userId).toBe('123')
      expect(decoded.email).toBe('test@example.com')
    })

    it('should include expiration in token', () => {
      const token = signToken(testPayload)
      const decoded = jwt.decode(token)
      expect(decoded.exp).toBeDefined()
      expect(decoded.iat).toBeDefined()
    })
  })

  describe('verifyToken', () => {
    it('should verify a valid token', () => {
      const token = signToken(testPayload)
      const decoded = verifyToken(token)
      expect(decoded).toBeDefined()
      expect(decoded.userId).toBe('123')
      expect(decoded.email).toBe('test@example.com')
    })

    it('should return null for invalid token', () => {
      const result = verifyToken('invalid.token.here')
      expect(result).toBeNull()
    })

    it('should return null for expired token', () => {
      // Create an expired token (signed 1 hour in the past with 0 expiry)
      const expiredToken = jwt.sign(testPayload, process.env.JWT_SECRET, { expiresIn: '-1h' })
      const result = verifyToken(expiredToken)
      expect(result).toBeNull()
    })

    it('should return null for tampered token', () => {
      const token = signToken(testPayload)
      const tamperedToken = token.slice(0, -5) + 'XXXXX'
      const result = verifyToken(tamperedToken)
      expect(result).toBeNull()
    })
  })

  describe('getTokenFromRequest', () => {
    it('should extract token from cookie', () => {
      const mockRequest = {
        cookies: {
          get: vi.fn(() => ({ value: 'cookie-token' })),
        },
        headers: {
          get: vi.fn(() => null),
        },
      }

      const token = getTokenFromRequest(mockRequest)
      expect(token).toBe('cookie-token')
      expect(mockRequest.cookies.get).toHaveBeenCalledWith('vialia_token')
    })

    it('should extract token from Authorization header', () => {
      const mockRequest = {
        cookies: {
          get: vi.fn(() => null),
        },
        headers: {
          get: vi.fn((name) => {
            if (name === 'authorization') return 'Bearer header-token'
            return null
          }),
        },
      }

      const token = getTokenFromRequest(mockRequest)
      expect(token).toBe('header-token')
    })

    it('should prefer cookie over Authorization header', () => {
      const mockRequest = {
        cookies: {
          get: vi.fn(() => ({ value: 'cookie-token' })),
        },
        headers: {
          get: vi.fn(() => 'Bearer header-token'),
        },
      }

      const token = getTokenFromRequest(mockRequest)
      expect(token).toBe('cookie-token')
    })

    it('should return null when no token is present', () => {
      const mockRequest = {
        cookies: {
          get: vi.fn(() => null),
        },
        headers: {
          get: vi.fn(() => null),
        },
      }

      const token = getTokenFromRequest(mockRequest)
      expect(token).toBeNull()
    })

    it('should handle malformed Authorization header', () => {
      const mockRequest = {
        cookies: {
          get: vi.fn(() => null),
        },
        headers: {
          get: vi.fn(() => 'InvalidFormat token'),
        },
      }

      const token = getTokenFromRequest(mockRequest)
      expect(token).toBeNull()
    })
  })

  describe('getCurrentUser', () => {
    it('should return null when no token is present', async () => {
      const mockRequest = {
        cookies: {
          get: vi.fn(() => null),
        },
        headers: {
          get: vi.fn(() => null),
        },
      }

      const user = await getCurrentUser(mockRequest)
      expect(user).toBeNull()
    })

    it('should return user data for valid token', async () => {
      const token = signToken(testPayload)
      const mockRequest = {
        cookies: {
          get: vi.fn(() => ({ value: token })),
        },
        headers: {
          get: vi.fn(() => null),
        },
      }

      const user = await getCurrentUser(mockRequest)
      expect(user).toBeDefined()
      expect(user.userId).toBe('123')
      expect(user.email).toBe('test@example.com')
    })

    it('should return null for invalid token', async () => {
      const mockRequest = {
        cookies: {
          get: vi.fn(() => ({ value: 'invalid-token' })),
        },
        headers: {
          get: vi.fn(() => null),
        },
      }

      const user = await getCurrentUser(mockRequest)
      expect(user).toBeNull()
    })
  })
})
