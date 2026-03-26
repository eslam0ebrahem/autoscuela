import Groq from 'groq-sdk'

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const MODEL = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile'
const FAST_MODEL = process.env.GROQ_FAST_MODEL ?? 'llama-3.1-8b-instant'
const TEMPERATURE = 0.2
const MAX_RETRIES = 3
const RETRY_DELAY = 800

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Add up to 25 % random jitter so concurrent retries don't pile up */
const jitter = (ms) => ms + Math.floor(Math.random() * ms * 0.25)

/**
 * Robust JSON parser that handles common LLM output artefacts:
 *   • ```json … ``` fences
 *   • Trailing commas before } or ]
 *   • Single-quoted strings (basic heuristic)
 */
function safeParseJSON(raw) {
  if (!raw) return null

  // Strip markdown fences
  let text = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()

  // First attempt: raw
  try {
    return JSON.parse(text)
  } catch {
    /* continue */
  }

  // Remove trailing commas before } or ]
  const repaired = text.replace(/,(\s*[}\]])/g, '$1')
  try {
    return JSON.parse(repaired)
  } catch {
    /* continue */
  }

  // Last-ditch: find outermost { … } or [ … ] block
  const start = text.search(/[{[]/)
  if (start !== -1) {
    const opener = text[start]
    const closer = opener === '{' ? '}' : ']'
    const end = text.lastIndexOf(closer)
    if (end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1))
      } catch {
        /* give up */
      }
    }
  }

  return null
}

function cleanAndTruncate(html, maxLen = 2000) {
  if (!html) return 'None provided'
  let text = html.replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi, '')
  text = text.replace(/<[^>]+>/g, ' ')
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length <= maxLen ? text : text.substring(0, maxLen) + '… [TRUNCATED]'
}

/**
 * Shared helper: format a question's options array into a labelled string.
 * If markCorrect is true, the correct option gets ✅ CORRECT.
 * If selectedIdx is provided, that option gets ❌ SELECTED (or ✅ if also correct).
 */
function buildOptionsText(options = [], lang, correctIdx, selectedIdx) {
  return options
    .map((o, i) => {
      const label = ['A', 'B', 'C', 'D'][i] ?? String(i + 1)
      const text = lang === 'en' ? o.text_en || o.text_es : o.text_es || o.text_en
      let mark = ''
      if (correctIdx !== undefined && i === correctIdx) mark = ' ✅ CORRECT'
      else if (selectedIdx !== undefined && i === selectedIdx) mark = ' ❌ SELECTED'
      return `${label}) ${text}${mark}`
    })
    .join('\n')
}

/** Retrieve the localised question text */
function questionText(question, lang) {
  return lang === 'en' ? question?.en || question?.es : question?.es || question?.en
}

// ---------------------------------------------------------------------------
// Core Groq caller  (retry + timeout + structured logging)
// ---------------------------------------------------------------------------
async function callGroq({
  messages,
  model = MODEL,
  temperature = TEMPERATURE,
  json = true,
  timeout = 25_000,
  maxTokens = 1500,
  label = 'groq',
}) {
  let lastError
  const t0 = Date.now()

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const completionPromise = groq.chat.completions.create({
        model,
        temperature,
        max_tokens: maxTokens,
        ...(json && { response_format: { type: 'json_object' } }),
        messages,
      })

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`[${label}] Groq timeout after ${timeout}ms`)), timeout)
      )

      const completion = await Promise.race([completionPromise, timeoutPromise])
      const content = completion.choices[0]?.message?.content ?? ''

      console.info(`[${label}] OK – attempt=${attempt}, model=${model}, ms=${Date.now() - t0}`)
      return content
    } catch (error) {
      lastError = error
      const retryable =
        (error?.status >= 500 && error?.status < 600) ||
        error?.code === 'ECONNRESET' ||
        error?.message?.includes('timeout') ||
        error?.message?.includes('rate_limit')

      if (!retryable || attempt === MAX_RETRIES) break

      const delay = jitter(RETRY_DELAY * 2 ** (attempt - 1))
      console.warn(
        `[${label}] attempt ${attempt} failed – retrying in ${delay}ms | ${error?.message}`
      )
      await sleep(delay)
    }
  }

  console.error(`[${label}] All ${MAX_RETRIES} attempts failed`, lastError?.message)
  throw lastError
}

