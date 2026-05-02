'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthContext'
import AppShell from '@/components/AppShell'
import DOMPurify from 'dompurify'
import {
  RobotOutlined,
  LoadingOutlined,
  ThunderboltOutlined,
  TrophyOutlined,
} from '@ant-design/icons'

function sanitizeHtml(html) {
  if (typeof window === 'undefined') return ''
  return DOMPurify.sanitize(html)
}

/**
 * AI COACH CARD COMPONENT
 */
function AICoachCard({ sessionId, lang, t }) {
  const [feedback, setFeedback] = useState(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(true)

  useEffect(() => {
    if (!sessionId) return
    fetch('/api/ai/coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, lang }),
    })
      .then((r) => r.json())
      .then((d) => setFeedback(d.feedback))
      .catch((err) => console.error('[review/coach]', err))
      .finally(() => setLoading(false))
  }, [sessionId, lang])

  const verdictColors = {
    passed: 'from-green-500 to-emerald-600',
    failed: 'from-red-500 to-orange-600',
    close: 'from-amber-500 to-yellow-600',
  }
  const gradient = verdictColors[feedback?.verdict] ?? 'from-primary to-indigo-600'

  return (
    <div className="mb-6 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-lg">
      {/* Header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between p-4 bg-gradient-to-r ${gradient} text-white`}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <RobotOutlined className="text-xl" />
          </div>
          <div className="text-left">
            <p className="font-black text-lg leading-tight">
              {loading
                ? t('Analizando con IA...', 'Analyzing with AI...')
                : (feedback?.headline ?? t('Análisis IA', 'AI Analysis'))}
            </p>
            <p className="text-white/80 text-sm">
              {t('Coach personalizado', 'Personalized coach')}
            </p>
          </div>
        </div>
        <span className="text-white/70 text-xl">{open ? '▲' : '▼'}</span>
      </button>

      {/* Body */}
      {open && (
        <div className="bg-white dark:bg-slate-900 p-5 space-y-4">
          {loading ? (
            <div className="flex items-center gap-3 py-4 text-primary">
              <LoadingOutlined className="text-2xl animate-spin" />
              <p className="text-sm text-ink-light dark:text-slate-400">
                {t('La IA está revisando tu examen...', 'AI is reviewing your exam...')}
              </p>
            </div>
          ) : feedback ? (
            <>
              {/* Summary */}
              {feedback.summary && (
                <p className="text-ink dark:text-white text-sm leading-relaxed">
                  {feedback.summary}
                </p>
              )}

              {/* Strengths & Weaknesses */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {feedback.strengths?.length > 0 && (
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
                    <p className="text-xs font-bold text-green-700 dark:text-green-400 mb-2 uppercase tracking-wide">
                      ✅ {t('Puntos fuertes', 'Strengths')}
                    </p>
                    <ul className="space-y-1">
                      {feedback.strengths.map((s, i) => (
                        <li key={i} className="text-sm text-ink dark:text-white">
                          • {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {feedback.weaknesses?.length > 0 && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                    <p className="text-xs font-bold text-red-700 dark:text-red-400 mb-2 uppercase tracking-wide">
                      ⚠️ {t('A mejorar', 'To improve')}
                    </p>
                    <ul className="space-y-1">
                      {feedback.weaknesses.map((w, i) => (
                        <li key={i} className="text-sm text-ink dark:text-white">
                          • {w}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Next Step */}
              {feedback.next_step && (
                <div className="p-3 bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-xl flex items-start gap-3">
                  <ThunderboltOutlined className="text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-primary mb-1 uppercase tracking-wide">
                      {t('Próximo paso', 'Next step')}
                    </p>
                    <p className="text-sm text-ink dark:text-white">{feedback.next_step}</p>
                  </div>
                </div>
              )}

              {/* Confidence Boost */}
              {feedback.confidence_boost && (
                <div className="text-center p-3 bg-gradient-to-r from-primary/5 to-indigo-600/5 rounded-xl">
                  <TrophyOutlined className="text-amber-500 text-xl mb-1" />
                  <p className="text-sm text-ink-light dark:text-slate-400 italic">
                    "{feedback.confidence_boost}"
                  </p>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-ink-light dark:text-slate-400 py-2">
              {t('No se pudo generar el análisis.', 'Could not generate analysis.')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function ReviewInterface() {
  const { user, t } = useAuth()
  const params = useParams()
  const router = useRouter()
  const sessionId = params?.sessionId

  const [session, setSession] = useState(null)
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [expandedImage, setExpandedImage] = useState(null)
  const [showExplanationMap, setShowExplanationMap] = useState({})
  const [bookmarkedQuestions, setBookmarkedQuestions] = useState(new Set())
  const [filter, setFilter] = useState('all') // 'all' | 'correct' | 'incorrect' | 'unanswered'

  const lang = user?.preferences?.language || 'es'

  useEffect(() => {
    if (!sessionId) return
    fetch('/api/bookmarks?idsOnly=true')
      .then((r) => (r.ok ? r.json() : {}))
      .then((data) => {
        if (data.bookmarks) setBookmarkedQuestions(new Set(data.bookmarks))
      })
      .catch(console.error)

    fetch(`/api/exams/${sessionId}`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to fetch exam review')
        return r.json()
      })
      .then((data) => {
        setSession(data.session)
        setQuestions(data.questions || [])
      })
      .catch((err) => {
        console.error(err)
        setError(true)
      })
      .finally(() => setLoading(false))
  }, [sessionId])

  const toggleExplanation = (idx) =>
    setShowExplanationMap((prev) => ({ ...prev, [idx]: !prev[idx] }))

  const toggleBookmark = async (questionId) => {
    try {
      const res = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId }),
      })
      const data = await res.json()
      if (data.success) {
        setBookmarkedQuestions((prev) => {
          const newSet = new Set(prev)
          data.isBookmarked ? newSet.add(questionId) : newSet.delete(questionId)
          return newSet
        })
      }
    } catch (error) {
      console.error('Error toggling bookmark:', error)
    }
  }

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
            {t('Cargando revisión...', 'Loading review...')}
          </p>
        </div>
      </AppShell>
    )
  }

  // ── ERROR ──
  if (error || !session || !questions?.length) {
    return (
      <AppShell>
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center">
          <div className="text-6xl">😕</div>
          <h2 className="text-xl font-black text-base-content">
            {t('Examen no encontrado', 'Exam not found')}
          </h2>
          <p className="text-sm text-base-content/50">
            {t(
              'No pudimos cargar los resultados de este examen.',
              'We could not load the results for this exam.'
            )}
          </p>
          <button onClick={() => router.push('/exam')} className="btn btn-primary rounded-xl mt-2">
            {t('Volver a exámenes', 'Back to exams')}
          </button>
        </div>
      </AppShell>
    )
  }

  // Answer lookup map
  const answerMap = {}
  session.answers?.forEach((a) => {
    answerMap[a.questionId] = a
  })

  // Derive per-question status
  const questionsWithStatus = questions.map((q) => {
    const userAnswer = answerMap[q._id]
    const selectedOptionIdx = userAnswer?.selectedOptionIdx
    const correctIdx = q.correct_option_idx
    let status = 'unanswered'
    if (selectedOptionIdx !== undefined) {
      status = selectedOptionIdx === correctIdx ? 'correct' : 'incorrect'
    }
    return { ...q, status, selectedOptionIdx, correctIdx }
  })

  const filteredQuestions = questionsWithStatus.filter((q) => {
    if (filter === 'all') return true
    return q.status === filter
  })

  const counts = {
    correct: questionsWithStatus.filter((q) => q.status === 'correct').length,
    incorrect: questionsWithStatus.filter((q) => q.status === 'incorrect').length,
    unanswered: questionsWithStatus.filter((q) => q.status === 'unanswered').length,
  }

  const passed = session.passed
  const scorePercent = session.score ?? 0

  // ── MAIN RENDER ──
  return (
    <AppShell>
      <div className="min-h-screen bg-base-100">
        {/* ── Sticky Header ── */}
        <div className="sticky top-0 z-30 bg-base-100/95 backdrop-blur border-b border-base-200 shadow-sm">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="w-9 h-9 rounded-xl flex items-center justify-center bg-base-200
                hover:bg-base-300 transition-colors text-base-content/70 shrink-0"
            >
              ←
            </button>
            <div className="flex-1 min-w-0">
              <p className="font-black text-base text-base-content leading-tight">
                {t('Revisión del Examen', 'Exam Review')}
              </p>
              <p className="text-xs text-base-content/40">
                {questions.length} {t('preguntas', 'questions')}
              </p>
            </div>
            <div
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-black border
              ${
                passed
                  ? 'bg-success/10 border-success/30 text-success'
                  : 'bg-error/10 border-error/30 text-error'
              }`}
            >
              {passed ? '✅' : '❌'} {scorePercent}%
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 pt-5 pb-16 space-y-5">
          {/* ── Score Summary ── */}
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                label: t('Correctas', 'Correct'),
                value: counts.correct,
                color: 'text-success',
                bg: 'bg-success/5 border-success/20',
                icon: '✅',
              },
              {
                label: t('Errores', 'Errors'),
                value: counts.incorrect,
                color: 'text-error',
                bg: 'bg-error/5 border-error/20',
                icon: '❌',
              },
              {
                label: t('Sin resp.', 'No answer'),
                value: counts.unanswered,
                color: 'text-base-content/50',
                bg: 'bg-base-200/60 border-base-300',
                icon: '—',
              },
            ].map((s, i) => (
              <div key={i} className={`rounded-2xl border p-3 text-center ${s.bg}`}>
                <div className="text-base mb-1">{s.icon}</div>
                <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
                <div className="text-[10px] text-base-content/50 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* ── AI Coach ── */}
          <AICoachCard sessionId={sessionId} lang={lang} t={t} />

          {/* ── Filter Tabs ── */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
            {[
              { key: 'all', label: t('Todas', 'All'), count: questions.length },
              { key: 'correct', label: t('Correctas', 'Correct'), count: counts.correct },
              { key: 'incorrect', label: t('Errores', 'Errors'), count: counts.incorrect },
              { key: 'unanswered', label: t('Sin resp.', 'Unanswered'), count: counts.unanswered },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold
                  border transition-all
                  ${
                    filter === tab.key
                      ? 'bg-primary text-white border-primary shadow-sm'
                      : 'bg-base-100 text-base-content/60 border-base-200 hover:border-base-300'
                  }`}
              >
                {tab.label}
                <span
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black
                  ${filter === tab.key ? 'bg-white/20 text-white' : 'bg-base-200 text-base-content/50'}`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* ── Questions List ── */}
          {filteredQuestions.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-base-300 p-10 text-center">
              <p className="text-3xl mb-2">🎉</p>
              <p className="text-sm text-base-content/50">
                {t('No hay preguntas en esta categoría.', 'No questions in this category.')}
              </p>
            </div>
          ) : (
            filteredQuestions.map((q) => {
              const questionText = getLocalizedText(q.question)
              const helpHtml = q.metadata?.help_html
              const isBookmarked = bookmarkedQuestions.has(q._id)
              const originalIdx = questionsWithStatus.findIndex((qw) => qw._id === q._id)

              const statusConfig = {
                correct: {
                  icon: '✓',
                  ring: 'border-success/30',
                  badge: 'bg-success/10 text-success border-success/25',
                },
                incorrect: {
                  icon: '✗',
                  ring: 'border-error/30',
                  badge: 'bg-error/10 text-error border-error/25',
                },
                unanswered: {
                  icon: '—',
                  ring: 'border-base-300',
                  badge: 'bg-base-200 text-base-content/50 border-base-300',
                },
              }
              const sc = statusConfig[q.status]

              return (
                <div
                  key={q._id}
                  className={`rounded-2xl border-2 overflow-hidden ${sc.ring} bg-base-100 shadow-sm`}
                >
                  {/* Question Header */}
                  <div className="px-4 pt-4 pb-3 flex items-start gap-3">
                    {/* Status badge */}
                    <span
                      className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center
                      text-xs font-black border ${sc.badge} mt-0.5`}
                    >
                      {sc.icon}
                    </span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[11px] font-bold text-base-content/40 uppercase tracking-widest">
                          {t('Pregunta', 'Q')} {originalIdx + 1}
                        </span>
                        <button
                          onClick={() => toggleBookmark(q._id)}
                          className={`shrink-0 text-base transition-colors
                            ${isBookmarked ? 'text-warning' : 'text-base-content/25 hover:text-warning'}`}
                          aria-label={
                            isBookmarked
                              ? t('Quitar guardado', 'Remove bookmark')
                              : t('Guardar', 'Bookmark')
                          }
                        >
                          {isBookmarked ? '★' : '☆'}
                        </button>
                      </div>
                      <p
                        className="text-sm sm:text-base font-semibold text-base-content leading-snug"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(questionText) }}
                      />
                    </div>
                  </div>

                   {/* Question Image */}
                   {q.metadata?.image_url && (
                     <div
                       className="mx-4 mb-3 rounded-xl overflow-hidden border border-base-200 cursor-zoom-in"
                       onClick={() => setExpandedImage(q.metadata.image_url)}
                       onKeyDown={(e) => {
                         if (e.key === 'Enter' || e.key === ' ') {
                           setExpandedImage(q.metadata.image_url)
                         }
                       }}
                       role="button"
                       tabIndex={0}
                     >
                       <div className="relative w-full h-48">
                         <Image
                           src={q.metadata.image_url}
                           alt={t('Imagen de la pregunta', 'Question image')}
                           fill
                           className="object-contain bg-base-50"
                         />
                       </div>
                     </div>
                   )}

                  {/* Options */}
                  <div className="px-4 pb-3 space-y-2">
                    {q.options?.map((opt) => {
                      const text =
                        lang === 'en' ? opt.text_en || opt.text_es : opt.text_es || opt.text_en
                      const letter = ['A', 'B', 'C', 'D'][opt.idx]
                      const isCorrect = opt.idx === q.correctIdx
                      const isWrong = opt.idx === q.selectedOptionIdx && !isCorrect

                      let optStyle = 'border-base-200 bg-base-50 text-base-content/40'
                      if (isCorrect)
                        optStyle = 'border-success bg-success/10 text-success font-semibold'
                      if (isWrong) optStyle = 'border-error bg-error/10 text-error font-semibold'

                      return (
                        <div
                          key={opt.idx}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-sm ${optStyle}`}
                        >
                          <span
                            className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center
                            text-xs font-black
                            ${
                              isCorrect
                                ? 'bg-success text-white'
                                : isWrong
                                  ? 'bg-error text-white'
                                  : 'bg-base-200 text-base-content/40'
                            }`}
                          >
                            {letter}
                          </span>
                          <span className="flex-1 leading-snug">{text}</span>
                          {isCorrect && <span className="shrink-0 text-success font-black">✓</span>}
                          {isWrong && <span className="shrink-0 text-error font-black">✗</span>}
                        </div>
                      )
                    })}

                    {/* Unanswered notice */}
                    {q.selectedOptionIdx === undefined && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-base-200 text-base-content/50 text-xs font-medium">
                        <span>⚠️</span>
                        {t('No respondiste a esta pregunta.', 'You did not answer this question.')}
                      </div>
                    )}
                  </div>

                  {/* DGT Explanation */}
                  {helpHtml && (
                    <div className="border-t border-base-200">
                      <button
                        onClick={() => toggleExplanation(originalIdx)}
                        className="w-full flex items-center justify-between px-4 py-3 text-sm
                          font-semibold text-primary hover:bg-primary/5 transition-colors"
                        aria-expanded={showExplanationMap[originalIdx]}
                      >
                        <span className="flex items-center gap-2">
                          <span>💡</span>
                          {t('Explicación oficial DGT', 'Official DGT Explanation')}
                        </span>
                        <span
                          className={`text-xs transition-transform duration-200
                          ${showExplanationMap[originalIdx] ? 'rotate-180' : ''}`}
                        >
                          ▼
                        </span>
                      </button>
                      {showExplanationMap[originalIdx] && (
                        <div
                          className="px-4 pb-4 text-sm text-base-content/75 leading-relaxed
                            border-t border-primary/10 bg-primary/5"
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(helpHtml) }}
                        />
                      )}
                    </div>
                  )}
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
            onKeyDown={(e) => {
              if (e.key === 'Escape' || e.key === 'Enter') {
                setExpandedImage(null)
              }
            }}
            role="dialog"
            aria-label={t('Imagen ampliada', 'Expanded image')}
            tabIndex={0}
          >
            <div className="relative w-full h-full max-w-5xl max-h-[90vh]">
              <Image
                src={expandedImage}
                alt={t('Imagen ampliada', 'Expanded image')}
                fill
                className="object-contain rounded-2xl shadow-2xl"
                priority
              />
            </div>
            <button
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white
                flex items-center justify-center text-lg hover:bg-white/20 transition-colors"
              onClick={() => setExpandedImage(null)}
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </AppShell>
  )
}

export default function ExamReviewPage() {
  return <ReviewInterface />
}
