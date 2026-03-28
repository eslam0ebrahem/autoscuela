import {
  callGroq,
  MODEL,
  FAST_MODEL,
  safeParseJSON,
  cleanAndTruncate,
  buildOptionsText,
  questionText,
} from './provider.js'
import { withCache } from './cache.js'

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

  // Use question text hash or ID if available. For now, rely on question string length + lang + options as a signature
  const cacheKey = `expl_${lang}_${correctIdx}_${selectedIdx}_${questionText(question, lang)?.substring(0, 50)}`

  return withCache(cacheKey, async () => {
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
  })
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

  // Hint cache key depends heavily on the question itself and language
  const cacheKey = `hint_${lang}_${correctIdx}_${questionText(question, lang)?.substring(0, 50)}`

  return withCache(cacheKey, async () => {
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
  })
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
