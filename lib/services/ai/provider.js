import Groq from 'groq-sdk'

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
export const MODEL = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile'
export const FAST_MODEL = process.env.GROQ_FAST_MODEL ?? 'llama-3.1-8b-instant'
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
export function safeParseJSON(raw) {
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

export function cleanAndTruncate(html, maxLen = 2000) {
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
export function buildOptionsText(options = [], lang, correctIdx, selectedIdx) {
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
export function questionText(question, lang) {
  return lang === 'en' ? question?.en || question?.es : question?.es || question?.en
}

// ---------------------------------------------------------------------------
// Core Groq caller  (retry + timeout + structured logging)
// ---------------------------------------------------------------------------
export async function callGroq({
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

export default groq
