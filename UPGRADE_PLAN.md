# Vialia — Comprehensive Codebase Audit & Upgrade Plan

**Date:** 2026-03-16
**Scope:** Full codebase analysis — architecture, security, UI/UX, performance, testing, and tech debt

---

## 1. Executive Summary

**Vialia** is an AI-powered Spanish DGT driving exam preparation platform. It offers exam simulation, spaced-repetition flashcards, adaptive question selection, gamification (XP, streaks, badges, leaderboard), AI coaching via Groq, and Stripe-based premium subscriptions — all in a bilingual (ES/EN) interface.

### Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.1.6 |
| UI | React | 19.2.4 |
| Styling | Tailwind CSS | 4.2.1 |
| Database | MongoDB (Mongoose ODM) | 9.3.0 |
| Auth | JWT + bcryptjs | 9.0.2 / 2.4.3 |
| AI | Groq SDK | 1.1.1 |
| Payments | Stripe | 20.4.1 |
| Icons | Ant Design Icons | 6.1.0 |
| Charts | Recharts | 3.8.0 |

### Codebase at a Glance

- **~90 source files** across `app/`, `components/`, `lib/`, `models/`, `scripts/`
- **42 API endpoints** across 9 domains (auth, exams, AI, gamification, billing, stats, bookmarks, mistakes, flashcards)
- **14+ pages/routes**, 7 core components, 6 Mongoose models
- **0% test coverage** — no test framework configured
- **JavaScript only** — no TypeScript

### Overall Health: **B-** (Functional but needs hardening)

The application is feature-rich and well-structured at a high level, but has **critical security gaps** (exposed credentials, weak JWT fallback, missing rate limiting), **zero automated testing**, and **frontend code duplication** that will compound as the app scales.

---

## 2. Issue Log

### 2.1 CRITICAL — Security & Data Exposure

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| C1 | **Real API credentials committed to git** — MongoDB URI with password and Groq API key are in `.env.local` which appears in git history | `.env.local` | Full infrastructure compromise; credentials must be rotated immediately |
| C2 | **Hardcoded JWT secret fallback** — falls back to `'vialia-dev-secret-change-in-production'` if env var missing | `lib/auth.js:4` | Token forgery if deployed without proper env setup |
| C3 | **No rate limiting on 90% of endpoints** — only auth/register and auth/login are rate-limited | All POST/PATCH/DELETE routes except auth | API abuse, Groq bill explosion, DB DoS |
| C4 | **XSS risk via raw HTML** — `help_html` stored as raw HTML in Question model and returned to client | `models/Question.js:21-24`, answer/question API routes | Stored XSS if malicious HTML injected via admin question import |
| C5 | **MongoDB connection string logged to console** | `lib/db.js:26` | Credential leak in production logs |

### 2.2 HIGH — Architecture & Logic

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| H1 | **Zero test coverage** — no test framework, no test files, no CI test step | Project-wide | Cannot verify correctness; high regression risk on every change |
| H2 | **No input validation library** — manual validation is inconsistent; `source` param unvalidated, `time_taken` unvalidated, bookmark `questionId` format unchecked | `api/exams/generate`, `api/exams/answer`, `api/bookmarks` | Invalid data in DB, potential crashes |
| H3 | **No CSRF protection** — cookie-based auth without CSRF tokens on state-changing endpoints | All POST/PATCH/DELETE routes | Cross-site request forgery attacks |
| H4 | **No audit logging for admin actions** — admin can grant premium, change roles with no record | `api/admin/users/[id]/route.js` | No accountability, compliance risk |
| H5 | **No email verification** — any email accepted at registration without confirmation | `api/auth/register` | Account impersonation, spam accounts |
| H6 | **No token revocation mechanism** — JWT valid for 30 days with no way to invalidate | `lib/auth.js` | Stolen tokens cannot be revoked |
| H7 | **Weak RBAC** — only 2 roles (user/admin) with no fine-grained permissions | `api/admin/*` | Admin is all-or-nothing; no principle of least privilege |
| H8 | **Overly permissive image domain** — `hostname: '**'` allows loading images from any HTTPS domain | `next.config.js:10-12` | Referrer leaks, malicious image loading |

