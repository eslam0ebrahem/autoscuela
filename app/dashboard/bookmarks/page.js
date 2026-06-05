'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import DOMPurify from 'dompurify'
import AppShell from '@/components/AppShell'
import FormattedText from '@/components/FormattedText'
import { useAuth } from '@/components/AuthContext'
import { useToast } from '@/components/Toast'
import {
  StarFilled,
  StarOutlined,
  DeleteOutlined,
  EyeOutlined,
  FilterOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  RocketOutlined,
  WarningOutlined,
  BulbOutlined,
  RobotOutlined,
  LoadingOutlined,
} from '@ant-design/icons'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const API_ENDPOINTS = {
  BOOKMARKS: '/api/bookmarks',
  TOPICS: '/api/stats/topics',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function sanitizeHtml(html) {
  if (typeof window === 'undefined') return ''
  return DOMPurify.sanitize(html)
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

/**
 * Bookmarked question card
 */
function BookmarkCard({ question, onRemove, onReview, t, lang = 'es' }) {
  const [expanded, setExpanded] = useState(false)
  const [showAi, setShowAi] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiExplanation, setAiExplanation] = useState(null)
  const [aiError, setAiError] = useState(null)

  // Mapping to real schema
  const questionText = question.question?.[lang] || question.question?.es || ''
  const explanation = question.metadata?.help_html || ''
  const topic = question.topic || t('Desconocido', 'Unknown')
  const options = question.options || []
  const correctIdx = question.correct_option_idx

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
          questionId: question._id || question.questionId,
          selectedIdx: correctIdx !== undefined ? correctIdx : 0, // Sending correct index to get general explanation
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
  }, [question, lang, correctIdx, showAi, aiExplanation])

  return (
    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/20 dark:border-slate-700/50 rounded-2xl p-5 shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300 flex flex-col relative overflow-hidden group">
      {/* Decorative gradient blob */}
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-amber-400/10 dark:bg-amber-500/10 rounded-full blur-2xl pointer-events-none group-hover:scale-110 transition-transform duration-500" />
      
      {/* Header */}
      <div className="flex items-start gap-3 mb-4 relative z-10">
        <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0 shadow-inner">
          <StarFilled className="text-xl text-amber-500 dark:text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-2.5 py-1 bg-indigo-100/80 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-[10px] uppercase tracking-wider font-bold rounded-lg border border-indigo-200 dark:border-indigo-800">
              {topic}
            </span>
          </div>
          <h3 className="text-base font-bold text-ink dark:text-white leading-snug">
            {questionText}
          </h3>
          {question.metadata?.image_url && (
            <div className="mt-3 rounded-xl overflow-hidden border border-slate-200/50 dark:border-slate-700/50 w-full max-h-48 relative group/img">
              <img
                src={question.metadata.image_url}
                alt="Question"
                className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-500"
              />
            </div>
          )}
        </div>
      </div>

      {/* Options (if available) */}
      {options.length > 0 && (
        <div className="space-y-2 mb-4 relative z-10 flex-1">
          {options.map((option, index) => {
            const optionText = option['text_' + lang] || option.text_es || ''
            const isCorrect = option.idx === correctIdx

            return (
              <div
                key={index}
                className={`flex items-start gap-3 p-3 rounded-xl border relative overflow-hidden transition-colors ${
                  isCorrect
                    ? 'bg-green-50/80 dark:bg-green-900/10 border-green-200 dark:border-green-800/50 shadow-sm'
                    : 'bg-slate-50/50 dark:bg-slate-800/30 border-slate-200/50 dark:border-slate-700/50'
                }`}
              >
                {isCorrect && (
                   <div className="absolute inset-y-0 left-0 w-1 bg-green-500 rounded-l-xl" />
                )}
                {isCorrect ? (
                  <CheckCircleOutlined className="text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-slate-300 dark:border-slate-600 shrink-0 mt-0.5" />
                )}
                <p
                  className={`text-sm ${
                    isCorrect 
                      ? 'text-green-900 dark:text-green-100 font-bold' 
                      : 'text-slate-600 dark:text-slate-400 font-medium'
                  }`}
                >
                  {optionText}
                </p>
              </div>
            )
          })}
        </div>
      )}

      {/* Expandable Sections */}
      <div className="space-y-2 mb-4 relative z-10">
        {/* Official Explanation */}
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
                  className="text-sm text-ink dark:text-white leading-relaxed prose prose-sm dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(explanation) }}
                />
              </div>
            )}
          </div>
        )}

        {/* AI Tutor */}
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
              {t('Explicación IA', 'AI Explanation')}
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
                  <span className="text-sm font-medium">{t('Generando explicación...', 'Generating explanation...')}</span>
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
                        <span><FormattedText text={aiExplanation.wrong_explanation} /></span>
                      </div>
                    )}

                    {aiExplanation.correct_explanation && (
                      <div className="text-sm text-green-800 dark:text-green-200 bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-100 dark:border-green-800/50">
                        <span className="font-bold block mb-1">✅ {t('La regla correcta:', 'The correct rule:')}</span>
                        <span><FormattedText text={aiExplanation.correct_explanation} /></span>
                      </div>
                    )}

                    {aiExplanation.memory_tip && (
                      <div className="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg flex gap-3 border border-amber-100 dark:border-amber-800/50 mt-1">
                        <span className="text-xl shrink-0">💡</span>
                        <div>
                          <span className="font-bold block mb-0.5">{t('Consejo de memoria:', 'Memory tip:')}</span>
                          <span><FormattedText text={aiExplanation.memory_tip} /></span>
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
          onClick={() => onReview(question)}
          className="flex-1 px-4 py-2.5 bg-ink text-white dark:bg-primary dark:hover:bg-indigo-600 font-bold rounded-xl hover:bg-slate-800 transition-all active:scale-95 flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
        >
          <EyeOutlined />
          {t('Revisar', 'Review')}
        </button>
        <button
          onClick={() => onRemove(question._id)}
          className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-red-500 dark:text-red-400 rounded-xl hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-300 transition-all active:scale-95 border border-transparent hover:border-red-200 dark:hover:border-red-800"
          title={t('Quitar de guardados', 'Remove bookmark')}
        >
          <DeleteOutlined className="text-lg" />
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
function BookmarksContent() {
  const { user, t } = useAuth()
  const router = useRouter()
  const toast = useToast()

  const lang = user?.preferences?.language || 'es'

  // ── State ──────────────────────────────────────────────────────────────
  const [questions, setQuestions] = useState([])
  const [topics, setTopics] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(false)
  const [selectedTopic, setSelectedTopic] = useState(null)
  
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  // ── Fetch bookmarks ────────────────────────────────────────────────────
  const fetchBookmarks = useCallback(
    async (newOffset = 0, force = false) => {
      try {
        if (newOffset === 0) {
          setRefreshing(true)
        } else {
          setLoadingMore(true)
        }
        setError(false)

        const params = new URLSearchParams()
        if (selectedTopic) params.append('topic', selectedTopic)
        if (force) params.append('force', 'true')
        params.append('offset', newOffset.toString())
        params.append('limit', '20')

        const res = await fetch(`${API_ENDPOINTS.BOOKMARKS}?${params}`)
        if (!res.ok) throw new Error(t('Error al cargar guardados', 'Failed to load bookmarks'))

        const data = await res.json()
        if (newOffset === 0) {
          setQuestions(data.bookmarks || [])
        } else {
          setQuestions((prev) => {
            const existingIds = new Set(prev.map(q => q._id || q.questionId))
            const newQuestions = (data.bookmarks || []).filter(q => !existingIds.has(q._id || q.questionId))
            return [...prev, ...newQuestions]
          })
        }
        setOffset(newOffset)
        setHasMore(data.hasMore || false)
      } catch (err) {
        console.error('[bookmarks] Fetch error:', err)
        setError(true)
        toast?.error?.(t('Error', 'Error'), err.message)
      } finally {
        if (newOffset === 0) setLoading(false)
        setRefreshing(false)
        setLoadingMore(false)
      }
    },
    [selectedTopic, t, toast]
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
        console.error('[bookmarks] Topics fetch error:', err)
      }
    }

    fetchTopics()
  }, [])

  // ── Fetch bookmarks when filters change ────────────────────────────────
  useEffect(() => {
    fetchBookmarks(0)
  }, [fetchBookmarks])

  // ── Remove bookmark ────────────────────────────────────────────────────
  const handleRemoveBookmark = useCallback(
    async (bookmarkId) => {
      try {
        const res = await fetch(`${API_ENDPOINTS.BOOKMARKS}/${bookmarkId}`, {
          method: 'DELETE',
        })

        if (!res.ok) throw new Error(t('Error al eliminar', 'Failed to delete'))

        setQuestions((prev) => prev.filter((q) => q._id !== bookmarkId))
        toast?.success?.(
          t('Eliminado', 'Deleted'),
          t('Pregunta quitada de guardados', 'Question removed from bookmarks')
        )
      } catch (err) {
        console.error('[bookmarks] Delete error:', err)
        toast?.error?.(t('Error', 'Error'), err.message)
      }
    },
    [t, toast]
  )

  // ── Review question ────────────────────────────────────────────────────
  const handleReviewQuestion = useCallback(
    (question) => {
      if (question.questionId || question._id) {
        router.push(`/question/${question.questionId || question._id}`)
      } else if (question.topic) {
        router.push(`/exam?mode=custom&topics=${encodeURIComponent(question.topic)}`)
      }
    },
    [router]
  )

  // ── Practice all bookmarks ─────────────────────────────────────────────
  const handlePracticeAll = useCallback(() => {
    router.push('/exam?mode=bookmarks')
  }, [router])

  // ── Loading state ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4 shadow-lg"></div>
        <p className="text-slate-500 dark:text-slate-400 font-medium">
          {t('Cargando tus guardados...', 'Loading your bookmarks...')}
        </p>
      </div>
    )
  }

  // ── Error state ────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="container-wrapper max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-md rounded-3xl p-12 text-center border border-white/50 dark:border-slate-700/50 shadow-sm flex flex-col items-center">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-red-400 to-rose-600 flex items-center justify-center shadow-xl shadow-red-500/20 mb-6">
            <WarningOutlined className="text-5xl text-white drop-shadow-md" />
          </div>
          <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-3 tracking-tight">
            {t('Error al cargar', 'Failed to load')}
          </h3>
          <p className="text-base text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-8 font-medium">
            {t(
              'No pudimos cargar tus preguntas guardadas. Inténtalo de nuevo más tarde.',
              'We could not load your bookmarked questions. Please try again later.'
            )}
          </p>
          <button
            onClick={() => fetchBookmarks(0, true)}
            className="px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black rounded-2xl hover:scale-105 transition-all shadow-xl active:scale-95 flex items-center gap-3 text-lg"
          >
            <ReloadOutlined />
            {t('Reintentar', 'Retry')}
          </button>
        </div>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="container-wrapper space-y-8 max-w-7xl mx-auto px-4 py-8">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6">
        <div className="relative">
          <div className="absolute -inset-1 bg-gradient-to-r from-amber-400 to-orange-500 rounded-xl blur opacity-20 dark:opacity-30 pointer-events-none"></div>
          <div className="relative">
            <h1 className="text-3xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 tracking-tight mb-2">
              {t('Preguntas Guardadas', 'Bookmarked Questions')}
            </h1>
            <p className="text-base text-slate-500 dark:text-slate-400 font-medium max-w-xl">
              {questions.length > 0
                ? t(
                    `Tienes ${questions.length} preguntas reservadas para repaso especial.`,
                    `You have ${questions.length} questions saved for special review.`
                  )
                : t('No tienes preguntas guardadas aún.', 'No bookmarks yet.')}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => fetchBookmarks(0, true)}
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

      {/* ── Info Card ───────────────────────────────────────────────── */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10 border border-amber-200/50 dark:border-amber-800/30 p-5 md:p-6 shadow-sm">
        <div className="absolute right-0 top-0 w-32 h-32 bg-amber-400/10 dark:bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
        <div className="flex items-start md:items-center gap-4 relative z-10">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white shadow-lg shadow-amber-500/20 shrink-0">
            <StarFilled className="text-2xl drop-shadow-sm" />
          </div>
          <div>
            <h3 className="text-lg font-black text-amber-900 dark:text-amber-100 mb-1">
              {t('¿Cómo funciona?', 'How does it work?')}
            </h3>
            <p className="text-sm font-medium text-amber-800/80 dark:text-amber-200/80 leading-relaxed max-w-3xl">
              {t(
                'Guarda preguntas difíciles o interesantes durante tus exámenes haciendo clic en la estrella. Tu colección personal te ayudará a enfocarte en lo que más necesitas repasar.',
                'Save difficult or interesting questions during your exams by clicking the star. Your personal collection will help you focus on what you need to review most.'
              )}
            </p>
          </div>
        </div>
      </div>

      {/* ── Filters & Action Bar ──────────────────────────────────────── */}
      {(topics.length > 0 || questions.length > 0) && (
        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
          
          {/* Topic Filter */}
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-md rounded-2xl p-4 border border-white/50 dark:border-slate-700/50 shadow-sm flex items-center gap-4 flex-1 md:flex-none">
            <FilterOutlined className="text-slate-400 text-lg hidden sm:block" />
            <div className="relative w-full md:w-auto inline-block">
              <select
                value={selectedTopic || ''}
                onChange={(e) => setSelectedTopic(e.target.value || null)}
                className="w-full md:min-w-[250px] px-4 py-2.5 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-white focus:ring-4 focus:ring-amber-500/20 focus:border-amber-500 transition-all appearance-none cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 shadow-sm pr-10"
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

          {/* Practice All CTA */}
          {questions.length > 0 && (
            <button
              onClick={handlePracticeAll}
              className="px-8 py-3 md:py-0 h-[60px] bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black rounded-2xl hover:scale-105 transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3 whitespace-nowrap text-base"
            >
              <RocketOutlined className="text-amber-500" />
              {t('Practicar Guardados', 'Practice Bookmarks')}
            </button>
          )}
        </div>
      )}

      {/* ── Bookmarks List ──────────────────────────────────────────── */}
      {questions.length === 0 ? (
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-md rounded-3xl p-12 text-center border border-white/50 dark:border-slate-700/50 shadow-sm flex flex-col items-center">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-200 to-amber-400 dark:from-amber-700 dark:to-amber-900 flex items-center justify-center shadow-xl shadow-amber-500/20 mb-6">
            <StarOutlined className="text-5xl text-amber-600 dark:text-amber-300 drop-shadow-md" />
          </div>
          <h3 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white mb-3 tracking-tight">
            {selectedTopic
              ? t('No hay preguntas guardadas', 'No bookmarked questions')
              : t('Aún no has guardado preguntas', "You haven't bookmarked any questions yet")}
          </h3>
          <p className="text-base text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-8 font-medium">
            {selectedTopic
              ? t(
                  'No tienes preguntas guardadas en este tema específico.',
                  'You have no bookmarked questions in this specific topic.'
                )
              : t(
                  'Durante los exámenes, haz clic en el ícono de estrella para guardar preguntas importantes y repasarlas más tarde.',
                  'During exams, click the star icon to save important questions and review them later.'
                )}
          </p>
          {!selectedTopic && (
            <button
              onClick={() => router.push('/exam')}
              className="px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black rounded-2xl hover:scale-105 transition-all shadow-xl active:scale-95 flex items-center gap-3 text-lg"
            >
              <RocketOutlined className="text-amber-500" />
              {t('Tomar un Examen', 'Take an Exam')}
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {questions.map((question) => (
              <BookmarkCard
                key={question._id || question.questionId}
                question={question}
                onRemove={handleRemoveBookmark}
                onReview={handleReviewQuestion}
                t={t}
                lang={lang}
              />
            ))}
          </div>
          
          {hasMore && (
            <div className="flex justify-center mt-8">
              <button
                onClick={() => fetchBookmarks(offset + 20)}
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
export default function BookmarksPage() {
  return (
    <AppShell>
      <BookmarksContent />
    </AppShell>
  )
}
