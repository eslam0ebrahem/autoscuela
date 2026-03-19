# AI Enhancement Plan for Vialia

**Goal:** Enhance AI capabilities to make the platform smarter — better learning science, deeper personalization, richer coaching, and real-time adaptation.

**Scope:** 5 implementation phases + final verification.

---

## Phase 0: Documentation Discovery ✅ COMPLETE

### Allowed APIs & Patterns (from codebase audit)

**Groq SDK wrapper — use `callGroq()` from `lib/groq.js`:**
```javascript
await callGroq({ messages, model?, temperature?, json?: true, timeout? })
// json: true → response_format: { type: 'json_object' }, always parse result with JSON.parse()
// model defaults: MODEL='llama-3.3-70b-versatile', FAST_MODEL='llama-3.1-8b-instant'
```

**Existing Groq functions in `lib/groq.js` (do NOT duplicate):**
```
getAIInsights(userLanguage, aggregatedData) → { readiness_score, weak_topics, ... }
getQuestionExplanation({ question, options, correctIdx, selectedIdx, helpHtml, lang })
getSmartHint({ question, options, correctIdx, lang })
getExamCoachFeedback({ examSummary, lang })
getExamRecommendation({ recentStats, lang })
```

**Mongoose patterns:**
```javascript
// Update (Mongoose v9 — do NOT use new: true, it's deprecated)
await Model.findByIdAndUpdate(id, { $set: {...} })
// Aggregate
await UserAnswer.aggregate([{ $match }, { $group }, { $project }, { $lookup }])
// Index
schema.index({ userId: 1, 'srs.nextReviewAt': 1 })
```

**Rate limit pattern (from existing routes):**
```javascript
import { checkRateLimit } from '@/lib/rate-limit'
const rateLimit = await checkRateLimit(userId, 'featureName', maxCount, windowSeconds)
if (!rateLimit.allowed) return NextResponse.json({ error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfter }, { status: 429 })
```

**getUserSkillProfile() from `lib/user-skill.js`:**
```javascript
const profile = await getUserSkillProfile(userId)
// Returns: { overallLevel, topicLevels, totalAnswered, overallAccuracy, topics: [{ tag, tagEn, attempted, correct, accuracy, avgTime }], cached }
```

**selectAdaptiveQuestions() from `lib/adaptive-selection.js`:**
```javascript
const questionIds = await selectAdaptiveQuestions(userId, count, { mode, topicFilters, mistakeQuestionIds })
// mode enum: 'official'|'custom'|'daily_challenge'|'mistakes'|'weak_topics'
// Scoring weights per mode available in WEIGHTS constant
```

**Auth pattern (from existing routes):**
```javascript
import { verifyToken } from '@/lib/auth'
const token = request.cookies.get('token')?.value
const decoded = verifyToken(token)
if (!decoded) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
const userId = decoded.userId
```

**Anti-patterns to avoid:**
- Never use `new: true` with `findByIdAndUpdate` (Mongoose v9 deprecated it)
- Never block exam generation or completion response with synchronous AI calls
- Never skip `checkRateLimit` on any AI endpoint
- Never send raw HTML (`help_html`) to Groq — strip to plain text first
- Never invent API methods — only use patterns shown in existing code

---

## Phase 1: Spaced Repetition System (SM-2)

**Why:** The biggest learning-science win. SM-2 ensures users re-see questions they got wrong at scientifically optimal intervals, dramatically improving long-term retention.

### Task 1.1 — Create `lib/srs.js`

**File:** `lib/srs.js` (NEW)

Implement SM-2 algorithm (pure functions, no DB calls):