// ============================================================================
// 1. AI INSIGHTS  (dashboard / stats page)
// ============================================================================
const INSIGHTS_PROMPT = `You are an expert Spanish DGT driving instructor, data analyst, and learning psychologist.
Analyze the student's performance data deeply and return a JSON object with:
- "readiness_score": 0-100 (90+ = ready for real DGT exam). Factor in accuracy trend, topic coverage breadth, and consistency.
- "weak_topics": top 2-3 weak topic names in user's language with specific sub-concept (e.g., "Señales de peligro — triángulos" not just "Señales")
- "coach_message": encouraging, personalized message in user's language (max 3 sentences). Reference their specific progress and next milestone.
- "recommended_action": { "type": "custom_exam"|"official_exam"|"mistakes"|"weak_topics"|"spaced_repetition", "filters": [Spanish tag values], "question_count": number, "reason": "why this action" }
- "predicted_ready_date": ISO date or null (estimate based on current improvement rate)
- "improvement_rate": weekly accuracy % improvement (number, can be negative)
- "study_tips": 3 actionable, specific strings in user's language. Each tip should reference a concrete topic or technique.
- "topic_priority_order": Spanish tag values ranked by impact on passing probability
- "learning_style_note": one sentence about what the data suggests about the student's learning pattern
- "confidence_areas": top 2 topics where user is strongest (for morale)
Return ONLY valid JSON, no markdown.`

function buildInsightsFallback(lang) {
  const es = lang === 'es'
  return {
    readiness_score: null,
    weak_topics: [],
    coach_message: es
      ? '¡Sigue estudiando! Completa otro examen para generar tus análisis personalizados con IA.'
      : 'Keep studying! Take another mock exam to generate your personalized AI insights.',
    recommended_action: { type: 'official_exam', filters: [] },
    predicted_ready_date: null,
    improvement_rate: null,
    study_tips: [],
    topic_priority_order: [],
    learning_style_note: null,
    confidence_areas: [],
    _fallback: true,
  }
}

export async function getAIInsights(userLanguage, aggregatedData, studyTrends = null) {
  if (!userLanguage || !aggregatedData) {
    console.warn('[groq] getAIInsights: missing args – fallback')
    return buildInsightsFallback(userLanguage ?? 'en')
  }
  try {
    const raw = await callGroq({
      label: 'getAIInsights',
      maxTokens: 1500,
      messages: [
        { role: 'system', content: INSIGHTS_PROMPT },
        {
          role: 'user',
          content: [
            `User Language: ${userLanguage}`,
            `Performance Data:\n${JSON.stringify(aggregatedData, null, 2)}`,
            studyTrends
              ? `Study Trends (last 14 days):\n${JSON.stringify(studyTrends, null, 2)}`
              : '',
            'Generate the JSON output.',
          ]
            .filter(Boolean)
            .join('\n\n'),
        },
      ],
    })
    return safeParseJSON(raw) ?? buildInsightsFallback(userLanguage)
  } catch (err) {
    console.error('[groq] getAIInsights failed:', err)
    return buildInsightsFallback(userLanguage)
  }
}

// ============================================================================
// 2. QUESTION EXPLANATION  (instant feedback after answering)
// ============================================================================
const EXPLAIN_PROMPT = `You are a friendly Spanish DGT driving theory tutor with deep expertise.
A student just answered a question. Provide a thorough, educational explanation.

You might be provided with a "Manual Reference" (HTML snippet) which contains the official rule; use it to ground your explanation.

Return JSON:
{
  "summary": "one-sentence verdict (correct/incorrect + key reason why)",
  "correct_explanation": "why the correct answer is right (2-3 sentences). Be specific about the rule or principle.",
  "wrong_explanation": "why the chosen answer is wrong (if applicable, 1-2 sentences). Explain the exact misconception.",
  "memory_tip": "a vivid, memorable tip or mnemonic to NEVER forget this rule. Use visual imagery, wordplay, or real-world analogies.",
  "law_reference": "relevant DGT regulation article or RGC section (string or null)",
  "common_confusion": "one sentence about what most students confuse with this rule (helps prevent future mistakes)",
  "difficulty_note": "easy|medium|hard — and one sentence explaining why this question trips people up (or why it should be easy)"
}
Return ONLY valid JSON.`

