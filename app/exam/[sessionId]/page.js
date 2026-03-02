'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/components/AuthContext'

function sanitizeHtml(html) {
  if (typeof window === 'undefined') return ''
  // Basic sanitization - in production, use DOMPurify
  const div = document.createElement('div')
  div.innerHTML = html
  // Remove script tags
  div.querySelectorAll('script, iframe, object, embed').forEach(el => el.remove())
  return div.innerHTML
}

const audioCache = {}

const preloadAudio = (src) => {
  if (typeof window !== 'undefined' && !audioCache[src]) {
    const audio = new Audio(src)
    audio.preload = 'auto'
    audioCache[src] = audio
  }
}

// Preload common sounds
if (typeof window !== 'undefined') {
  preloadAudio('/sounds/correct-answer.mp3')
  preloadAudio('/sounds/wrong-answer.mp3')
  preloadAudio('/sounds/sucess-exam.mp3')
  preloadAudio('/sounds/fail-exam.mp3')
}

function playSound(src) {
  if (typeof window !== 'undefined') {
    preloadAudio(src) // Ensure it's in cache
    const audio = audioCache[src]
    if (audio) {
      audio.currentTime = 0
      const playPromise = audio.play()
      if (playPromise !== undefined) {
        playPromise.catch((e) => console.error('Audio play failed:', e))
      }
    }
  }
}