```javascript
/**
 * Calculate next SRS interval using SM-2 algorithm.
 * @param {object} current - Current SRS state
 * @param {number} current.easinessFactor - EF value (default 2.5)
 * @param {number} current.interval - Days until next review (default 1)
 * @param {number} current.repetitions - Successful review count (default 0)
 * @param {number} grade - Answer quality 0-5 (0=fail, 3=correct w/ difficulty, 5=perfect)
 * @returns {{ easinessFactor, interval, repetitions, nextReviewAt: Date }}
 */
export function calculateSRS({ easinessFactor = 2.5, interval = 1, repetitions = 0 }, grade) {
  let newEF = Math.max(1.3, easinessFactor + 0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02))
  let newInterval, newRepetitions

  if (grade < 3) {
    // Failed — reset
    newRepetitions = 0
    newInterval = 1
  } else {
    // Successful
    newRepetitions = repetitions + 1
    if (newRepetitions === 1) newInterval = 1
    else if (newRepetitions === 2) newInterval = 6
    else newInterval = Math.round(interval * newEF)
  }

  const nextReviewAt = new Date()
  nextReviewAt.setDate(nextReviewAt.getDate() + newInterval)

  return { easinessFactor: newEF, interval: newInterval, repetitions: newRepetitions, nextReviewAt }
}

/**
 * Convert answer data to SM-2 grade (0-5).
 * @param {boolean} isCorrect
 * @param {number} timeTakenSeconds - Actual time taken
 * @param {number} avgTimeSeconds - User's average time for this topic
 */
export function answerToGrade(isCorrect, timeTakenSeconds, avgTimeSeconds = 30) {
  if (!isCorrect) return 1 // Incorrect = grade 1
  const ratio = timeTakenSeconds / Math.max(avgTimeSeconds, 5)
  if (ratio <= 0.5) return 5  // Fast = perfect
  if (ratio <= 1.0) return 4  // Normal speed = good
  if (ratio <= 1.5) return 3  // Slow = correct with difficulty
  return 3                    // Very slow = still grade 3 (correct but hard)
}
```

**Verification:** Import and call `calculateSRS({ easinessFactor: 2.5, interval: 6, repetitions: 2 }, 5)` — should return interval ≥ 15 days.

### Task 1.2 — Add SRS fields to `models/UserAnswer.js`

**File:** `models/UserAnswer.js` (MODIFY)

Add SRS subdocument after existing fields:
```javascript
srs: {
  easinessFactor: { type: Number, default: 2.5, min: 1.3, max: 4.0 },
  interval: { type: Number, default: 1 },
  repetitions: { type: Number, default: 0 },
  nextReviewAt: { type: Date, default: Date.now },
  lastGrade: { type: Number, min: 0, max: 5 },
},
```

Add index after existing indexes:
```javascript
userAnswerSchema.index({ userId: 1, 'srs.nextReviewAt': 1 })
```

**Verification:** `grep -A8 "srs:" models/UserAnswer.js` shows all fields.

### Task 1.3 — Update answer route to calculate SRS

**File:** `app/api/exams/[sessionId]/answer/route.js` (MODIFY)

After recording the answer and before returning response, update SRS:
1. Import `{ calculateSRS, answerToGrade }` from `@/lib/srs`
2. Find existing UserAnswer for this user+question (most recent)
3. Compute grade: `answerToGrade(isCorrect, timeTaken, avgTopicTime)`
4. Compute new SRS state: `calculateSRS(existingSRS || {}, grade)`
5. Update/upsert UserAnswer with SRS fields using `$set`

Pattern (fire-and-forget, non-blocking):
```javascript
// After main answer logic, fire-and-forget SRS update
Promise.resolve().then(async () => {
  const existing = await UserAnswer.findOne({ userId, questionId }).sort({ createdAt: -1 }).lean()
  const grade = answerToGrade(isCorrect, timeTakenSeconds)
  const newSRS = calculateSRS(existing?.srs || {}, grade)
  await UserAnswer.findByIdAndUpdate(savedAnswer._id, { $set: { srs: { ...newSRS, lastGrade: grade } } })
}).catch(() => {})
```

**Verification:** After answering a question, check that UserAnswer document has `srs.nextReviewAt` set to a future date.

