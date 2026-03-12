'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/components/AuthContext'
import DOMPurify from 'dompurify'

function sanitizeHtml(html) {
  if (typeof window === 'undefined') return ''
  return DOMPurify.sanitize(html)
}

function BookmarksInterface() {
  const { user, t } = useAuth()
  const router = useRouter()

  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [expandedImage, setExpandedImage] = useState(null)
  const [showExplanationMap, setShowExplanationMap] = useState({})

  const lang = user?.preferences?.language || 'es'

  useEffect(() => {
    let isMounted = true
    const fetchBookmarks = async () => {
      setLoading(true)
      setError(false)
      try {
        const res = await fetch('/api/users/bookmarks?populate=true')
        if (!res.ok) throw new Error('Failed to fetch bookmarks')
        const data = await res.json()
        if (isMounted && data.bookmarks) setQuestions(data.bookmarks)
      } catch (err) {
        console.error('Error fetching bookmarks:', err)
        if (isMounted) setError(true)
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    fetchBookmarks()
    return () => { isMounted = false }
  }, [])

  const toggleBookmark = async (questionId) => {
    setQuestions(prev => prev.filter(q => q._id !== questionId))
    try {
      const res = await fetch('/api/users/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId }),
      })
      const data = await res.json()
      if (!data.success) console.error('Failed to update bookmark on server')
    } catch (error) {
      console.error('Error toggling bookmark:', error)
    }
  }

  const toggleExplanation = (idx) =>
    setShowExplanationMap(prev => ({ ...prev, [idx]: !prev[idx] }))

  const getLocalizedText = (obj) => {
    if (!obj) return ''
    if (typeof obj === 'string') return obj
    if (lang === 'en' && obj.en) return obj.en
    return obj.es || obj.en || ''
  }

  // ── LOADING ──
  if (loading) {
    return (
      <AppShell>
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-base-100">
          <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-base-content/50 animate-pulse">
            {t('Cargando guardados...', 'Loading bookmarks...')}
          </p>
        </div>
      </AppShell>
    )
  }

  // ── ERROR ──
  if (error) {
    return (
      <AppShell>
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center">
          <div className="text-5xl">⚠️</div>
          <h2 className="text-xl font-black text-base-content">
            {t('Error al cargar', 'Error loading')}
          </h2>
          <p className="text-sm text-base-content/50">
            {t(
              'No pudimos cargar tus preguntas guardadas. Inténtalo de nuevo más tarde.',
              'We could not load your bookmarked questions. Please try again later.'
            )}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="btn btn-primary rounded-xl mt-2"
          >
            {t('Reintentar', 'Retry')}
          </button>
        </div>
      </AppShell>
    )
  }

  // ── MAIN ──
  return (
    <AppShell>
      <div className="min-h-screen bg-base-100">
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-24 space-y-4">

          {/* ── Header ── */}
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => router.push('/dashboard')}
              className="w-9 h-9 rounded-xl bg-base-200 flex items-center justify-center
                text-base-content/60 hover:bg-base-300 transition-colors shrink-0"
            >
              ←
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-black text-base-content">
                ⭐ {t('Preguntas Guardadas', 'Bookmarked Questions')}
              </h1>
              <p className="text-xs text-base-content/50 mt-0.5">
                {questions.length > 0
                  ? t(`${questions.length} preguntas para revisar`, `${questions.length} questions to review`)
                  : t('Sin preguntas guardadas', 'No bookmarks yet')}
              </p>
            </div>
          </div>

          {/* ── Empty State ── */}
          {questions.length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-base-300 p-12 text-center mt-6">
              <div className="text-5xl mb-4">⭐</div>
              <h2 className="text-lg font-black text-base-content mb-2">
                {t('No tienes preguntas guardadas', 'No bookmarked questions')}
              </h2>
              <p className="text-sm text-base-content/50 mb-6 max-w-xs mx-auto leading-relaxed">
                {t(
                  'Guarda preguntas durante los exámenes haciendo clic en la estrella para repasarlas aquí.',
                  'Bookmark questions during exams by clicking the star to review them here.'
                )}
              </p>
              <button
                onClick={() => router.push('/exam')}
                className="btn btn-primary rounded-xl"
              >
                {t('Hacer un examen', 'Take an exam')}
              </button>
            </div>
          ) : (
            /* ── Questions List ── */
            questions.map((q, idx) => {
              const questionText = getLocalizedText(q.question)
              const correctIdx = q.correct_option_idx
              const helpHtml = q.metadata?.help_html

              return (
                <div
                  key={q._id}
                  className="rounded-2xl border border-base-200 bg-base-100 overflow-hidden shadow-sm
                    hover:border-warning/40 transition-all"
                >
                  {/* ── Question image ── */}
                  {q.metadata?.image_url && (
                    <div
                      className="w-full cursor-zoom-in border-b border-base-200 bg-base-50
                        flex items-center justify-center overflow-hidden"
                      onClick={() => setExpandedImage(q.metadata.image_url)}
                    >
                      <img
                        src={q.metadata.image_url}
                        alt={t('Imagen de la pregunta', 'Question image')}
                        className="w-full max-h-52 object-contain p-4"
                      />
                    </div>
                  )}

                  {/* ── Content ── */}
                  <div className="p-4 space-y-3">

                    {/* Topic + Remove row */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {q.topic_tag && (
                          <span className="px-2.5 py-1 rounded-full bg-base-200 text-base-content/60
                            text-[11px] font-bold">
                            {getLocalizedText(q.topic_tag)}
                          </span>
                        )}
                        <span className="text-[11px] font-semibold text-base-content/30">
                          #{idx + 1}
                        </span>
                      </div>
                      <button
                        onClick={() => toggleBookmark(q._id)}
                        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl
                          bg-warning/10 border border-warning/25 text-warning text-xs font-bold
                          hover:bg-warning/20 active:scale-95 transition-all"
                        aria-label={t('Quitar de guardados', 'Remove bookmark')}
                      >
                        ★ {t('Quitar', 'Remove')}
                      </button>
                    </div>

                    {/* Question text */}
                    <p
                      className="text-sm sm:text-base font-semibold text-base-content leading-snug"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(questionText) }}
                    />

                    {/* Options */}
                    <div className="space-y-2 pt-1">
                      {q.options?.map((opt) => {
                        const text = lang === 'en' && opt.text_en ? opt.text_en : opt.text_es
                        const letter = ['A', 'B', 'C', 'D'][opt.idx]
                        const isCorrect = opt.idx === correctIdx

                        return (
                          <div
                            key={opt.idx}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-sm
                              ${isCorrect
                                ? 'border-success bg-success/10 text-success font-semibold'
                                : 'border-base-200 bg-base-50 text-base-content/40'}`}
                          >
                            <span
                              className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center
                                text-[11px] font-black
                                ${isCorrect
                                  ? 'bg-success text-white'
                                  : 'bg-base-200 text-base-content/40'}`}
                            >
                              {letter}
                            </span>
                            <span className="flex-1 leading-snug">{text}</span>
                            {isCorrect && (
                              <span className="shrink-0 text-success font-black" aria-label={t('Respuesta correcta', 'Correct answer')}>
                                ✓
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {/* DGT Explanation accordion */}
                    {helpHtml && (
                      <div className="border-t border-base-200 pt-3 mt-1">
                        <button
                          onClick={() => toggleExplanation(idx)}
                          className="w-full flex items-center justify-between text-sm font-semibold
                            text-primary hover:text-primary/80 transition-colors"
                          aria-expanded={showExplanationMap[idx]}
                        >
                          <span className="flex items-center gap-2">
                            💡 {t('Explicación oficial DGT', 'Official DGT Explanation')}
                          </span>
                          <span className={`text-xs text-base-content/40 transition-transform duration-200
                            ${showExplanationMap[idx] ? 'rotate-180' : ''}`}>
                            ▼
                          </span>
                        </button>
                        {showExplanationMap[idx] && (
                          <div
                            className="mt-3 p-3 rounded-xl bg-primary/5 border border-primary/15
                              text-sm text-base-content/75 leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(helpHtml) }}
                          />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* ── Expanded Image Modal ── */}
        {expandedImage && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
            onClick={() => setExpandedImage(null)}
            role="dialog"
            aria-label={t('Imagen ampliada', 'Expanded image')}
            tabIndex={-1}
            onKeyDown={(e) => { if (e.key === 'Escape') setExpandedImage(null) }}
          >
            <img
              src={expandedImage}
              alt={t('Imagen ampliada', 'Expanded image')}
              className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl object-contain"
            />
            <button
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white
                flex items-center justify-center text-lg hover:bg-white/20 transition-colors"
              onClick={() => setExpandedImage(null)}
              aria-label={t('Cerrar', 'Close')}
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </AppShell>
  )
}

export default function BookmarksPage() {
  return <BookmarksInterface />
}
