'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import DOMPurify from 'dompurify'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/components/AuthContext'
import { useToast } from '@/components/Toast'

function sanitizeHtml(html) {
  if (typeof window === 'undefined') return ''
  return DOMPurify.sanitize(html)
}
import {
  CloseCircleOutlined,
  CheckCircleOutlined,
  FilterOutlined,
  ReloadOutlined,
  RocketOutlined,
  EyeOutlined,
  BulbOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const API_ENDPOINTS = {
  MISTAKES: '/api/mistakes',
  TOPICS: '/api/stats/topics',
}

const FILTER_OPTIONS = {
  ALL: 'all',
  RECENT: 'recent',
  FREQUENT: 'frequent',
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

/**
 * Mistake card component
 */
function MistakeCard({ mistake, onReview, onClear, t, lang = 'es' }) {
  const [expanded, setExpanded] = useState(false)

  const questionText = mistake?.question?.[lang] || mistake?.question?.es || ''

  const correctOption = mistake?.options?.find((o) => o.idx === mistake?.correct_option_idx)
  const userOption = mistake?.options?.find((o) => o.idx === mistake?.lastWrongAnswerIdx)

  const correctAnswer = correctOption ? correctOption['text_' + lang] || correctOption.text_es : ''
  const userAnswer = userOption ? userOption['text_' + lang] || userOption.text_es : ''

  const explanation = mistake.metadata?.help_html || ''
  const topic = mistake?.topic || t('Desconocido', 'Unknown')
  const timesIncorrect = mistake?.timesWrong || 1
  const lastAttempt = mistake?.lastWrong ? new Date(mistake.lastWrong) : null

  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => !prev)
  }, [])

  return (
    <div className="card hover:shadow-lg transition-shadow">
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
          <CloseCircleOutlined className="text-xl text-red-600 dark:text-red-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-bold rounded">
              {topic}
            </span>
            {timesIncorrect > 1 && (
              <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-bold rounded">
                {timesIncorrect}x {t('errores', 'mistakes')}
              </span>
            )}
          </div>
          <h3 className="text-sm font-semibold text-ink dark:text-white leading-snug">
            {questionText}
          </h3>
          {mistake.metadata?.image_url && (
            <div className="mt-2 rounded-lg overflow-hidden border border-slate-100 dark:border-slate-700 max-w-[240px]">
              <img
                src={mistake.metadata.image_url}
                alt="Question"
                className="w-full h-auto object-cover"
              />
            </div>
          )}
          {lastAttempt && (
            <p className="text-xs text-ink-light dark:text-slate-400 mt-1 flex items-center gap-1">
              <ClockCircleOutlined />
              {t('Último intento:', 'Last attempt:')}{' '}
              {lastAttempt.toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US')}
            </p>
          )}
        </div>
      </div>

      {/* Answers */}
      <div className="space-y-2 mb-3">
        <div className="flex items-start gap-2 p-2 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200 dark:border-red-800">
          <CloseCircleOutlined className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs font-semibold text-red-800 dark:text-red-300 mb-0.5">
              {t('Tu respuesta:', 'Your answer:')}
            </p>
            <p className="text-sm text-red-900 dark:text-red-200">{userAnswer}</p>
          </div>
        </div>

        <div className="flex items-start gap-2 p-2 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-200 dark:border-green-800">
          <CheckCircleOutlined className="text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs font-semibold text-green-800 dark:text-green-300 mb-0.5">
              {t('Respuesta correcta:', 'Correct answer:')}
            </p>
            <p className="text-sm text-green-900 dark:text-green-200">{correctAnswer}</p>
          </div>
        </div>
      </div>

      {/* Explanation (expandable) */}
      {explanation && (
        <div className="mb-3">
          <button
            onClick={toggleExpanded}
            className="w-full text-left px-3 py-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors flex items-center justify-between"
          >
            <span className="text-sm font-semibold text-indigo-900 dark:text-indigo-200 flex items-center gap-2">
              <BulbOutlined />
              {t('Explicación', 'Explanation')}
            </span>
            <span
              className={`text-indigo-600 dark:text-indigo-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            >
              ▼
            </span>
          </button>
          {expanded && (
            <div className="mt-2 p-4 bg-white dark:bg-slate-800 rounded-lg border border-indigo-200 dark:border-indigo-800">
              <div
                className="text-sm text-ink dark:text-white leading-relaxed help-html"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(explanation) }}
              />
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => onReview(mistake)}
          className="flex-1 px-4 py-2 bg-primary text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
        >
          <EyeOutlined />
          {t('Revisar', 'Review')}
        </button>
        <button
          onClick={() => onClear(mistake.questionId)}
          className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-ink-light dark:text-slate-400 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          title={t('Marcar como dominada', 'Mark as mastered')}
        >
          <CheckCircleOutlined />
        </button>
      </div>
    </div>
  )
}

/**
 * Filter button component
 */
function FilterButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
        active
          ? 'bg-primary text-white shadow-md'
          : 'bg-slate-100 dark:bg-slate-800 text-ink dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700'
      }`}
    >
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
function MistakeReviewContent() {
  const { user, t } = useAuth()
  const router = useRouter()
  const toast = useToast()

  const lang = user?.preferences?.language || 'es'

  // ── State ──────────────────────────────────────────────────────────────
  const [mistakes, setMistakes] = useState([])
  const [topics, setTopics] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState(FILTER_OPTIONS.ALL)
  const [selectedTopic, setSelectedTopic] = useState(null)

  // ── Fetch mistakes ─────────────────────────────────────────────────────
  const fetchMistakes = useCallback(
    async (force = false) => {
      try {
        setRefreshing(force)

        const params = new URLSearchParams()
        if (filter === FILTER_OPTIONS.RECENT) params.append('sort', 'recent')
        if (filter === FILTER_OPTIONS.FREQUENT) params.append('sort', 'frequent')
        if (selectedTopic) params.append('topic', selectedTopic)
        if (force) params.append('force', 'true')

        const res = await fetch(`${API_ENDPOINTS.MISTAKES}?${params}`)
        if (!res.ok) throw new Error(t('Error al cargar errores', 'Failed to load mistakes'))

        const data = await res.json()
        setMistakes(data.mistakes || [])
      } catch (err) {
        console.error('[mistakes] Fetch error:', err)
        toast?.error?.(t('Error', 'Error'), err.message)
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [filter, selectedTopic, t, toast]
  )

  // ── Fetch topics ───────────────────────────────────────────────────────
  useEffect(() => {
    const fetchTopics = async () => {
      try {
        const res = await fetch(API_ENDPOINTS.TOPICS)
        if (!res.ok) return

        const data = await res.json()
        setTopics(data.topics || [])
      } catch (err) {
        console.error('[mistakes] Topics fetch error:', err)
      }
    }

    fetchTopics()
  }, [])

  // ── Fetch mistakes when filters change ────────────────────────────────
  useEffect(() => {
    fetchMistakes()
  }, [fetchMistakes])

  // ── Clear mistake ──────────────────────────────────────────────────────
  const handleClearMistake = useCallback(
    async (mistakeId) => {
      try {
        const res = await fetch(`${API_ENDPOINTS.MISTAKES}/${mistakeId}`, {
          method: 'DELETE',
        })

        if (!res.ok) throw new Error(t('Error al eliminar', 'Failed to delete'))

        setMistakes((prev) => prev.filter((m) => m._id !== mistakeId))
        toast?.success?.(
          t('Eliminado', 'Deleted'),
          t('Error marcado como dominado', 'Mistake marked as mastered')
        )
      } catch (err) {
        console.error('[mistakes] Delete error:', err)
        toast?.error?.(t('Error', 'Error'), err.message)
      }
    },
    [t, toast]
  )

  // ── Review mistake ─────────────────────────────────────────────────────
  const handleReviewMistake = useCallback(
    (mistake) => {
      // Navigate to practice exam with this specific question
      // Navigate to practice exam with this specific question
      if (mistake.questionId) {
        router.push(`/question/${mistake.questionId}`)
      } else if (mistake.topic) {
        router.push(`/exam?mode=custom&topics=${encodeURIComponent(mistake.topic)}`)
      }
    },
    [router]
  )

  // ── Practice all mistakes ──────────────────────────────────────────────
  const handlePracticeAll = useCallback(() => {
    router.push('/exam?mode=mistakes')
  }, [router])

  // ── Filtered mistakes ──────────────────────────────────────────────────
  const filteredMistakes = useMemo(() => {
    let result = [...mistakes]

    // Already filtered by API, but keep for local state management
    return result
  }, [mistakes])

  // ── Stats ──────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalMistakes = mistakes.length
    const topicCounts = {}

    mistakes.forEach((m) => {
      const topic = m.topic || t('Desconocido', 'Unknown')
      topicCounts[topic] = (topicCounts[topic] || 0) + 1
    })

    const mostCommonTopic = Object.entries(topicCounts).sort((a, b) => b[1] - a[1])[0]

    return {
      total: totalMistakes,
      mostCommonTopic: mostCommonTopic ? mostCommonTopic[0] : null,
      mostCommonCount: mostCommonTopic ? mostCommonTopic[1] : 0,
    }
  }, [mistakes, t])

  // ── Loading state ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-ink-light dark:text-slate-400 text-sm">
          {t('Cargando errores...', 'Loading mistakes...')}
        </p>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="container-wrapper space-y-6 max-w-5xl mx-auto">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-ink dark:text-white">
            {t('Repaso de Errores', 'Mistake Review')}
          </h1>
          <p className="text-sm text-ink-light dark:text-slate-400 mt-1">
            {t(
              'Revisa y practica tus respuestas incorrectas para dominarlas',
              'Review and practice your incorrect answers to master them'
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => fetchMistakes(true)}
            disabled={refreshing}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-ink dark:text-white rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <ReloadOutlined className={refreshing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline font-semibold">
              {refreshing ? t('Actualizando...', 'Refreshing...') : t('Actualizar', 'Refresh')}
            </span>
          </button>
        </div>
      </div>

      {/* ── Stats Cards ────────────────────────────────────────────── */}
      {stats.total > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card text-center hover:shadow-lg transition-shadow">
            <div className="text-3xl font-black text-red-600 dark:text-red-400">{stats.total}</div>
            <p className="text-xs text-ink-light dark:text-slate-400 mt-1 font-semibold">
              {t('Errores totales', 'Total mistakes')}
            </p>
          </div>
          {stats.mostCommonTopic && (
            <>
              <div className="card text-center hover:shadow-lg transition-shadow">
                <div className="text-lg font-black text-ink dark:text-white truncate">
                  {stats.mostCommonTopic}
                </div>
                <p className="text-xs text-ink-light dark:text-slate-400 mt-1 font-semibold">
                  {t('Tema con más errores', 'Most common topic')}
                </p>
              </div>
              <div className="card text-center hover:shadow-lg transition-shadow">
                <div className="text-3xl font-black text-orange-600 dark:text-orange-400">
                  {stats.mostCommonCount}
                </div>
                <p className="text-xs text-ink-light dark:text-slate-400 mt-1 font-semibold">
                  {t('Errores en ese tema', 'Mistakes in that topic')}
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Filters ─────────────────────────────────────────────────── */}
      <div className="card">
        <h2 className="text-lg font-black text-ink dark:text-white mb-4 flex items-center gap-2">
          <FilterOutlined />
          {t('Filtros', 'Filters')}
        </h2>

        {/* Filter buttons */}
        <div className="flex flex-wrap gap-2 mb-4">
          <FilterButton
            active={filter === FILTER_OPTIONS.ALL}
            onClick={() => setFilter(FILTER_OPTIONS.ALL)}
          >
            {t('Todos', 'All')}
          </FilterButton>
          <FilterButton
            active={filter === FILTER_OPTIONS.RECENT}
            onClick={() => setFilter(FILTER_OPTIONS.RECENT)}
          >
            {t('Recientes', 'Recent')}
          </FilterButton>
          <FilterButton
            active={filter === FILTER_OPTIONS.FREQUENT}
            onClick={() => setFilter(FILTER_OPTIONS.FREQUENT)}
          >
            {t('Más frecuentes', 'Most frequent')}
          </FilterButton>
        </div>

        {/* Topic filter */}
        {topics.length > 0 && (
          <div>
            <label className="text-sm font-semibold text-ink dark:text-white mb-2 block">
              {t('Filtrar por tema:', 'Filter by topic:')}
            </label>
            <select
              value={selectedTopic || ''}
              onChange={(e) => setSelectedTopic(e.target.value || null)}
              className="w-full md:w-auto px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-ink dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="">{t('Todos los temas', 'All topics')}</option>
              {topics.map((topic, index) => {
                const tagValue = typeof topic.tag === 'object' ? topic.tag.es : topic.tag
                const tagName = topic.name || tagValue
                return (
                  <option key={`topic-${tagValue || index}`} value={tagValue}>
                    {tagName}
                  </option>
                )
              })}
            </select>
          </div>
        )}
      </div>

      {/* ── Practice All Button ─────────────────────────────────────── */}
      {filteredMistakes.length > 0 && (
        <div className="card bg-gradient-to-r from-primary to-indigo-600 text-white border-0">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-black mb-1">
                {t('¿Listo para mejorar?', 'Ready to improve?')}
              </h3>
              <p className="text-sm text-indigo-100">
                {t(
                  'Practica un examen enfocado en tus errores',
                  'Practice an exam focused on your mistakes'
                )}
              </p>
            </div>
            <button
              onClick={handlePracticeAll}
              className="px-8 py-3 bg-white text-primary font-black rounded-xl hover:bg-indigo-50 transition-all shadow-lg active:scale-95 flex items-center gap-2 whitespace-nowrap"
            >
              <RocketOutlined />
              {t('Practicar Errores', 'Practice Mistakes')}
            </button>
          </div>
        </div>
      )}

      {/* ── Mistakes List ───────────────────────────────────────────── */}
      {filteredMistakes.length === 0 ? (
        <div className="card text-center py-12">
          <div className="flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircleOutlined className="text-5xl text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="text-xl font-black text-ink dark:text-white mb-2">
                {filter !== FILTER_OPTIONS.ALL || selectedTopic
                  ? t('No hay errores que coincidan', 'No matching mistakes')
                  : t('¡Excelente trabajo!', 'Excellent work!')}
              </h3>
              <p className="text-sm text-ink-light dark:text-slate-400 max-w-md mx-auto">
                {filter !== FILTER_OPTIONS.ALL || selectedTopic
                  ? t(
                      'No tienes errores que coincidan con estos filtros',
                      'You have no mistakes matching these filters'
                    )
                  : t(
                      'No has cometido errores aún. ¡Sigue así!',
                      "You haven't made any mistakes yet. Keep it up!"
                    )}
              </p>
            </div>
            <button
              onClick={() => router.push('/exam')}
              className="px-6 py-3 bg-primary text-white font-bold rounded-xl hover:bg-indigo-700 transition-all active:scale-95 flex items-center gap-2"
            >
              <RocketOutlined />
              {t('Tomar Examen', 'Take Exam')}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredMistakes.map(
            (mistake, index) =>
              mistake && (
                <MistakeCard
                  key={mistake.questionId || `mistake-${index}`}
                  mistake={mistake}
                  onReview={handleReviewMistake}
                  onClear={handleClearMistake}
                  t={t}
                  lang={lang}
                />
              )
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page Export
// ---------------------------------------------------------------------------
export default function MistakeReviewPage() {
  return (
    <AppShell>
      <MistakeReviewContent />
    </AppShell>
  )
}