### Task 1.4 — Add SRS boost to `lib/adaptive-selection.js`

**File:** `lib/adaptive-selection.js` (MODIFY)

1. Import `{ ObjectId }` from mongoose (or use `mongoose.Types.ObjectId`)
2. Before scoring, fetch SRS-due question IDs for user:
```javascript
const now = new Date()
const srsDueAnswers = await UserAnswer.aggregate([
  { $match: { userId: objectId, 'srs.nextReviewAt': { $lte: now } } },
  { $group: { _id: '$questionId' } },
])
const srsDueIds = new Set(srsDueAnswers.map(a => a._id.toString()))
```

3. In scoring loop, add SRS boost:
```javascript
const srsDueBoost = srsDueIds.has(qId) ? 0.3 : 0
const baseScore = weights.weakness * weaknessScore + weights.freshness * freshnessScore +
                  weights.difficulty * difficultyScore + weights.noise * noiseScore + srsDueBoost
```

### Task 1.5 — Add `spaced_repetition` exam mode

**File:** `app/api/exams/generate/route.js` (MODIFY)

1. Add `'spaced_repetition'` to `VALID_MODES` array
2. Add duration: `DURATIONS.spaced_repetition = 45`
3. Add mode handling: when mode is `spaced_repetition`, only select SRS-due questions:
```javascript
if (mode === 'spaced_repetition') {
  const now = new Date()
  const dueAnswers = await UserAnswer.aggregate([
    { $match: { userId: objectId, 'srs.nextReviewAt': { $lte: now } } },
    { $sort: { 'srs.nextReviewAt': 1 } },
    { $limit: requestedCount * 2 },
    { $group: { _id: '$questionId' } },
  ])
  const dueIds = dueAnswers.map(a => a._id)
  if (dueIds.length === 0) {
    return NextResponse.json({ error: 'No questions due for review', message: 'Great job! No spaced repetition reviews due. Come back later.' }, { status: 200 })
  }
  questionIds = dueIds.slice(0, requestedCount).sort(() => Math.random() - 0.5)
}
```

### Phase 1 Verification Checklist
- [ ] `lib/srs.js` exists with `calculateSRS()` and `answerToGrade()` exports
- [ ] UserAnswer model has `srs` subdocument with all 5 fields
- [ ] SRS index exists on `{ userId, 'srs.nextReviewAt' }`
- [ ] Answering a question updates `srs.nextReviewAt`
- [ ] `spaced_repetition` in VALID_MODES
- [ ] Build passes: `npm run build`

---

## Phase 2: AI-Powered Personalized Study Plan

**Why:** Users preparing for the DGT exam have a target date. An AI-generated weekly study plan gives them a concrete roadmap, dramatically improving motivation and study structure.

### Task 2.1 — Add `getStudyPlan()` to `lib/groq.js`

**File:** `lib/groq.js` (MODIFY)

Add after existing functions:

```javascript
/**
 * Generate a personalized study plan.
 * @param {{ skillProfile, targetDate: string, dailyMinutes: number, lang: 'es'|'en' }} params
 */
export async function getStudyPlan({ skillProfile, targetDate, dailyMinutes = 30, lang = 'es' }) {
  const daysUntilExam = Math.max(1, Math.ceil((new Date(targetDate) - new Date()) / (1000 * 60 * 60 * 24)))
  const weeksAvailable = Math.ceil(daysUntilExam / 7)
  const weakTopics = skillProfile.topics
    .filter(t => t.accuracy < 70)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 8)
    .map(t => `${t.tag} (${t.accuracy}% accuracy)`)
    .join(', ')

  const STUDY_PLAN_PROMPT = `You are a DGT Spanish driving exam coach. Create a personalized study plan.

Student profile:
- Overall level: ${skillProfile.overallLevel}
- Overall accuracy: ${skillProfile.overallAccuracy}%
- Total questions answered: ${skillProfile.totalAnswered}
- Weak topics (by Spanish tag): ${weakTopics || 'none identified yet'}
- Days until exam: ${daysUntilExam}
- Weeks available: ${weeksAvailable}
- Daily study time: ${dailyMinutes} minutes

