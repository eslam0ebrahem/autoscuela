# Vialia — Comprehensive Codebase Audit & Upgrade Plan (v2)

**Date:** 2026-03-19
**Scope:** Full codebase deep-audit — security, data integrity, performance, UI/UX, and accessibility
**Methodology:** 4 parallel subagent audits covering architecture, security, frontend, and data layer

---

## 1. Executive Summary

**Vialia** is an AI-powered Spanish DGT driving exam preparation platform built on Next.js 16.1.6 (React 19) with MongoDB/Mongoose, JWT auth, Groq AI, Stripe subscriptions, and Tailwind CSS 4. The app has strong foundational work — Zod validation, DOMPurify sanitization, token blacklisting, audit logging, error boundaries, and a bilingual interface. It is feature-rich with 57 API endpoints, 10 Mongoose models, an adaptive learning algorithm, gamification system, and flashcard engine.

**Overall Health: 7/10**
The core product is solid and production-ready at the feature level. However, several architectural gaps create correctness and security risks at scale: the absence of database transactions risks data corruption on exam submission, in-memory rate limiting is bypassable in multi-instance deployments, and token rotation remains disabled. These are addressable with moderate effort and would significantly improve production resilience.

---

## 2. Issue Log

### CRITICAL — Data Integrity & Security

| # | Category | File | Line | Issue |
|---|----------|------|------|-------|
| C1 | **Transactions** | `app/api/exams/[sessionId]/submit/route.js` | 115–172 | Exam submission performs 3+ non-atomic DB writes (session, user XP/badges, rank). If any step fails, user gets partial state: XP without badges, score without stats, etc. |
| C2 | **Transactions** | `app/api/exams/[sessionId]/answer/route.js` | 92–118 | `UserAnswer.create()` and `session.answers.push()` are two separate writes. If session save fails after UserAnswer succeeds, retry causes duplicate answer. |
| C3 | **Rate Limiting** | `lib/utils.js` | 25 | Rate limiter uses `new Map()` (in-memory). On multi-instance deployments (Render, Vercel), each server instance maintains independent state — users can trivially bypass limits. |
| C4 | **Auth** | `app/api/auth/refresh/route.js` | 65–84 | Token rotation is commented out. Stolen refresh tokens are valid for 7 days with no detection mechanism. The `rotateToken` statics method exists in the model — just not called. |
| C5 | **Auth** | `lib/auth.js` | 78 | `sameSite: 'lax'` allows cookies on top-level cross-site navigations. Combined with the CSRF implementation's weakness, state-changing requests could execute from attacker-controlled links. |

### HIGH — Security

| # | Category | File | Line | Issue |
|---|----------|------|-------|-------|
| H1 | **IP Spoofing** | `app/api/auth/login/route.js` | 40 | Rate limit key uses `X-Forwarded-For` without trusted-proxy validation. Attackers can spoof the header to rotate through rate limit buckets. |
| H2 | **CSP Headers** | `next.config.js` | — | No `Content-Security-Policy` response header configured. DOMPurify sanitizes stored HTML server-side, but a missing CSP means the browser provides no second line of defence. |
| H3 | **Admin Authz** | `app/api/admin/users/[id]/route.js` | 23–24 | Admin check is a single role comparison (`role !== 'admin'`). No permission scopes — any admin can escalate roles, manage subscriptions, and export all user data. |
| H4 | **Audit Gap** | `app/api/auth/login/route.js` | — | Failed login attempts are not written to the audit log. Only successful logins update `lastLoginAt`. Brute force attempts leave no forensic trail. |
| H5 | **Validation** | `app/api/auth/me/route.js` | 134–155 | Nickname update uses a manual regex instead of a Zod schema. Unicode normalization and homograph characters could bypass the pattern. No rate limiting on this endpoint. |

### MEDIUM — Performance & Correctness