export async function getQuestionExplanation({
  question,
  options,
  correctIdx,
  selectedIdx,
  helpHtml,
  lang,
  userTopicAccuracy = null,
}) {
  const fallback = {
    summary: lang === 'es' ? 'Sin explicación disponible.' : 'No explanation available.',
    correct_explanation: '',
    wrong_explanation: '',
    memory_tip: '',
    law_reference: null,
    common_confusion: null,
    difficulty_note: null,
    _fallback: true,
  }
  try {
    const contextLines = [
      `Language: ${lang}`,
      `Question: ${questionText(question, lang)}`,
      `Options:\n${buildOptionsText(options, lang, correctIdx, selectedIdx)}`,
      `Manual Reference: ${cleanAndTruncate(helpHtml)}`,
      `Student chose: ${['A', 'B', 'C', 'D'][selectedIdx] ?? '?'}`,
      `Correct answer: ${['A', 'B', 'C', 'D'][correctIdx] ?? '?'}`,
    ]

    if (userTopicAccuracy !== null) {
      contextLines.push(
        `Student's accuracy on this topic: ${Math.round(userTopicAccuracy * 100)}% — tailor advice depth accordingly.`
      )
    }

    contextLines.push('Explain.')

    const raw = await callGroq({
      label: 'getQuestionExplanation',
      model: FAST_MODEL,
      maxTokens: 800,
      messages: [
        { role: 'system', content: EXPLAIN_PROMPT },
        { role: 'user', content: contextLines.join('\n') },
      ],
    })
    return safeParseJSON(raw) ?? fallback
  } catch (err) {
    console.error('[groq] getQuestionExplanation failed:', err)
    return fallback
  }
}

// ============================================================================
// 3. SMART HINT  (before answering – doesn't reveal answer)
// ============================================================================
const HINT_PROMPT = `You are a helpful DGT driving theory tutor.
Give a helpful HINT for a question WITHOUT revealing the correct answer.
Focus on the key concept or rule the question is testing.
You will be given the correct answer index to help you provide a more accurate and relevant hint, but remember: NEVER explicitly tell the student which option is correct.

Make the hint pedagogical — guide them to think about the right concept, like a Socratic teacher.

Return JSON:
{
  "hint": "a helpful clue (1-2 sentences) in the student's language. Use a question to guide thinking.",
  "concept": "the key driving concept being tested (5-8 words)",
  "think_about": "what specifically the student should consider before answering (one sentence)",
  "difficulty": "easy" | "medium" | "hard",
  "related_rule": "optional: the general traffic rule category this falls under (e.g., 'Priority rules', 'Speed limits')"
}
Return ONLY valid JSON.`

export async function getSmartHint({ question, options, correctIdx, lang, userHistory = null }) {
  const fallback = {
    hint:
      lang === 'es'
        ? 'Piensa en las normas de tráfico generales.'
        : 'Think about general traffic rules.',
    concept: lang === 'es' ? 'Normas de tráfico' : 'Traffic rules',
    think_about: null,
    difficulty: 'medium',
    related_rule: null,
    _fallback: true,
  }
  try {
    // Mark correct for the model's benefit without labelling it CORRECT for the student
    const optsText = (options ?? [])
      .map((o, i) => {
        const label = ['A', 'B', 'C', 'D'][i]
        const text = lang === 'en' ? o.text_en || o.text_es : o.text_es || o.text_en
        const mark = i === correctIdx ? ' [ADMIN: THIS IS THE CORRECT OPTION]' : ''
        return `${label}) ${text}${mark}`
      })
      .join('\n')

    const contextLines = [
      `Language: ${lang}`,
      `Question: ${questionText(question, lang)}`,
      `Options:\n${optsText}`,
      `Correct answer index (for your context): ${correctIdx ?? '?'}`,
    ]

    if (userHistory) {
      contextLines.push(
        `Student context: Has attempted this question ${userHistory.attempts} time(s), got it right ${userHistory.correctCount} time(s).`
      )
    }

    contextLines.push('Give a hint.')

    const raw = await callGroq({
      label: 'getSmartHint',
      model: FAST_MODEL,
      maxTokens: 400,
      messages: [
        { role: 'system', content: HINT_PROMPT },
        { role: 'user', content: contextLines.join('\n') },
      ],
    })
    return safeParseJSON(raw) ?? fallback
  } catch (err) {
    console.error('[groq] getSmartHint failed:', err)
    return fallback
  }
}