Return a JSON study plan:
{
  "summary": "2-sentence overview of the plan and goal",
  "estimated_pass_ready": "ISO date string when user should be ready",
  "weeks": [
    {
      "week_number": 1,
      "theme": "theme name",
      "focus_topics": ["Spanish tag1", "Spanish tag2"],
      "exam_modes": ["official", "weak_topics"],
      "daily_sessions": 1,
      "session_question_count": 20,
      "milestone_target": "specific measurable goal for this week"
    }
  ],
  "daily_tip": "one actionable daily habit"
}

Language: ${lang === 'es' ? 'Spanish' : 'English'}. Be encouraging and specific. If only 1-2 weeks available, be intensive. Maximum ${Math.min(weeksAvailable, 8)} weeks in the plan.`

  return callGroq({
    messages: [{ role: 'user', content: STUDY_PLAN_PROMPT }],
    model: MODEL,
    temperature: 0.3,
    json: true,
    timeout: 25000,
  })
}
```

**Fallback response for `getStudyPlan()`** (return if Groq fails):
```javascript
return JSON.stringify({
  summary: lang === 'es'
    ? 'Practica con exámenes oficiales diariamente y repasa tus temas débiles.'
    : 'Practice with official exams daily and review your weak topics.',
  estimated_pass_ready: null,
  weeks: [],
  daily_tip: lang === 'es' ? 'Estudia 30 minutos al día de forma constante.' : 'Study 30 minutes daily consistently.',
  _fallback: true
})
```

### Task 2.2 — Create `app/api/ai/study-plan/route.js`

**File:** `app/api/ai/study-plan/route.js` (NEW)

```javascript
import { NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import connectDB from '@/lib/db'
import { checkRateLimit } from '@/lib/rate-limit'
import { getUserSkillProfile } from '@/lib/user-skill'
import { getStudyPlan } from '@/lib/groq'
import { AIStudyPlanSchema } from '@/lib/schemas'

export async function GET(request) {
  // 1. Auth
  const token = request.cookies.get('token')?.value
  const decoded = verifyToken(token)
  if (!decoded) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = decoded.userId

  // 2. Rate limit: 5 per hour
  await connectDB()
  const rateLimit = await checkRateLimit(userId, 'study_plan', 5, 3600)
  if (!rateLimit.allowed) return NextResponse.json({ error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfter }, { status: 429 })

  // 3. Validate query params
  const { searchParams } = new URL(request.url)
  const parseResult = AIStudyPlanSchema.safeParse({
    targetDate: searchParams.get('targetDate'),
    dailyMinutes: searchParams.get('dailyMinutes') ? Number(searchParams.get('dailyMinutes')) : undefined,
    lang: searchParams.get('lang') || 'es',
  })
  if (!parseResult.success) return NextResponse.json({ error: 'Invalid parameters', details: parseResult.error.flatten() }, { status: 400 })
  const { targetDate, dailyMinutes, lang } = parseResult.data

  // 4. Get skill profile
  const skillProfile = await getUserSkillProfile(userId)
  if (skillProfile.totalAnswered < 10) {
    return NextResponse.json({ error: 'insufficient_data', message: lang === 'es' ? 'Responde al menos 10 preguntas antes de generar un plan.' : 'Answer at least 10 questions before generating a plan.', progress: skillProfile.totalAnswered, required: 10 }, { status: 422 })
  }

  // 5. Generate plan
  try {
    const raw = await getStudyPlan({ skillProfile, targetDate, dailyMinutes, lang })
    const plan = JSON.parse(raw)
    return NextResponse.json({ plan, generatedAt: new Date().toISOString() })
  } catch {
    return NextResponse.json({
      plan: {
        summary: lang === 'es' ? 'Practica con exámenes oficiales diariamente.' : 'Practice with official exams daily.',
        weeks: [],
        daily_tip: lang === 'es' ? 'Estudia 30 minutos al día.' : 'Study 30 minutes daily.',
        _fallback: true
      },
      generatedAt: new Date().toISOString()
    }, { status: 200 })
  }
}
```

