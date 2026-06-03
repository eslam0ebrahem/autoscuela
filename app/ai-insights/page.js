'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/components/AuthContext'
import { useToast } from '@/components/Toast'
import FormattedText from '@/components/FormattedText'
import {
  RobotOutlined,
  TrophyOutlined,
  BulbOutlined,
  ClockCircleOutlined,
  FireOutlined,
  LineChartOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  ArrowRightOutlined,
  ReloadOutlined,
  LockOutlined,
  RocketOutlined,
} from '@ant-design/icons'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const MIN_QUESTIONS_FOR_AI = 60
const READINESS_THRESHOLDS = {
  READY: 90,
  GOOD: 70,
  PROGRESS: 50,
}

const READINESS_COLORS = {
  READY: '#10B981',
  GOOD: '#6366F1',
  PROGRESS: '#F59E0B',
  START: '#F43F5E',
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

/**
 * Readiness score ring with progress visualization
 */
function ReadinessRing({ score, t }) {
  const radius = 60
  const circumference = 2 * Math.PI * radius
  const validScore = typeof score === 'number' && !isNaN(score) ? score : 0
  const dashoffset =
    score != null ? circumference - (validScore / 100) * circumference : circumference

  const getColorAndLabel = () => {
    if (score >= READINESS_THRESHOLDS.READY) {
      return { color: READINESS_COLORS.READY, label: t('¡Listo!', 'Ready!') }
    }
    if (score >= READINESS_THRESHOLDS.GOOD) {
      return { color: READINESS_COLORS.GOOD, label: t('Bien', 'Good') }
    }
    if (score >= READINESS_THRESHOLDS.PROGRESS) {
      return { color: READINESS_COLORS.PROGRESS, label: t('Progresando', 'Progressing') }
    }
    return { color: READINESS_COLORS.START, label: t('Empieza', 'Start') }
  }

  const { color, label } = getColorAndLabel()

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-40 h-40">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 140 140">
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke="currentColor"
            className="text-slate-100 dark:text-slate-800"
            strokeWidth="10"
          />
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashoffset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {score != null ? (
            <>
              <span className="text-4xl font-black text-ink dark:text-white">{validScore}</span>
              <span className="text-xs font-bold uppercase tracking-wider mt-1" style={{ color }}>
                {label}
              </span>
            </>
          ) : (
            <span className="text-sm text-slate-400">—</span>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Stat card component
 */
function StatCard({ icon, label, value, color = 'primary' }) {
  return (
    <div className="card text-center hover:shadow-lg transition-shadow">
      <div className={`text-3xl text-${color} mb-2`}>{icon}</div>
      <div className="text-2xl font-black text-ink dark:text-white">{value}</div>
      <p className="text-xs text-ink-light dark:text-slate-400 mt-1 font-semibold">{label}</p>
    </div>
  )
}

/**
 * Weak topic chip
 */
function WeakTopicChip({ topic, onPractice, t }) {
  return (
    <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
      <div className="flex items-center gap-2">
        <WarningOutlined className="text-red-600 dark:text-red-400" />
        <span className="text-sm font-semibold text-red-900 dark:text-red-200">{topic}</span>
      </div>
      <button
        onClick={() => onPractice(topic)}
        className="px-3 py-1 bg-red-600 text-white text-xs font-bold rounded-md hover:bg-red-700 transition-colors"
      >
        {t('Practicar', 'Practice')}
      </button>
    </div>
  )
}

/**
 * Study tip card
 */
function StudyTipCard({ tip, index }) {
  return (
    <div className="flex items-start gap-3 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
      <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
        {index + 1}
      </div>
      <p className="text-sm text-indigo-900 dark:text-indigo-200 leading-relaxed">{tip}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
function AIInsightsContent() {
  const { user, t } = useAuth()
  const router = useRouter()
  const toast = useToast()

  // ── State ──────────────────────────────────────────────────────────────
  const [insights, setInsights] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [required, setRequired] = useState(MIN_QUESTIONS_FOR_AI)

  const isPremium = user?.isPremium

  // ── Fetch AI Insights ──────────────────────────────────────────────────
  const fetchInsights = useCallback(
    async (force = false) => {
      try {
        setRefreshing(force)
        const forceParam = force ? '?force=true' : ''

        const res = await fetch(`/api/stats/ai-insights${forceParam}`)
        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || t('Error al cargar análisis', 'Failed to load insights'))
        }

        if (data.insights) {
          setInsights(data.insights)
        } else {
          // Not enough questions answered yet
          setInsights(null)
          setProgress(data.progress ?? 0)
          setRequired(data.required ?? MIN_QUESTIONS_FOR_AI)
        }
      } catch (e) {
        console.error('[ai-insights] Fetch error:', e)
        toast?.error?.(t('Error', 'Error'), e.message)
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [t, toast]
  )

  useEffect(() => {
    fetchInsights()
  }, [fetchInsights])

  // ── Practice weak topic ────────────────────────────────────────────────
  const handlePracticeTopic = useCallback(
    (topic) => {
      router.push(`/exam?mode=custom&topics=${encodeURIComponent(topic)}`)
    },
    [router]
  )

  // ── Handle recommended action ──────────────────────────────────────────
  const handleRecommendedAction = useCallback(() => {
    if (!insights?.recommendedAction) return

    const action = insights.recommendedAction

    if (action.type === 'custom_exam' && action.filters?.length > 0) {
      const topics = action.filters.join(',')
      router.push(`/exam?mode=custom&topics=${encodeURIComponent(topics)}&ai=1`)
    } else if (action.type === 'official_exam') {
      router.push('/exam?mode=official')
    } else {
      router.push('/exam')
    }
  }, [insights, router])

  // ── Refresh handler ────────────────────────────────────────────────────
  const handleRefresh = useCallback(() => {
    if (!refreshing) fetchInsights(true)
  }, [refreshing, fetchInsights])

  // ── Loading state ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-ink-light dark:text-slate-400 text-sm">
          {t('Analizando tu rendimiento...', 'Analyzing your performance...')}
        </p>
      </div>
    )
  }

  // ── Not premium ────────────────────────────────────────────────────────
  if (!isPremium) {
    return (
      <div className="container-wrapper max-w-4xl mx-auto">
        <div className="card bg-gradient-to-br from-amber-400 to-orange-500 text-white border-0 shadow-xl text-center">
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center">
              <LockOutlined className="text-5xl text-white" />
            </div>
            <h2 className="text-2xl font-black">{t('Función Premium', 'Premium Feature')}</h2>
            <p className="text-orange-100 max-w-md">
              {t(
                'El análisis IA está disponible solo para usuarios Premium. Mejora tu plan para desbloquear recomendaciones personalizadas.',
                'AI insights are available only for Premium users. Upgrade your plan to unlock personalized recommendations.'
              )}
            </p>
            <button
              onClick={() => router.push('/settings')}
              className="px-8 py-3 bg-white text-orange-600 font-black rounded-xl hover:bg-orange-50 transition-all shadow-lg active:scale-95"
            >
              {t('Mejorar a Premium', 'Upgrade to Premium')} <ArrowRightOutlined />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Not enough questions ───────────────────────────────────────────────
  if (!insights) {
    const percentage = Math.min(100, Math.round((progress / required) * 100))

    return (
      <div className="container-wrapper max-w-4xl mx-auto">
        <div className="card text-center">
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="w-20 h-20 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
              <RobotOutlined className="text-5xl text-primary" />
            </div>
            <h2 className="text-2xl font-black text-ink dark:text-white">
              {t('Sigue Practicando', 'Keep Practicing')}
            </h2>
            <p className="text-ink-light dark:text-slate-400 max-w-md">
              {t(
                `Responde al menos ${required} preguntas para desbloquear el análisis IA. Has respondido ${progress} hasta ahora.`,
                `Answer at least ${required} questions to unlock AI insights. You've answered ${progress} so far.`
              )}
            </p>

            {/* Progress bar */}
            <div className="w-full max-w-md">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-ink-light dark:text-slate-400">
                  {t('Progreso', 'Progress')}
                </span>
                <span className="font-bold text-primary">{percentage}%</span>
              </div>
              <div className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-indigo-600 transition-all duration-500"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <p className="text-xs text-ink-light dark:text-slate-400 mt-2">
                {required - progress} {t('preguntas restantes', 'questions remaining')}
              </p>
            </div>

            <button
              onClick={() => router.push('/exam')}
              className="px-8 py-3 bg-primary text-white font-black rounded-xl hover:bg-indigo-700 transition-all shadow-lg active:scale-95 flex items-center gap-2"
            >
              <RocketOutlined />
              {t('Empezar Examen', 'Start Exam')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Main insights view ─────────────────────────────────────────────────
  const {
    readinessScore,
    weakTopics = [],
    coachMessage,
    predictedReadyDate,
    improvementRate,
    studyTips = [],
    topicPriorityOrder = [],
  } = insights

  return (
    <div className="container-wrapper space-y-6 max-w-5xl mx-auto">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-ink dark:text-white">
            {t('Análisis IA', 'AI Insights')}
          </h1>
          <p className="text-sm text-ink-light dark:text-slate-400 mt-1">
            {t('Recomendaciones personalizadas por IA', 'AI-powered personalized recommendations')}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-ink dark:text-white rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          <ReloadOutlined className={refreshing ? 'animate-spin' : ''} />
          <span className="hidden sm:inline text-sm font-semibold">
            {refreshing ? t('Actualizando...', 'Refreshing...') : t('Actualizar', 'Refresh')}
          </span>
        </button>
      </div>

      {/* ── Readiness Score ────────────────────────────────────────── */}
      <div className="card bg-gradient-to-br from-primary to-indigo-600 text-white border-0 shadow-xl">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left flex-1">
            <h2 className="text-xl md:text-2xl font-black mb-3">
              {t('Tu Nivel de Preparación', 'Your Readiness Level')}
            </h2>
            {coachMessage && <p className="text-indigo-100 leading-relaxed mb-4"><FormattedText text={coachMessage} /></p>}
            {predictedReadyDate && (
              <div className="flex items-center gap-2 text-indigo-200 text-sm">
                <ClockCircleOutlined />
                <span>
                  {t('Estimado listo:', 'Estimated ready:')}{' '}
                  <strong className="text-white">
                    {new Date(predictedReadyDate).toLocaleDateString(
                      user?.preferences?.language === 'es' ? 'es-ES' : 'en-US',
                      { year: 'numeric', month: 'long', day: 'numeric' }
                    )}
                  </strong>
                </span>
              </div>
            )}
          </div>
          <ReadinessRing score={readinessScore} t={t} />
        </div>
      </div>

      {/* ── Quick Stats ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard
          icon={<TrophyOutlined />}
          label={t('Puntuación', 'Score')}
          value={readinessScore != null ? `${readinessScore}%` : '—'}
          color="primary"
        />
        <StatCard
          icon={<WarningOutlined />}
          label={t('Temas Débiles', 'Weak Topics')}
          value={weakTopics.length}
          color="orange-500"
        />
        <StatCard
          icon={<LineChartOutlined />}
          label={t('Mejora Semanal', 'Weekly Improvement')}
          value={
            improvementRate != null ? `${improvementRate > 0 ? '+' : ''}${improvementRate}%` : '—'
          }
          color={improvementRate > 0 ? 'green-500' : improvementRate < 0 ? 'red-500' : 'slate-400'}
        />
      </div>

      {/* ── Recommended Action ─────────────────────────────────────── */}
      <div className="card bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            <div className="w-12 h-12 rounded-xl bg-green-600 flex items-center justify-center text-white text-xl shrink-0">
              <CheckCircleOutlined />
            </div>
            <div>
              <h3 className="text-lg font-black text-green-900 dark:text-green-200 mb-1">
                {t('Próximo Paso Recomendado', 'Recommended Next Step')}
              </h3>
              <p className="text-sm text-green-700 dark:text-green-300">
                {insights.recommendedAction?.type === 'custom_exam'
                  ? t(
                      `Practica un examen enfocado en: ${insights.recommendedAction.filters?.join(', ')}`,
                      `Practice an exam focused on: ${insights.recommendedAction.filters?.join(', ')}`
                    )
                  : t('Realiza un examen oficial completo', 'Take a full official exam')}
              </p>
            </div>
          </div>
          <button
            onClick={handleRecommendedAction}
            className="px-6 py-3 bg-green-600 text-white font-black rounded-xl hover:bg-green-700 transition-all shadow-lg active:scale-95 flex items-center gap-2 whitespace-nowrap"
          >
            {t('Comenzar', 'Start')} <ArrowRightOutlined />
          </button>
        </div>
      </div>

      {/* ── Weak Topics ────────────────────────────────────────────── */}
      {weakTopics.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-black text-ink dark:text-white mb-4 flex items-center gap-2">
            <WarningOutlined className="text-red-600" />
            {t('Áreas de Mejora', 'Areas for Improvement')}
          </h2>
          <div className="space-y-2">
            {weakTopics.map((topic, index) => (
              <WeakTopicChip key={index} topic={topic} onPractice={handlePracticeTopic} t={t} />
            ))}
          </div>
        </div>
      )}

      {/* ── Study Tips ─────────────────────────────────────────────── */}
      {studyTips.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-black text-ink dark:text-white mb-4 flex items-center gap-2">
            <BulbOutlined className="text-indigo-600" />
            {t('Consejos de Estudio', 'Study Tips')}
          </h2>
          <div className="space-y-3">
            {studyTips.map((tip, index) => (
              <StudyTipCard key={index} tip={tip} index={index} />
            ))}
          </div>
        </div>
      )}

      {/* ── Topic Priority ─────────────────────────────────────────── */}
      {topicPriorityOrder.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-black text-ink dark:text-white mb-4 flex items-center gap-2">
            <FireOutlined className="text-orange-600" />
            {t('Prioridad de Temas', 'Topic Priority')}
          </h2>
          <p className="text-sm text-ink-light dark:text-slate-400 mb-4">
            {t(
              'Enfócate en estos temas en orden para maximizar tu mejora',
              'Focus on these topics in order to maximize your improvement'
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            {topicPriorityOrder.map((topic, index) => (
              <div
                key={index}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center gap-2"
              >
                <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">
                  {index + 1}
                </span>
                <span className="text-sm font-semibold text-ink dark:text-white">{topic}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page Export
// ---------------------------------------------------------------------------
export default function AIInsightsPage() {
  return (
    <AppShell>
      <AIInsightsContent />
    </AppShell>
  )
}