// ============================================================================
// 4. EXAM COACH FEEDBACK  (post-exam review page)
// ============================================================================
const COACH_PROMPT = `You are an expert DGT driving theory coach reviewing a student's exam.
Analyze their performance deeply and give personalized, actionable feedback.
You should act like a real driving school instructor who knows the student well.

Return JSON:
{
  "verdict": "passed" | "failed" | "close",
  "headline": "one bold motivational headline in user's language (make it memorable, not generic)",
  "summary": "2-3 sentences summarizing performance. Reference specific topics and numbers. Be honest but encouraging.",
  "strengths": ["list of 1-2 strong topics with what specifically they did well"],
  "weaknesses": ["list of 1-3 specific areas with concrete examples of mistakes"],
  "next_step": "one concrete, specific recommended next action in user's language (reference actual topics)",
  "priority_topics": ["Spanish tag values to study next, ranked by urgency"],
  "study_strategy": "one specific study technique recommendation based on their error pattern",
  "time_analysis": "one sentence about their pacing (too fast? too slow? good timing?)",
  "confidence_boost": "one personalized, specific motivational message in user's language referencing their actual progress"
}
Return ONLY valid JSON.`

export async function getExamCoachFeedback({
  examSummary,
  sessionHistory = [],
  skillProfile = null,
  lang,
}) {
  const fallback = {
    verdict: examSummary?.passed ? 'passed' : 'failed',
    headline: lang === 'es' ? '¡Sigue adelante!' : 'Keep going!',
    summary:
      lang === 'es'
        ? 'Completa más exámenes para obtener análisis personalizados.'
        : 'Complete more exams for personalized analysis.',
    strengths: [],
    weaknesses: [],
    next_step:
      lang === 'es'
        ? 'Practica los temas con más errores.'
        : 'Practice topics with the most errors.',
    priority_topics: [],
    study_strategy: null,
    time_analysis: null,
    confidence_boost:
      lang === 'es'
        ? '¡Cada intento te acerca más al aprobado!'
        : 'Every attempt brings you closer to passing!',
    _fallback: true,
  }
  try {
    let historyContext = ''
    if (sessionHistory.length > 0) {
      const histLines = sessionHistory
        .map(
          (s, i) =>
            `Session ${i + 1} (${new Date(s.completedAt).toLocaleDateString()}): score=${s.score ?? '?'}%, passed=${s.passed}, errors=${s.errorCount ?? '?'}, mode=${s.mode}`
        )
        .join('\n')
      historyContext = `\n\nRecent session history (oldest → newest):\n${histLines}`
    }

    let skillContext = ''
    if (skillProfile) {
      skillContext = `\n\nStudent skill profile: Level=${skillProfile.overallLevel}, Overall accuracy=${skillProfile.overallAccuracy}%, Total questions answered=${skillProfile.totalAnswered}`
      if (skillProfile.topics?.length > 0) {
        const topicLines = skillProfile.topics
          .sort((a, b) => a.accuracy - b.accuracy)
          .slice(0, 6)
          .map(
            (t) =>
              `  ${t.tag}: ${t.accuracy}% (${t.attempted} attempts, trend: ${t.trend || 'unknown'})`
          )
          .join('\n')
        skillContext += `\nTopic breakdown (weakest first):\n${topicLines}`
      }
    }

    const systemPrompt =
      COACH_PROMPT +
      (sessionHistory.length > 0
        ? '\n\nAlso include "trend": "improving"|"stable"|"declining", "improvement_pct": score change vs oldest session (number or null), "consistency_score": 0-100, "sessions_until_ready": estimated sessions until pass-ready (number or null).'
        : '')

    const raw = await callGroq({
      label: 'getExamCoachFeedback',
      maxTokens: 1200,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            `Language: ${lang}`,
            `Exam Results:\n${JSON.stringify(examSummary, null, 2)}`,
            historyContext,
            skillContext,
            'Generate coach feedback.',
          ]
            .filter(Boolean)
            .join('\n\n'),
        },
      ],
    })
    return safeParseJSON(raw) ?? fallback
  } catch (err) {
    console.error('[groq] getExamCoachFeedback failed:', err)
    return fallback
  }
}