### Task 2.3 — Add `AIStudyPlanSchema` to `lib/schemas.js`

**File:** `lib/schemas.js` (MODIFY)

Add after existing schemas:
```javascript
export const AIStudyPlanSchema = z.object({
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format').refine(
    v => new Date(v) > new Date(),
    'Target date must be in the future'
  ),
  dailyMinutes: z.coerce.number().int().min(5).max(180).optional().default(30),
  lang: z.enum(['es', 'en']).optional().default('es'),
})
```

### Phase 2 Verification Checklist
- [ ] `GET /api/ai/study-plan?targetDate=2026-06-01` returns JSON with `plan.weeks` array
- [ ] Missing `targetDate` returns 400 with validation error
- [ ] Past `targetDate` returns 400 validation error
- [ ] `<10 questions answered` returns 422 with progress info
- [ ] Rate limit 5/hour applied
- [ ] Build passes

---

## Phase 3: Historical Coach Feedback

**Why:** The current coach only sees one session. By adding 5-session history, Groq can detect improvement trends ("your accuracy on señales has improved 20% this week") and give genuinely motivating, personalized coaching.

### Task 3.1 — Update `getExamCoachFeedback()` in `lib/groq.js`

**File:** `lib/groq.js` (MODIFY)

Update the function signature and COACH_PROMPT to accept `sessionHistory`:

```javascript
export async function getExamCoachFeedback({ examSummary, sessionHistory = [], lang = 'es' }) {
```

Build historical context string:
```javascript
let historyContext = ''
if (sessionHistory.length > 0) {
  const histLines = sessionHistory.map((s, i) =>
    `Session ${i + 1} (${new Date(s.completedAt).toLocaleDateString()}): score=${s.score}%, passed=${s.passed}, errors=${s.errorCount}`
  ).join('\n')
  historyContext = `\n\nRecent history (oldest to newest):\n${histLines}`
}
```

Add to COACH_PROMPT: include `${historyContext}` and add to the output JSON:
```
"trend": "improving|stable|declining",
"improvement_pct": number (score change vs oldest session, null if single session),
"consistency_score": 0-100 (how consistent recent scores are)
```

### Task 3.2 — Fetch session history in `app/api/ai/coach/route.js`

**File:** `app/api/ai/coach/route.js` (MODIFY)

After fetching the current session, fetch last 5 completed sessions before calling Groq:

```javascript
// Fetch last 5 completed sessions for history (excluding current)
let sessionHistory = []
try {
  sessionHistory = await ExamSession.find({
    userId,
    status: 'completed',
    _id: { $ne: session._id }
  })
  .sort({ completedAt: -1 })
  .limit(5)
  .select('score errorCount passed completedAt mode')
  .lean()
  sessionHistory.reverse() // oldest first for trend analysis
} catch {
  // Graceful: proceed without history
}

const feedback = await getExamCoachFeedback({ examSummary, sessionHistory, lang })
```

### Task 3.3 — Store trend in `models/ExamSession.js`

**File:** `models/ExamSession.js` (MODIFY)

Add to `aiCoachFeedback` schema definition:
```javascript
aiCoachFeedback: {
  // ... existing fields (headline, summary, strengths, weaknesses, next_step, confidence_boost, verdict)
  trend: { type: String, enum: ['improving', 'stable', 'declining'] },
  improvementPct: { type: Number },
  consistencyScore: { type: Number, min: 0, max: 100 },
},
```

### Phase 3 Verification Checklist
- [ ] Coach response includes `trend` field when history exists
- [ ] When only 1 session, `trend` is `null` or omitted gracefully
- [ ] History fetch failure doesn't crash coach endpoint
- [ ] `aiCoachFeedback.trend` saved to ExamSession after coach call
- [ ] Build passes

