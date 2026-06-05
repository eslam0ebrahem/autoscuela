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
  RobotOutlined,
  LoadingOutlined,
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
  const [showAi, setShowAi] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiExplanation, setAiExplanation] = useState(null)
  const [aiError, setAiError] = useState(null)

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

  const handleAskAI = useCallback(async () => {
    if (showAi && aiExplanation) {
      setShowAi(false)
      return
    }
    setShowAi(true)
    if (aiExplanation) return

    setAiLoading(true)
    setAiError(null)

    try {
      const res = await fetch('/api/ai/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: mistake.questionId,
          selectedIdx: mistake.lastWrongAnswerIdx !== undefined ? mistake.lastWrongAnswerIdx : 0,
          lang,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.message || data.error || 'Failed to load AI explanation')
      setAiExplanation(data.explanation)
    } catch (err) {
      setAiError(err.message)
    } finally {
      setAiLoading(false)
    }
  }, [mistake, lang, showAi, aiExplanation])

  return (
    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/20 dark:border-slate-700/50 rounded-2xl p-5 shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300 flex flex-col relative overflow-hidden group">
      {/* Decorative gradient blob */}
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-red-400/10 dark:bg-red-500/10 rounded-full blur-2xl pointer-events-none group-hover:scale-110 transition-transform duration-500" />
      
      {/* Header */}
      <div className="flex items-start gap-3 mb-4 relative z-10">
        <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0 shadow-inner">
          <CloseCircleOutlined className="text-xl text-red-600 dark:text-red-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-2.5 py-1 bg-indigo-100/80 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-[10px] uppercase tracking-wider font-bold rounded-lg border border-indigo-200 dark:border-indigo-800">
              {topic}
            </span>
            {timesIncorrect > 1 && (
              <span className="px-2.5 py-1 bg-red-100/80 dark:bg-red-900/40 text-red-700 dark:text-red-300 text-[10px] uppercase tracking-wider font-bold rounded-lg border border-red-200 dark:border-red-800">
                {timesIncorrect}x {t('errores', 'mistakes')}
              </span>
            )}
          </div>
          <h3 className="text-base font-bold text-ink dark:text-white leading-snug">
            {questionText}
          </h3>
          {mistake.metadata?.image_url && (
            <div className="mt-3 rounded-xl overflow-hidden border border-slate-200/50 dark:border-slate-700/50 w-full max-h-48 relative group/img">
              <img
                src={mistake.metadata.image_url}
                alt="Question"
                className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-500"
              />
            </div>
          )}
          {lastAttempt && (
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 w-fit px-2 py-1 rounded-md">
              <ClockCircleOutlined />
              {lastAttempt.toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US')}
            </p>
          )}
        </div>
      </div>

      {/* Answers */}
      <div className="space-y-2 mb-4 relative z-10 flex-1">
        <div className="flex items-start gap-3 p-3 bg-red-50/80 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-800/50 relative overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-1 bg-red-500 rounded-l-xl" />
          <CloseCircleOutlined className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-[11px] uppercase tracking-wider font-bold text-red-800/70 dark:text-red-300/70 mb-0.5">
              {t('Tu respuesta:', 'Your answer:')}
            </p>
            <p className="text-sm font-medium text-red-900 dark:text-red-100">{userAnswer}</p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-3 bg-green-50/80 dark:bg-green-900/10 rounded-xl border border-green-100 dark:border-green-800/50 relative overflow-hidden">
           <div className="absolute inset-y-0 left-0 w-1 bg-green-500 rounded-l-xl" />
          <CheckCircleOutlined className="text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-[11px] uppercase tracking-wider font-bold text-green-800/70 dark:text-green-300/70 mb-0.5">
              {t('Respuesta correcta:', 'Correct answer:')}
            </p>
            <p className="text-sm font-medium text-green-900 dark:text-green-100">{correctAnswer}</p>
          </div>
        </div>
      </div>

      {/* Explanation (expandable) */}
      <div className="space-y-2 mb-4 relative z-10">
        {explanation && (
          <div>
            <button
              onClick={toggleExpanded}
              className="w-full text-left px-3 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-between border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
            >
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <BulbOutlined className="text-amber-500" />
                {t('Explicación oficial', 'Official explanation')}
              </span>
              <span className={`text-slate-400 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}>
                ▼
              </span>
            </button>
            {expanded && (
              <div className="mt-2 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm animate-in slide-in-from-top-2 duration-200">
                <div
                  className="text-sm text-ink dark:text-white leading-relaxed help-html"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(explanation) }}
                />
              </div>
            )}
          </div>
        )}

        {/* AI Tutor Section */}
        <div>
          <button
            onClick={handleAskAI}
            className={`w-full text-left px-3 py-2 rounded-xl transition-all flex items-center justify-between border ${
              showAi 
                ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-700' 
                : 'bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 hover:from-indigo-100 hover:to-purple-100 dark:hover:from-indigo-900/40 dark:hover:to-purple-900/40 border-indigo-100 dark:border-indigo-800/50'
            }`}
          >
            <span className="text-sm font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-2">
              <RobotOutlined className="text-indigo-500" />
              {t('Tutor de IA', 'AI Tutor')}
            </span>
             <span className={`text-indigo-400 transition-transform duration-300 ${showAi ? 'rotate-180' : ''}`}>
                ▼
              </span>
          </button>
          
          {showAi && (
            <div className="mt-2 p-4 bg-white/90 dark:bg-slate-800/90 backdrop-blur rounded-xl border border-indigo-200 dark:border-indigo-700 shadow-sm animate-in slide-in-from-top-2 duration-200">
              {aiLoading ? (
                <div className="flex items-center justify-center gap-2 text-indigo-500 py-4">
                  <LoadingOutlined className="text-xl" />
                  <span className="text-sm font-medium">{t('Analizando error...', 'Analyzing mistake...')}</span>
                </div>
              ) : aiError ? (
                <div className="text-sm text-red-600 dark:text-red-400 font-medium p-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-900">
                  {aiError}
                </div>
              ) : aiExplanation ? (
                typeof aiExplanation === 'string' ? (
                  <div 
                    className="text-sm text-ink dark:text-white leading-relaxed prose prose-sm dark:prose-invert prose-indigo max-w-none"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(aiExplanation) }}
                  />
                ) : (
                  <div className="space-y-3">
                    <p className="font-bold text-indigo-900 dark:text-indigo-200">
                      {aiExplanation.summary}
                    </p>
                    
                    {aiExplanation.wrong_explanation && (
                      <div className="text-sm text-red-800 dark:text-red-200 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-100 dark:border-red-800/50">
                        <span className="font-bold block mb-1">❌ {t('Por qué es incorrecto:', 'Why it is incorrect:')}</span>
                        <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(aiExplanation.wrong_explanation) }} />
                      </div>
                    )}

                    {aiExplanation.correct_explanation && (
                      <div className="text-sm text-green-800 dark:text-green-200 bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-100 dark:border-green-800/50">
                        <span className="font-bold block mb-1">✅ {t('La regla correcta:', 'The correct rule:')}</span>
                        <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(aiExplanation.correct_explanation) }} />
                      </div>
                    )}

                    {aiExplanation.memory_tip && (
                      <div className="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg flex gap-3 border border-amber-100 dark:border-amber-800/50 mt-1">
                        <span className="text-xl shrink-0">💡</span>
                        <div>
                          <span className="font-bold block mb-0.5">{t('Consejo de memoria:', 'Memory tip:')}</span>
                          <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(aiExplanation.memory_tip) }} />
                        </div>
                      </div>
                    )}
                  </div>
                )
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-auto pt-2 relative z-10 border-t border-slate-100 dark:border-slate-800">
        <button
          onClick={() => onReview(mistake)}
          className="flex-1 px-4 py-2.5 bg-ink text-white dark:bg-primary dark:hover:bg-indigo-600 font-bold rounded-xl hover:bg-slate-800 transition-all active:scale-95 flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
        >
          <EyeOutlined />
          {t('Revisar', 'Review')}
        </button>
        <button
          onClick={() => onClear(mistake.questionId)}
          className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl hover:bg-green-100 hover:text-green-600 dark:hover:bg-green-900/30 dark:hover:text-green-400 transition-all active:scale-95 border border-transparent hover:border-green-200 dark:hover:border-green-800"
          title={t('Marcar como dominada', 'Mark as mastered')}
        >
          <CheckCircleOutlined className="text-lg" />
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
      className={`px-5 py-2 rounded-xl font-bold text-sm transition-all active:scale-95 ${
        active
          ? 'bg-ink text-white dark:bg-primary shadow-lg ring-2 ring-primary/20 dark:ring-primary/50 ring-offset-2 dark:ring-offset-slate-900'
          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
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
  
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loadingMore, setLoadingMore] = useState(false)

  const [aiPatterns, setAiPatterns] = useState(null)

  // ── Fetch mistakes ─────────────────────────────────────────────────────
  const fetchMistakes = useCallback(
    async (pageNumber = 1, force = false) => {
      try {
        if (pageNumber === 1) {
          setRefreshing(true)
        } else {
          setLoadingMore(true)
        }

        const params = new URLSearchParams()
        if (filter === FILTER_OPTIONS.RECENT) params.append('sort', 'recent')
        if (filter === FILTER_OPTIONS.FREQUENT) params.append('sort', 'frequent')
        if (selectedTopic) params.append('topic', selectedTopic)
        if (force) params.append('force', 'true')
        params.append('page', pageNumber.toString())
        params.append('limit', '20')

        const res = await fetch(`${API_ENDPOINTS.MISTAKES}?${params}`)
        if (!res.ok) throw new Error(t('Error al cargar errores', 'Failed to load mistakes'))

        const data = await res.json()
        if (pageNumber === 1) {
          setMistakes(data.mistakes || [])
        } else {
          setMistakes((prev) => {
            // Prevent duplicates if React StrictMode double-invokes
            const existingIds = new Set(prev.map(m => m.questionId))
            const newMistakes = (data.mistakes || []).filter(m => !existingIds.has(m.questionId))
            return [...prev, ...newMistakes]
          })
        }
        setPage(pageNumber)
        setTotalPages(data.totalPages || 1)
      } catch (err) {
        console.error('[mistakes] Fetch error:', err)
        toast?.error?.(t('Error', 'Error'), err.message)
      } finally {
        if (pageNumber === 1) setLoading(false)
        setRefreshing(false)
        setLoadingMore(false)
      }
    },
    [filter, selectedTopic, t, toast]
  )

  // ── Fetch AI Patterns ──────────────────────────────────────────────────
  const fetchAIPatterns = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/patterns?lang=' + lang)
      const data = await res.json()
      if (data && data.patterns) {
        setAiPatterns(data)
      }
    } catch (err) {
      console.error('[mistakes] AI patterns fetch error:', err)
    }
  }, [lang])

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
    fetchMistakes(1)
  }, [fetchMistakes])

  // ── Fetch AI Patterns on mount ─────────────────────────────────────────
  useEffect(() => {
    fetchAIPatterns()
  }, [fetchAIPatterns])

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
        <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4 shadow-lg"></div>
        <p className="text-slate-500 dark:text-slate-400 font-medium">
          {t('Analizando tu historial...', 'Analyzing your history...')}
        </p>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="container-wrapper space-y-8 max-w-7xl mx-auto px-4 py-8">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6">
        <div className="relative">
          <div className="absolute -inset-1 bg-gradient-to-r from-red-500 to-orange-500 rounded-xl blur opacity-20 dark:opacity-40 pointer-events-none"></div>
          <div className="relative">
            <h1 className="text-3xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 tracking-tight mb-2">
              {t('Repaso de Errores', 'Mistake Review')}
            </h1>
            <p className="text-base text-slate-500 dark:text-slate-400 font-medium max-w-xl">
              {t(
                'Revisa y practica tus respuestas incorrectas para dominarlas. Deja que la IA te ayude a entender por qué te equivocaste.',
                'Review and practice your incorrect answers to master them. Let AI help you understand why you got it wrong.'
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => fetchMistakes(1, true)}
            disabled={refreshing}
            className="px-5 py-2.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-white rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 font-bold"
          >
            <ReloadOutlined className={refreshing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">
              {refreshing ? t('Actualizando...', 'Refreshing...') : t('Actualizar', 'Refresh')}
            </span>
          </button>
        </div>
      </div>

      {/* ── Stats Cards ────────────────────────────────────────────── */}
      {stats.total > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-md rounded-2xl p-6 border border-white/50 dark:border-slate-700/50 shadow-sm flex flex-col justify-center relative overflow-hidden group">
            <div className="absolute right-0 top-0 w-24 h-24 bg-red-500/10 rounded-bl-full transition-transform group-hover:scale-110"></div>
            <div className="text-4xl md:text-5xl font-black text-red-500 dark:text-red-400 mb-1">{stats.total}</div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
              {t('Errores totales', 'Total mistakes')}
            </p>
          </div>
          {stats.mostCommonTopic && (
            <>
              <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-md rounded-2xl p-6 border border-white/50 dark:border-slate-700/50 shadow-sm flex flex-col justify-center relative overflow-hidden group">
                 <div className="absolute right-0 top-0 w-24 h-24 bg-indigo-500/10 rounded-bl-full transition-transform group-hover:scale-110"></div>
                <div className="text-xl md:text-2xl font-black text-slate-800 dark:text-white truncate mb-1" title={stats.mostCommonTopic}>
                  {stats.mostCommonTopic}
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                  {t('Tema crítico', 'Critical topic')}
                </p>
              </div>
              <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-md rounded-2xl p-6 border border-white/50 dark:border-slate-700/50 shadow-sm flex flex-col justify-center relative overflow-hidden group">
                 <div className="absolute right-0 top-0 w-24 h-24 bg-orange-500/10 rounded-bl-full transition-transform group-hover:scale-110"></div>
                <div className="text-4xl md:text-5xl font-black text-orange-500 dark:text-orange-400 mb-1">
                  {stats.mostCommonCount}
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                  {t('Errores en este tema', 'Mistakes in topic')}
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── AI Mistake Analysis ───────────────────────────────────── */}
      {aiPatterns?.patterns?.length > 0 && (
        <div className="relative rounded-3xl overflow-hidden shadow-xl shadow-indigo-500/10 group">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 opacity-90 group-hover:scale-105 transition-transform duration-700" />
          <div className="absolute inset-0 bg-[url('/noise.png')] opacity-20 mix-blend-overlay" />
          
          <div className="relative p-6 md:p-8 backdrop-blur-sm">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6 mb-8">
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-inner shrink-0 border border-white/30">
                <RobotOutlined className="text-3xl drop-shadow-md" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white drop-shadow-sm mb-1 tracking-tight">
                  {t('Análisis de Patrones con IA', 'AI Pattern Analysis')}
                </h2>
                <p className="text-base text-indigo-100 font-medium max-w-2xl">
                  {aiPatterns.study_tip}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {aiPatterns.patterns.slice(0, 2).map((pattern, idx) => (
                <div key={idx} className="bg-white/10 dark:bg-black/20 backdrop-blur-xl rounded-2xl p-5 border border-white/20 shadow-lg hover:bg-white/20 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-3 py-1.5 bg-white/20 text-white text-xs font-black uppercase tracking-wider rounded-lg truncate max-w-[70%] border border-white/20 shadow-sm">
                      {pattern.topic}
                    </span>
                    <span className={`px-2.5 py-1 text-[10px] font-black rounded-lg uppercase tracking-wider shadow-sm ${
                      pattern.severity === 'critical' ? 'bg-red-500 text-white border border-red-400' :
                      pattern.severity === 'moderate' ? 'bg-amber-500 text-white border border-amber-400' :
                      'bg-slate-500 text-white border border-slate-400'
                    }`}>
                      {pattern.severity}
                    </span>
                  </div>
                  <h4 className="font-bold text-white text-lg mb-1 leading-tight">{pattern.concept}</h4>
                  <p className="text-sm text-indigo-100/90 mb-4 font-medium">{pattern.root_cause}</p>
                  
                  <div className="bg-black/20 rounded-xl p-4 border border-white/10 backdrop-blur-sm relative overflow-hidden">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-green-400 to-emerald-500" />
                    <p className="text-xs font-black uppercase tracking-widest text-green-300 mb-1.5 flex items-center gap-1.5">
                      <BulbOutlined /> {t('Estrategia de estudio', 'Study Strategy')}
                    </p>
                    <p className="text-sm font-medium text-white leading-relaxed">{pattern.fix_strategy}</p>
                  </div>
                </div>
              ))}
            </div>
            
            {aiPatterns.priority_fix && (
              <div className="mt-6 p-4 bg-black/30 backdrop-blur-md border border-white/20 rounded-2xl flex items-start md:items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0 border border-amber-500/30">
                  <RocketOutlined className="text-amber-400 text-lg" />
                </div>
                <p className="text-sm md:text-base font-medium text-white">
                  <span className="font-black text-amber-300 uppercase tracking-wider text-xs block md:inline md:mr-2 mb-1 md:mb-0">{t('Enfoque Prioritario', 'Priority Focus')}:</span>
                  {aiPatterns.priority_fix}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Practice All Button ─────────────────────────────────────── */}
      {filteredMistakes.length > 0 && (
        <div className="relative overflow-hidden rounded-3xl bg-slate-900 dark:bg-slate-950 p-6 md:p-8 shadow-2xl border border-slate-800 group">
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-primary/30 blur-3xl rounded-full group-hover:bg-primary/40 transition-colors duration-500" />
          <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-48 h-48 bg-purple-500/20 blur-3xl rounded-full group-hover:bg-purple-500/30 transition-colors duration-500" />
          
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="text-2xl md:text-3xl font-black text-white mb-2 tracking-tight">
                {t('¿Listo para mejorar?', 'Ready to improve?')}
              </h3>
              <p className="text-slate-400 font-medium">
                {t(
                  'Practica un examen generado dinámicamente enfocado solo en tus errores.',
                  'Practice a dynamically generated exam focused only on your mistakes.'
                )}
              </p>
            </div>
            <button
              onClick={handlePracticeAll}
              className="w-full md:w-auto px-8 py-4 bg-white text-slate-900 font-black rounded-2xl hover:bg-slate-100 hover:scale-105 transition-all shadow-[0_0_40px_rgba(255,255,255,0.2)] active:scale-95 flex items-center justify-center gap-3 whitespace-nowrap text-lg"
            >
              <RocketOutlined className="text-primary" />
              {t('Practicar Errores', 'Practice Mistakes')}
            </button>
          </div>
        </div>
      )}

      {/* ── Filters ─────────────────────────────────────────────────── */}
      <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-md rounded-2xl p-6 border border-white/50 dark:border-slate-700/50 shadow-sm">
        <h2 className="text-lg font-black text-slate-800 dark:text-white mb-5 flex items-center gap-2">
          <FilterOutlined className="text-slate-400" />
          {t('Filtros', 'Filters')}
        </h2>

        {/* Filter buttons */}
        <div className="flex flex-wrap gap-3 mb-5">
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
            <label className="text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 mb-2 block">
              {t('Filtrar por tema:', 'Filter by topic:')}
            </label>
            <div className="relative w-full md:w-auto inline-block">
              <select
                value={selectedTopic || ''}
                onChange={(e) => setSelectedTopic(e.target.value || null)}
                className="w-full md:min-w-[300px] px-4 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-white focus:ring-4 focus:ring-primary/20 focus:border-primary transition-all appearance-none cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 shadow-sm pr-10"
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
              <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-slate-400">
                ▼
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Mistakes List ───────────────────────────────────────────── */}
      {filteredMistakes.length === 0 ? (
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-md rounded-3xl p-12 text-center border border-white/50 dark:border-slate-700/50 shadow-sm flex flex-col items-center">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-xl shadow-green-500/20 mb-6">
            <CheckCircleOutlined className="text-5xl text-white drop-shadow-md" />
          </div>
          <h3 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white mb-3 tracking-tight">
            {filter !== FILTER_OPTIONS.ALL || selectedTopic
              ? t('No hay errores que coincidan', 'No matching mistakes')
              : t('¡Excelente trabajo!', 'Excellent work!')}
          </h3>
          <p className="text-base text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-8 font-medium">
            {filter !== FILTER_OPTIONS.ALL || selectedTopic
              ? t(
                  'No tienes errores que coincidan con estos filtros',
                  'You have no mistakes matching these filters'
                )
              : t(
                  'No has cometido errores aún. ¡Sigue así demostrando tu conocimiento!',
                  "You haven't made any mistakes yet. Keep showing your knowledge!"
                )}
          </p>
          <button
            onClick={() => router.push('/exam')}
            className="px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black rounded-2xl hover:scale-105 transition-all shadow-xl active:scale-95 flex items-center gap-3 text-lg"
          >
            <RocketOutlined />
            {t('Tomar Examen', 'Take Exam')}
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
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
          
          {page < totalPages && (
            <div className="flex justify-center mt-8">
              <button
                onClick={() => fetchMistakes(page + 1)}
                disabled={loadingMore}
                className="px-8 py-3 bg-white dark:bg-slate-800 text-slate-700 dark:text-white font-bold rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
              >
                {loadingMore && <LoadingOutlined className="animate-spin" />}
                {t('Cargar más', 'Load more')}
              </button>
            </div>
          )}
        </>
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