| # | Category | File | Line | Issue |
|---|----------|------|------|-------|
| M1 | **Indexes** | `models/User.js` | 103–104 | Leaderboard sorts by `gamification.weeklyXP`. Single-field index exists but compound `{ weeklyXP: -1, _id: 1 }` is needed for efficient cursor-based pagination. |
| M2 | **Race Condition** | `app/api/exams/[sessionId]/submit/route.js` | 175–208 | Fire-and-forget `updateLeaderboardRank` and `getExamCoachFeedback` have no idempotency guard. Concurrent submissions or retries can produce duplicate XP awards or out-of-order rank updates. |
| M3 | **Race Condition** | `app/api/gamification/leaderboard/route.js` | 16–31 | Lazy weekly XP reset uses `updateMany`. Concurrent requests trigger multiple reset operations with no atomic guard (e.g., `findOneAndUpdate` with conditional). |
| M4 | **DB Connection** | `lib/db.js` | 22 | No `serverSelectionTimeoutMS` or `socketTimeoutMS` configured. Slow MongoDB connections hang indefinitely in production without a timeout ceiling. |
| M5 | **React Perf** | `app/exam/[sessionId]/page.js` | 60–127 | `OptionButton` is not memoized with `React.memo()`. Re-renders all 3–4 option buttons on every parent state change (answer selection, hint loading, timer tick). |
| M6 | **Error Isolation** | `app/dashboard/page.js` | 171–177 | `Promise.all([dashRes, trendsRes])` fails entirely if any single API call fails. A slow or erroring trends endpoint breaks the entire dashboard. |
| M7 | **Fetch Leak** | `app/exam/page.js` | 231 | `AIRecommendBanner` fetches without an `AbortController`. If the component unmounts before response, the request continues and may trigger a state update on an unmounted component. |
| M8 | **Cache Consistency** | `lib/user-skill.js` | 109–119 | Fire-and-forget cache write returns stale data in the interval between calculation and persistence. Concurrent requests can trigger duplicate aggregation pipelines. |

### LOW — Polish & Tech Debt

| # | Category | File | Line | Issue |
|---|----------|------|------|-------|
| L1 | **Accessibility** | `components/Navbar.js` | — | Navigation dropdowns lack `aria-expanded` / `aria-controls` / `aria-haspopup`. Icon-only buttons throughout the app have no `aria-label`. Only 18 aria attributes found across 57 pages. |
| L2 | **Accessibility** | `app/exam/[sessionId]/page.js` | — | Exam answer options have no `role="radio"` group semantics. Screen readers can't announce "Option A of 4, currently selected". |
| L3 | **Audit Gap** | `app/api/admin/users/[id]/route.js` | 142 | `user-agent` extracted without a fallback — produces `null` in audit logs for API clients that omit the header. |
| L4 | **HTTPS** | `lib/auth.js` | 77 | `secure: process.env.NODE_ENV === 'production'` — if `NODE_ENV` is unset or misconfigured in staging, cookies travel over HTTP. |
| L5 | **Validation** | `app/api/exams/generate/route.js` | 198 | `topic_filter` has no max-array-length constraint in the Zod schema. Very large arrays could degrade adaptive selection performance. |
| L6 | **Stale Bookmarks** | `app/api/bookmarks/route.js` | 76 | When fetching bookmarked questions, deleted questions are silently excluded. Users see fewer items than expected with no explanation or cleanup. |

---

## 3. Step-by-Step Roadmap

Ordered by **Highest Impact / Lowest Effort** first.

---

### Phase 0 — Quick Security Wins (1–2 hrs, no architecture changes)

These require minimal code changes and immediately close known vulnerabilities.

#### 0.1 — Enable Token Rotation
- **File:** `app/api/auth/refresh/route.js:65–84`
- **Action:** Uncomment the existing `rotateToken` block. The `RefreshToken.rotateToken` static method is already implemented with family-tracking.
- **Verify:** Logging out on one device should invalidate refresh tokens on other sessions.

#### 0.2 — Harden Cookie SameSite
- **File:** `lib/auth.js:78`
- **Action:** Change `sameSite: 'lax'` → `sameSite: 'strict'`
- **Risk:** Test that cross-origin OAuth flows (if any) still work. No OAuth found in this codebase, so change is safe.