---

## Phase 4: Real-Time Skill Profile Invalidation

**Why:** Currently, the skill profile has a 1-hour stale cache. After completing an exam (20-30 questions), the user's skill data has changed significantly, but adaptive question selection still uses old data. Invalidating on exam completion ensures next session uses fresh data.

### Task 4.1 — Export `invalidateSkillProfile()` from `lib/user-skill.js`

**File:** `lib/user-skill.js` (MODIFY)

Add after `getUserSkillProfile()`:
```javascript
/**
 * Invalidate the cached skill profile for a user.
 * Sets lastCalculatedAt to epoch, forcing recalculation on next access.
 */
export async function invalidateSkillProfile(userId) {
  await connectDB()
  await User.findByIdAndUpdate(userId, {
    $set: { 'skillProfile.lastCalculatedAt': new Date(0) }
  })
}
```

### Task 4.2 — Call invalidation on exam completion

**File:** `app/api/exams/[sessionId]/route.js` OR wherever `status: 'completed'` is set (MODIFY)

Find the code path where an exam session is marked as `completed`. After the update, fire-and-forget invalidation:

```javascript
// After marking session as completed:
import { invalidateSkillProfile } from '@/lib/user-skill'

// Non-blocking: invalidate skill cache so next adaptive selection uses fresh data
invalidateSkillProfile(userId).catch(() => {})
```

**Note:** Read `app/api/exams/[sessionId]/route.js` first to find the exact completion code path.

### Task 4.3 — Add exam-aware cache check to AI insights

**File:** `app/api/stats/ai-insights/route.js` (MODIFY)

After fetching cached insights, also check if a newer exam completed after cache:
```javascript
// If cached, check if user completed a newer exam since cache was made
if (cachedInsights && !force) {
  const latestExam = await ExamSession.findOne({ userId, status: 'completed' })
    .sort({ completedAt: -1 })
    .select('completedAt')
    .lean()

  const cacheDate = user.aiInsights?.lastUpdated
  if (latestExam?.completedAt && cacheDate && latestExam.completedAt > cacheDate) {
    // Newer exam exists — regenerate insights
    // (fall through to regeneration code)
  } else {
    return NextResponse.json({ insights: cachedInsights, cached: true, cachedAt: cacheDate })
  }
}
```

Also reduce `CACHE_HOURS` from 8 to 4.

### Phase 4 Verification Checklist
- [ ] `invalidateSkillProfile()` exported from `lib/user-skill.js`
- [ ] Exam completion triggers skill profile invalidation (fire-and-forget)
- [ ] AI insights regenerate if a newer exam exists since last cache
- [ ] `CACHE_HOURS` reduced to 4
- [ ] Build passes

---

## Phase 5: AI Mistake Pattern Analysis

**Why:** "Weak topics" tells users *what* they're failing. Mistake patterns tell them *why* — "you consistently confuse señales de obligación with señales de prohibición". This is the most actionable AI insight.

### Task 5.1 — Add `getMistakePatterns()` to `lib/groq.js`

**File:** `lib/groq.js` (MODIFY)

Add new exported function:
```javascript
/**
 * Analyze recurring mistake patterns to identify conceptual gaps.
 * @param {{ mistakeGroups: Array, lang: 'es'|'en' }} params
 */
export async function getMistakePatterns({ mistakeGroups, lang = 'es' }) {
  const groupsText = mistakeGroups.map(g =>
    `Topic: ${g.topic}\nMistakes (${g.count}):\n` +
    g.examples.slice(0, 3).map(e =>
      `  Q: ${e.questionText?.substring(0, 100)}\n  Selected: ${e.selectedText}\n  Correct: ${e.correctText}`
    ).join('\n')
  ).join('\n\n')

  const PATTERNS_PROMPT = `You are a DGT Spanish driving exam expert. Analyze these mistake patterns and identify conceptual knowledge gaps.

