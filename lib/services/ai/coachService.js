import { callGroq, MODEL, FAST_MODEL, safeParseJSON } from './provider.js'

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