### 2.3 MEDIUM — Performance & Data Flow

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| M1 | **No caching on skill profile calculation** — full aggregation of all user answers on every exam generate/submit | `lib/user-skill.js` | 1-5s latency for active users |
| M2 | **No pagination on bookmarks** — `.populate()` loads all bookmarked questions at once | `api/bookmarks/route.js` | Memory spike for heavy users |
| M3 | **Multiple DB round-trips per request** — mistakes endpoint does 3 separate queries; adaptive selection does 2 aggregations | `api/mistakes`, `lib/adaptive-selection.js` | Unnecessary latency |
| M4 | **Fire-and-forget AI calls fail silently** — if Groq is down, user never gets tips/coaching but exam is marked complete | `api/exams/generate`, `api/exams/submit` | Degraded UX with no user awareness |
| M5 | **Race condition in answer submission** — duplicate check is in-memory before DB write; concurrent requests could bypass | `api/exams/[sessionId]/answer` | Duplicate UserAnswer records (mitigated by unique index) |
| M6 | **No request body size limits** — no Content-Length or payload size validation | All API routes | Memory exhaustion via large payloads |
| M7 | **No abort signals on frontend fetches** — no request cancellation on unmount or rapid clicks | Dashboard, exam pages | Memory leaks, wasted network requests |
| M8 | **Leaderboard countDocuments for rank** — scans users with higher XP every time | `api/gamification/leaderboard` | Slow at scale |

### 2.4 UI/UX Deficiencies

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| U1 | **Zero `React.memo()` usage** — no component memoization despite 180+ `useCallback` calls | Project-wide | Unnecessary re-renders |
| U2 | **Navbar code duplicated 3-4×** — desktop nav, mobile nav, mobile menu, theme toggle all copy-pasted | `components/Navbar.js` (534 lines) | Maintenance burden, inconsistency risk |
| U3 | **No shared form input component** — login, register, settings all duplicate input markup | Auth pages, settings page | Styling drift, repeated a11y fixes |
| U4 | **Missing a11y attributes** — no `aria-expanded` on dropdowns, no `aria-current="page"` on nav, no `aria-label` on icon buttons, no skip-to-content link, no focus trap on mobile menu | `Navbar.js`, auth pages | Screen reader / keyboard users excluded |
| U5 | **No retry mechanism for failed API calls** — errors show toast but no "Retry" button | Dashboard, all data-fetching pages | Dead-end error states |
| U6 | **No offline detection** — app assumes connectivity | Project-wide | Silent failures when offline |
| U7 | **Inconsistent border radius** — mixed `rounded-lg`, `rounded-xl`, `rounded-2xl`, `rounded-3xl` | Various components | Visual inconsistency |
| U8 | **Admin tables not responsive** — no horizontal scroll or collapse strategy for mobile | `admin/users/page.js`, `admin/questions/page.js` | Unusable on mobile |
| U9 | **No form validation library** — no Zod/Yup; only HTML5 `type="email"` and manual length checks | Auth pages | Weak client-side validation, no real-time feedback |
| U10 | **Error messages mix languages** — some errors in English regardless of user language setting | Various API routes | Jarring bilingual UX |

### 2.5 Tech Debt & Developer Experience

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| D1 | **No TypeScript** — entire codebase is plain JavaScript with `jsconfig.json` | Project-wide | No compile-time type safety |
| D2 | **No ESLint/Prettier config** — only Next.js default lint; no formatting enforcement | Project root | Inconsistent code style |
| D3 | **No git hooks (Husky/lint-staged)** — nothing prevents committing bad code | Project root | Quality regressions |
| D4 | **5 `console.log` statements in production code** | `lib/db.js`, `lib/keep-alive.js`, `api/exams/generate`, `check_db.js` | Log noise, info disclosure |
| D5 | **`check_db.js` utility script still in repo** — development artifact | Project root | Clutter |
| D6 | **No structured logging** — uses `console.error` everywhere instead of a logger with levels | All API routes | No log aggregation, no severity filtering |
| D7 | **Stripe price ID not validated at startup** — silent failure if env var missing | `api/billing/checkout` | Cryptic checkout errors |
| D8 | **Missing env var validation at startup** — no fail-fast for required env vars | `lib/auth.js`, `lib/db.js`, `lib/stripe.js` | Runtime crashes instead of boot-time errors |

