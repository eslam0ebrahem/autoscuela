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

// Global Audio Cache to prevent re-fetching
const audioCache = {}

const preloadAudio = (src) => {
  if (typeof window !== 'undefined' && !audioCache[src]) {
    const audio = new Audio(src)
    audio.preload = 'auto'
    audioCache[src] = audio
  }
}

// Preload specific sounds
if (typeof window !== 'undefined') {
  preloadAudio('/sounds/correct-answer.mp3')
  preloadAudio('/sounds/wrong-answer.mp3')
  preloadAudio('/sounds/sucess-exam.mp3')
  preloadAudio('/sounds/fail-exam.mp3')
}

function playSound(src) {
  if (typeof window !== 'undefined') {
    preloadAudio(src) // Ensure it exists
    const audio = audioCache[src]
    if (audio) {
      audio.currentTime = 0
      const playPromise = audio.play()
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Ignore auto-play blocking errors silently
        })
      }
    }
  }
}

function ExamInterface() {
  const { user, t } = useAuth()
  const params = useParams()
  const router = useRouter()
  const sessionId = params?.sessionId

  const [session, setSession] = useState(null)
  const [questions, setQuestions] = useState([])
  const [currentIdx, setCurrentIdx] = useState(0)
  
  // Interaction State
  const [selectedOption, setSelectedOption] = useState(null)
  const [answered, setAnswered] = useState(false)
  const [feedbackData, setFeedbackData] = useState(null)
  const [showExplanation, setShowExplanation] = useState(false)
  const [expandedImage, setExpandedImage] = useState(null)
  
  // Exam State
  const [timeLeft, setTimeLeft] = useState(null)
  const [timerWarning, setTimerWarning] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const [startTime, setStartTime] = useState(null)
  const [confetti, setConfetti] = useState(false)
  const [bookmarkedQuestions, setBookmarkedQuestions] = useState(new Set())
  const [showShortcuts, setShowShortcuts] = useState(false)

  const lang = user?.preferences?.language || 'es'
  const soundEnabled = user?.preferences?.soundEnabled !== false

  const timerRef = useRef(null)
  const submitLockRef = useRef(false)

  // 1. Fetch Session & Bookmarks
  useEffect(() => {
    if (!sessionId) return

    Promise.all([
      fetch('/api/users/bookmarks').then(r => r.ok ? r.json() : {}).catch(() => ({})),
      fetch(`/api/exams/${sessionId}`).then(r => {
        if (!r.ok) throw new Error('Failed to fetch exam session')
        return r.json()
      })
    ])
    .then(([bookmarksData, examData]) => {
      if (bookmarksData?.bookmarks) {
        setBookmarkedQuestions(new Set(bookmarksData.bookmarks))
      }

      setSession(examData.session)
      setQuestions(examData.questions || [])

      if (examData.session.status === 'completed') {
        setResult({
          score: examData.session.score,
          errors: examData.session.errorCount,
          passed: examData.session.passed,
          total: examData.questions?.length || 30,
          xpEarned: 0,
          newBadges: [],
        })
      } else {
        setCurrentIdx(examData.session.currentQuestionIndex || 0)
        setStartTime(Date.now())
      }
    })
    .catch(err => {
      console.error(err)
      alert(t('Error al cargar el examen', 'Error loading exam'))
    })
    .finally(() => {
      setLoading(false)
    })
  }, [sessionId, t])

  const currentQuestion = questions[currentIdx]

  // Compute status map for progress bar
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

  // 2. Exam Submission Logic
  const handleSubmitExam = useCallback(async () => {
    if (submitLockRef.current) return
    submitLockRef.current = true
    setSubmitting(true)

    try {
      const res = await fetch(`/api/exams/${sessionId}/submit`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to submit exam')
      
      const data = await res.json()
      if (data.result) {
        setResult(data.result)
        if (soundEnabled) {
          playSound(data.result.passed ? '/sounds/sucess-exam.mp3' : '/sounds/fail-exam.mp3')
        }
        if (data.result.passed) setConfetti(true)
      }
    } catch (e) {
      console.error(e)
      alert(t('Error al enviar el examen. Inténtalo de nuevo.', 'Error submitting exam. Please try again.'))
      submitLockRef.current = false // Unlock so they can try again
    } finally {
      setSubmitting(false)
    }
  }, [sessionId, soundEnabled, t])

  // 3. Accurate Timer logic using Interval + Date math
  useEffect(() => {
    if (!session?.expiresAt || result) return

    const endTime = new Date(session.expiresAt).getTime()

    const checkTime = () => {
      const now = Date.now()
      const remaining = Math.max(0, Math.floor((endTime - now) / 1000))
      
      setTimeLeft(remaining)

      if (remaining <= 0) {
        clearInterval(timerRef.current)
        handleSubmitExam()
      } else if (remaining === 300) {
        setTimerWarning('5min')
      } else if (remaining === 60) {
        setTimerWarning('1min')
      }
    }

    checkTime() // Run immediately
    timerRef.current = setInterval(checkTime, 1000)

    return () => clearInterval(timerRef.current)
  }, [session?.expiresAt, result, handleSubmitExam])

  // 4. Handle Option Selection
  const handleSelectOption = (optIdx) => {
    if (answered || submitting) return
    
    setSelectedOption(optIdx)
    setAnswered(true)

    const timeTaken = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0
    setStartTime(Date.now())

    // Optimistic Audio
    if (session?.assistanceMode === 'instant' && soundEnabled) {
      const localCorrect = currentQuestion.correct_option_idx
      if (localCorrect != null) {
        playSound(optIdx === localCorrect ? '/sounds/correct-answer.mp3' : '/sounds/wrong-answer.mp3')
      }
    }

    // Fire API Call
    fetch(`/api/exams/${sessionId}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question_id: currentQuestion._id,
        selected_option_idx: optIdx,
        time_taken: timeTaken,
      }),
    })
      .then(res => res.json())
      .then(data => {
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
          if (existingIdx >= 0) answers[existingIdx] = newAnswer
          else answers.push(newAnswer)
          
          return { ...prev, answers }
        })

        // Fallback Audio (If optimistic failed)
        if (session?.assistanceMode === 'instant' && soundEnabled && currentQuestion.correct_option_idx == null) {
          playSound(data.isCorrect ? '/sounds/correct-answer.mp3' : '/sounds/wrong-answer.mp3')
        }
      })
      .catch(e => {
        console.error('Failed to record answer:', e)
        // Rollback state so the user isn't stuck
        setAnswered(false)
        setSelectedOption(null)
      })
  }

  const handleNext = () => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx((i) => i + 1)
      setSelectedOption(null)
      setAnswered(false)
      setFeedbackData(null)
      setShowExplanation(false)
      setStartTime(Date.now())
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
        setBookmarkedQuestions(prev => {
          const newSet = new Set(prev)
          data.isBookmarked ? newSet.add(questionId) : newSet.delete(questionId)
          return newSet
        })
      }
    } catch (error) {
      console.error('Error toggling bookmark:', error)
    }
  }

  // 5. Keyboard Shortcuts (with safety checks)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if user is using modifier keys (prevent browser shortcut hijack)
      if (e.ctrlKey || e.metaKey || e.altKey) return
      
      // Ignore if typing in an input field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

      if (expandedImage || showShortcuts) {
        if (e.key === 'Escape') {
          setExpandedImage(null)
          setShowShortcuts(false)
        }
        return
      }

      if (!answered && currentQuestion) {
        const keyMap = { '1': 0, '2': 1, '3': 2, '4': 3, 'a': 0, 'b': 1, 'c': 2, 'd': 3 }
        const optIdx = keyMap[e.key.toLowerCase()]
        if (optIdx !== undefined && currentQuestion.options?.[optIdx]) {
          e.preventDefault()
          handleSelectOption(optIdx)
        }
      }

      if (answered) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleNext()
        }
        if (e.key === 'e' || e.key === 'E') {
          setShowExplanation(prev => !prev)
        }
      }

      if (e.key === 's' || e.key === 'S') {
        if (currentQuestion) {
          e.preventDefault()
          toggleBookmark(currentQuestion._id)
        }
      }

      if (e.key === '?') {
        setShowShortcuts(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [answered, currentQuestion, expandedImage, showShortcuts])


  const formatTime = (secs) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // ==== RENDER: LOADING ====
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

  // ==== RENDER: RESULT SCREEN ====
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
                {t('¡APROBADO!', 'PASSED!')}
              </div>
            </>
          ) : (
            <>
              <div className="text-6xl mb-4" role="img" aria-label="Keep trying">💪</div>
              <div className="inline-block px-6 py-2 bg-amber-500 rounded-full text-white font-bold text-xl mb-4">
                {t('¡Casi! Inténtalo de nuevo', 'Almost! Try Again')}
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
              <div className="text-xs text-ink-light">{t('Precisión', 'Accuracy')}</div>
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
                🔥 {result.newStreak} {t('días de racha', 'day streak')}
              </span>
            </div>
          )}

          {result.newBadges?.length > 0 && (
            <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
              <p className="text-sm font-bold text-amber-700 dark:text-amber-400 mb-2">
                🎖️ {t('¡Nueva insignia!', 'New badge!')}
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

  // Empty state fallback
  if (!currentQuestion) {
    return (
      <div className="text-center p-8">
        <p className="text-ink-light">{t('No se encontraron preguntas.', 'No questions found.')}</p>
        <button onClick={() => router.push('/exam')} className="mt-4 btn-primary">
          {t('Volver', 'Go Back')}
        </button>
      </div>
    )
  }

  // ==== RENDER: ACTIVE EXAM ====
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
          timerWarning === '1min' 
            ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' 
            : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
          }`} role="alert">
          {timerWarning === '1min'
            ? t('¡1 minuto restante!', '1 minute remaining!')
            : t('5 minutos restantes', '5 minutes remaining')
          }
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => { if (confirm(t('¿Salir del examen?', 'Exit exam?'))) router.push('/exam') }}
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

        {/* Timer UI */}
        {timeLeft != null && (
          <div className={`px-3 py-1.5 rounded-xl font-mono font-bold text-sm transition-colors ${
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
      <div className="card p-0 overflow-hidden bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex flex-col md:flex-row h-full">
          
          {/* Image Section */}
          {currentQuestion.metadata?.image_url && (
            <button 
              className="w-full md:w-1/2 bg-slate-50 dark:bg-slate-900 relative flex items-center justify-center min-h-[16rem] cursor-zoom-in border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-700 hover:opacity-95 transition-opacity"
              onClick={() => setExpandedImage(currentQuestion.metadata.image_url)}
              aria-label={t('Ampliar imagen', 'Expand image')}
            >
              <img
                src={currentQuestion.metadata.image_url}
                alt={t('Imagen de la pregunta', 'Question image')}
                className="w-full h-full max-h-64 md:max-h-full object-contain absolute inset-0 p-4"
              />
            </button>
          )}

          {/* Text/Options Section */}
          <div className={`p-6 md:p-8 flex flex-col justify-center w-full ${currentQuestion.metadata?.image_url ? 'md:w-1/2' : ''}`}>
            <h2 className="text-xl font-semibold text-ink dark:text-white mb-6 leading-relaxed">
              {questionText}
            </h2>

            <div className="space-y-3 flex flex-col">
              {currentQuestion.options?.map((opt) => {
                const text = lang === 'en' && opt.text_en ? opt.text_en : opt.text_es
                const letter = ['A', 'B', 'C', 'D'][opt.idx]

                let cls = 'option-btn flex text-left items-center w-full px-4 py-3 rounded-xl border-2 transition-all duration-200 '
                
                if (answered) {
                  if (isInstant && feedbackData) {
                    if (opt.idx === correctIdx) cls += ' border-success bg-success/10 text-success'
                    else if (opt.idx === selectedOption) cls += ' border-danger bg-danger/10 text-danger'
                    else cls += ' border-slate-200 opacity-50'
                  } else {
                    if (opt.idx === selectedOption) cls += ' border-primary bg-primary/10 text-primary'
                    else cls += ' border-slate-200 opacity-50'
                  }
                } else {
                  cls += ' border-slate-200 hover:border-primary hover:bg-slate-50 dark:border-slate-600 dark:hover:border-primary dark:hover:bg-slate-700'
                }

                return (
                  <button
                    key={opt.idx}
                    onClick={() => handleSelectOption(opt.idx)}
                    className={cls}
                    disabled={answered}
                    aria-pressed={selectedOption === opt.idx}
                  >
                    <span className="inline-flex items-center gap-3 flex-1">
                      <span className="font-bold">{letter}.</span>
                      <span>{text}</span>
                    </span>
                    {!answered && <span className="kbd ml-auto hidden sm:inline-block">{opt.idx + 1}</span>}
                    {isInstant && answered && feedbackData && opt.idx === correctIdx && (
                      <span className="ml-2 font-bold text-success text-lg">✓</span>
                    )}
                    {isInstant && answered && feedbackData && opt.idx === selectedOption && opt.idx !== correctIdx && (
                      <span className="ml-2 font-bold text-danger text-lg">✗</span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Explanation Area */}
            {isInstant && answered && feedbackData?.helpHtml && (
              <div className="mt-6 animate-fade-in">
                <button
                  onClick={() => setShowExplanation(!showExplanation)}
                  className="text-sm text-primary font-medium hover:underline flex items-center gap-1"
                >
                  {showExplanation ? '▲' : '▼'} {t('Ver explicación del manual DGT', 'View DGT manual explanation')}
                  <span className="kbd ml-1 hidden sm:inline-block">E</span>
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

      {/* Footer controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {currentQuestion.topic_tag && (
            <span className="badge-pill bg-slate-100 dark:bg-slate-700 text-ink-light truncate max-w-[150px] sm:max-w-none">
              {getLocalizedText(currentQuestion.topic_tag)}
            </span>
          )}
          <button
            onClick={() => toggleBookmark(currentQuestion._id)}
            className={`flex items-center gap-1 text-sm font-medium transition-colors ${
              bookmarkedQuestions.has(currentQuestion._id)
                ? 'text-amber-500 hover:text-amber-600'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            aria-label={bookmarkedQuestions.has(currentQuestion._id) ? t('Quitar de guardados', 'Remove bookmark') : t('Guardar pregunta', 'Bookmark question')}
          >
            {bookmarkedQuestions.has(currentQuestion._id) ? `⭐ ${t('Guardado', 'Saved')}` : `☆ ${t('Guardar', 'Save')}`}
            <span className="kbd ml-1 hidden sm:inline-block">S</span>
          </button>
        </div>

        {answered && (
          <button 
            onClick={handleNext} 
            className="btn-primary animate-scale-in px-6 py-2"
          >
            {currentIdx < questions.length - 1
              ? t('Siguiente', 'Next')
              : submitting ? t('Enviando...', 'Submitting...') : t('Finalizar examen', 'Finish exam')}
            {!submitting && currentIdx < questions.length - 1 && <span className="kbd ml-2 bg-white/20 border-white/30 text-white hidden sm:inline-block">↵</span>}
          </button>
        )}
      </div>

      {/* Modals */}
      {expandedImage && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
          onClick={() => setExpandedImage(null)}
          onKeyDown={(e) => { if (e.key === 'Escape') setExpandedImage(null) }}
          role="dialog"
          aria-label={t('Imagen ampliada', 'Expanded image')}
          tabIndex={-1}
        >
          <button className="absolute top-4 right-4 text-white/70 hover:text-white text-3xl" onClick={() => setExpandedImage(null)} aria-label="Close">✕</button>
          <img
            src={expandedImage}
            alt={t('Imagen ampliada', 'Expanded image')}
            className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl object-contain animate-scale-in"
          />
        </div>
      )}

      {showShortcuts && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
          onClick={() => setShowShortcuts(false)}
          role="dialog"
          aria-label={t('Atajos de teclado', 'Keyboard shortcuts')}
        >
          <div className="card max-w-sm w-full animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-ink dark:text-white">
                {t('Atajos de teclado', 'Keyboard Shortcuts')}
              </h3>
              <button onClick={() => setShowShortcuts(false)} className="text-ink-light hover:text-ink" aria-label="Close">✕</button>
            </div>
            <div className="space-y-3 text-sm">
              {[
                { keys: '1-4 / A-D', desc: t('Seleccionar opción', 'Select option') },
                { keys: 'Enter / Space', desc: t('Siguiente pregunta', 'Next question') },
                { keys: 'E', desc: t('Ver/ocultar explicación', 'Toggle explanation') },
                { keys: 'S', desc: t('Guardar pregunta', 'Bookmark question') },
                { keys: 'Esc', desc: t('Cerrar diálogo', 'Close dialog') },
              ].map(({ keys, desc }) => (
                <div key={keys} className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-2 last:border-0 last:pb-0">
                  <span className="text-ink-light">{desc}</span>
                  <span className="kbd bg-slate-100 dark:bg-slate-800">{keys}</span>
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