// ============================================================================
// 5. AI EXAM RECOMMENDATION  (exam setup page)
// ============================================================================
const RECOMMEND_PROMPT = `You are a DGT exam strategy advisor with expertise in learning optimization.
Based on the student's recent performance, skill profile, and study patterns, recommend the BEST exam configuration to maximize improvement.

Consider:
- If they keep failing on specific topics → weak_topics mode
- If they have many accumulated mistakes → mistakes mode
- If they haven't practiced in a while → official mode for baseline
- If they're close to passing → focused custom exam
- If they're already passing → spaced_repetition to maintain knowledge

Return JSON:
{
  "recommended_mode": "official" | "custom" | "mistakes" | "weak_topics" | "bookmarks" | "spaced_repetition",
  "reason": "2-3 sentences explaining WHY this specific mode is the best choice right now. Be specific, not generic.",
  "suggested_topics": ["Spanish tag values if custom/weak_topics mode"],
  "suggested_question_count": number (10, 20, 30, or 40),
  "urgency": "low" | "medium" | "high",
  "tip": "one actionable study tip for today in user's language, referencing their specific situation",
  "warm_up_suggestion": "optional: a quick warm-up recommendation before starting",
  "expected_outcome": "what the student should aim for in this session",
  "alternative_mode": { "mode": "string", "reason": "one sentence why this is a good second choice" }
}
Return ONLY valid JSON.`

export async function getExamRecommendation({ recentStats, skillProfile = null, lang }) {
  const fallback = {
    recommended_mode: 'official',
    reason:
      lang === 'es'
        ? 'Practica con el formato oficial para acostumbrarte al examen real.'
        : 'Practice with the official format to get used to the real exam.',
    suggested_topics: [],
    suggested_question_count: 30,
    urgency: 'medium',
    tip:
      lang === 'es'
        ? 'Estudia 20 minutos al día para mejorar consistentemente.'
        : 'Study 20 minutes daily for consistent improvement.',
    warm_up_suggestion: null,
    expected_outcome: null,
    alternative_mode: null,
    _fallback: true,
  }
  if (!recentStats) return fallback
  try {
    const contextLines = [
      `Language: ${lang}`,
      `Recent Stats:\n${JSON.stringify(recentStats, null, 2)}`,
    ]

    if (skillProfile) {
      contextLines.push(
        `Skill Profile: Level=${skillProfile.overallLevel}, Accuracy=${skillProfile.overallAccuracy}%, Questions answered=${skillProfile.totalAnswered}`
      )
      if (skillProfile.topics?.length > 0) {
        const weakTopics = skillProfile.topics
          .filter((t) => t.accuracy < 70)
          .sort((a, b) => a.accuracy - b.accuracy)
          .slice(0, 5)
          .map((t) => `${t.tag} (${t.accuracy}%)`)
          .join(', ')
        if (weakTopics) contextLines.push(`Weak topics: ${weakTopics}`)
      }
    }

    contextLines.push('Recommend exam configuration.')

    const raw = await callGroq({
      label: 'getExamRecommendation',
      model: FAST_MODEL,
      maxTokens: 700,
      messages: [
        { role: 'system', content: RECOMMEND_PROMPT },
        { role: 'user', content: contextLines.join('\n\n') },
      ],
    })
    return safeParseJSON(raw) ?? fallback
  } catch (err) {
    console.error('[groq] getExamRecommendation failed:', err)
    return fallback
  }
}