---

## 3. Step-by-Step Upgrade Roadmap

Ordered by **Highest Impact / Lowest Effort** first within each phase.

---

### Phase 0: Emergency Security Fixes ⏱️ ~2 hours

> These items represent active security risks and should be addressed before any other work.

| Step | Task | Files | Effort |
|------|------|-------|--------|
| 0.1 | **Rotate all exposed credentials** — change MongoDB password, regenerate Groq API key, update Stripe keys. Scrub git history with `git filter-repo` or `BFG Repo Cleaner` | `.env.local`, git history | 30 min |
| 0.2 | **Make JWT_SECRET required** — remove fallback string; throw on missing env var | `lib/auth.js:4` | 5 min |
| 0.3 | **Add startup env validation** — fail fast if `MONGODB_URI`, `JWT_SECRET`, `GROQ_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID` are missing | New: `lib/env.js`, import in `lib/db.js`, `lib/auth.js`, `lib/stripe.js` | 20 min |
| 0.4 | **Remove `console.log` of MongoDB URI** and other debug logs | `lib/db.js:26`, `lib/keep-alive.js:18,32`, `api/exams/generate:123` | 10 min |
| 0.5 | **Restrict image domains** in `next.config.js` — replace `hostname: '**'` with specific CDN domains | `next.config.js` | 5 min |
| 0.6 | **Remove `check_db.js`** from tracked files | `check_db.js` | 2 min |

**Verification:** All env vars validated at boot; no secrets in logs; git history scrubbed.

---

### Phase 1: Input Validation & Rate Limiting ⏱️ ~4 hours

| Step | Task | Files | Effort |
|------|------|-------|--------|
| 1.1 | **Install Zod** for schema validation | `package.json` | 5 min |
| 1.2 | **Add Zod schemas for all API inputs** — validate request bodies, query params, and URL params. Priority: exam generate, answer submission, bookmarks, admin routes | All `api/*/route.js` files | 2 hr |
| 1.3 | **Apply rate limiting to all state-changing endpoints** — use existing `checkRateLimit()` utility | All POST/PATCH/DELETE routes, especially `api/ai/*` (expensive Groq calls) | 1 hr |
| 1.4 | **Add request body size limits** — use Next.js route segment config `export const maxDuration` and body size config | `next.config.js` or per-route config | 30 min |
| 1.5 | **Sanitize `help_html` server-side** before returning to client — use DOMPurify on the server or strip HTML tags | `api/exams/[sessionId]/answer`, `api/questions/[id]` | 30 min |

**Verification:** Send malformed payloads to each endpoint → get 400 errors. Hit rate limits → get 429. Send oversized payloads → rejected.

---

### Phase 2: Testing Infrastructure ⏱️ ~6 hours

| Step | Task | Files | Effort |
|------|------|-------|--------|
| 2.1 | **Install Vitest + testing-library** — configure with jsconfig paths | `package.json`, new `vitest.config.js` | 30 min |
| 2.2 | **Write unit tests for core utilities** — `lib/auth.js`, `lib/gamification.js`, `lib/adaptive-selection.js`, `lib/user-skill.js`, `lib/utils.js` | New `__tests__/lib/*.test.js` files | 2 hr |
| 2.3 | **Write API route integration tests** — auth register/login, exam generate/answer/submit, bookmarks CRUD | New `__tests__/api/*.test.js` files | 2 hr |
| 2.4 | **Add test script to package.json** — `"test": "vitest run"`, `"test:watch": "vitest"` | `package.json` | 5 min |
| 2.5 | **Add test coverage threshold** — configure minimum 60% coverage, increasing to 80% over time | `vitest.config.js` | 15 min |
| 2.6 | **Install Husky + lint-staged** — run lint + test on pre-commit | `package.json`, new `.husky/pre-commit` | 30 min |

