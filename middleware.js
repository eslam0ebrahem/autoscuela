import { NextResponse } from 'next/server'

// Routes that require authentication
const PROTECTED_PREFIXES = [
  '/dashboard',
  '/exam',
  '/stats',
  '/leaderboard',
  '/badges',
  '/mistakes',
  '/ai-insights',
  '/study-plan',
  '/settings',
  '/question',
]

// Admin-only routes
const ADMIN_PREFIXES = ['/admin']

// Routes only accessible when NOT authenticated (redirect to dashboard if logged in)
const AUTH_ONLY_PATHS = ['/auth/login', '/auth/register']

export function middleware(request) {
  const { pathname } = request.nextUrl

  // Check for the auth cookie (presence only — full JWT verification happens in API routes)
  const token = request.cookies.get('vialia_token')?.value
  const isAuthenticated = Boolean(token)

  // ── Redirect authenticated users away from auth pages ─────────────────
  if (isAuthenticated && AUTH_ONLY_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // ── Protect authenticated routes ───────────────────────────────────────
  if (PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    if (!isAuthenticated) {
      const loginUrl = new URL('/auth/login', request.url)
      loginUrl.searchParams.set('from', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  // ── Protect admin routes ───────────────────────────────────────────────
  // Note: role validation still happens server-side in API routes.
  // This is a first-pass gate to avoid leaking admin UI to non-admins.
  if (ADMIN_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  // Match all routes except static files, images, and Next.js internals
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon-|apple-icon|manifest|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff|woff2|ttf|eot|css|js)$).*)',
  ],
}
