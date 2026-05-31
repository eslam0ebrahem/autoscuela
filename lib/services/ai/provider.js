// provider.js
import crypto from 'node:crypto'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export const MODEL = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile'
export const FAST_MODEL = process.env.GROQ_FAST_MODEL ?? 'llama-3.3-70b-versatile'

const DEFAULT_TIMEOUT = 25_000
const DEFAULT_TEMP = 0.2
const MAX_RETRIES = 3
const RETRY_DELAY = 800

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const jitter = (ms) => ms + Math.floor(Math.random() * ms * 0.25)

export function hashKey(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 16)
}

export function pickLocalizedText(obj, lang, esKey = 'text_es', enKey = 'text_en') {
  if (!obj) return ''
  return lang === 'en' ? obj?.[enKey] || obj?.[esKey] || '' : obj?.[esKey] || obj?.[enKey] || ''
}

export function questionText(question, lang) {
  return lang === 'en' ? question?.en || question?.es || '' : question?.es || question?.en || ''
}

export function buildOptionsText(options = [], lang, correctIdx, selectedIdx) {
  return options
    .map((o, i) => {
      const label = ['A', 'B', 'C', 'D'][i] ?? String(i + 1)
      const text = pickLocalizedText(o, lang)
      const isCorrect = Number.isInteger(correctIdx) && i === correctIdx
      const isSelected = Number.isInteger(selectedIdx) && i === selectedIdx

      let mark = ''
      if (isCorrect && isSelected) mark = ' ✅ CORRECT & SELECTED'
      else if (isCorrect) mark = ' ✅ CORRECT'
      else if (isSelected) mark = ' ❌ SELECTED'

      return `${label}) ${text}${mark}`
    })
    .join('\n')
}

export function cleanAndTruncate(html, maxLen = 2000) {
  if (!html) return 'None provided'
  const text = String(html)
    .replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()

  return text.length <= maxLen ? text : `${text.slice(0, maxLen)}… [TRUNCATED]`
}

export function safeParseJSON(raw) {
  if (!raw) return null
  
  let text = String(raw).trim()
  
  // Strip markdown code blocks anywhere in the text
  const mdMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (mdMatch) {
    text = mdMatch[1].trim()
  }

  const candidates = [text, text.replace(/,(\s*[}\]])/g, '$1')]

  for (let t of candidates) {
    try {
      return JSON.parse(t)
    } catch {
      /* ignore */
    }
    
    // Fallback: try to extract the first full object/array
    const start = t.search(/[{[]/)
    if (start !== -1) {
      const opener = t[start]
      const closer = opener === '{' ? '}' : ']'
      const end = t.lastIndexOf(closer)
      if (end > start) {
        try {
          return JSON.parse(t.slice(start, end + 1))
        } catch {
          /* ignore */
        }
      }
    }
  }

  return null
}

function normalizeObject(parsed, defaults = {}) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ...defaults, _fallback: true }
  return { ...defaults, ...parsed }
}

function isRetryable(error) {
  return (
    (error?.status >= 500 && error?.status < 600) ||
    error?.status === 429 ||
    error?.code === 'ECONNRESET' ||
    error?.message?.toLowerCase?.().includes('timeout') ||
    error?.message?.toLowerCase?.().includes('rate_limit')
  )
}

export async function callGroq({
  messages,
  model = MODEL,
  temperature = DEFAULT_TEMP,
  json = true,
  timeout = DEFAULT_TIMEOUT,
  maxTokens = 1500,
  label = 'groq',
}) {
  let lastError

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const completionPromise = groq.chat.completions.create({
        model,
        temperature,
        max_tokens: maxTokens,
        ...(json ? { response_format: { type: 'json_object' } } : {}),
        messages,
      })

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`[${label}] timeout after ${timeout}ms`)), timeout)
      )

      const completion = await Promise.race([completionPromise, timeoutPromise])
      return completion?.choices?.[0]?.message?.content ?? ''
    } catch (error) {
      lastError = error
      if (!isRetryable(error) || attempt === MAX_RETRIES) break
      await sleep(jitter(RETRY_DELAY * 2 ** (attempt - 1)))
    }
  }

  throw lastError
}

export async function callJsonTask({
  label,
  messages,
  defaults,
  model = FAST_MODEL,
  maxTokens = 800,
  temperature = DEFAULT_TEMP,
  timeout = DEFAULT_TIMEOUT,
}) {
  try {
    const raw = await callGroq({
      label,
      messages,
      model,
      maxTokens,
      temperature,
      timeout,
      json: true,
    })

    const parsed = safeParseJSON(raw)
    return normalizeObject(parsed, defaults)
  } catch (err) {
    console.error(`[${label}] failed:`, err)
    return { ...defaults, _fallback: true }
  }
}

export default groq