import {
  callJsonTask,
  MODEL,
  FAST_MODEL,
  cleanAndTruncate,
  buildOptionsText,
  questionText,
  hashKey,
} from './provider.js'
import { withCache } from './cache.js'

const OPTION_LABELS = ['A', 'B', 'C', 'D']

function optionLabel(idx) {
  return OPTION_LABELS[idx] ?? '?'
}

function makeQuestionSignature({ question, options, correctIdx, selectedIdx, lang, extra = {} }) {
  return hashKey(
    JSON.stringify({
      lang,
      question: questionText(question, lang),
      options: (options ?? []).map((o) => ({
        es: o?.text_es ?? '',
        en: o?.text_en ?? '',
      })),
      correctIdx,
      selectedIdx,
      extra,
    })
  )
}

function masteryBand(userTopicAccuracy) {
  if (userTopicAccuracy === null || userTopicAccuracy === undefined) return null
  const pct = Math.round(userTopicAccuracy * 100)
  if (pct >= 85) return `${pct}% (strong)`
  if (pct >= 65) return `${pct}% (developing)`
  return `${pct}% (weak)`
}

// ============================================================================
// 2. QUESTION EXPLANATION
// ============================================================================
const EXPLAIN_PROMPT = `You are a friendly Spanish DGT driving theory tutor with deep expertise.
A student just answered a question. Provide a thorough, educational explanation.

You may be given a "Manual Reference" snippet containing the official rule. Use it to ground your explanation when relevant.

Return ONLY valid JSON with:
{
  "summary": "one-sentence verdict (correct/incorrect + key reason)",
  "correct_explanation": "why the correct answer is right (2-3 sentences)",
  "wrong_explanation": "why the chosen answer is wrong (1-2 sentences, or empty string if not applicable)",
  "memory_tip": "a vivid memory aid or mnemonic",
  "law_reference": "relevant DGT regulation article or RGC section (string or null)",
  "common_confusion": "one sentence about what students usually confuse this with",
  "difficulty_note": "easy|medium|hard — followed by a short explanation"
}`

