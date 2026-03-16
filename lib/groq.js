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

function safeParseJSON(raw) {
  try {
    return JSON.parse(raw)
  } catch {
    const stripped = raw
      .replace(/^```json\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()
    try {
      return JSON.parse(stripped)
    } catch {
      return null
    }
  }
}

function cleanAndTruncate(html, maxLen = 2000) {
  if (!html) return 'None provided'
  // Remove style/script tags and their content
  let text = html.replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi, '')
  // Strip all HTML tags
  text = text.replace(/<[^>]+>/g, ' ')
  // Decode basic entities and collapse whitespace
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()

  if (text.length <= maxLen) return text
  return text.substring(0, maxLen) + '... [TRUNCATED]'
}

async function callGroq({
  messages,
  model = MODEL,
  temperature = TEMPERATURE,
  json = true,
  timeout = 25000,
}) {
  let lastError
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Wrap in timeout promise
      const completionPromise = groq.chat.completions.create({
        model,
        temperature,
        ...(json && { response_format: { type: 'json_object' } }),
        messages,
      })

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Groq timeout after ${timeout}ms`)), timeout)
      )

      const completion = await Promise.race([completionPromise, timeoutPromise])
      return completion.choices[0]?.message?.content ?? ''
    } catch (error) {
      lastError = error
      const retryable =
        error?.status >= 500 || error?.code === 'ECONNRESET' || error?.message?.includes('timeout')
      if (!retryable || attempt === MAX_RETRIES) break
      const delay = RETRY_DELAY * 2 ** (attempt - 1)
      console.warn(`[groq] attempt ${attempt} failed – retrying in ${delay}ms`, error?.message)
      await sleep(delay)
    }
  }
  throw lastError
}

// ============================================================================
// 1. AI INSIGHTS  (dashboard / stats page)
// ============================================================================
const INSIGHTS_PROMPT = `You are an expert Spanish DGT driving instructor and data analyst.
Analyze the student's performance data and return a JSON object with:
- "readiness_score": 0-100 (90+ = ready for real DGT exam)
- "weak_topics": top 2-3 weak topic names in user's language
- "coach_message": encouraging message in user's language (max 3 sentences)
- "recommended_action": { "type": "custom_exam"|"official_exam", "filters": [Spanish tag values] }
- "predicted_ready_date": ISO date or null
- "improvement_rate": weekly accuracy % improvement (number)
- "study_tips": 2-3 actionable strings in user's language
- "topic_priority_order": Spanish tag values ranked by impact
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
    _fallback: true,
  }
}

export async function getAIInsights(userLanguage, aggregatedData) {
  if (!userLanguage || !aggregatedData) {
    console.warn('[groq] getAIInsights: missing args – fallback')
    return buildInsightsFallback(userLanguage ?? 'en')
  }
  try {
    const raw = await callGroq({
      messages: [
        { role: 'system', content: INSIGHTS_PROMPT },
        {
          role: 'user',
          content: [
            `User Language: ${userLanguage}`,
            `Performance Data:\n${JSON.stringify(aggregatedData, null, 2)}`,
            'Generate the JSON output.',
          ].join('\n\n'),
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
const EXPLAIN_PROMPT = `You are a friendly Spanish DGT driving theory tutor.
A student just answered a question. Explain clearly WHY the correct answer is right
and why the wrong answers are wrong. Use the student's language.

You might be provided with a "Manual Reference" (HTML snippet) which contains the official rule; use it to ground your explanation. 

Return JSON:
{
  "summary": "one-sentence verdict (correct/incorrect + why)",
  "correct_explanation": "why the correct answer is right (2-3 sentences)",
  "wrong_explanation": "why the chosen answer is wrong (if applicable, 1-2 sentences)",
  "memory_tip": "a memorable tip or mnemonic to remember this rule",
  "law_reference": "optional: relevant DGT regulation or article (string or null)"
}
Return ONLY valid JSON.`

export async function getQuestionExplanation({
  question,
  options,
  correctIdx,
  selectedIdx,
  helpHtml,
  lang,
}) {
  const fallback = {
    summary: lang === 'es' ? 'Sin explicación disponible.' : 'No explanation available.',
    correct_explanation: '',
    wrong_explanation: '',
    memory_tip: '',
    law_reference: null,
    _fallback: true,
  }
  try {
    const qText = lang === 'en' ? question?.en || question?.es : question?.es || question?.en
    const opts = (options ?? [])
      .map((o, i) => {
        const label = ['A', 'B', 'C', 'D'][i]
        const text = lang === 'en' ? o.text_en || o.text_es : o.text_es || o.text_en
        const mark = i === correctIdx ? ' ✅ CORRECT' : i === selectedIdx ? ' ❌ SELECTED' : ''
        return `${label}) ${text}${mark}`
      })
      .join('\n')
    const raw = await callGroq({
      model: FAST_MODEL,
      messages: [
        { role: 'system', content: EXPLAIN_PROMPT },
        {
          role: 'user',
          content: [
            `Language: ${lang}`,
            `Question: ${qText}`,
            `Options:\n${opts}`,
            `Manual Reference: ${cleanAndTruncate(helpHtml)}`,
            `Student chose: ${['A', 'B', 'C', 'D'][selectedIdx] ?? '?'}`,
            `Correct answer: ${['A', 'B', 'C', 'D'][correctIdx] ?? '?'}`,
            'Explain.',
          ].join('\n'),
        },
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

Return JSON:
{
  "hint": "a helpful clue (1-2 sentences) in the student's language",
  "concept": "the key driving concept being tested (3-6 words)",
  "difficulty": "easy" | "medium" | "hard"
}
Return ONLY valid JSON.`

