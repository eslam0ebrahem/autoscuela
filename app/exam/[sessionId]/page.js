'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/components/AuthContext'

import DOMPurify from 'dompurify'

function sanitizeHtml(html) {
  if (typeof window === 'undefined') return ''
  return DOMPurify.sanitize(html)
}

const audioCache = {}

const preloadAudio = (src) => {
  if (typeof window !== 'undefined' && !audioCache[src]) {
    const audio = new Audio(src)
    audio.preload = 'auto'
    audioCache[src] = audio
  }
}

if (typeof window !== 'undefined') {
  preloadAudio('/sounds/correct-answer.mp3')
  preloadAudio('/sounds/wrong-answer.mp3')
  preloadAudio('/sounds/sucess-exam.mp3')
  preloadAudio('/sounds/fail-exam.mp3')
}

function playSound(src) {
  if (typeof window !== 'undefined') {
    preloadAudio(src)
    const audio = audioCache[src]
    if (audio) {
      audio.currentTime = 0
      const playPromise = audio.play()
      if (playPromise !== undefined) {
        playPromise.catch(() => {})
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
  const [timerWarning, setTimerWarning] = useState(false)
  const lang = user?.preferences?.language || 'es'
  const soundEnabled = user?.preferences?.soundEnabled !== false
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const [startTime, setStartTime] = useState(null)
  const [confetti, setConfetti] = useState(false)
  const [bookmarkedQuestions, setBookmarkedQuestions] = useState(new Set())
  const [showShortcuts, setShowShortcuts] = useState(false)

  const timerRef = useRef(null)
  const submitLockRef = useRef(false)

  // Load exam and bookmarks
  useEffect(() => {
    fetch('/api/users/bookmarks').then(r => r.json()).then(data => {
      if (data.bookmarks) {
        setBookmarkedQuestions(new Set(data.bookmarks))
      }
    }).catch(() => {})

    fetch(`/api/exams/${sessionId}`)
      .then((r) => r.json())
      .then((data) => {
        setSession(data.session)
        setQuestions(data.questions)

        if (data.session.status === 'completed') {
          setResult({
            score: data.session.score,
            errors: data.session.errorCount,
            passed: data.session.passed,
            xpEarned: 0,
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

  const currentQuestion = questions[currentIdx]

  const answeredStatuses = questions.map((q, idx) => {
    if (idx === currentIdx && answered && feedbackData) {
      return feedbackData.isCorrect ? 'correct' : 'incorrect'
    }
    const ans = session?.answers?.find(a => a.questionId === q._id)
    if (ans) {
      return ans.isCorrect ? 'correct' : 'incorrect'
    }
    return 'unanswered'
  })

  const handleSelectOption = async (optIdx) => {
    if (answered || submitting) return
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

      if (data.expired) {
        handleSubmitExam()
        return
      }

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

      if (session?.assistanceMode === 'instant' && soundEnabled) {
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

  const handleSubmitExam = useCallback(async () => {
    if (submitLockRef.current) return
    submitLockRef.current = true
    setSubmitting(true)
    try {
      const res = await fetch(`/api/exams/${sessionId}/submit`, { method: 'POST' })
      const data = await res.json()
      if (data.result) {
        setResult(data.result)
        if (soundEnabled) {
          if (data.result.passed) {
            playSound('/sounds/sucess-exam.mp3')
          } else {
            playSound('/sounds/fail-exam.mp3')
          }
        }
        if (data.result.passed) setConfetti(true)
      }
    } catch (e) {
      console.error(e)
    }
    setSubmitting(false)
  }, [sessionId, soundEnabled])

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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (expandedImage || showShortcuts) {
        if (e.key === 'Escape') {
          setExpandedImage(null)
          setShowShortcuts(false)
        }
        return
      }

      // Don't handle if typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

      if (!answered && currentQuestion) {
        // 1,2,3,4 or A,B,C,D to select option
        const keyMap = { '1': 0, '2': 1, '3': 2, '4': 3, 'a': 0, 'b': 1, 'c': 2, 'd': 3 }
        const optIdx = keyMap[e.key.toLowerCase()]
        if (optIdx !== undefined && currentQuestion.options?.[optIdx]) {
          e.preventDefault()
          handleSelectOption(optIdx)
        }
      }

      if (answered) {
        // Enter or Space to go next
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleNext()
        }
        // E to toggle explanation
        if (e.key === 'e' || e.key === 'E') {
          setShowExplanation(prev => !prev)
        }
      }

      // S to toggle bookmark
      if (e.key === 's' || e.key === 'S') {
        if (currentQuestion) {
          e.preventDefault()
          toggleBookmark(currentQuestion._id)
        }
      }

      // ? to show shortcuts
      if (e.key === '?') {
        setShowShortcuts(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [answered, currentQuestion, expandedImage, showShortcuts])

  // Timer with warnings
  useEffect(() => {
    if (timeLeft == null) return
    if (timeLeft <= 0) {
      handleSubmitExam()
      return
    }

    // Timer warnings
    if (timeLeft === 300 && !timerWarning) {
      setTimerWarning('5min')
    } else if (timeLeft === 60 && timerWarning !== '1min') {
      setTimerWarning('1min')
    }

    timerRef.current = setTimeout(() => setTimeLeft((t) => t - 1), 1000)
    return () => clearTimeout(timerRef.current)
  }, [timeLeft, handleSubmitExam])

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="text-4xl animate-bounce mb-4" role="img" aria-label="Loading">📝</div>
          <p className="text-ink-light">{t('Preparando tu examen...', 'Preparing your exam...')}</p>
        </div>
      </div>
    )
  }

  // Result screen
  if (result) {
    const accuracy = result.total > 0 ? Math.round((result.score / result.total) * 100) : 0

    return (
      <div className="max-w-2xl mx-auto animate-scale-in">
        {confetti && (
          <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden" aria-hidden="true">
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

        <div className={`card text-center ${result.passed ? 'border-success' : 'border-amber-200'}`}>
          {result.passed ? (
            <>
              <div className="text-6xl mb-4" role="img" aria-label="Celebration">🎉</div>
              <div className="inline-block px-6 py-2 bg-success rounded-full text-white font-bold text-xl mb-4">
                {t('APROBADO!', 'PASSED!')}
              </div>
            </>
          ) : (
            <>
              <div className="text-6xl mb-4" role="img" aria-label="Keep trying">💪</div>
              <div className="inline-block px-6 py-2 bg-amber-500 rounded-full text-white font-bold text-xl mb-4">
                {t('Casi! Intentalo de nuevo', 'Almost! Try Again')}
              </div>
            </>
          )}

          <div className="grid grid-cols-4 gap-3 my-6">
            <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4">
              <div className="text-2xl font-bold text-success">{result.score}</div>
              <div className="text-xs text-ink-light">{t('Correctas', 'Correct')}</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4">
              <div className="text-2xl font-bold text-danger">{result.errors}</div>
              <div className="text-xs text-ink-light">{t('Errores', 'Errors')}</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4">
              <div className="text-2xl font-bold text-primary">{accuracy}%</div>
              <div className="text-xs text-ink-light">{t('Precision', 'Accuracy')}</div>
            </div>
            {result.xpEarned !== undefined && (
              <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4">
                <div className="text-2xl font-bold text-secondary">+{result.xpEarned}</div>
                <div className="text-xs text-ink-light">XP</div>
              </div>
            )}
          </div>

          {result.newStreak > 0 && (
            <div className="mb-4 text-center">
              <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-orange-50 dark:bg-orange-900/30 rounded-full text-orange-600 dark:text-orange-400 text-sm font-medium">
                🔥 {result.newStreak} {t('dias de racha', 'day streak')}
              </span>
            </div>
          )}

          {result.newBadges?.length > 0 && (
            <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
              <p className="text-sm font-bold text-amber-700 dark:text-amber-400 mb-2">
                🎖️ {t('Nueva insignia!', 'New badge!')}
              </p>
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
              {t('Nuevo examen', 'New exam')}
            </button>
          </div>
        </div>

        <div className="text-center mt-4">
          <button onClick={() => router.push('/dashboard')} className="text-ink-light hover:text-ink dark:hover:text-white text-sm transition-colors">
            {t('Volver al inicio', 'Back to dashboard')}
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
      {/* Timer warning banner */}
      {timerWarning && (
        <div className={`rounded-xl px-4 py-2 text-center text-sm font-medium animate-scale-in ${
          timerWarning === '1min' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
        }`} role="alert">
          {timerWarning === '1min'
            ? t('1 minuto restante!', '1 minute remaining!')
            : t('5 minutos restantes', '5 minutes remaining')
          }
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => { if (confirm(t('Salir del examen?', 'Exit exam?'))) router.push('/exam') }}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-ink-light"
          aria-label={t('Salir', 'Exit')}
        >
          ✕
        </button>

        {/* Progress */}
        <div className="flex-1">
          <div className="flex items-center justify-between text-sm text-ink-light mb-1">
            <span>{t('Pregunta', 'Question')} {currentIdx + 1} / {questions.length}</span>
            <div className="flex items-center gap-2">
              <span>{Math.round(((currentIdx) / questions.length) * 100)}%</span>
              <button
                onClick={() => setShowShortcuts(true)}
                className="kbd text-[10px]"
                title={t('Atajos de teclado', 'Keyboard shortcuts')}
              >
                ?
              </button>
            </div>
          </div>
          <div className="progress-bar mb-2">
            <div
              className="progress-fill"
              style={{ width: `${(currentIdx / questions.length) * 100}%` }}
              role="progressbar"
              aria-valuenow={currentIdx}
              aria-valuemin={0}
              aria-valuemax={questions.length}
            />
          </div>

          {isInstant && (
            <div className="flex gap-1 overflow-x-auto pb-1 hide-scrollbar" role="list" aria-label="Question progress">
              {answeredStatuses.map((status, i) => {
                let bgColor = 'bg-slate-200 dark:bg-slate-700'
                if (status === 'correct') bgColor = 'bg-success'
                if (status === 'incorrect') bgColor = 'bg-danger'

                let borderStyle = ''
                if (i === currentIdx) {
                  borderStyle = 'ring-2 ring-primary ring-offset-2 dark:ring-offset-slate-800 scale-110 z-10 opacity-100'
                } else if (status === 'unanswered') {
                  borderStyle = 'opacity-60'
                }

                return (
                  <div
                    key={i}
                    className={`h-1.5 flex-1 rounded-full min-w-[12px] transition-all duration-300 ${bgColor} ${borderStyle}`}
                    title={`${t('Pregunta', 'Question')} ${i + 1}`}
                    role="listitem"
                  />
                )
              })}
            </div>
          )}
        </div>

        {/* Timer */}
        {timeLeft != null && (
          <div className={`px-3 py-1.5 rounded-xl font-mono font-bold text-sm ${
            timeLeft < 60 ? 'bg-red-100 dark:bg-red-900/30 text-danger animate-pulse' :
            timeLeft < 120 ? 'bg-red-100 dark:bg-red-900/30 text-danger' :
            timeLeft < 300 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600' :
            'bg-slate-100 dark:bg-slate-800 text-ink dark:text-slate-300'
          }`} role="timer" aria-label={`${Math.floor(timeLeft / 60)} minutes ${timeLeft % 60} seconds remaining`}>
            ⏱ {formatTime(timeLeft)}
          </div>
        )}
      </div>

      {/* Question card */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="flex flex-col md:flex-row md:items-stretch h-full">
          {currentQuestion.metadata?.image_url && (
            <div className="w-full md:w-1/2 bg-slate-50 dark:bg-slate-900 md:relative flex flex-col justify-center min-h-[12rem] cursor-zoom-in border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-700"
              onClick={() => setExpandedImage(currentQuestion.metadata.image_url)}
              role="button"
              aria-label={t('Ampliar imagen', 'Expand image')}
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') setExpandedImage(currentQuestion.metadata.image_url) }}
            >
              <img
                src={currentQuestion.metadata.image_url}
                alt={t('Imagen de la pregunta', 'Question image')}
                className="w-full max-h-64 object-contain md:absolute md:inset-0 md:h-full md:max-h-none"
              />
            </div>
          )}

          <div className={`p-6 md:p-8 flex flex-col justify-center w-full ${currentQuestion.metadata?.image_url ? 'md:w-1/2' : ''}`}>
            <h2 className="text-xl font-semibold text-ink dark:text-white mb-6 leading-relaxed">{questionText}</h2>

            <div className="space-y-3" role="radiogroup" aria-label={t('Opciones', 'Options')}>
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
                    role="radio"
                    aria-checked={selectedOption === opt.idx}
                  >
                    <span className="inline-flex items-center gap-3">
                      <span className="font-bold text-primary">{letter}.</span>
                      <span className="flex-1">{text}</span>
                    </span>
                    {!answered && <span className="kbd ml-auto">{opt.idx + 1}</span>}
                    {isInstant && answered && opt.idx === correctIdx && (
                      <span className="ml-2 text-success font-bold">✓</span>
                    )}
                    {isInstant && answered && opt.idx === selectedOption && opt.idx !== correctIdx && (
                      <span className="ml-2 text-danger font-bold">✗</span>
                    )}
                  </button>
                )
              })}
            </div>

            {isInstant && answered && feedbackData?.helpHtml && (
              <div className="mt-6">
                <button
                  onClick={() => setShowExplanation(!showExplanation)}
                  className="text-sm text-primary font-medium hover:underline flex items-center gap-1"
                >
                  {showExplanation ? '▲' : '▼'} {t('Ver explicacion del manual DGT', 'View DGT manual explanation')}
                  <span className="kbd ml-1">E</span>
                </button>
                {showExplanation && (
                  <div
                    className="mt-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl help-html text-ink-light border border-blue-100 dark:border-blue-800"
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
            <span className="badge-pill bg-slate-100 dark:bg-slate-700 text-ink-light">
              {getLocalizedText(currentQuestion.topic_tag)}
            </span>
          )}
          <button
            onClick={() => toggleBookmark(currentQuestion._id)}
            className={`flex items-center gap-1 text-sm font-medium transition-colors ${bookmarkedQuestions.has(currentQuestion._id)
              ? 'text-amber-500 hover:text-amber-600'
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
            aria-label={bookmarkedQuestions.has(currentQuestion._id) ? t('Quitar de guardados', 'Remove bookmark') : t('Guardar pregunta', 'Bookmark question')}
          >
            {bookmarkedQuestions.has(currentQuestion._id) ? `⭐ ${t('Guardado', 'Saved')}` : `☆ ${t('Guardar', 'Save')}`}
            <span className="kbd ml-1">S</span>
          </button>
        </div>

        {answered && (
          <button onClick={handleNext} className="btn-primary animate-scale-in">
            {currentIdx < questions.length - 1
              ? t('Siguiente', 'Next')
              : submitting ? t('Enviando...', 'Submitting...') : t('Finalizar examen', 'Finish exam')}
            {!submitting && currentIdx < questions.length - 1 && <span className="kbd ml-1 bg-white/20 border-white/30 text-white">↵</span>}
          </button>
        )}
      </div>

      {/* Expanded image modal */}
      {expandedImage && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setExpandedImage(null)}
          onKeyDown={(e) => { if (e.key === 'Escape') setExpandedImage(null) }}
          role="dialog"
          aria-label={t('Imagen ampliada', 'Expanded image')}
          tabIndex={-1}
        >
          <button className="absolute top-4 right-4 text-white text-2xl hover:text-slate-300" onClick={() => setExpandedImage(null)} aria-label="Close">✕</button>
          <img
            src={expandedImage}
            alt={t('Imagen ampliada', 'Expanded image')}
            className="max-w-full max-h-full rounded-2xl shadow-2xl"
          />
        </div>
      )}

      {/* Keyboard shortcuts modal */}
      {showShortcuts && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowShortcuts(false)}
          role="dialog"
          aria-label={t('Atajos de teclado', 'Keyboard shortcuts')}
        >
          <div className="card max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-ink dark:text-white">
                {t('Atajos de teclado', 'Keyboard Shortcuts')}
              </h3>
              <button onClick={() => setShowShortcuts(false)} className="text-ink-light hover:text-ink" aria-label="Close">✕</button>
            </div>
            <div className="space-y-3 text-sm">
              {[
                { keys: '1-4 / A-D', desc: t('Seleccionar opcion', 'Select option') },
                { keys: 'Enter / Space', desc: t('Siguiente pregunta', 'Next question') },
                { keys: 'E', desc: t('Ver/ocultar explicacion', 'Toggle explanation') },
                { keys: 'S', desc: t('Guardar pregunta', 'Bookmark question') },
                { keys: 'Esc', desc: t('Cerrar dialogo', 'Close dialog') },
              ].map(({ keys, desc }) => (
                <div key={keys} className="flex items-center justify-between">
                  <span className="text-ink-light">{desc}</span>
                  <span className="kbd">{keys}</span>
                </div>
              ))}
            </div>
          </div>
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
