import { describe, test, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

// ── Mocks ────────────────────────────────────────────────────────────────────
vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  default: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/csrf', () => ({
  checkCSRF: vi.fn(),
}))

vi.mock('@/lib/utils', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 9 }),
}))

vi.mock('@/lib/schemas', () => ({
  parseSchema: vi.fn((schema, data) => ({ data, error: null })),
  parseQueryParams: vi.fn((request, schema) => ({ data: {}, error: null })),
}))

import { getCurrentUser } from '@/lib/auth'
import connectDB from '@/lib/db'
import { checkCSRF } from '@/lib/csrf'
import { checkRateLimit } from '@/lib/utils'
import { parseSchema } from '@/lib/schemas'
import { compose } from '@/lib/middleware/compose'
import { withAuth } from '@/lib/middleware/withAuth'
import { withDB } from '@/lib/middleware/withDB'
import { withCSRF } from '@/lib/middleware/withCSRF'
import { withRateLimit } from '@/lib/middleware/withRateLimit'
import { withBody } from '@/lib/middleware/withValidation'

// ── Helpers ──────────────────────────────────────────────────────────────────
function makeRequest(method = 'GET', body = null) {
  return {
    method,
    url: 'http://localhost:3000/api/test',
    headers: new Map([['x-forwarded-for', '127.0.0.1']]),
    json: body ? () => Promise.resolve(body) : () => Promise.reject(new Error('no body')),
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────
describe('Middleware Pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // compose()
  // ═══════════════════════════════════════════════════════════════════════════
  describe('compose()', () => {
    test('should call handler directly with no middleware', async () => {
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }))
      const composed = compose(handler)
      const req = makeRequest()

      const res = await composed(req)
      const data = await res.json()

      expect(handler).toHaveBeenCalledOnce()
      expect(data.ok).toBe(true)
    })

    test('should pass context through middleware chain', async () => {
      const mw1 = async (_req, ctx) => { ctx.step1 = true }
      const mw2 = async (_req, ctx) => { ctx.step2 = true }
      const handler = vi.fn(async (_req, ctx) => {
        return NextResponse.json({ step1: ctx.step1, step2: ctx.step2 })
      })

      const composed = compose(mw1, mw2, handler)
      const res = await composed(makeRequest())
      const data = await res.json()

      expect(data.step1).toBe(true)
      expect(data.step2).toBe(true)
    })

    test('should short-circuit when middleware returns a Response', async () => {
      const mw1 = async () => NextResponse.json({ error: 'blocked' }, { status: 403 })
      const handler = vi.fn()

      const composed = compose(mw1, handler)
      const res = await composed(makeRequest())

      expect(res.status).toBe(403)
      expect(handler).not.toHaveBeenCalled()
    })

    test('should catch unhandled errors and return 500', async () => {
      const handler = async () => { throw new Error('boom') }
      const composed = compose(handler)
      const res = await composed(makeRequest())

      expect(res.status).toBe(500)
    })

    test('should throw if called with no arguments', () => {
      expect(() => compose()).toThrow('compose() requires at least one function')
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // withAuth()
  // ═══════════════════════════════════════════════════════════════════════════
  describe('withAuth()', () => {
    test('should inject ctx.user on valid token', async () => {
      getCurrentUser.mockResolvedValue({ userId: 'u1', role: 'user' })

      const handler = vi.fn(async (_req, ctx) => NextResponse.json({ user: ctx.user }))
      const composed = compose(withAuth(), handler)
      const res = await composed(makeRequest())
      const data = await res.json()

      expect(data.user.userId).toBe('u1')
    })

    test('should return 401 when no token', async () => {
      getCurrentUser.mockResolvedValue(null)

      const handler = vi.fn()
      const composed = compose(withAuth(), handler)
      const res = await composed(makeRequest())

      expect(res.status).toBe(401)
      expect(handler).not.toHaveBeenCalled()
    })

    test('should allow optional auth with null user', async () => {
      getCurrentUser.mockResolvedValue(null)

      const handler = vi.fn(async (_req, ctx) => NextResponse.json({ user: ctx.user }))
      const composed = compose(withAuth({ optional: true }), handler)
      const res = await composed(makeRequest())
      const data = await res.json()

      expect(data.user).toBeNull()
      expect(handler).toHaveBeenCalledOnce()
    })

    test('should return 403 for wrong role', async () => {
      getCurrentUser.mockResolvedValue({ userId: 'u1', role: 'user' })

      const handler = vi.fn()
      const composed = compose(withAuth({ role: 'admin' }), handler)
      const res = await composed(makeRequest())

      expect(res.status).toBe(403)
      expect(handler).not.toHaveBeenCalled()
    })

    test('should allow correct role', async () => {
      getCurrentUser.mockResolvedValue({ userId: 'u1', role: 'admin' })

      const handler = vi.fn(async () => NextResponse.json({ ok: true }))
      const composed = compose(withAuth({ role: 'admin' }), handler)
      const res = await composed(makeRequest())

      expect(res.status).toBe(200)
      expect(handler).toHaveBeenCalledOnce()
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // withDB()
  // ═══════════════════════════════════════════════════════════════════════════
  describe('withDB()', () => {
    test('should call connectDB', async () => {
      const handler = vi.fn(async () => NextResponse.json({ ok: true }))
      const composed = compose(withDB(), handler)
      await composed(makeRequest())

      expect(connectDB).toHaveBeenCalledOnce()
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // withCSRF()
  // ═══════════════════════════════════════════════════════════════════════════
  describe('withCSRF()', () => {
    test('should pass when CSRF is valid', async () => {
      checkCSRF.mockReturnValue(null)

      const handler = vi.fn(async () => NextResponse.json({ ok: true }))
      const composed = compose(withCSRF(), handler)
      const res = await composed(makeRequest('POST'))

      expect(res.status).toBe(200)
      expect(handler).toHaveBeenCalledOnce()
    })

    test('should block when CSRF fails', async () => {
      checkCSRF.mockReturnValue({ error: 'CSRF validation failed', status: 403 })

      const handler = vi.fn()
      const composed = compose(withCSRF(), handler)
      const res = await composed(makeRequest('POST'))

      expect(res.status).toBe(403)
      expect(handler).not.toHaveBeenCalled()
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // withRateLimit()
  // ═══════════════════════════════════════════════════════════════════════════
  describe('withRateLimit()', () => {
    test('should pass when under limit', async () => {
      getCurrentUser.mockResolvedValue({ userId: 'u1', role: 'user' })
      checkRateLimit.mockResolvedValue({ allowed: true, remaining: 5 })

      const handler = vi.fn(async () => NextResponse.json({ ok: true }))
      const composed = compose(
        withAuth(),
        withRateLimit({ key: 'test', max: 10, windowMs: 60000 }),
        handler
      )
      const res = await composed(makeRequest())

      expect(res.status).toBe(200)
    })

    test('should return 429 when rate limited', async () => {
      getCurrentUser.mockResolvedValue({ userId: 'u1', role: 'user' })
      checkRateLimit.mockResolvedValue({ allowed: false, retryAfter: 30 })

      const handler = vi.fn()
      const composed = compose(
        withAuth(),
        withRateLimit({ key: 'test', max: 10 }),
        handler
      )
      const res = await composed(makeRequest())

      expect(res.status).toBe(429)
      expect(handler).not.toHaveBeenCalled()
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // withBody()
  // ═══════════════════════════════════════════════════════════════════════════
  describe('withBody()', () => {
    test('should inject ctx.body with validated data', async () => {
      const schema = {} // Mock schema — parseSchema is mocked
      parseSchema.mockReturnValue({ data: { name: 'test' }, error: null })

      const handler = vi.fn(async (_req, ctx) => NextResponse.json({ body: ctx.body }))
      const composed = compose(withBody(schema), handler)
      const res = await composed(makeRequest('POST', { name: 'test' }))
      const data = await res.json()

      expect(data.body.name).toBe('test')
    })

    test('should return 400 for invalid JSON', async () => {
      const handler = vi.fn()
      const composed = compose(withBody({}), handler)
      const res = await composed(makeRequest('POST')) // no body → json() rejects

      expect(res.status).toBe(400)
      expect(handler).not.toHaveBeenCalled()
    })

    test('should return validation error', async () => {
      parseSchema.mockReturnValue({ data: null, error: { status: 400, messages: ['bad'] } })

      const handler = vi.fn()
      const composed = compose(
        withBody({}),
        handler
      )
      const res = await composed(makeRequest('POST', { bad: 'data' }))

      expect(res.status).toBe(400)
      expect(handler).not.toHaveBeenCalled()
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // Full pipeline integration
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Full pipeline', () => {
    test('typical POST pipeline: CSRF → Auth → RateLimit → Body → DB → Handler', async () => {
      checkCSRF.mockReturnValue(null)
      getCurrentUser.mockResolvedValue({ userId: 'u1', role: 'user' })
      checkRateLimit.mockResolvedValue({ allowed: true, remaining: 9 })
      parseSchema.mockReturnValue({ data: { questionId: 'q1' }, error: null })

      const handler = vi.fn(async (_req, ctx) => {
        return NextResponse.json({
          user: ctx.user.userId,
          body: ctx.body.questionId,
        })
      })

      const composed = compose(
        withCSRF(),
        withAuth(),
        withRateLimit({ key: 'bookmark', max: 20 }),
        withBody({}),
        withDB(),
        handler
      )

      const res = await composed(makeRequest('POST', { questionId: 'q1' }))
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.user).toBe('u1')
      expect(data.body).toBe('q1')
      expect(connectDB).toHaveBeenCalledOnce()
    })
  })
})
