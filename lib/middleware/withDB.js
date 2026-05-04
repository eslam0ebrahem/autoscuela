import connectDB from '@/lib/db'

/**
 * Database connection middleware.
 * Ensures MongoDB is connected before the handler runs.
 * This is a thin wrapper but removes `await connectDB()` boilerplate.
 *
 * @example
 * compose(withAuth(), withDB(), handler)
 */
export function withDB() {
  return async function dbMiddleware(_request, _ctx) {
    await connectDB()
  }
}