export async function getQuestionExplanation({
  question,
  options,
  correctIdx,
  selectedIdx,
  helpHtml,
  lang = 'es',
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

  const cacheKey = `expl_${makeQuestionSignature({
    question,
    options,
    correctIdx,
    selectedIdx,
    lang,
    extra: { help: cleanAndTruncate(helpHtml, 300), acc: userTopicAccuracy },
  })}`

  return withCache(cacheKey, async () => {
    const contextLines = [
      `Language: ${lang}`,
      `Question: ${questionText(question, lang)}`,
      `Options:\n${buildOptionsText(options, lang, correctIdx, selectedIdx)}`,
      `Manual Reference: ${cleanAndTruncate(helpHtml)}`,
      `Student chose: ${optionLabel(selectedIdx)}`,
      `Correct answer: ${optionLabel(correctIdx)}`,
      `Verdict: ${selectedIdx === correctIdx ? 'CORRECT' : 'INCORRECT'}`,
      userTopicAccuracy !== null
        ? `Student topic mastery: ${masteryBand(userTopicAccuracy)}`
        : null,
      'Explain clearly and teach the rule, not just the answer.',
    ].filter(Boolean)

    return callJsonTask({
      label: 'getQuestionExplanation',
      model: FAST_MODEL,
      maxTokens: 800,
      defaults: fallback,
      messages: [
        { role: 'system', content: EXPLAIN_PROMPT },
        { role: 'user', content: contextLines.join('\n') },
      ],
    })
  })
}

// ============================================================================
// 3. SMART HINT
// ============================================================================
const HINT_PROMPT = `You are a helpful DGT driving theory tutor.
Give a useful hint WITHOUT revealing the answer.

Focus on the key concept or rule being tested. You may be told the correct answer index for internal guidance, but NEVER reveal the option letter, index, or answer text.

Return ONLY valid JSON with:
{
  "hint": "a helpful clue (1-2 sentences) in the student's language, ideally guiding with a question",
  "concept": "the key driving concept being tested (5-8 words)",
  "think_about": "what specifically the student should consider before answering",
  "difficulty": "easy|medium|hard",
  "related_rule": "general traffic rule category or null"
}`

export async function getSmartHint({
  question,
  options,
  correctIdx,
  lang = 'es',
  userHistory = null,
}) {
  const fallback = {
    hint: lang === 'es'
      ? 'Piensa en la norma general que se aplica en esta situación.'
      : 'Think about the general rule that applies in this situation.',
    concept: lang === 'es' ? 'Normas de tráfico' : 'Traffic rules',
    think_about: null,
    difficulty: 'medium',
    related_rule: null,
    _fallback: true,
  }
  const cacheKey = `hint_${makeQuestionSignature({
    question,
    options,
    correctIdx,
    lang,
    extra: { attempts: userHistory?.attempts ?? 0, correctCount: userHistory?.correctCount ?? 0 },
  })}`
  return withCache(cacheKey, async () => {
    const cleanOptions = (options ?? [])
      .map((o, i) => {
        const label = optionLabel(i)
        const text = lang === 'en' ? o?.text_en || o?.text_es : o?.text_es || o?.text_en
        return `${label}) ${text}`
      })
      .join('\n')

    const contextLines = [
      `Language: ${lang}`,
      `Question: ${questionText(question, lang)}`,
      `Options:\n${cleanOptions}`,
      `Internal correct option index: ${correctIdx ?? '?'}`,
      userHistory
        ? `Student history: attempts=${userHistory.attempts ?? 0}, correct_count=${userHistory.correctCount ?? 0}`
        : null,
      'Give a pedagogical hint without revealing the answer.',
    ].filter(Boolean)

    return callJsonTask({
      label: 'getSmartHint',
      model: FAST_MODEL,
      maxTokens: 400,
      defaults: fallback,
      messages: [
        { role: 'system', content: HINT_PROMPT },
        { role: 'user', content: contextLines.join('\n') },
      ],
    })
  })
}

// ============================================================================
// 7. MISTAKE PATTERN ANALYSIS
// ============================================================================
const MISTAKE_PATTERNS_PROMPT = `You are a DGT Spanish driving exam expert and learning psychologist.
Analyze mistake clusters to identify deep conceptual gaps, not just topic counts.

Look for:
1. Cross-topic confusion.
2. Visual recognition failures.
3. Rule application errors.
4. Speed or pressure mistakes.

Return ONLY valid JSON with:
{
  "patterns": [
    {
      "concept": "brief concept name",
      "topic": "Spanish topic tag",
      "frequency": 0,
      "severity": "critical|moderate|minor",
      "root_cause": "why the student gets this wrong",
      "fix_strategy": "specific study action",
      "fix_time_estimate": "estimated time to improve",
      "example_question": "typical mistake example",
      "related_patterns": ["other connected topic tags"]
    }
  ],
  "priority_fix": "single most impactful concept to study first",
  "cross_topic_insights": "how the mistakes connect at a deeper level",
  "study_tip": "one overarching strategy",
  "recommended_session": {
    "mode": "mistakes|weak_topics|custom",
    "topics": ["specific tags"],
    "question_count": 0,
    "reason": "why this session helps most now"
  }
}`

export async function getMistakePatterns({
  mistakeGroups,
  totalQuestions = null,
  overallAccuracy = null,
  lang = 'es',
}) {
  const fallback = {
    patterns: [],
    priority_fix: null,
    cross_topic_insights: null,
    study_tip:
      lang === 'es'
        ? 'Repasa los temas con más errores y practica con el modo "Errores".'
        : 'Review the topics with the most mistakes and practice using "Mistakes" mode.',
    recommended_session: null,
    _fallback: true,
  }

  if (!Array.isArray(mistakeGroups) || mistakeGroups.length === 0) {
    return fallback
  }

  const groupsText = mistakeGroups
    .map((g) => {
      const examples = (g.examples ?? [])
        .slice(0, 3)
        .map((e) => `- ${(e.questionText || 'N/A').slice(0, 140)}`)
        .join('\n')

      return `Topic: ${g.topic}
Mistakes: ${g.count}
Examples:
${examples || '- N/A'}`
    })
    .join('\n\n')

  return callJsonTask({
    label: 'getMistakePatterns',
    model: MODEL,
    maxTokens: 1800,
    timeout: 30_000,
    defaults: fallback,
    messages: [
      { role: 'system', content: MISTAKE_PATTERNS_PROMPT },
      {
        role: 'user',
        content: [
          `Language: ${lang === 'es' ? 'Spanish' : 'English'}`,
          totalQuestions ? `Total questions attempted: ${totalQuestions}` : null,
          overallAccuracy !== null ? `Overall accuracy: ${overallAccuracy}%` : null,
          `Mistake groups:\n${groupsText}`,
          'Be specific, actionable, and psychologically insightful.',
        ].filter(Boolean).join('\n\n'),
      },
    ],
  })
}

// ============================================================================
// 8. QUESTION DEEP DIVE
// ============================================================================
const DEEP_DIVE_PROMPT = `You are a DGT tutor analyzing why a student keeps getting a specific question wrong.

Return ONLY valid JSON with:
{
  "analysis": "2-3 sentences explaining the likely misconception",
  "likely_confusion": "what the student is probably confusing this with",
  "targeted_tip": "a very specific tip for this exact question",
  "similar_trap_questions": "1-2 trap question types with similar confusion",
  "mastery_check": "a quick mental exercise to verify understanding"
}`

export async function getQuestionDeepDive({
  question,
  options,
  correctIdx,
  userAnswerHistory,
  helpHtml,
  lang = 'es',
}) {
  const fallback = {
    analysis: null,
    likely_confusion: null,
    targeted_tip: null,
    similar_trap_questions: null,
    mastery_check: null,
    _fallback: true,
  }

  const normalizedHistory = (userAnswerHistory ?? []).map((a, i) => ({
    attempt: i + 1,
    selected: optionLabel(a?.selected),
    correct: Boolean(a?.correct),
    timeSec: a?.timeSec ?? null,
  }))

  const cacheKey = `deep_${makeQuestionSignature({
    question,
    options,
    correctIdx,
    lang,
    extra: { history: normalizedHistory },
  })}`

  return withCache(cacheKey, async () => {
    const historyLines = normalizedHistory
      .map((a) => `Attempt ${a.attempt}: chose ${a.selected} (${a.correct ? 'correct' : 'incorrect'}, ${a.timeSec ?? '?'}s)`)
      .join('\n')

    return callJsonTask({
      label: 'getQuestionDeepDive',
      model: FAST_MODEL,
      maxTokens: 600,
      timeout: 15_000,
      defaults: fallback,
      messages: [
        { role: 'system', content: DEEP_DIVE_PROMPT },
        {
          role: 'user',
          content: [
            `Language: ${lang === 'es' ? 'Spanish' : 'English'}`,
            `Question: ${questionText(question, lang)}`,
            `Options:\n${buildOptionsText(options, lang, correctIdx)}`,
            `Manual Reference: ${cleanAndTruncate(helpHtml)}`,
            `Student answer history:\n${historyLines || 'No history provided.'}`,
            'Identify the exact misconception and how to fix it.',
          ].join('\n\n'),
        },
      ],
    })
  })
}