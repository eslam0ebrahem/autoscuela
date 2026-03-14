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
  WarningOutlined
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
        isSelected
          ? 'ring-2 ring-primary shadow-lg'
          : 'hover:shadow-md'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${mode.color} flex items-center justify-center text-white text-xl shrink-0`}>
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
        {isSelected && (
          <CheckCircleOutlined className="text-primary text-xl shrink-0" />
        )}
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
              {isSelected && (
                <CheckCircleOutlined className="text-primary" />
              )}
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
            {topic.name || topic.tag}
          </button>
        )
      })}
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
          setAvailableTopics(data.decks || [])
          setTopicsLoading(false)
        }
      } catch (err) {
        console.error('[exam-setup] Topics fetch error:', err)
        if (isMounted) {
          setAvailableTopics([])
          setTopicsLoading(false)
          toast?.error?.(
            t('Error al cargar temas', 'Failed to load topics'),
            err.message
          )
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
          ? selectedTopics.join(', ')
          : `${selectedTopics.slice(0, MAX_TOPIC_DISPLAY).join(', ')} +${selectedTopics.length - MAX_TOPIC_DISPLAY}`
        : t('Todos los temas', 'All topics')

    const modeText =
      assistanceMode === 'exam'
        ? t('Modo examen', 'Exam mode')
        : t('Retroalimentación inmediata', 'Instant feedback')

    return `${topicText} · ${modeText}`
  }, [mode, selectedTopics, assistanceMode, t])

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
        <AssistanceModeToggle
          selected={assistanceMode}
          onChange={setAssistanceMode}
          t={t}
        />
      </div>

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