${groupsText}

Identify the ROOT CAUSE of each mistake cluster (e.g., "confuses urban vs rural speed limits", "misreads priority signs"). Be specific and actionable.

Return JSON:
{
  "patterns": [
    {
      "concept": "brief concept name (5-8 words)",
      "topic": "Spanish topic tag",
      "frequency": number,
      "root_cause": "why user gets this wrong (1 sentence)",
      "fix_strategy": "specific study action (1-2 sentences)",
      "example_question": "brief example of a typical mistake question"
    }
  ],
  "priority_fix": "the single most impactful concept to study first",
  "study_tip": "one overarching tip based on all patterns"
}

Language: ${lang === 'es' ? 'Spanish' : 'English'}. Be direct and specific — not generic advice.`

  return callGroq({
    messages: [{ role: 'user', content: PATTERNS_PROMPT }],
    model: MODEL,
    temperature: 0.2,
    json: true,
    timeout: 30000,
  })
}
```

### Task 5.2 — Create `app/api/ai/patterns/route.js`

**File:** `app/api/ai/patterns/route.js` (NEW)

```javascript
import { NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { verifyToken } from '@/lib/auth'
import connectDB from '@/lib/db'
import { checkRateLimit } from '@/lib/rate-limit'
import UserAnswer from '@/models/UserAnswer'
import { getMistakePatterns } from '@/lib/groq'

const MIN_MISTAKES = 10

export async function GET(request) {
  // 1. Auth
  const token = request.cookies.get('token')?.value
  const decoded = verifyToken(token)
  if (!decoded) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = decoded.userId

  // 2. Rate limit: 5 per day (expensive analysis)
  await connectDB()
  const rateLimit = await checkRateLimit(userId, 'mistake_patterns', 5, 86400)
  if (!rateLimit.allowed) return NextResponse.json({ error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfter }, { status: 429 })

  const lang = new URL(request.url).searchParams.get('lang') || 'es'
  const objectId = new mongoose.Types.ObjectId(userId)

  // 3. Aggregate recent wrong answers grouped by topic, with question text
  const mistakeGroups = await UserAnswer.aggregate([
    { $match: { userId: objectId, is_correct: false } },
    { $sort: { createdAt: -1 } },
    { $limit: 100 },
    {
      $lookup: {
        from: 'questions',
        localField: 'questionId',
        foreignField: '_id',
        as: 'question',
      },
    },
    { $unwind: { path: '$question', preserveNullAndEmpty: false } },
    {
      $group: {
        _id: '$topic_tag.es',
        count: { $sum: 1 },
        examples: {
          $push: {
            questionText: { $arrayElemAt: ['$question.question', 0] },
            selectedIdx: '$selected_option_idx',
            correctIdx: '$question.correct_option_idx',
          },
        },
      },
    },
    { $match: { count: { $gte: 2 } } },
    { $sort: { count: -1 } },
    { $limit: 8 },
  ])

  // Resolve question text from bilingual field
  const groups = mistakeGroups.map(g => ({
    topic: g._id,
    count: g.count,
    examples: g.examples.slice(0, 3).map(e => ({
      questionText: e.questionText?.[lang === 'es' ? 'es' : 'en'] || e.questionText?.es || '',
      selectedText: '', // Option text not joined here to keep aggregation simple
      correctText: '',
    })),
  }))

  // 4. Check minimum
  const totalMistakes = mistakeGroups.reduce((sum, g) => sum + g.count, 0)
  if (totalMistakes < MIN_MISTAKES || groups.length === 0) {
    return NextResponse.json({
      patterns: null,
      message: lang === 'es'
        ? `Necesitas al menos ${MIN_MISTAKES} respuestas incorrectas para el análisis de patrones.`
        : `You need at least ${MIN_MISTAKES} incorrect answers for pattern analysis.`,
      progress: totalMistakes,
      required: MIN_MISTAKES,
    }, { status: 200 })
  }

  // 5. Call AI
  try {
    const raw = await getMistakePatterns({ mistakeGroups: groups, lang })
    const result = JSON.parse(raw)
    return NextResponse.json({ ...result, total_analyzed: totalMistakes, analyzed_at: new Date().toISOString() })
  } catch {
    return NextResponse.json({
      patterns: null,
      message: lang === 'es' ? 'Análisis no disponible temporalmente.' : 'Analysis temporarily unavailable.',
      _fallback: true,
    }, { status: 200 })
  }
}
```

