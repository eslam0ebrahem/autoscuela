import Groq from 'groq-sdk'

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const MODEL = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile'
const TEMPERATURE = 0.2
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 800

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are an expert Spanish DGT (Dirección General de Tráfico) driving instructor and data analyst.
Your goal is to analyze a student's driving theory test performance data and provide a highly accurate readiness score and personalized study advice.

Rules:
1. Calculate a "readiness_score" between 0 and 100. A score of 90+ means they are ready for the real DGT exam (max 3 errors per 30 questions). Weight recent accuracy and topic mastery heavily.
2. Identify the top 2–3 "weak_topics" based on low accuracy AND high average time taken.
3. Write a "coach_message" in the user's preferred language. Be encouraging, max 3 sentences, mention the weakest topic, and suggest one concrete next step.
4. Estimate "predicted_ready_date" as ISO date (YYYY-MM-DD) when they'll reach 90 % readiness at their current pace. Return null if insufficient data.
5. Calculate "improvement_rate" as weekly accuracy improvement percentage (e.g. 2.3 or -1.1).
6. Provide "study_tips" as 2–3 specific, actionable tips tailored to their data (array of strings).
7. Return "topic_priority_order" as array of topic names ranked by impact on readiness score.
8. You MUST return ONLY valid JSON. No markdown fences, no prose outside the JSON object.

Expected output shape (all keys required):
{
  "readiness_score": 68,
  "weak_topics": ["Illness and Medication", "Right of Way"],
  "coach_message": "...",
  "recommended_action": { "type": "custom_exam", "filters": ["Illness and Medication", "Right of Way"] },
  "predicted_ready_date": "2026-04-15",
  "improvement_rate": 2.3,
  "study_tips": ["Focus on...", "Try practicing...", "Remember to..."],
  "topic_priority_order": ["Right of Way", "Illness and Medication", "Speed Limits"]
}`

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Exponential-backoff sleep. */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Safe JSON parser – returns null instead of throwing on malformed input.
 * @param {string} raw
 * @returns {object|null}
 */
function safeParseJSON(raw) {
  try {
    return JSON.parse(raw)
  } catch {
    // Strip accidental markdown fences the model may still include
    const stripped = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
    try {
      return JSON.parse(stripped)
    } catch {
      return null
    }
  }
}

/**
 * Build a language-aware fallback insights object when the AI call fails.
 * @param {string} lang
 * @returns {object}
 */
function buildFallback(lang) {
  const isEs = lang === 'es'
  return {
    readiness_score: null,
    weak_topics: [],
    coach_message: isEs
      ? '¡Sigue estudiando! Completa otro examen de práctica para generar tus análisis personalizados con IA.'
      : 'Keep studying! Take another mock exam to generate your personalized AI insights.',
    recommended_action: { type: 'official_exam', filters: [] },
    predicted_ready_date: null,
    improvement_rate: null,
    study_tips: [],
    topic_priority_order: [],
    _fallback: true,
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Call Groq and return structured AI insights for a DGT student.
 *
 * @param {string} userLanguage   - BCP-47 language tag, e.g. "es" or "en"
 * @param {object} aggregatedData - Pre-aggregated performance data from the DB
 * @returns {Promise<object>}     - Parsed insights object (never throws)
 */
export async function getAIInsights(userLanguage, aggregatedData) {
  if (!userLanguage || !aggregatedData) {
    console.warn('[groq] getAIInsights called with missing arguments – returning fallback.')
    return buildFallback(userLanguage ?? 'en')
  }

  const userMessage = [
    `User Preferred Language: ${userLanguage}`,
    `Student Performance Data:\n${JSON.stringify(aggregatedData, null, 2)}`,
    'Generate the JSON output.',
  ].join('\n\n')

  let lastError

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const completion = await groq.chat.completions.create({
        model: MODEL,
        temperature: TEMPERATURE,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
      })

      const raw = completion.choices[0]?.message?.content
      if (!raw) throw new Error('Empty response from Groq')

      const parsed = safeParseJSON(raw)
      if (!parsed) throw new Error('Groq returned unparseable JSON')

      return parsed
    } catch (error) {
      lastError = error
      const isRetryable = error?.status >= 500 || error?.code === 'ECONNRESET'
      if (!isRetryable || attempt === MAX_RETRIES) break

      const delay = RETRY_DELAY_MS * 2 ** (attempt - 1)
      console.warn(`[groq] Attempt ${attempt} failed – retrying in ${delay} ms…`, error?.message)
      await sleep(delay)
    }
  }

  console.error('[groq] All attempts failed:', lastError)
  return buildFallback(userLanguage)
}

export default groq
