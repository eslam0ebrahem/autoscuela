'use client'
import { useState, useEffect, Suspense, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/components/AuthContext'
import { useToast } from '@/components/Toast'
import {
  AimOutlined,
  ToolOutlined,
  ThunderboltOutlined,
  RocketOutlined,
  AuditOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  BulbOutlined,
  WarningOutlined,
  StarFilled,
  RobotOutlined,
  LoadingOutlined,
} from '@ant-design/icons'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const EXAM_MODES = {
  official: {
    id: 'official',
    icon: AimOutlined,
    titleKey: 'Examen Oficial DGT',
    titleEn: 'Official DGT Exam',
    descKey: '30 preguntas · 30 minutos',
    descEn: '30 questions · 30 minutes',
    color: 'from-primary to-indigo-600',
    recommended: true,
  },
  spaced_repetition: {
    id: 'spaced_repetition',
    icon: ThunderboltOutlined,
    titleKey: 'Repaso Inteligente (SRS)',
    titleEn: 'Spaced Repetition (SRS)',
    descKey: 'Repasa lo que vas a olvidar',
    descEn: 'Review what you are about to forget',
    color: 'from-blue-500 to-indigo-600',
  },
  custom: {
    id: 'custom',
    icon: ToolOutlined,
    titleKey: 'Personalizado',
    titleEn: 'Custom',
    descKey: 'Elige tus temas',
    descEn: 'Choose your topics',
    color: 'from-purple-500 to-violet-600',
  },
  mistakes: {
    id: 'mistakes',
    icon: AuditOutlined,
    titleKey: 'Repaso de Errores',
    titleEn: 'Review Mistakes',
    descKey: 'Practica tus fallos',
    descEn: 'Practice your mistakes',
    color: 'from-orange-500 to-red-600',
  },
  weak_topics: {
    id: 'weak_topics',
    icon: BulbOutlined,
    titleKey: 'Temas Débiles',
    titleEn: 'Weak Topics',
    descKey: 'Mejora donde más lo necesitas',
    descEn: 'Improve where you need it most',
    color: 'from-amber-500 to-orange-600',
  },
  bookmarks: {
    id: 'bookmarks',
    icon: StarFilled,
    titleKey: 'Preguntas Guardadas',
    titleEn: 'Bookmarked Questions',
    descKey: 'Repasa tus favoritos',
    descEn: 'Review your favorites',
    color: 'from-amber-400 to-yellow-600',
  },
}

const ASSISTANCE_MODES = {
  exam: {
    id: 'exam',
    titleKey: 'Modo Examen',
    titleEn: 'Exam Mode',
    descKey: 'Sin ayuda hasta el final',
    descEn: 'No help until the end',
    icon: ClockCircleOutlined,
  },
  instant: {
    id: 'instant',
    titleKey: 'Retroalimentación Inmediata',
    titleEn: 'Instant Feedback',
    descKey: 'Aprende mientras practicas',
    descEn: 'Learn as you practice',
    icon: CheckCircleOutlined,
  },
}

const MAX_TOPIC_DISPLAY = 3

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

/**
 * Mode selection card component
 */
function ModeCard({ mode, isSelected, onClick, t }) {
  const Icon = mode.icon

  return (
    <button
      onClick={() => onClick(mode.id)}
      className={`card text-left transition-all duration-200 hover:scale-105 active:scale-95 ${
        isSelected ? 'ring-2 ring-primary shadow-lg' : 'hover:shadow-md'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-12 h-12 rounded-xl bg-gradient-to-br ${mode.color} flex items-center justify-center text-white text-xl shrink-0`}
        >
          <Icon />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-black text-ink dark:text-white">
              {t(mode.titleKey, mode.titleEn)}
            </h3>
            {mode.recommended && (
              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded-full">
                {t('Recomendado', 'Recommended')}
              </span>
            )}
          </div>
          <p className="text-xs text-ink-light dark:text-slate-400 mt-1">
            {t(mode.descKey, mode.descEn)}
          </p>
        </div>
        {isSelected && <CheckCircleOutlined className="text-primary text-xl shrink-0" />}
      </div>
    </button>
  )
}

/**
 * Assistance mode toggle component
 */
function AssistanceModeToggle({ selected, onChange, t }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {Object.values(ASSISTANCE_MODES).map((mode) => {
        const Icon = mode.icon
        const isSelected = selected === mode.id

        return (
          <button
            key={mode.id}
            onClick={() => onChange(mode.id)}
            className={`p-4 rounded-xl border-2 transition-all text-left ${
              isSelected
                ? 'border-primary bg-primary/5'
                : 'border-slate-200 dark:border-slate-700 hover:border-primary/50'
            }`}
          >
            <div className="flex items-center gap-3">
              <Icon className={`text-2xl ${isSelected ? 'text-primary' : 'text-slate-400'}`} />
              <div className="flex-1">
                <h4 className="font-bold text-sm text-ink dark:text-white">
                  {t(mode.titleKey, mode.titleEn)}
                </h4>
                <p className="text-xs text-ink-light dark:text-slate-400 mt-0.5">
                  {t(mode.descKey, mode.descEn)}
                </p>
              </div>
              {isSelected && <CheckCircleOutlined className="text-primary" />}
            </div>
          </button>
        )
      })}
    </div>
  )
}