// ============================================================================
// 6. PERSONALIZED STUDY PLAN  (AI-generated week-by-week roadmap)
// ============================================================================
const STUDY_PLAN_SYSTEM = `You are an expert DGT Spanish driving exam coach and adaptive learning specialist.
Your role is to generate personalized, realistic, and highly specific week-by-week study plans.
Always anchor advice to the student's ACTUAL data — weak topics, accuracy trends, and available time.
Be encouraging but honest about what is achievable given the time available.
Return ONLY valid JSON, no markdown.`

export async function getStudyPlan({
  skillProfile,
  targetDate,
  dailyMinutes = 30,
  studyTrends = null,
  lang = 'es',
}) {
  const fallback = {
    summary:
      lang === 'es'
        ? 'Practica con exámenes oficiales diariamente y repasa tus temas débiles.'
        : 'Practice with official exams daily and review your weak topics.',
    estimated_pass_ready: null,
    weeks: [],
    daily_tip:
      lang === 'es'
        ? 'Estudia 30 minutos al día de forma constante.'
        : 'Study 30 minutes daily consistently.',
    _fallback: true,
  }
  try {
    const daysUntilExam = Math.max(
      1,
      Math.ceil((new Date(targetDate) - new Date()) / (1_000 * 60 * 60 * 24))
    )
    const weeksAvailable = Math.ceil(daysUntilExam / 7)

    const weakTopics = (skillProfile.topics || [])
      .filter((t) => t.accuracy < 70)
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 8)
      .map((t) => `${t.tag} (${t.accuracy}% accuracy, trend: ${t.trend || 'unknown'})`)
      .join(', ')

    const strongTopics = (skillProfile.topics || [])
      .filter((t) => t.accuracy >= 85 && t.attempted >= 10)
      .map((t) => t.tag)
      .join(', ')

    let consistencyNote = ''
    if (studyTrends?.length > 0) {
      const activeDays = studyTrends.filter((d) => d.questions > 0).length
      const avgQPerDay = (
        studyTrends.reduce((s, d) => s + (d.questions || 0), 0) / studyTrends.length
      ).toFixed(1)
      consistencyNote = `Study consistency: ${activeDays}/${studyTrends.length} days active recently (avg ${avgQPerDay} questions/day).`
    }

    const prompt = `Create a personalized, adaptive study plan for this DGT student.

Student profile:
- Overall level: ${skillProfile.overallLevel}
- Overall accuracy: ${skillProfile.overallAccuracy}%
- Total questions answered: ${skillProfile.totalAnswered}
- Weak topics (tag + accuracy + trend): ${weakTopics || 'none identified yet'}
- Strong topics (need less practice): ${strongTopics || 'none yet'}
- Days until exam: ${daysUntilExam}
- Weeks available: ${weeksAvailable}
- Daily study time: ${dailyMinutes} minutes
${consistencyNote ? `- ${consistencyNote}` : ''}

Return JSON:
{
  "summary": "2-sentence overview. Be specific about what they'll achieve and what the biggest risk is.",
  "estimated_pass_ready": "ISO date string when student should be ready to pass, or null if insufficient data",
  "readiness_assessment": "one honest sentence: is ${daysUntilExam} days realistically enough given their current level?",
  "weeks": [
    {
      "week_number": 1,
      "theme": "specific theme name (not generic like 'Review week')",
      "focus_topics": ["Spanish tag1", "Spanish tag2"],
      "exam_modes": ["official", "weak_topics"],
      "daily_sessions": 1,
      "session_question_count": 20,
      "milestone_target": "specific measurable goal, e.g. 'Achieve 80%+ accuracy on señales de peligro'",
      "technique": "specific study technique for this week with a concrete daily action"
    }
  ],
  "daily_routine": {
    "warm_up": "1-2 minute warm-up activity tailored to their weak areas",
    "main_study": "core study activity for ${dailyMinutes} minutes",
    "cool_down": "1-minute consolidation activity"
  },
  "daily_tip": "one actionable daily habit specific to their actual weak areas",
  "critical_warning": "optional: one critical risk to flag (e.g., 'At this pace, 3 weeks may not be enough — consider booking later') or null"
}

Language: ${lang === 'es' ? 'Spanish' : 'English'}. Maximum ${Math.min(weeksAvailable, 8)} weeks. Be encouraging but realistic.`

    const raw = await callGroq({
      label: 'getStudyPlan',
      messages: [
        { role: 'system', content: STUDY_PLAN_SYSTEM },
        { role: 'user', content: prompt },
      ],
      model: MODEL,
      temperature: 0.3,
      json: true,
      timeout: 28_000,
      maxTokens: 2000,
    })
    return safeParseJSON(raw) ?? fallback
  } catch (err) {
    console.error('[groq] getStudyPlan failed:', err)
    return fallback
  }
}