function ExamInterface() {
  const { user, t } = useAuth()
  const params = useParams()
  const router = useRouter()
  const sessionId = params.sessionId

  const [session, setSession] = useState(null)
  const [questions, setQuestions] = useState([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [selectedOption, setSelectedOption] = useState(null)
  const [answered, setAnswered] = useState(false)
  const [feedbackData, setFeedbackData] = useState(null)
  const [showExplanation, setShowExplanation] = useState(false)
  const [expandedImage, setExpandedImage] = useState(null)
  const [timeLeft, setTimeLeft] = useState(null)
  const lang = user?.preferences?.language || 'es'
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const [startTime, setStartTime] = useState(null)
  const [confetti, setConfetti] = useState(false)
  const [bookmarkedQuestions, setBookmarkedQuestions] = useState(new Set())

  const timerRef = useRef(null)

  // Load exam and bookmarks
  useEffect(() => {
    // Fetch initial bookmarks
    fetch('/api/users/bookmarks').then(r => r.json()).then(data => {
      if (data.bookmarks) {
        setBookmarkedQuestions(new Set(data.bookmarks))
      }
    }).catch(console.error)

    fetch(`/api/exams/${sessionId}`)
      .then((r) => r.json())
      .then((data) => {
        setSession(data.session)
        setQuestions(data.questions)

        // If we just loaded the page and it's already completed, trigger the result screen
        if (data.session.status === 'completed') {
          setResult({
            score: data.session.score,
            errors: data.session.errorCount,
            passed: data.session.passed,
            xpEarned: 0, // Not tracked in session object directly for reloading
            newBadges: [],
          })
          setLoading(false)
          return
        }

        setCurrentIdx(data.session.currentQuestionIndex || 0)
        if (data.session.expiresAt) {
          const remaining = Math.max(0, Math.floor((new Date(data.session.expiresAt) - Date.now()) / 1000))
          setTimeLeft(remaining)
        }
        setLoading(false)
        setStartTime(Date.now())
      })
  }, [sessionId])

  // Timer
  useEffect(() => {
    if (timeLeft == null) return
    if (timeLeft <= 0) {
      handleSubmitExam()
      return
    }
    timerRef.current = setTimeout(() => setTimeLeft((t) => t - 1), 1000)
    return () => clearTimeout(timerRef.current)
  }, [timeLeft, handleSubmitExam])

  const currentQuestion = questions[currentIdx]

  // Compute answered statuses for the progress bar
  const answeredStatuses = questions.map((q, idx) => {
    // If it's the current question and answered, use feedbackData
    if (idx === currentIdx && answered && feedbackData) {
      return feedbackData.isCorrect ? 'correct' : 'incorrect'
    }
    // Otherwise, check session.answers
    const ans = session?.answers?.find(a => a.questionId === q._id)
    if (ans) {
      return ans.isCorrect ? 'correct' : 'incorrect'
    }
    return 'unanswered'
  })

  const handleSelectOption = async (optIdx) => {
    if (answered) return
    setSelectedOption(optIdx)
    setAnswered(true)

    const timeTaken = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0
    setStartTime(Date.now())

    try {
      const res = await fetch(`/api/exams/${sessionId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_id: currentQuestion._id,
          selected_option_idx: optIdx,
          time_taken: timeTaken,
        }),
      })
      const data = await res.json()
      setFeedbackData(data)

      setSession(prev => {
        if (!prev) return prev
        const answers = [...(prev.answers || [])]
        const existingIdx = answers.findIndex(a => a.questionId === currentQuestion._id)
        const newAnswer = {
          questionId: currentQuestion._id,
          selectedOptionIdx: optIdx,
          isCorrect: data.isCorrect,
          timeTakenSeconds: timeTaken
        }
        if (existingIdx >= 0) {
          answers[existingIdx] = newAnswer
        } else {
          answers.push(newAnswer)
        }
        return { ...prev, answers }
      })

      if (session?.assistanceMode === 'instant') {
        if (data.isCorrect) {
          playSound('/sounds/correct-answer.mp3')
        } else {
          playSound('/sounds/wrong-answer.mp3')
        }
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleNext = () => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx((i) => i + 1)
      setSelectedOption(null)
      setAnswered(false)
      setFeedbackData(null)
      setShowExplanation(false)
    } else {
      handleSubmitExam()
    }
  }

  const toggleBookmark = async (questionId) => {
    try {
      const res = await fetch('/api/users/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId })
      })
      const data = await res.json()
      if (data.success) {
        const newSet = new Set(bookmarkedQuestions)
        if (data.isBookmarked) {
          newSet.add(questionId)
        } else {
          newSet.delete(questionId)
        }
        setBookmarkedQuestions(newSet)
      }
    } catch (error) {
      console.error('Error toggling bookmark:', error)
    }
  }

  const handleSubmitExam = useCallback(async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/exams/${sessionId}/submit`, { method: 'POST' })
      const data = await res.json()
      if (data.result) {
        setResult(data.result)
        if (data.result.passed) {
          setConfetti(true)
          playSound('/sounds/sucess-exam.mp3')
        } else {
          playSound('/sounds/fail-exam.mp3')
        }
      }
    } catch (e) {
      console.error(e)
    }
    setSubmitting(false)
  }, [sessionId, submitting])

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="text-4xl animate-bounce mb-4">📝</div>
          <p className="text-ink-light">{t('Preparando tu examen...', 'Preparing your exam...')}</p>
        </div>
      </div>
    )
  }

  // Result screen
  if (result) {
    return (
      <div className="max-w-2xl mx-auto animate-scale-in">
        {/* Confetti effect */}
        {confetti && (
          <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
            {[...Array(30)].map((_, i) => (
              <div
                key={i}
                className="absolute w-3 h-3 rounded-sm"
                style={{
                  left: `${Math.random() * 100}%`,
                  backgroundColor: ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'][i % 5],
                  animation: `confetti-fall ${1 + Math.random() * 2}s ${Math.random() * 2}s ease-in forwards`,
                }}
              />
            ))}
          </div>
        )}

        <div className={`card text-center ${result.passed ? 'border-success' : 'border-warning border-amber-200'}`}>
          {result.passed ? (
            <>
              <div className="text-6xl mb-4">🎉</div>
              <div className="inline-block px-6 py-2 bg-success rounded-full text-white font-bold text-xl mb-4">
                {t('¡APROBADO!', 'PASSED!')}
              </div>
            </>
          ) : (
            <>
              <div className="text-6xl mb-4">💪</div>
              <div className="inline-block px-6 py-2 bg-amber-500 rounded-full text-white font-bold text-xl mb-4">
                {t('¡Casi! Inténtalo de nuevo', 'Almost! Try Again')}
              </div>
            </>
          )}

          <div className="grid grid-cols-3 gap-4 my-6">
            <div className="bg-slate-50 rounded-xl p-4">
              <div className="text-3xl font-bold text-success">{result.score}</div>
              <div className="text-xs text-ink-light">{t('Correctas', 'Correct')}</div>
            </div>
            <div className="bg-slate-50 rounded-xl p-4">
              <div className="text-3xl font-bold text-danger">{result.errors}</div>
              <div className="text-xs text-ink-light">{t('Errores', 'Errors')}</div>
            </div>
            {result.xpEarned !== undefined && (
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="text-3xl font-bold text-secondary">+{result.xpEarned}</div>
                <div className="text-xs text-ink-light">XP</div>
              </div>
            )}
          </div>

          {result.newBadges?.length > 0 && (
            <div className="mb-6 p-4 bg-amber-50 rounded-xl border border-amber-200">
              <p className="text-sm font-bold text-amber-700 mb-2">🎖️ {t('¡Nueva insignia!', 'New badge!')}</p>
              <div className="flex justify-center gap-3">
                {result.newBadges.map((id) => (
                  <span key={id} className="text-3xl">🏅</span>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => router.push(`/exam/${sessionId}/review`)}
              className="btn-secondary flex-1"
            >
              {t('Revisar respuestas', 'Review answers')}
            </button>
            <button onClick={() => router.push('/exam')} className="btn-primary flex-1">
              {t('Nuevo examen', 'New exam')} →
            </button>
          </div>
        </div>

        <div className="text-center mt-4">
          <button onClick={() => router.push('/dashboard')} className="text-ink-light hover:text-ink text-sm">
            {t('← Volver al inicio', '← Back to dashboard')}
          </button>
        </div>
      </div>
    )
  }

  if (!currentQuestion) return null

  const isInstant = session?.assistanceMode === 'instant'
  const correctIdx = feedbackData?.correctOptionIdx ?? currentQuestion.correct_option_idx

  const getLocalizedText = (obj) => {
    if (!obj) return ''
    if (typeof obj === 'string') return obj
    if (lang === 'en' && obj.en) return obj.en
    return obj.es || obj.en || ''
  }

  const questionText = getLocalizedText(currentQuestion.question)

  return (
    <div className="max-w-7xl mx-auto space-y-4 animate-fade-in">
      {/* Sticky header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => { if (confirm(t('¿Salir del examen?', 'Exit exam?'))) router.push('/exam') }}
          className="p-2 rounded-lg hover:bg-slate-100 text-ink-light"
        >
          ✕
        </button>

        {/* Progress */}
        <div className="flex-1">
          <div className="flex items-center justify-between text-sm text-ink-light mb-1">
            <span>{t('Pregunta', 'Question')} {currentIdx + 1} / {questions.length}</span>
            <span>{Math.round(((currentIdx) / questions.length) * 100)}%</span>
          </div>
          <div className="progress-bar mb-2">
            <div
              className="progress-fill"
              style={{ width: `${(currentIdx / questions.length) * 100}%` }}
            />
          </div>

          {/* Detailed Progress blocks for Instant mode */}
          {isInstant && (
            <div className="flex gap-1 overflow-x-auto pb-1 hide-scrollbar">
              {answeredStatuses.map((status, i) => {
                let bgColor = 'bg-slate-200'
                if (status === 'correct') bgColor = 'bg-success'
                if (status === 'incorrect') bgColor = 'bg-danger'

                let borderStyle = ''
                if (i === currentIdx) {
                  borderStyle = 'ring-2 ring-primary ring-offset-2 scale-110 z-10 opacity-100'
                } else if (status === 'unanswered') {
                  borderStyle = 'opacity-60'
                }

                return (
                  <div
                    key={i}
                    className={`h-1.5 flex-1 rounded-full min-w-[12px] transition-all duration-300 ${bgColor} ${borderStyle}`}
                    title={`${t('Pregunta', 'Question')} ${i + 1}`}
                  />
                )
              })}
            </div>
          )}
        </div>

        {/* Timer */}
        {timeLeft != null && (
          <div className={`px-3 py-1.5 rounded-xl font-mono font-bold text-sm ${timeLeft < 120 ? 'bg-red-100 text-danger' : 'bg-slate-100 text-ink'}`}>
            ⏱ {formatTime(timeLeft)}
          </div>
        )}
      </div>

      {/* Question card */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="flex flex-col md:flex-row md:items-stretch h-full">
          {/* Image */}
          {currentQuestion.metadata?.image_url && (
            <div className="w-full md:w-1/2 bg-slate-50 md:relative flex flex-col justify-center min-h-[12rem] cursor-zoom-in border-b md:border-b-0 md:border-r border-slate-100"
              onClick={() => setExpandedImage(currentQuestion.metadata.image_url)}>
              <img
                src={currentQuestion.metadata.image_url}
                alt="Question image"
                className="w-full max-h-64 object-contain md:absolute md:inset-0 md:h-full md:max-h-none"
              />
            </div>
          )}

          {/* Content */}
          <div className={`p-6 md:p-8 flex flex-col justify-center w-full ${currentQuestion.metadata?.image_url ? 'md:w-1/2' : ''}`}>
            <h2 className="text-xl font-semibold text-ink mb-6 leading-relaxed">{questionText}</h2>

            {/* Options */}
            <div className="space-y-3">
              {currentQuestion.options?.map((opt) => {
                const text = lang === 'en' && opt.text_en ? opt.text_en : opt.text_es
                const letter = ['A', 'B', 'C', 'D'][opt.idx]

                let cls = 'option-btn'
                if (answered) {
                  if (isInstant) {
                    if (opt.idx === correctIdx) cls += ' correct'
                    else if (opt.idx === selectedOption && opt.idx !== correctIdx) cls += ' incorrect'
                  } else {
                    if (opt.idx === selectedOption) cls += ' selected'
                  }
                }

                return (
                  <button
                    key={opt.idx}
                    onClick={() => handleSelectOption(opt.idx)}
                    className={cls}
                    disabled={answered}
                  >
                    <span className="font-bold mr-3 text-primary">{letter}.</span>
                    {text}
                    {isInstant && answered && opt.idx === correctIdx && (
                      <span className="ml-2 text-success">✓</span>
                    )}
                    {isInstant && answered && opt.idx === selectedOption && opt.idx !== correctIdx && (
                      <span className="ml-2 text-danger">✗</span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Instant explanation */}
            {isInstant && answered && feedbackData?.helpHtml && (
              <div className="mt-6">
                <button
                  onClick={() => setShowExplanation(!showExplanation)}
                  className="text-sm text-primary font-medium hover:underline"
                >
                  {showExplanation ? '▲' : '▼'} {t('Ver explicación del manual DGT', 'View DGT manual explanation')}
                </button>
                {showExplanation && (
                  <div
                    className="mt-3 p-4 bg-blue-50 rounded-xl help-html text-ink-light border border-blue-100"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(feedbackData.helpHtml) }}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {currentQuestion.topic_tag && (
            <span className="badge-pill bg-slate-100 text-ink-light">
              {getLocalizedText(currentQuestion.topic_tag)}
            </span>
          )}
          <button
            onClick={() => toggleBookmark(currentQuestion._id)}
            className={`flex items-center gap-1 text-sm font-medium transition-colors ${bookmarkedQuestions.has(currentQuestion._id) ? 'text-amber-500 hover:text-amber-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            {bookmarkedQuestions.has(currentQuestion._id) ? `⭐ ${t('Guardado', 'Saved')}` : `☆ ${t('Guardar', 'Save')}`}
          </button>
        </div>

        {answered && (
          <button onClick={handleNext} className="btn-primary animate-scale-in">
            {currentIdx < questions.length - 1
              ? t('Siguiente →', 'Next →')
              : t('Finalizar examen', 'Finish exam')}
          </button>
        )}
      </div>

      {/* Expanded image modal */}
      {expandedImage && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setExpandedImage(null)}
        >
          <img
            src={expandedImage}
            alt="Expanded"
            className="max-w-full max-h-full rounded-2xl shadow-2xl"
          />
        </div>
      )}
    </div>
  )
}

export default function ExamSessionPage() {
  return (
    <AppShell>
      <ExamInterface />
    </AppShell>
  )
}
