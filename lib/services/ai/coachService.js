import { callJsonTask, MODEL, FAST_MODEL } from './provider.js'

function avg(nums = []) {
  return nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : 0
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

function daysBetween(a, b) {
  return Math.ceil((new Date(a) - new Date(b)) / (1000 * 60 * 60 * 24))
}

function getTrendDirection(values = []) {
  if (values.length < 2) return 'stable'
  const first = values[0]
  const last = values[values.length - 1]
  const delta = last - first
  if (delta >= 5) return 'improving'
  if (delta <= -5) return 'declining'
  return 'stable'
}

function getConsistencyScore(studyTrends) {
  const trends = Array.isArray(studyTrends) ? studyTrends : []
  if (!trends.length) return null
  const activeDays = trends.filter((d) => (d.questions || 0) > 0).length
  return Math.round((activeDays / trends.length) * 100)
}

function getWeakTopics(skillProfile, threshold = 70, limit = 6) {
  return (skillProfile?.topics || [])
    .filter((t) => (t.accuracy ?? 0) < threshold)
    .sort((a, b) => (a.accuracy ?? 0) - (b.accuracy ?? 0))
    .slice(0, limit)
}

function getStrongTopics(skillProfile, threshold = 85, minAttempts = 10, limit = 4) {
  return (skillProfile?.topics || [])
    .filter((t) => (t.accuracy ?? 0) >= threshold && (t.attempted ?? 0) >= minAttempts)
    .sort((a, b) => (b.accuracy ?? 0) - (a.accuracy ?? 0))
    .slice(0, limit)
}

export function computeReadinessScore({ aggregatedData, studyTrends, skillProfile }) {
  const overallAccuracy =
    aggregatedData?.overallAccuracy ??
    skillProfile?.overallAccuracy ??
    aggregatedData?.accuracy ??
    0

  const consistency = getConsistencyScore(studyTrends) ?? 50
  const weakPenalty = getWeakTopics(skillProfile, 70, 10).length * 4
  const breadthBonus = Math.min(((skillProfile?.topics?.length || 0) / 12) * 10, 10)

  const score = Math.round(
    overallAccuracy * 0.7 +
    consistency * 0.15 +
    breadthBonus -
    weakPenalty
  )

  return clamp(score, 0, 100)
}

function chooseRecommendedMode({ recentStats, skillProfile, consistencyScore }) {
  const accuracy = recentStats?.accuracy ?? skillProfile?.overallAccuracy ?? 0
  const weakTopics = getWeakTopics(skillProfile, 70, 5)
  const manyWeakTopics = weakTopics.length >= 3
  const lowConsistency = (consistencyScore ?? 100) < 40

  if (lowConsistency) return 'official'
  if (accuracy >= 90) return 'official'
  if (accuracy >= 80 && weakTopics.length > 0) return 'custom'
  if (manyWeakTopics) return 'weak_topics'
  if ((recentStats?.mistakesCount ?? 0) >= 15) return 'mistakes'
  return 'official'
}

function buildInsightsFallback(lang = 'en') {
  const es = lang === 'es'
  return {
    readiness_score: null,
    weak_topics: [],
    coach_message: es
      ? '¡Sigue estudiando! Completa otro examen para generar tus análisis personalizados con IA.'
      : 'Keep studying! Take another mock exam to generate your personalized AI insights.',
    recommended_action: {
      type: 'official_exam',
      filters: [],
      question_count: 30,
      reason: es
        ? 'Necesitamos más datos para personalizar mejor la recomendación.'
        : 'We need more data to personalize the recommendation better.',
    },
    predicted_ready_date: null,
    improvement_rate: null,
    study_tips: [],
    topic_priority_order: [],
    learning_style_note: null,
    confidence_areas: [],
    _fallback: true,
  }
}

function buildExamFeedbackFallback(lang = 'en', examSummary = null) {
  const es = lang === 'es'
  return {
    verdict: examSummary?.passed ? 'passed' : 'failed',
    headline: es ? '¡Sigue adelante!' : 'Keep going!',
    summary: es
      ? 'Completa más exámenes para obtener análisis personalizados.'
      : 'Complete more exams for personalized analysis.',
    strengths: [],
    weaknesses: [],
    next_step: es
      ? 'Practica los temas con más errores.'
      : 'Practice the topics with the most mistakes.',
    priority_topics: [],
    study_strategy: null,
    time_analysis: null,
    confidence_boost: es
      ? '¡Cada intento te acerca más al aprobado!'
      : 'Every attempt brings you closer to passing!',
    trend: null,
    improvement_pct: null,
    consistency_score: null,
    sessions_until_ready: null,
    _fallback: true,
  }
}

function buildRecommendationFallback(lang = 'en') {
  const es = lang === 'es'
  return {
    recommended_mode: 'official',
    reason: es
      ? 'Practica con el formato oficial para acostumbrarte al examen real.'
      : 'Practice with the official format to get used to the real exam.',
    suggested_topics: [],
    suggested_question_count: 30,
    urgency: 'medium',
    tip: es
      ? 'Estudia 20 minutos al día para mejorar consistentemente.'
      : 'Study 20 minutes daily for consistent improvement.',
    warm_up_suggestion: null,
    expected_outcome: null,
    alternative_mode: null,
    _fallback: true,
  }
}

function buildStudyPlanFallback(lang = 'en') {
  const es = lang === 'es'
  return {
    summary: es
      ? 'Practica con exámenes oficiales diariamente y repasa tus temas débiles.'
      : 'Practice official exams daily and review your weak topics.',
    estimated_pass_ready: null,
    readiness_assessment: null,
    weeks: [
      {
        week_number: 1,
        focus_area: es ? 'Fundamentos y Señalización' : 'Fundamentals & Signage',
        tasks: es 
          ? ['Completar 1 examen oficial diario', 'Repasar señales de prioridad'] 
          : ['Complete 1 official exam daily', 'Review priority signs']
      }
    ],
    daily_routine: es
      ? '1 Examen Oficial + 20 Preguntas de temas débiles'
      : '1 Official Exam + 20 Weak topic questions',
    daily_tip: es
      ? 'Estudia 30 minutos al día de forma constante.'
      : 'Study 30 minutes daily consistently.',
    critical_warning: null,
    _fallback: true,
  }
}

const INSIGHTS_PROMPT = `You are an expert Spanish DGT driving instructor, data analyst, and learning psychologist.
Use the provided computed signals as your main source of truth.
Return ONLY valid JSON with:
{
  "readiness_score": 0,
  "weak_topics": ["topic"],
  "coach_message": "max 3 sentences",
  "recommended_action": {
    "type": "custom_exam|official_exam|mistakes|weak_topics|spaced_repetition",
    "filters": ["Spanish topic tags"],
    "question_count": 10,
    "reason": "why this action"
  },
  "predicted_ready_date": "ISO date or null",
  "improvement_rate": 0,
  "study_tips": ["tip1", "tip2", "tip3"],
  "topic_priority_order": ["Spanish topic tags"],
  "learning_style_note": "one sentence",
  "confidence_areas": ["topic1", "topic2"]
}`

export async function getAIInsights(userLanguage, aggregatedData, studyTrends = null, skillProfile = null) {
  if (!userLanguage || !aggregatedData) {
    return buildInsightsFallback(userLanguage ?? 'en')
  }

  const lang = userLanguage
  const weakTopics = getWeakTopics(skillProfile)
  const strongTopics = getStrongTopics(skillProfile)
  const consistencyScore = getConsistencyScore(studyTrends)
  const readinessScoreBase = computeReadinessScore({ aggregatedData, studyTrends, skillProfile })

  const trendValues = (studyTrends || []).map((d) => d.accuracy || 0)
  const trendDirection = getTrendDirection(trendValues)
  const improvementRate =
    trendValues.length >= 2 ? Number((trendValues[trendValues.length - 1] - trendValues[0]).toFixed(1)) : null

  const defaults = buildInsightsFallback(lang)

  // Token Trimming
  const trimmedSkillProfile = skillProfile ? {
    overallLevel: skillProfile.overallLevel,
    overallAccuracy: skillProfile.overallAccuracy,
    totalAnswered: skillProfile.totalAnswered,
    topTopics: strongTopics.map(t => `${t.tag} (${t.accuracy}%)`),
    weakTopics: weakTopics.map(t => `${t.tag} (${t.accuracy}%)`)
  } : null

  const trimmedTrends = (studyTrends || []).map(d => ({
    date: d.date,
    accuracy: d.accuracy,
    questions: d.questions
  }))

  return callJsonTask({
    label: 'getAIInsights',
    model: MODEL,
    maxTokens: 1400,
    defaults,
    messages: [
      { role: 'system', content: INSIGHTS_PROMPT },
      {
        role: 'user',
        content: [
          `User language: ${lang}`,
          `Computed readiness score: ${readinessScoreBase}`,
          `Trend direction: ${trendDirection}`,
          `Improvement rate: ${improvementRate ?? 'unknown'}%`,
          `Consistency score: ${consistencyScore ?? 'unknown'}`,
          `Aggregated performance summary:\n${JSON.stringify(aggregatedData, null, 2)}`,
          trimmedTrends.length ? `Recent study trends:\n${JSON.stringify(trimmedTrends, null, 2)}` : null,
          trimmedSkillProfile ? `User skill profile summary:\n${JSON.stringify(trimmedSkillProfile, null, 2)}` : null,
          'Explain these signals clearly and personalize the output.',
        ].filter(Boolean).join('\n\n'),
      },
    ],
  })
}

const COACH_PROMPT = `You are an expert DGT driving theory coach reviewing a student's exam.
Use the computed signals as anchors and personalize the tone like a great driving-school instructor.

Return ONLY valid JSON with:
{
  "verdict": "passed|failed|close",
  "headline": "motivational headline",
  "summary": "2-3 sentences",
  "strengths": ["strength"],
  "weaknesses": ["weakness"],
  "next_step": "specific next action",
  "priority_topics": ["Spanish topic tags"],
  "study_strategy": "specific strategy",
  "time_analysis": "comment on pacing",
  "confidence_boost": "personalized morale boost",
  "trend": "improving|stable|declining|null",
  "improvement_pct": 0,
  "consistency_score": 0,
  "sessions_until_ready": 0
}`

export async function getExamCoachFeedback({
  examSummary,
  sessionHistory = [],
  skillProfile = null,
  lang = 'es',
}) {
  const defaults = buildExamFeedbackFallback(lang, examSummary)

  const scoreSeries = sessionHistory.map((s) => s.score).filter((n) => typeof n === 'number')
  const trend = getTrendDirection(scoreSeries)
  const improvementPct =
    scoreSeries.length >= 2 ? Number((scoreSeries[scoreSeries.length - 1] - scoreSeries[0]).toFixed(1)) : null

  const consistencyScore =
    sessionHistory.length > 0
      ? clamp(
          100 - avg(
            sessionHistory.map((s) => Math.abs((s.score ?? 0) - avg(scoreSeries)))
          ),
          0,
          100
        )
      : null

  const weakTopics = getWeakTopics(skillProfile).map((t) => t.tag)
  const sessionsUntilReady =
    typeof examSummary?.score === 'number' && examSummary.score < 90
      ? Math.max(1, Math.ceil((90 - examSummary.score) / 5))
      : 0

  // ── Token Trimming ────────────────────────────────────────────────────
  // 1. Trim session history to core metrics
  const trimmedHistory = sessionHistory.map(s => ({
    score: s.score,
    passed: s.passed,
    mode: s.mode,
    date: s.completedAt
  }))

  // 2. Trim skill profile to avoid token overflow
  const trimmedSkillProfile = skillProfile ? {
    overallLevel: skillProfile.overallLevel,
    overallAccuracy: skillProfile.overallAccuracy,
    totalAnswered: skillProfile.totalAnswered,
    topTopics: getStrongTopics(skillProfile, 85, 10, 5).map(t => `${t.tag} (${t.accuracy}%)`),
    weakTopics: getWeakTopics(skillProfile, 70, 5).map(t => `${t.tag} (${t.accuracy}%)`)
  } : null

  // 3. Trim exam summary (remove full question details)
  const { ...coreSummary } = examSummary || {}

  return callJsonTask({
    label: 'getExamCoachFeedback',
    model: MODEL,
    maxTokens: 1200,
    defaults,
    messages: [
      { role: 'system', content: COACH_PROMPT },
      {
        role: 'user',
        content: [
          `Language: ${lang}`,
          `Exam summary:\n${JSON.stringify(coreSummary, null, 2)}`,
          `Trend: ${trend}`,
          `Improvement vs oldest session: ${improvementPct ?? 'unknown'}%`,
          `Consistency score: ${consistencyScore ?? 'unknown'}`,
          `Estimated sessions until ready: ${sessionsUntilReady}`,
          `Priority weak topics: ${weakTopics.join(', ') || 'none identified'}`,
          trimmedHistory.length
            ? `Recent sessions history:\n${JSON.stringify(trimmedHistory, null, 2)}`
            : null,
          trimmedSkillProfile
            ? `User skill profile summary:\n${JSON.stringify(trimmedSkillProfile, null, 2)}`
            : null,
          'Give direct, specific, motivating exam feedback based on these metrics.',
        ].filter(Boolean).join('\n\n'),
      },
    ],
  })
}

const RECOMMEND_PROMPT = `You are a DGT exam strategy advisor.
Use the deterministic recommendation as the default anchor unless the provided evidence strongly supports a better alternative.

Return ONLY valid JSON with:
{
  "recommended_mode": "official|custom|mistakes|weak_topics",
  "reason": "2-3 sentences",
  "suggested_topics": ["Spanish topic tags"],
  "suggested_question_count": 10,
  "urgency": "low|medium|high",
  "tip": "specific actionable tip",
  "warm_up_suggestion": "string or null",
  "expected_outcome": "string or null",
  "alternative_mode": {
    "mode": "string",
    "reason": "one sentence"
  }
}`

export async function getExamRecommendation({ recentStats, skillProfile = null, studyTrends = null, lang = 'es' }) {
  const defaults = buildRecommendationFallback(lang)
  if (!recentStats) return defaults

  const consistencyScore = getConsistencyScore(studyTrends)
  const modeBase = chooseRecommendedMode({ recentStats, skillProfile, consistencyScore })
  const weakTopics = getWeakTopics(skillProfile, 70, 5)

  return callJsonTask({
    label: 'getExamRecommendation',
    model: FAST_MODEL,
    maxTokens: 700,
    defaults,
    messages: [
      { role: 'system', content: RECOMMEND_PROMPT },
      {
        role: 'user',
        content: [
          `Language: ${lang}`,
          `Base recommended mode: ${modeBase}`,
          `Recent stats:\n${JSON.stringify(recentStats, null, 2)}`,
          `Consistency score: ${consistencyScore ?? 'unknown'}`,
          skillProfile ? `Skill profile:\n${JSON.stringify(skillProfile, null, 2)}` : null,
          weakTopics.length
            ? `Weak topics: ${weakTopics.map((t) => `${t.tag} (${t.accuracy}%)`).join(', ')}`
            : 'Weak topics: none identified',
          'Recommend the best next exam setup.',
        ].filter(Boolean).join('\n\n'),
      },
    ],
  })
}

const STUDY_PLAN_SYSTEM = `You are an expert DGT Spanish driving exam coach and adaptive learning specialist.
Build a realistic week-by-week study plan using the computed constraints and topic priorities.
Return ONLY valid JSON matching exactly this structure:
{
  "summary": "String explaining the overarching strategy",
  "daily_routine": "Detailed daily habits (e.g. '1 Exam + 20 Practice Questions')",
  "daily_tip": "String with a motivational tip",
  "critical_warning": "Warning if the time is too short, or null",
  "weeks": [
    {
      "week_number": 1,
      "focus_area": "Main focus of this week",
      "tasks": ["Task 1", "Task 2"]
    }
  ]
}
CRITICAL: 'daily_routine' and 'weeks' must NEVER be null or empty.`

export async function getStudyPlan({
  skillProfile,
  targetDate,
  dailyMinutes = 30,
  studyTrends = null,
  lang = 'es',
}) {
  const defaults = buildStudyPlanFallback(lang)
  if (!skillProfile || !targetDate) return defaults

  const daysUntilExam = Math.max(1, daysBetween(targetDate, new Date()))
  const weeksAvailable = Math.ceil(daysUntilExam / 7)
  const weakTopics = getWeakTopics(skillProfile, 70, 8)
  const strongTopics = getStrongTopics(skillProfile, 85, 10, 6)
  const consistencyScore = getConsistencyScore(studyTrends)
  const readinessScore = computeReadinessScore({
    aggregatedData: { overallAccuracy: skillProfile.overallAccuracy },
    studyTrends,
    skillProfile,
  })

  const trimmedTrends = (studyTrends || []).map(d => ({
    date: d.date,
    accuracy: d.accuracy,
    questions: d.questions
  }))

  return callJsonTask({
    label: 'getStudyPlan',
    model: MODEL,
    temperature: 0.3,
    timeout: 28_000,
    maxTokens: 2000,
    defaults,
    messages: [
      { role: 'system', content: STUDY_PLAN_SYSTEM },
      {
        role: 'user',
        content: [
          `Language: ${lang === 'es' ? 'Spanish' : 'English'}`,
          `Target date: ${targetDate}`,
          `Days until exam: ${daysUntilExam}`,
          `Weeks available: ${weeksAvailable}`,
          `Daily study time: ${dailyMinutes} minutes`,
          `Current readiness score: ${readinessScore}`,
          `Consistency score: ${consistencyScore ?? 'unknown'}`,
          `Overall accuracy: ${skillProfile.overallAccuracy}%`,
          `Total answered: ${skillProfile.totalAnswered}`,
          `Weak topics: ${weakTopics.map((t) => `${t.tag} (${t.accuracy}%, trend: ${t.trend || 'unknown'})`).join(', ') || 'none yet'}`,
          `Strong topics: ${strongTopics.map((t) => t.tag).join(', ') || 'none yet'}`,
          trimmedTrends.length ? `Study trends:\n${JSON.stringify(trimmedTrends, null, 2)}` : null,
          'Create a realistic adaptive plan. Be specific, not generic.',
        ].filter(Boolean).join('\n\n'),
      },
    ],
  })
}

export async function getSessionQuickSummary({
  correctCount,
  totalCount,
  timeSeconds,
  mode,
  topicBreakdown = [],
  lang = 'es',
}) {
  const defaults = { one_liner: null, emoji_verdict: null, micro_tip: null, _fallback: true }

  const accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0
  const weakTopics = topicBreakdown.filter((t) => (t.accuracy ?? 0) < 60).map((t) => t.tag)
  const strongTopics = topicBreakdown.filter((t) => (t.accuracy ?? 0) >= 80).map((t) => t.tag)

  return callJsonTask({
    label: 'getSessionQuickSummary',
    model: FAST_MODEL,
    temperature: 0.5,
    timeout: 8_000,
    maxTokens: 220,
    defaults,
    messages: [
      {
        role: 'user',
        content: [
          `Language: ${lang === 'es' ? 'Spanish' : 'English'}`,
          `Session mode: ${mode}`,
          `Score: ${correctCount}/${totalCount} (${accuracy}%)`,
          `Duration: ${Math.round((timeSeconds || 0) / 60)} minutes`,
          `Weak topics this session: ${weakTopics.join(', ') || 'none major'}`,
          `Strong topics this session: ${strongTopics.join(', ') || 'none standout'}`,
          `Return ONLY JSON with "one_liner", "emoji_verdict", and "micro_tip".`,
        ].join('\n'),
      },
    ],
  })
}