**Verification:** `npm test` passes; coverage report generated; pre-commit hook blocks bad code.

---

### Phase 3: Auth Hardening ⏱️ ~4 hours

| Step | Task | Files | Effort |
|------|------|-------|--------|
| 3.1 | **Implement CSRF protection** — add custom CSRF header check (`X-Requested-With`) on all state-changing API routes | New middleware or per-route check | 1 hr |
| 3.2 | **Add token refresh mechanism** — short-lived access token (15 min) + longer refresh token (7 days) | `lib/auth.js`, `api/auth/refresh/route.js`, `components/AuthContext.js` | 2 hr |
| 3.3 | **Implement token blacklist** — store invalidated tokens in a lightweight in-memory or MongoDB collection with TTL index | New `models/TokenBlacklist.js`, update `lib/auth.js` | 1 hr |
| 3.4 | **Add email verification flow** — send verification email on register; require verification before full access | `api/auth/register`, new `api/auth/verify`, `lib/email.js` (nodemailer already installed) | 2 hr |

**Verification:** Logout invalidates token; refresh token rotates; unverified users are restricted; CSRF header required.

---

### Phase 4: Frontend Component Refactoring ⏱️ ~5 hours

| Step | Task | Files | Effort |
|------|------|-------|--------|
| 4.1 | **Extract reusable `<Input>` component** — with label, error state, a11y attributes built in | New `components/ui/Input.js`, update auth pages, settings | 1 hr |
| 4.2 | **Extract reusable `<Button>` component** — variants (primary, secondary, danger, ghost), loading state, disabled state | New `components/ui/Button.js`, update all pages | 1 hr |
| 4.3 | **Refactor Navbar** — extract `NavLink`, `ThemeToggle`, `UserMenu` sub-components; eliminate 3-4× duplication | `components/Navbar.js` → split into sub-components | 1.5 hr |
| 4.4 | **Add `React.memo()` to expensive components** — QuickActionCard, stat cards, leaderboard rows, exam option buttons | Dashboard, leaderboard, exam pages | 30 min |
| 4.5 | **Add AbortController to all fetch calls** — cancel on unmount, prevent double-submit | All pages with `useEffect` + `fetch` | 1 hr |
| 4.6 | **Extract loading spinner component** — replace 5+ duplicated spinner markups | New `components/ui/Spinner.js` | 15 min |

**Verification:** Navbar renders identically; no visual regressions; React DevTools shows fewer re-renders.

---

### Phase 5: Accessibility (a11y) ⏱️ ~3 hours

| Step | Task | Files | Effort |
|------|------|-------|--------|
| 5.1 | **Add skip-to-content link** | `app/layout.js` | 15 min |
| 5.2 | **Add `aria-expanded` to all dropdown triggers** | `components/Navbar.js` | 15 min |
| 5.3 | **Add `aria-current="page"` to active nav links** | `components/Navbar.js` | 15 min |
| 5.4 | **Add `aria-label` to all icon-only buttons** — theme toggle, password visibility, bookmark toggle | Navbar, auth pages, question page | 30 min |
| 5.5 | **Add focus trap to mobile menu overlay** | `components/Navbar.js` | 30 min |
| 5.6 | **Add `role="dialog"` and `aria-modal` to mobile menu** | `components/Navbar.js` | 15 min |
| 5.7 | **Ensure all question images have meaningful alt text** | Exam page, question page | 30 min |
| 5.8 | **Add proper error announcements** — `aria-live` regions for form errors | Auth pages, exam page | 30 min |

**Verification:** Run axe-core or Lighthouse accessibility audit; keyboard-only navigation works end-to-end.

---

### Phase 6: Performance Optimization ⏱️ ~4 hours