export async function getSmartHint({ question, options, correctIdx, lang }) {
  const fallback = {
    hint:
      lang === 'es'
        ? 'Piensa en las normas de tráfico generales.'
        : 'Think about general traffic rules.',
    concept: lang === 'es' ? 'Normas de tráfico' : 'Traffic rules',
    difficulty: 'medium',
    _fallback: true,
  }
  try {
    const qText = lang === 'en' ? question?.en || question?.es : question?.es || question?.en
    const opts = (options ?? [])
      .map((o, i) => {
        const label = ['A', 'B', 'C', 'D'][i]
        const text = lang === 'en' ? o.text_en || o.text_es : o.text_es || o.text_en
        const mark = i === correctIdx ? ' [ADMIN: THIS IS THE CORRECT OPTION]' : ''
        return `${label}) ${text}${mark}`
      })
      .join('\n')

    const raw = await callGroq({
      model: FAST_MODEL,
      messages: [
        { role: 'system', content: HINT_PROMPT },
        {
          role: 'user',
          content: [
            `Language: ${lang}`,
            `Question: ${qText}`,
            `Options:\n${opts}`,
            `Correct answer index (for your context): ${correctIdx ?? '?'}`,
            'Give a hint.',
          ].join('\n'),
        },
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
Analyze their performance and give personalized, actionable feedback.

Return JSON:
{
  "verdict": "passed" | "failed" | "close",
  "headline": "one bold motivational headline in user's language",
  "summary": "2-3 sentences summarizing performance in user's language",
  "strengths": ["list of 1-2 strong topics/patterns (strings)"],
  "weaknesses": ["list of 1-3 specific areas to improve (strings)"],
  "next_step": "one concrete recommended next action in user's language",
  "priority_topics": ["Spanish tag values to study next", ...],
  "confidence_boost": "one short motivational quote in user's language"
}
Return ONLY valid JSON.`

export async function getExamCoachFeedback({ examSummary, lang }) {
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
    confidence_boost:
      lang === 'es'
        ? '¡Cada intento te acerca más al aprobado!'
        : 'Every attempt brings you closer to passing!',
    _fallback: true,
  }
  try {
    const raw = await callGroq({
      messages: [
        { role: 'system', content: COACH_PROMPT },
        {
          role: 'user',
          content: [
            `Language: ${lang}`,
            `Exam Results:\n${JSON.stringify(examSummary, null, 2)}`,
            'Generate coach feedback.',
          ].join('\n\n'),
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
const RECOMMEND_PROMPT = `You are a DGT exam strategy advisor.
Based on the student's recent performance, recommend the BEST exam configuration to maximize improvement.

Return JSON:
{
  "recommended_mode": "official" | "custom" | "mistakes" | "weak_topics" | "bookmarks",
  "reason": "brief explanation why (1-2 sentences) in user's language",
  "suggested_topics": ["Spanish tag values if custom mode"],
  "suggested_question_count": 20 | 30 | 40,
  "urgency": "low" | "medium" | "high",
  "tip": "one study tip for today in user's language"
}
Return ONLY valid JSON.`

export async function getExamRecommendation({ recentStats, lang }) {
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
    _fallback: true,
  }
  if (!recentStats) return fallback
  try {
    const raw = await callGroq({
      model: FAST_MODEL,
      messages: [
        { role: 'system', content: RECOMMEND_PROMPT },
        {
          role: 'user',
          content: [
            `Language: ${lang}`,
            `Recent Stats:\n${JSON.stringify(recentStats, null, 2)}`,
            'Recommend exam configuration.',
          ].join('\n\n'),
        },
      ],
    })
    return safeParseJSON(raw) ?? fallback
  } catch (err) {
    console.error('[groq] getExamRecommendation failed:', err)
    return fallback
  }
}

export default groq