// ============================================================================
// 7. MISTAKE PATTERN ANALYSIS  (identify conceptual knowledge gaps)
// ============================================================================

export async function getMistakePatterns({
  mistakeGroups,
  totalQuestions = null,
  overallAccuracy = null,
  lang = 'es',
}) {
  const fallback = {
    patterns: null,
    priority_fix: null,
    study_tip:
      lang === 'es'
        ? 'Repasa los temas con más errores y practica con el modo "Errores".'
        : 'Review topics with the most errors and practice using "Mistakes" mode.',
    _fallback: true,
  }
  try {
    const groupsText = mistakeGroups
      .map(
        (g) =>
          `Topic: ${g.topic} (${g.count} mistakes)\nExample questions:\n${g.examples
            .slice(0, 3)
            .map((e) => `  - ${e.questionText?.substring(0, 120) || 'N/A'}`)
            .join('\n')}`
      )
      .join('\n\n')

    const prompt = `You are a DGT Spanish driving exam expert and learning psychologist. Analyze these mistake patterns to identify deep conceptual knowledge gaps — not just surface-level topic counts.

${groupsText}
${totalQuestions ? `\nTotal questions attempted: ${totalQuestions}` : ''}
${overallAccuracy !== null ? `Overall accuracy: ${overallAccuracy}%` : ''}

Look for:
1. Cross-topic confusion patterns (e.g., student confuses priority rules in both intersection and roundabout questions)
2. Visual recognition failures (e.g., repeatedly confusing similar-looking signs)
3. Rule application errors (knows the rule but applies it to wrong situations)
4. Speed/pressure mistakes (knows the answer but gets it wrong under time pressure)

For each topic cluster, identify the ROOT CAUSE. Be specific and actionable.

Return JSON:
{
  "patterns": [
    {
      "concept": "brief concept name (5-8 words)",
      "topic": "Spanish topic tag",
      "frequency": number,
      "severity": "critical" | "moderate" | "minor",
      "root_cause": "why user gets this wrong (1-2 sentences). Be psychologically insightful.",
      "fix_strategy": "specific study action (2-3 sentences). Include a concrete technique.",
      "fix_time_estimate": "estimated time to fix this gap (e.g., '2-3 focused sessions')",
      "example_question": "brief example of a typical mistake question",
      "related_patterns": ["other topic tags that share this conceptual confusion"]
    }
  ],
  "priority_fix": "the single most impactful concept to study first (with reasoning)",
  "cross_topic_insights": "one paragraph about how the mistakes connect. What is the deeper learning gap?",
  "study_tip": "one overarching strategy based on all patterns combined",
  "recommended_session": {
    "mode": "mistakes" | "weak_topics" | "custom",
    "topics": ["specific tags to focus on"],
    "question_count": number,
    "reason": "why this specific session would help most right now"
  }
}

Language: ${lang === 'es' ? 'Spanish' : 'English'}. Be direct, specific, and psychologically insightful — no generic advice.
Return ONLY valid JSON.`

    const raw = await callGroq({
      label: 'getMistakePatterns',
      messages: [{ role: 'user', content: prompt }],
      model: MODEL,
      temperature: 0.2,
      json: true,
      timeout: 30_000,
      maxTokens: 1800,
    })
    return safeParseJSON(raw) ?? fallback
  } catch (err) {
    console.error('[groq] getMistakePatterns failed:', err)
    return fallback
  }
}

