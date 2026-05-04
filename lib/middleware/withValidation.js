import { NextResponse } from 'next/server'
import { parseSchema, parseQueryParams } from '@/lib/schemas'

/**
 * Body validation middleware for POST/PUT/PATCH requests.
 * Parses JSON body and validates it against the given Zod schema.
 * Injects `ctx.body` with the validated data.
 *
 * @param {import('zod').ZodSchema} schema - Zod schema to validate against
 *
 * @example
 * compose(
 *   withCSRF(),
 *   withAuth(),
 *   withBody(BookmarkToggleSchema),
 *   withDB(),
 *   async (req, ctx) => {
 *     const { questionId } = ctx.body
 *     ...
 *   }
 * )
 */
export function withBody(schema) {
  return async function bodyMiddleware(request, ctx) {
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { data, error } = parseSchema(schema, body)
    if (error) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.messages },
        { status: error.status }
      )
    }

    ctx.body = data
  }
}

/**
 * Query parameter validation middleware for GET requests.
 * Parses URL search params and validates against the given Zod schema.
 * Injects `ctx.query` with the validated data.
 *
 * @param {import('zod').ZodSchema} schema - Zod schema to validate against
 *
 * @example
 * compose(
 *   withAuth(),
 *   withQuery(BookmarkQuerySchema),
 *   withDB(),
 *   async (req, ctx) => {
 *     const { limit, offset } = ctx.query
 *     ...
 *   }
 * )
 */
export function withQuery(schema) {
  return async function queryMiddleware(request, ctx) {
    const { data, error } = parseQueryParams(request, schema)
    if (error) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.messages },
        { status: error.status }
      )
    }

    ctx.query = data
  }
}
