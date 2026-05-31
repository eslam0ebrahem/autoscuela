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
const EXPLAIN_PROMPT = `You are an elite, highly empathetic Spanish DGT driving theory tutor. Your mission is to make complex traffic rules instantly understandable.
A student just answered a question. You must provide a thorough, educational, and easy-to-digest explanation.

CRITICAL INSTRUCTIONS:
1. ALWAYS ground your explanation in the "Manual Reference" if provided.
2. Use clear, simple language. Avoid overly bureaucratic terms unless necessary, and if used, explain them.
3. The 'correct_explanation' should directly address WHY the answer is logically correct. Use markdown (bolding) to emphasize key concepts.
4. The 'wrong_explanation' must pinpoint the exact misconception that would lead someone to choose the specific wrong answer they selected.
5. Provide a highly memorable, creative 'memory_tip' (mnemonic, visualization, or simple rule of thumb).

Return ONLY valid JSON with:
{
  "summary": "one-sentence verdict (correct/incorrect + key core reason)",
  "correct_explanation": "why the correct answer is right logically (2-3 sentences). Use markdown.",
  "wrong_explanation": "why the chosen answer is wrong, addressing the specific misconception (1-2 sentences, or empty string if not applicable)",
  "memory_tip": "a vivid memory aid, mnemonic, or visualization technique",
  "law_reference": "relevant DGT regulation article or RGC section (string or null)",
  "common_confusion": "one sentence about what students usually confuse this rule with",
  "difficulty_note": "easy|medium|hard — followed by a short explanation of why it has this difficulty"
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
const HINT_PROMPT = `You are a brilliant, Socratic DGT driving theory tutor.
Your goal is to guide the student to the answer themselves WITHOUT revealing it. Use the Socratic method (ask a guiding question).

Focus on the key concept or rule being tested. You are given the correct answer index for your own internal context, but NEVER reveal the option letter, index, or answer text.

Return ONLY valid JSON with:
{
  "hint": "A powerful, Socratic guiding question or clue (1-2 sentences) in the student's language that triggers them to remember the rule.",
  "concept": "the key driving concept being tested (5-8 words)",
  "think_about": "what specific scenario or consequence the student should visualize before answering",
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
const MISTAKE_PATTERNS_PROMPT = `You are an elite DGT Spanish driving exam expert and cognitive learning psychologist.
Analyze mistake clusters to identify deep conceptual gaps, cognitive biases, and psychological patterns, not just topic counts.

Look for:
1. Cross-topic confusion (e.g. confusing speed limits with vehicle weights).
2. Visual recognition failures (misreading similar signs).
3. Rule application errors (knowing the rule but failing edge cases).
4. Speed, anxiety, or pressure mistakes.

Return ONLY valid JSON with:
{
  "patterns": [
    {
      "concept": "brief concept name (e.g. 'Priority at un-signaled intersections')",
      "topic": "Spanish topic tag",
      "frequency": 0,
      "severity": "critical|moderate|minor",
      "root_cause": "The psychological or cognitive reason the student gets this wrong",
      "fix_strategy": "A highly specific, cognitive study action (e.g. 'Draw a diagram of... ')",
      "fix_time_estimate": "estimated time to improve (e.g. '15 mins')",
      "example_question": "typical mistake example",
      "related_patterns": ["other connected topic tags"]
    }
  ],
  "priority_fix": "The single most impactful concept to study first for maximum score gain",
  "cross_topic_insights": "How these mistakes connect at a deeper, systemic level",
  "study_tip": "One profound, overarching cognitive strategy",
  "recommended_session": {
    "mode": "mistakes|weak_topics|custom",
    "topics": ["specific tags"],
    "question_count": 0,
    "reason": "Why this session format is the scientifically best next step"
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

  const cacheKey = `patterns_${hashKey(
    JSON.stringify({
      lang,
      totalQuestions,
      overallAccuracy,
      groupsCount: mistakeGroups.length,
      topics: mistakeGroups.map(g => `${g.topic}:${g.count}`).join(',')
    })
  )}`

  return withCache(cacheKey, async () => {
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
  }, 86400) // 24 hours
}

// ============================================================================
// 8. QUESTION DEEP DIVE
// ============================================================================
const DEEP_DIVE_PROMPT = `You are a world-class DGT tutor and cognitive psychologist analyzing why a student keeps getting a specific question wrong repeatedly.
Your goal is to break their bad mental habit and replace it with a foolproof mental model.

Return ONLY valid JSON with:
{
  "analysis": "2-3 sentences explaining the exact cognitive misconception or trap they are falling into.",
  "likely_confusion": "Exactly what the student is confusing this concept with",
  "targeted_tip": "A highly specific, surgical tip to rewire their understanding of this exact question",
  "similar_trap_questions": "1-2 trap question scenarios that prey on this same confusion",
  "mastery_check": "A quick, Socratic mental exercise they should do right now to verify understanding",
  "mnemonic": "A brilliant, funny, or highly memorable mnemonic/visualization to remember the correct rule forever"
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
    mnemonic: null,
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