#### 0.3 — Add Content-Security-Policy Header
- **File:** `next.config.js`
- **Action:** Add `headers()` export with a CSP policy. Start with report-only mode:
  ```js
  async headers() {
    return [{
      source: '/(.*)',
      headers: [{
        key: 'Content-Security-Policy',
        value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://api.groq.com;",
      }],
    }]
  }
  ```
- **Verify:** No console errors on exam, dashboard, and admin pages.

#### 0.4 — Log Failed Login Attempts
- **File:** `app/api/auth/login/route.js`
- **Action:** After the "Invalid email or password" branch, add `logAudit({ action: 'LOGIN_FAILED', ... })`. Import `logAudit` from `lib/audit.js` (already used in admin routes).
- **Verify:** `AuditLog` collection shows failed attempts with IP and timestamp.

#### 0.5 — Nickname Update via Zod Schema
- **File:** `app/api/auth/me/route.js:134–155`
- **Action:** Add a `nicknameUpdateSchema` to `lib/schemas.js` and replace the manual regex block. Add `checkRateLimit` call matching the pattern in other auth routes.

---

### Phase 1 — Database Transactions (3–5 hrs, high correctness impact)

#### 1.1 — Wrap Exam Submission in a Transaction
- **File:** `app/api/exams/[sessionId]/submit/route.js:86–233`
- **Pattern to follow:** Mongoose sessions
  ```js
  const mongoSession = await mongoose.startSession()
  await mongoSession.withTransaction(async () => {
    await examSession.save({ session: mongoSession })
    await User.findByIdAndUpdate(userId, {...}, { session: mongoSession })
  })
  await mongoSession.endSession()
  ```
- **Keep fire-and-forget:** `updateLeaderboardRank` and `getExamCoachFeedback` can remain outside the transaction — they are non-critical and correctly marked as such.
- **Verify:** Killing the process mid-submit should not produce partial XP or badge state.

#### 1.2 — Wrap Answer Recording in a Transaction
- **File:** `app/api/exams/[sessionId]/answer/route.js:92–118`
- **Action:** Wrap `UserAnswer.create()` and `session.save()` in a single `withTransaction` block to prevent answer duplication on retry.
- **Verify:** Duplicate POST to the same question+session should return 400, not create two `UserAnswer` documents.

#### 1.3 — Fix Leaderboard Reset Race Condition
- **File:** `app/api/gamification/leaderboard/route.js:16–31`
- **Action:** Replace `updateMany` with an atomic guard using `{ $lt: currentWeekStart }` in the filter and verify idempotency under concurrent requests.
- **Verify:** Running 10 concurrent leaderboard requests at week rollover should produce exactly one reset operation.

---

### Phase 2 — Distributed Rate Limiting (4–6 hrs, critical for scale)

#### 2.1 — Evaluate Persistence Backend
- **Decision:** MongoDB is already available. Implement rate limiting via a `RateLimit` collection with a TTL index rather than introducing Redis as a new dependency.
- **Pattern:**
  ```js
  // models/RateLimit.js
  const schema = new Schema({
    key: { type: String, unique: true },
    count: { type: Number, default: 1 },
    expiresAt: { type: Date, index: { expireAfterSeconds: 0 } },
  })
  ```
- **Action:** Replace `checkRateLimit` in `lib/utils.js` with a MongoDB-backed implementation using `findOneAndUpdate` with `$inc` and upsert — this is atomic across all server instances.
- **Verify:** Two instances running in parallel should share the same rate limit counter.

---

### Phase 3 — Frontend Performance & UX (2–3 hrs, high user-facing impact)

#### 3.1 — Memoize OptionButton
- **File:** `app/exam/[sessionId]/page.js:60–127`
- **Action:** Wrap with `React.memo()`. Add `useCallback` to any handlers passed as props.
- **Verify:** React DevTools Profiler shows OptionButton not re-rendering on hint load.

#### 3.2 — Dashboard Error Isolation
- **File:** `app/dashboard/page.js:171–177`
- **Action:** Replace `Promise.all` with `Promise.allSettled`. Destructure results with status checks. Show partial data rather than total failure.
- **Verify:** Blocking the `/api/stats/trends` endpoint in DevTools should show the rest of the dashboard normally.