| Step | Task | Files | Effort |
|------|------|-------|--------|
| 6.1 | **Cache user skill profile** — store calculated profile in User document with TTL; recalculate only when stale | `lib/user-skill.js`, `models/User.js` | 1 hr |
| 6.2 | **Add pagination to bookmarks endpoint** — limit + offset with default 20 per page | `api/bookmarks/route.js` | 30 min |
| 6.3 | **Combine mistakes queries** — merge 3 DB round-trips into single aggregation pipeline | `api/mistakes/route.js` | 1 hr |
| 6.4 | **Pre-calculate leaderboard rank** — use a scheduled job or update rank on XP change | `api/gamification/leaderboard` | 1 hr |
| 6.5 | **Add graceful AI degradation** — show "AI features temporarily unavailable" instead of silent failure | `api/exams/generate`, `api/exams/submit`, frontend components | 30 min |

**Verification:** API response times measured before/after; bookmarks paginated; leaderboard loads in <200ms.

---

### Phase 7: Developer Experience & Code Quality ⏱️ ~3 hours

| Step | Task | Files | Effort |
|------|------|-------|--------|
| 7.1 | **Configure ESLint** — extend `next/core-web-vitals` + `eslint-plugin-jsx-a11y` | New `.eslintrc.json` | 30 min |
| 7.2 | **Configure Prettier** — consistent formatting | New `.prettierrc` | 15 min |
| 7.3 | **Add structured logging** — replace `console.error` with a lightweight logger (e.g., `pino`) with log levels | New `lib/logger.js`, update all API routes | 1.5 hr |
| 7.4 | **Add admin audit logging** — log all admin actions with who/what/when | New `models/AuditLog.js`, update `api/admin/*` | 1 hr |
| 7.5 | **Standardize error messages for i18n** — return error codes instead of English strings; let frontend translate | All API routes | 1 hr (incremental) |

**Verification:** `npm run lint` passes; Prettier formats all files; admin actions logged to DB.

---

### Phase 8: TypeScript Migration (Optional, Long-term) ⏱️ ~2-3 weeks incremental

| Step | Task | Effort |
|------|------|--------|
| 8.1 | **Rename `jsconfig.json` → `tsconfig.json`** with `allowJs: true`, `strict: false` initially | 30 min |
| 8.2 | **Migrate `lib/` files to `.ts`** — start with utilities, then auth, then DB | 1 week |
| 8.3 | **Migrate `models/` to `.ts`** — add Mongoose typed schemas | 2 days |
| 8.4 | **Migrate API routes to `.ts`** — type request/response bodies | 1 week |
| 8.5 | **Migrate components to `.tsx`** — type props and context | 3 days |
| 8.6 | **Enable `strict: true`** — fix remaining type errors | 2 days |

**Verification:** `tsc --noEmit` passes with zero errors; `strict: true` enabled.

---

## 4. Priority Matrix

```
                    HIGH IMPACT
                        │
     Phase 0 ●          │         ● Phase 2
   (Security)           │        (Testing)
                        │
  Phase 1 ●             │      ● Phase 3
  (Validation)          │     (Auth)
                        │
LOW EFFORT ─────────────┼──────────────── HIGH EFFORT
                        │
     Phase 5 ●          │         ● Phase 8
     (a11y)             │       (TypeScript)
                        │
  Phase 4 ●             │      ● Phase 7
  (Components)          │     (DX)
                        │
                    LOW IMPACT
```

**Recommended execution order:** 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → (8 optional)

---

## 5. Anti-Pattern Guards

When executing this plan, **DO NOT**:

- Introduce `any` types if migrating to TypeScript
- Add dependencies without checking bundle size impact
- Skip writing tests for new validation/auth code
- Use `--no-verify` to bypass git hooks
- Store secrets in code — always use environment variables
- Use `dangerouslySetInnerHTML` without DOMPurify sanitization
- Add `console.log` for debugging — use the structured logger
- Create God components — keep components under 200 lines

---

*Generated by comprehensive codebase analysis on 2026-03-16*
