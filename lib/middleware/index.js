/**
 * Vialia Middleware Pipeline
 *
 * Composable middleware for Next.js App Router API routes.
 * Eliminates repetitive boilerplate (auth, CSRF, rate-limit, validation, DB)
 * by providing a functional composition pattern.
 *
 * @example
 * ```js
 * import { compose, withAuth, withDB, withCSRF, withRateLimit, withBody } from '@/lib/middleware'
 *
 * // Simple authenticated GET
 * export const GET = compose(
 *   withAuth(),
 *   withDB(),
 *   async (request, ctx) => {
 *     // ctx.user is available
 *     return NextResponse.json({ data: 'ok' })
 *   }
 * )
 *
 * // POST with full pipeline
 * export const POST = compose(
 *   withCSRF(),
 *   withAuth(),
 *   withRateLimit({ key: 'bookmarks', max: 20, windowMs: 60000 }),
 *   withBody(BookmarkToggleSchema),
 *   withDB(),
 *   async (request, ctx) => {
 *     const { questionId } = ctx.body
 *     // ctx.user, ctx.body are available
 *     return NextResponse.json({ success: true })
 *   }
 * )
 *
 * // Admin-only route
 * export const DELETE = compose(
 *   withCSRF(),
 *   withAuth({ role: 'admin' }),
 *   withDB(),
 *   async (request, ctx) => { ... }
 * )
 * ```
 */

export { compose } from './compose'
export { withAuth } from './withAuth'
export { withDB } from './withDB'
export { withCSRF } from './withCSRF'
export { withRateLimit } from './withRateLimit'
export { withBody, withQuery } from './withValidation'