### Phase 5 Verification Checklist
- [ ] `GET /api/ai/patterns` returns JSON with `patterns` array
- [ ] Requires 10+ mistakes (returns progress message if fewer)
- [ ] Rate limit: 5 per day applied
- [ ] `$lookup` correctly joins questions collection
- [ ] Fallback response if Groq fails
- [ ] Build passes

---

## Phase 6: Final Verification

### Build & Lint
```bash
npm run build
npm run lint
```

### Grep checks for required patterns
```bash
# All new AI endpoints have rate limiting
grep "checkRateLimit" app/api/ai/study-plan/route.js
grep "checkRateLimit" app/api/ai/patterns/route.js

# SRS integrated
grep "srs" models/UserAnswer.js
grep "calculateSRS" app/api/exams/

# New groq functions exported
grep "export async function" lib/groq.js

# Invalidation exported
grep "invalidateSkillProfile" lib/user-skill.js
```

### Functional verification checklist
- [ ] Phase 1: `spaced_repetition` mode in VALID_MODES, SRS fields in UserAnswer
- [ ] Phase 2: `GET /api/ai/study-plan?targetDate=2026-12-01` returns weeks array
- [ ] Phase 3: Coach response has `trend` field
- [ ] Phase 4: Skill profile recalculates after exam completion
- [ ] Phase 5: `GET /api/ai/patterns` returns mistake patterns
- [ ] No regressions: existing `/api/ai/hint`, `/api/ai/explain`, `/api/ai/coach`, `/api/ai/recommend` still work
- [ ] No `new: true` in findByIdAndUpdate calls (Mongoose v9)
- [ ] No blocking AI calls in critical response paths

### Anti-pattern final check
- [ ] No hardcoded API keys
- [ ] No raw help_html sent to Groq
- [ ] No invented Mongoose/Groq API methods
- [ ] All new endpoints return user-friendly fallback if AI fails

---

## Summary of Changes

| File | Action | Phase |
|------|--------|-------|
| `lib/srs.js` | NEW — SM-2 algorithm | 1 |
| `models/UserAnswer.js` | ADD srs subdocument + index | 1 |
| `app/api/exams/[sessionId]/answer/route.js` | ADD SRS update after answer | 1 |
| `lib/adaptive-selection.js` | ADD SRS-due boost to scoring | 1 |
| `app/api/exams/generate/route.js` | ADD spaced_repetition mode | 1 |
| `lib/groq.js` | ADD getStudyPlan(), getMistakePatterns(), update getExamCoachFeedback() | 2,3,5 |
| `app/api/ai/study-plan/route.js` | NEW — study plan endpoint | 2 |
| `lib/schemas.js` | ADD AIStudyPlanSchema | 2 |
| `app/api/ai/coach/route.js` | ADD session history fetch | 3 |
| `models/ExamSession.js` | ADD trend/improvementPct to aiCoachFeedback | 3 |
| `lib/user-skill.js` | ADD invalidateSkillProfile() | 4 |
| `app/api/exams/[sessionId]/route.js` | ADD invalidation on completion | 4 |
| `app/api/stats/ai-insights/route.js` | ADD exam-aware cache check, reduce CACHE_HOURS to 4 | 4 |
| `app/api/ai/patterns/route.js` | NEW — mistake patterns endpoint | 5 |