/**
 * Topic selector component
 */
function TopicSelector({ topics, selected, onToggle, loading, t }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (topics.length === 0) {
    return (
      <div className="text-center py-8 text-ink-light dark:text-slate-400">
        <WarningOutlined className="text-3xl mb-2" />
        <p className="text-sm">{t('No hay temas disponibles', 'No topics available')}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {topics.map((topic) => {
        const isSelected = selected.includes(topic.tag || topic.name)

        return (
          <button
            key={topic.tag || topic.name}
            onClick={() => onToggle(topic.tag || topic.name)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              isSelected
                ? 'bg-primary text-white shadow-md'
                : 'bg-slate-100 dark:bg-slate-800 text-ink dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {t(topic.tag, topic.tagEn || topic.tag)}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Question count selector component
 */
function QuestionCountSelector({ value, onChange, t }) {
  const options = [10, 20, 30, 50, 100]
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            value === opt
              ? 'bg-primary text-white shadow-md'
              : 'bg-slate-100 dark:bg-slate-800 text-ink dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          {opt} {t('preguntas', 'questions')}
        </button>
      ))}
    </div>
  )
}

/**
 * AI RECOMMENDATION BANNER
 */
function AIRecommendBanner({ lang, t, onApply }) {
  const [rec, setRec] = useState(null)
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    fetch(`/api/ai/recommend?lang=${lang}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((d) => setRec(d.recommendation))
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.error('[setup/recommend]', err)
        }
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [lang])

  if (dismissed || (!loading && !rec)) return null

  const urgencyColors = {
    high: 'border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-900/20',
    medium: 'border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20',
    low: 'border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-900/20',
  }
  const urgencyBadge = {
    high: 'bg-red-100 text-red-700',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-green-100 text-green-700',
  }

  const borderClass = urgencyColors[rec?.urgency] ?? urgencyColors.medium
  const badgeClass = urgencyBadge[rec?.urgency] ?? urgencyBadge.medium

  return (
    <div className={`mb-6 p-4 rounded-2xl border-2 ${borderClass} transition-all`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center flex-shrink-0">
            <RobotOutlined className="text-white text-lg" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-bold text-ink dark:text-white text-sm">
                {t('Recomendación IA', 'AI Recommendation')}
              </span>
              {rec?.urgency && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${badgeClass}`}>
                  {rec.urgency === 'high'
                    ? t('Alta prioridad', 'High priority')
                    : rec.urgency === 'medium'
                      ? t('Prioridad media', 'Medium priority')
                      : t('Baja prioridad', 'Low priority')}
                </span>
              )}
            </div>

            {loading ? (
              <div className="flex items-center gap-2 text-ink-light dark:text-slate-400">
                <LoadingOutlined className="animate-spin" />
                <span className="text-sm">
                  {t('Analizando tu historial...', 'Analyzing your history...')}
                </span>
              </div>
            ) : rec ? (
              <>
                <p className="text-sm text-ink dark:text-white leading-relaxed mb-2">
                  {rec.reason}
                </p>
                {rec.tip && (
                  <p className="text-xs text-ink-light dark:text-slate-400 italic mb-3">
                    💡 {rec.tip}
                  </p>
                )}
                <button
                  onClick={() => onApply?.(rec)}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary to-indigo-600 text-white text-sm font-bold rounded-xl hover:opacity-90 transition-opacity"
                >
                  <ThunderboltOutlined />
                  {t('Aplicar recomendación', 'Apply recommendation')}
                </button>
              </>
            ) : null}
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex-shrink-0 mt-1"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
function ExamSetup() {
  const { user, t } = useAuth()
  const router = useRouter()
  const toast = useToast()
  const searchParams = useSearchParams()

  // ── Parse URL params ───────────────────────────────────────────────────
  const aiTopics = useMemo(
    () => searchParams.get('topics')?.split(',').filter(Boolean) || [],
    [searchParams]
  )
  const isAI = searchParams.get('ai') === '1'
  const urlMode = searchParams.get('mode')

  // ── State ──────────────────────────────────────────────────────────────
  const [mode, setMode] = useState(urlMode || (isAI ? 'custom' : 'official'))
  const [assistanceMode, setAssistanceMode] = useState('exam')
  const [selectedTopics, setSelectedTopics] = useState(aiTopics)
  const [numQuestions, setNumQuestions] = useState(30)
  const [availableTopics, setAvailableTopics] = useState([])
  const [loading, setLoading] = useState(false)
  const [topicsLoading, setTopicsLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  // ── Fetch available topics ─────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true

    const fetchTopics = async () => {
      try {
        const res = await fetch('/api/flashcards/decks')
        if (!res.ok) throw new Error('Failed to fetch topics')

        const data = await res.json()
        if (isMounted) {
          const decks = data.decks || []
          setAvailableTopics(decks)
          setTopicsLoading(false)

          // Normalize selectedTopics: if a value from URL matches a tagEn, convert it to the Spanish tag
          setSelectedTopics((prev) =>
            prev.map((t) => {
              const found = decks.find(
                (d) =>
                  d.tagEn?.toLowerCase() === t.toLowerCase() ||
                  d.tag?.toLowerCase() === t.toLowerCase()
              )
              return found ? found.tag : t
            })
          )
        }
      } catch (err) {
        console.error('[exam-setup] Topics fetch error:', err)
        if (isMounted) {
          setAvailableTopics([])
          setTopicsLoading(false)
          toast?.error?.(t('Error al cargar temas', 'Failed to load topics'), err.message)
        }
      }
    }

    fetchTopics()

    return () => {
      isMounted = false
    }
  }, [t, toast])

  // ── Toggle topic selection ─────────────────────────────────────────────
  const toggleTopic = useCallback((tag) => {
    setSelectedTopics((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }, [])

  // ── Start exam ─────────────────────────────────────────────────────────
  const startExam = useCallback(async () => {
    if (loading) return

    // Validation
    if (mode === 'custom' && selectedTopics.length === 0) {
      setErrorMsg(
        t(
          'Selecciona al menos un tema o usa el modo oficial',
          'Select at least one topic or use official mode'
        )
      )
      return
    }

    setLoading(true)
    setErrorMsg('')

    try {
      const res = await fetch('/api/exams/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          topic_filter: mode === 'custom' && selectedTopics.length > 0 ? selectedTopics : null,
          assistance_mode: assistanceMode,
          num_questions: numQuestions,
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(
          data.message || data.error || t('Error al iniciar el examen', 'Failed to start exam')
        )
      }

      if (data.examId || data.sessionId) {
        const examId = data.examId || data.sessionId
        router.push(`/exam/${examId}`)
      } else {
        throw new Error(t('ID de examen no recibido', 'No exam ID received'))
      }
    } catch (e) {
      console.error('[exam-setup] Start exam error:', e)
      setErrorMsg(e.message || t('Hubo un problema de conexión', 'Connection error'))
      toast?.error?.(t('Error', 'Error'), e.message)
    } finally {
      setLoading(false)
    }
  }, [mode, selectedTopics, assistanceMode, loading, router, t, toast])

  // ── Summary text ───────────────────────────────────────────────────────
  const summaryText = useMemo(() => {
    if (mode === 'official') {
      return '30Q · 30min'
    }

    const topicText =
      selectedTopics.length > 0
        ? selectedTopics.length <= MAX_TOPIC_DISPLAY
          ? selectedTopics
              .map((tag) => {
                const topic = availableTopics.find((at) => at.tag === tag)
                return topic ? t(topic.tag, topic.tagEn) : tag
              })
              .join(', ')
          : `${selectedTopics
              .slice(0, MAX_TOPIC_DISPLAY)
              .map((tag) => {
                const topic = availableTopics.find((at) => at.tag === tag)
                return topic ? t(topic.tag, topic.tagEn) : tag
              })
              .join(', ')} +${selectedTopics.length - MAX_TOPIC_DISPLAY}`
        : t('Todos los temas', 'All topics')

    const modeText =
      assistanceMode === 'exam'
        ? t('Modo examen', 'Exam mode')
        : t('Retroalimentación inmediata', 'Instant feedback')

    return `${topicText} · ${numQuestions}Q · ${modeText}`
  }, [mode, selectedTopics, assistanceMode, numQuestions, t, availableTopics])

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="container-wrapper space-y-6 max-w-4xl mx-auto">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="text-center">
        <h1 className="text-2xl md:text-3xl font-black text-ink dark:text-white mb-2">
          {t('Personaliza tu sesión de práctica', 'Customize your practice session')}
        </h1>
        <p className="text-sm text-ink-light dark:text-slate-400">
          {t(
            'Elige el tipo de examen y configura tus preferencias',
            'Choose exam type and configure your preferences'
          )}
        </p>
      </div>

      <AIRecommendBanner
        lang={user?.preferences?.language || 'es'}
        t={t}
        onApply={(rec) => {
          if (rec.recommended_mode) setMode(rec.recommended_mode)
          if (rec.suggested_topics?.length) setSelectedTopics(rec.suggested_topics)
          // Note: questionCount state doesn't exist in original code, ignoring per original instruction
        }}
      />

      {/* ── Mode Selection ──────────────────────────────────────────── */}
      <div className="card">
        <h2 className="text-lg font-black text-ink dark:text-white mb-4">
          {t('Tipo de Examen', 'Exam Type')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.values(EXAM_MODES).map((modeOption) => (
            <ModeCard
              key={modeOption.id}
              mode={modeOption}
              isSelected={mode === modeOption.id}
              onClick={setMode}
              t={t}
            />
          ))}
        </div>
      </div>

      {/* ── Topic Selection (Custom Mode Only) ─────────────────────── */}
      {mode === 'custom' && (
        <div className="card">
          <h2 className="text-lg font-black text-ink dark:text-white mb-2">
            {t('Selecciona Temas', 'Select Topics')}
          </h2>
          <p className="text-sm text-ink-light dark:text-slate-400 mb-4">
            {t(
              'Deja vacío para preguntas de todos los temas',
              'Leave empty for questions from all topics'
            )}
          </p>
          <TopicSelector
            topics={availableTopics}
            selected={selectedTopics}
            onToggle={toggleTopic}
            loading={topicsLoading}
            t={t}
          />
        </div>
      )}

      {/* ── Assistance Mode ─────────────────────────────────────────── */}
      <div className="card">
        <h2 className="text-lg font-black text-ink dark:text-white mb-4">
          {t('Modo de Asistencia', 'Assistance Mode')}
        </h2>
        <AssistanceModeToggle selected={assistanceMode} onChange={setAssistanceMode} t={t} />
      </div>

      {/* ── Question Count (Non-official only) ─────────────────────── */}
      {mode !== 'official' && (
        <div className="card">
          <h2 className="text-lg font-black text-ink dark:text-white mb-4">
            {t('Número de Preguntas', 'Number of Questions')}
          </h2>
          <QuestionCountSelector value={numQuestions} onChange={setNumQuestions} t={t} />
        </div>
      )}

      {/* ── Summary & Start Button ─────────────────────────────────── */}
      <div className="card bg-gradient-to-br from-primary to-indigo-600 text-white border-0">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-black mb-1">
              {t('Listo para comenzar', 'Ready to start')}
            </h3>
            <p className="text-sm text-indigo-100">{summaryText}</p>
          </div>
          <button
            onClick={startExam}
            disabled={loading}
            className="px-8 py-4 bg-white text-primary font-black rounded-xl hover:bg-indigo-50 transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
                {t('Iniciando...', 'Starting...')}
              </>
            ) : (
              <>
                <RocketOutlined />
                {t('Iniciar Examen', 'Start Exam')}
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Error Message ──────────────────────────────────────────── */}
      {errorMsg && (
        <div className="card bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
          <div className="flex items-start gap-3">
            <WarningOutlined className="text-red-600 dark:text-red-400 text-xl shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-red-900 dark:text-red-200 text-sm">
                {t('Error', 'Error')}
              </h4>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">{errorMsg}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page Export with Suspense
// ---------------------------------------------------------------------------
export default function ExamSetupPage() {
  return (
    <AppShell>
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        }
      >
        <ExamSetup />
      </Suspense>
    </AppShell>
  )
}
