'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/components/AuthContext'
import { useToast } from '@/components/Toast'
import {
  StarFilled,
  StarOutlined,
  BookOutlined,
  DeleteOutlined,
  EyeOutlined,
  FilterOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  RocketOutlined,
  WarningOutlined,
  BulbOutlined,
} from '@ant-design/icons'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const API_ENDPOINTS = {
  BOOKMARKS: '/api/bookmarks',
  TOPICS: '/api/flashcards/decks',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Get localized text from multilingual object or string.
 */
const getLocalizedText = (obj, lang) => {
  if (!obj) return ''
  if (typeof obj === 'string') return obj
  if (lang === 'en' && obj.en) return obj.en
  return obj.es || obj.en || ''
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

/**
 * Bookmarked question card
 */
function BookmarkCard({ question, onRemove, onReview, t, lang = 'es' }) {
  const [expanded, setExpanded] = useState(false)

  // Mapping to real schema
  const questionText = question.question?.[lang] || question.question?.es || ''
  const explanation = question.metadata?.help_html || ''
  const topic = question.topic || t('Desconocido', 'Unknown')
  const options = question.options || []
  const correctIdx = question.correct_option_idx

  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => !prev)
  }, [])

  return (
    <div className="card hover:shadow-lg transition-shadow">
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
          <StarFilled className="text-xl text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-bold rounded">
              {topic}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-ink dark:text-white leading-snug">
            {questionText}
          </h3>
        </div>
      </div>

      {/* Options (if available) */}
      {options.length > 0 && (
        <div className="space-y-2 mb-3">
          {options.map((option, index) => {
            const optionText = option['text_' + lang] || option.text_es || ''
            const isCorrect = option.idx === correctIdx

            return (
              <div
                key={index}
                className={`flex items-start gap-2 p-2 rounded-lg border ${
                  isCorrect
                    ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                    : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
                }`}
              >
                {isCorrect ? (
                  <CheckCircleOutlined className="text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-slate-300 dark:border-slate-600 shrink-0 mt-0.5" />
                )}
                <p
                  className={`text-sm ${isCorrect ? 'text-green-900 dark:text-green-200 font-semibold' : 'text-ink-light dark:text-slate-400'}`}
                >
                  {optionText}
                </p>
              </div>
            )
          })}
        </div>
      )}

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
            <div className="mt-2 p-3 bg-white dark:bg-slate-800 rounded-lg border border-indigo-200 dark:border-indigo-800">
              <div
                className="text-sm text-ink dark:text-white leading-relaxed prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: explanation }}
              />
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => onReview(question)}
          className="flex-1 px-4 py-2 bg-primary text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
        >
          <EyeOutlined />
          {t('Revisar', 'Review')}
        </button>
        <button
          onClick={() => onRemove(question._id)}
          className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          title={t('Quitar de guardados', 'Remove bookmark')}
        >
          <DeleteOutlined />
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

  // ── Fetch bookmarks ────────────────────────────────────────────────────
  const fetchBookmarks = useCallback(
    async (force = false) => {
      try {
        setRefreshing(force)
        setError(false)

        const params = new URLSearchParams()
        if (selectedTopic) params.append('topic', selectedTopic)
        if (force) params.append('force', 'true')

        const res = await fetch(`${API_ENDPOINTS.BOOKMARKS}?${params}`)
        if (!res.ok) throw new Error(t('Error al cargar guardados', 'Failed to load bookmarks'))

        const data = await res.json()
        setQuestions(data.bookmarks || [])
      } catch (err) {
        console.error('[bookmarks] Fetch error:', err)
        setError(true)
        toast?.error?.(t('Error', 'Error'), err.message)
      } finally {
        setLoading(false)
        setRefreshing(false)
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
        setTopics(data.decks || [])
      } catch (err) {
        console.error('[bookmarks] Topics fetch error:', err)
      }
    }

    fetchTopics()
  }, [])

  // ── Fetch bookmarks when filters change ────────────────────────────────
  useEffect(() => {
    fetchBookmarks()
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
      // Navigate to single question review or practice
      if (question.questionId) {
        router.push(`/question/${question.questionId}`)
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
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-ink-light dark:text-slate-400 text-sm">
          {t('Cargando guardados...', 'Loading bookmarks...')}
        </p>
      </div>
    )
  }

  // ── Error state ────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="container-wrapper max-w-2xl mx-auto">
        <div className="card text-center py-12">
          <div className="flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <WarningOutlined className="text-5xl text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="text-xl font-black text-ink dark:text-white mb-2">
                {t('Error al cargar', 'Failed to load')}
              </h3>
              <p className="text-sm text-ink-light dark:text-slate-400 max-w-md mx-auto">
                {t(
                  'No pudimos cargar tus preguntas guardadas. Inténtalo de nuevo más tarde.',
                  'We could not load your bookmarked questions. Please try again later.'
                )}
              </p>
            </div>
            <button
              onClick={() => fetchBookmarks(true)}
              className="px-6 py-3 bg-primary text-white font-bold rounded-xl hover:bg-indigo-700 transition-all active:scale-95 flex items-center gap-2"
            >
              <ReloadOutlined />
              {t('Reintentar', 'Retry')}
            </button>
          </div>
        </div>
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
            {t('Preguntas Guardadas', 'Bookmarked Questions')}
          </h1>
          <p className="text-sm text-ink-light dark:text-slate-400 mt-1">
            {questions.length > 0
              ? t(
                  `${questions.length} preguntas para revisar`,
                  `${questions.length} questions to review`
                )
              : t('Sin preguntas guardadas', 'No bookmarks yet')}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => fetchBookmarks(true)}
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

      {/* ── Info Card ───────────────────────────────────────────────── */}
      <div className="card bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800">
        <div className="flex items-start gap-3">
          <StarFilled className="text-2xl text-amber-600 dark:text-amber-400 shrink-0 mt-1" />
          <div>
            <h3 className="font-bold text-indigo-900 dark:text-indigo-200 mb-1">
              {t('¿Cómo funciona?', 'How does it work?')}
            </h3>
            <p className="text-sm text-indigo-700 dark:text-indigo-300 leading-relaxed">
              {t(
                'Guarda preguntas durante los exámenes haciendo clic en la estrella para repasarlas aquí.',
                'Bookmark questions during exams by clicking the star to review them here.'
              )}
            </p>
          </div>
        </div>
      </div>

      {/* ── Topic Filter ────────────────────────────────────────────── */}
      {topics.length > 0 && questions.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-black text-ink dark:text-white mb-4 flex items-center gap-2">
            <FilterOutlined />
            {t('Filtrar por tema', 'Filter by topic')}
          </h2>
          <select
            value={selectedTopic || ''}
            onChange={(e) => setSelectedTopic(e.target.value || null)}
            className="w-full md:w-auto px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-ink dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option value="">{t('Todos los temas', 'All topics')}</option>
            {topics.map((topic, index) => (
              <option key={index} value={topic.tag || topic.name}>
                {topic.name || topic.tag}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* ── Practice All CTA ────────────────────────────────────────── */}
      {questions.length > 0 && (
        <div className="card bg-gradient-to-r from-amber-500 to-orange-600 text-white border-0">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-black mb-1">
                {t('¿Listo para practicar?', 'Ready to practice?')}
              </h3>
              <p className="text-sm text-amber-100">
                {t(
                  'Practica un examen con tus preguntas guardadas',
                  'Practice an exam with your bookmarked questions'
                )}
              </p>
            </div>
            <button
              onClick={handlePracticeAll}
              className="px-8 py-3 bg-white text-amber-600 font-black rounded-xl hover:bg-amber-50 transition-all shadow-lg active:scale-95 flex items-center gap-2 whitespace-nowrap"
            >
              <RocketOutlined />
              {t('Practicar Guardados', 'Practice Bookmarks')}
            </button>
          </div>
        </div>
      )}

      {/* ── Bookmarks List ──────────────────────────────────────────── */}
      {questions.length === 0 ? (
        <div className="card text-center py-12">
          <div className="flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <StarOutlined className="text-5xl text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="text-xl font-black text-ink dark:text-white mb-2">
                {selectedTopic
                  ? t('No hay preguntas guardadas', 'No bookmarked questions')
                  : t('Aún no has guardado preguntas', "You haven't bookmarked any questions yet")}
              </h3>
              <p className="text-sm text-ink-light dark:text-slate-400 max-w-md mx-auto">
                {selectedTopic
                  ? t(
                      'No tienes preguntas guardadas en este tema',
                      'You have no bookmarked questions in this topic'
                    )
                  : t(
                      'Durante los exámenes, haz clic en la estrella para guardar preguntas importantes',
                      'During exams, click the star to save important questions'
                    )}
              </p>
            </div>
            {!selectedTopic && (
              <button
                onClick={() => router.push('/exam')}
                className="px-6 py-3 bg-primary text-white font-bold rounded-xl hover:bg-indigo-700 transition-all active:scale-95 flex items-center gap-2"
              >
                <RocketOutlined />
                {t('Tomar Examen', 'Take Exam')}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {questions.map((question) => (
            <BookmarkCard
              key={question._id}
              question={question}
              onRemove={handleRemoveBookmark}
              onReview={handleReviewQuestion}
              t={t}
              lang={lang}
            />
          ))}
        </div>
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