// ============================================================================
// 8. QUESTION DEEP DIVE  (when user gets same question wrong multiple times)
// ============================================================================

export async function getQuestionDeepDive({
  question,
  options,
  correctIdx,
  userAnswerHistory,
  helpHtml,
  lang,
}) {
  const fallback = { analysis: null, _fallback: true }
  try {
    const historyLines = userAnswerHistory
      .map(
        (a, i) =>
          `  Attempt ${i + 1}: chose ${['A', 'B', 'C', 'D'][a.selected] ?? '?'} (${a.correct ? 'correct' : 'incorrect'}, ${a.timeSec}s)`
      )
      .join('\n')

    const prompt = `You are a DGT tutor analyzing why a student keeps getting a specific question wrong.

Question: ${questionText(question, lang)}
Options:
${buildOptionsText(options, lang, correctIdx)}
Manual Reference: ${cleanAndTruncate(helpHtml)}

Student's answer history on this specific question:
${historyLines}

Return JSON:
{
  "analysis": "2-3 sentences explaining the specific misconception this student has about this question",
  "likely_confusion": "what the student is probably confusing this with",
  "targeted_tip": "a very specific tip to remember the correct answer to THIS question",
  "similar_trap_questions": "describe 1-2 types of questions where similar confusion might occur",
  "mastery_check": "one quick mental exercise the student can do to verify they've truly understood"
}

Language: ${lang === 'es' ? 'Spanish' : 'English'}.
Return ONLY valid JSON.`

    const raw = await callGroq({
      label: 'getQuestionDeepDive',
      model: FAST_MODEL,
      json: true, // ← was missing in original
      maxTokens: 600,
      timeout: 15_000,
      messages: [{ role: 'user', content: prompt }],
    })
    return safeParseJSON(raw) ?? fallback
  } catch (err) {
    console.error('[groq] getQuestionDeepDive failed:', err)
    return fallback
  }
}

// ============================================================================
// 9. SESSION SUMMARY  (quick AI summary at end of practice session)
// ============================================================================

export async function getSessionQuickSummary({
  correctCount,
  totalCount,
  timeSeconds,
  mode,
  topicBreakdown,
  lang,
}) {
  const fallback = { one_liner: null, emoji_verdict: null, _fallback: true }
  try {
    const accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0
    const weakTopics = topicBreakdown
      .filter((t) => t.accuracy < 60)
      .map((t) => t.tag)
      .join(', ')

    const prompt = `Student just finished a ${mode} session: ${correctCount}/${totalCount} correct (${accuracy}%), ${Math.round(timeSeconds / 60)} minutes.
${weakTopics ? `Struggled with: ${weakTopics}` : 'No major weak areas this session.'}

Return JSON:
{
  "one_liner": "One enthusiastic or encouraging sentence in ${lang === 'es' ? 'Spanish' : 'English'} (be creative, not repetitive!)",
  "emoji_verdict": "exactly ONE emoji that captures the performance (🎯🔥💪🌟😤📚🎉 etc.)",
  "micro_tip": "one ultra-specific 10-second tip they can apply immediately in ${lang === 'es' ? 'Spanish' : 'English'}"
}
Return ONLY valid JSON.`

    const raw = await callGroq({
      label: 'getSessionQuickSummary',
      model: FAST_MODEL,
      json: true, // ← was missing in original
      temperature: 0.5,
      maxTokens: 200,
      timeout: 8_000,
      messages: [{ role: 'user', content: prompt }],
    })
    return safeParseJSON(raw) ?? fallback
  } catch (err) {
    console.error('[groq] getSessionQuickSummary failed:', err)
    return fallback
  }
}

export default groq