#### 3.3 — Fix AIRecommendBanner Fetch Leak
- **File:** `app/exam/page.js:231`
- **Action:** Add `AbortController`. Pass `signal` to fetch. Return cleanup function from `useEffect`.
- **Pattern:** Follow the existing cleanup pattern at `app/exam/page.js:343–384`.

---

### Phase 4 — Accessibility Pass (2–4 hrs, medium impact)

#### 4.1 — Navigation ARIA Attributes
- **Files:** `components/Navbar.js`, `components/UserMenu.js`, `components/NavMobileMenu.js`
- **Action:** Add `aria-expanded` toggling on menu trigger buttons. Add `aria-controls` pointing to menu element IDs. Add `aria-haspopup="menu"` where appropriate.
- **Verify:** VoiceOver/NVDA announces "expanded/collapsed" on toggle.

#### 4.2 — Exam Answer Options Semantics
- **File:** `app/exam/[sessionId]/page.js`
- **Action:** Wrap options in a `<div role="radiogroup" aria-label="Answer options">`. Give each `OptionButton` `role="radio"` and `aria-checked={isSelected}`.
- **Verify:** Screen reader announces "Option A, radio button, 1 of 4".

#### 4.3 — Icon Button Labels
- **Files:** Navbar, UserMenu, ThemeToggle
- **Action:** Add `aria-label` to all icon-only `<button>` elements (theme toggle, close menu, user menu trigger).

---

### Phase 5 — Data Layer Hardening (2–3 hrs, medium impact)

#### 5.1 — Add Database Connection Timeouts
- **File:** `lib/db.js:22`
- **Action:**
  ```js
  const opts = {
    bufferCommands: false,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 15000,
    connectTimeoutMS: 10000,
  }
  ```
- **Verify:** Blocking MongoDB connectivity shows an error within 5 seconds, not an indefinite hang.

#### 5.2 — Add Compound Leaderboard Indexes
- **File:** `models/User.js:103–104`
- **Action:**
  ```js
  userSchema.index({ 'gamification.weeklyXP': -1, _id: 1 })
  userSchema.index({ 'gamification.totalXP': -1, _id: 1 })
  ```
- **Verify:** `explain()` on leaderboard query shows `IXSCAN` not `COLLSCAN`.

#### 5.3 — topic_filter Array Size Limit
- **File:** `lib/schemas.js`
- **Action:** Add `.max(20)` to the topic_filter array schema.

#### 5.4 — Handle Stale Bookmarks
- **File:** `app/api/bookmarks/route.js:76`
- **Action:** After `Question.find()`, compare returned count to `paginatedIds.length`. If fewer results, strip missing IDs from user bookmarks via `$pull` (fire-and-forget).

#### 5.5 — Admin Audit: User-Agent Fallback
- **File:** `app/api/admin/users/[id]/route.js:142`
- **Action:** `userAgent: request.headers.get('user-agent') ?? 'unknown'`

---

## 4. Dependency Notes

No packages need upgrading — all dependencies are current. The following are already correctly installed and just need to be fully utilized:

| Package | Status | Needed For |
|---------|--------|-----------|
| `mongoose` ^9.3.0 | ✅ Installed | Phase 1 transactions |
| `zod` ^3.22.4 | ✅ Installed | Phase 0.5 Zod schema |
| `pino` ^10.3.1 | ✅ Installed | Phase 0.4 audit logging |

---

## 5. Testing Checklist

After each phase, verify:

- [ ] `npm run build` completes with zero errors
- [ ] `npm test` passes (or pre-existing failures unchanged)
- [ ] Auth flow: login → refresh → logout cycle works end-to-end
- [ ] Exam flow: generate → answer → submit cycle produces correct XP/badge state
- [ ] Dashboard loads with partial data when one API is unavailable (after Phase 3.2)
- [ ] Leaderboard loads and weekly reset fires only once under concurrent load (after Phase 1.3)
- [ ] Rate limiting blocks excess requests across simulated multi-instance environment (after Phase 2)

---

*Generated: 2026-03-19 via parallel 4-agent deep audit (architecture, security, frontend, data layer)*
