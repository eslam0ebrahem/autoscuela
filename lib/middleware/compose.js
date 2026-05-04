import { NextResponse } from 'next/server'

/**
 * Composes middleware functions into a single route handler.
 *
 * Each middleware receives (request, context) and can:
 * - Return a NextResponse to short-circuit (e.g. 401, 403, 429)
 * - Attach data to `context` for downstream middleware / handler
 * - Return undefined/null to continue to the next middleware
 *
 * The final function in the chain is the actual route handler which
 * receives (request, context) with all middleware-injected data.
 *
 * @example
 * ```js
 * import { compose } from '@/lib/middleware/compose'
 * import { withAuth } from '@/lib/middleware/withAuth'
 * import { withDB } from '@/lib/middleware/withDB'
 *
 * export const GET = compose(
 *   withAuth(),
 *   withDB(),
 *   async (request, ctx) => {
 *     // ctx.user is injected by withAuth
 *     return NextResponse.json({ userId: ctx.user.userId })
 *   }
 * )
 * ```
 */
export function compose(...fns) {
  if (fns.length === 0) {
    throw new Error('compose() requires at least one function')
  }

  const handler = fns[fns.length - 1]
  const middlewares = fns.slice(0, -1)

  return async function composedHandler(request, routeContext) {
    // Shared context object that accumulates data across middleware
    const ctx = { params: routeContext?.params || {} }

    // Resolve Next.js dynamic params (they're now async in Next.js 15+)
    if (ctx.params && typeof ctx.params.then === 'function') {
      ctx.params = await ctx.params
    }

    try {
      // Run each middleware in order
      for (const mw of middlewares) {
        const result = await mw(request, ctx)
        if (result instanceof NextResponse || result instanceof Response) {
          return result // Short-circuit: middleware returned a response
        }
      }

      // All middleware passed — run the handler
      return await handler(request, ctx)
    } catch (error) {
      console.error('[middleware/compose] Unhandled error:', error)
      return NextResponse.json(
        { error: 'Internal Server Error' },
        { status: 500 }
      )
    }
  }
}
