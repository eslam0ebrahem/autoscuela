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

// ── Audio ─────────────────────────────────────────────────
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
  if (typeof window === 'undefined') return
  preloadAudio(src)
  const audio = audioCache[src]
  if (audio) {
    audio.currentTime = 0
    audio.play().catch(() => {})
  }
}

// ── Option button ─────────────────────────────────────────
function OptionButton({ opt, idx, answered, selected, correct, isInstant, feedbackData, lang, onSelect }) {
  const text  = lang === 'en' && opt.text_en ? opt.text_en : opt.text_es
  const letter = ['A', 'B', 'C', 'D'][idx]

  // Derive visual state
  let state = 'idle'
  if (answered) {
    if (isInstant && feedbackData) {
      if (idx === correct)   state = 'correct'
      else if (idx === selected) state = 'wrong'
      else state = 'dimmed'
    } else {
      if (idx === selected)  state = 'selected'
      else state = 'dimmed'
    }
  }

  const stateClasses = {
    idle:     'border-base-300 bg-base-100 hover:border-primary hover:bg-primary/5 active:scale-[0.98]',
    correct:  'border-success bg-success/10 text-success shadow-sm shadow-success/20',
    wrong:    'border-error   bg-error/10   text-error   shadow-sm shadow-error/20',
    selected: 'border-primary bg-primary/10 text-primary shadow-sm shadow-primary/20',
    dimmed:   'border-base-200 bg-base-50 opacity-45',
  }

  const letterClasses = {
    idle:     'bg-base-200 text-base-content/60',
    correct:  'bg-success text-white',
    wrong:    'bg-error   text-white',
    selected: 'bg-primary text-white',
    dimmed:   'bg-base-200 text-base-content/30',
  }

  return (
    <button
      onClick={() => onSelect(idx)}
      disabled={answered}
      aria-pressed={selected === idx}
      className={`w-full flex items-center gap-3 px-4 py-4 rounded-2xl border-2
        text-left transition-all duration-200 cursor-pointer disabled:cursor-default
        ${stateClasses[state]}`}
    >
      {/* Letter badge */}
      <span className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center
        text-sm font-black transition-colors ${letterClasses[state]}`}>
        {letter}
      </span>

      {/* Answer text */}
      <span className="flex-1 text-sm sm:text-base font-medium leading-snug text-base-content">
        {text}
      </span>

      {/* Right side — kbd hint or feedback icon */}
      {!answered && (
        <kbd className="hidden sm:inline-flex items-center justify-center shrink-0
          w-6 h-6 rounded-lg bg-base-200 text-base-content/40 text-xs font-bold">
          {idx + 1}
        </kbd>
      )}
      {isInstant && answered && feedbackData && idx === correct && (
        <span className="shrink-0 w-7 h-7 rounded-full bg-success flex items-center justify-center
          text-white text-sm font-black">✓</span>
      )}
      {isInstant && answered && feedbackData && idx === selected && idx !== correct && (
        <span className="shrink-0 w-7 h-7 rounded-full bg-error flex items-center justify-center
          text-white text-sm font-black">✗</span>
      )}
    </button>
  )
}

// ── Main component ────────────────────────────────────────
function ExamInterface() {
  const { user, t } = useAuth()
  const params = useParams()
  const router = useRouter()
  const sessionId = params?.sessionId

  const [session, setSession]     = useState(null)
  const [questions, setQuestions] = useState([])
  const [currentIdx, setCurrentIdx] = useState(0)

  const [selectedOption, setSelectedOption] = useState(null)
  const [answered, setAnswered]   = useState(false)
  const [feedbackData, setFeedbackData] = useState(null)
  const [showExplanation, setShowExplanation] = useState(false)
  const [expandedImage, setExpandedImage] = useState(null)

  const [timeLeft, setTimeLeft]   = useState(null)
  const [timerWarning, setTimerWarning] = useState(false)
  const [loading, setLoading]     = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult]       = useState(null)
  const [startTime, setStartTime] = useState(null)
  const [confetti, setConfetti]   = useState(false)
  const [bookmarkedQuestions, setBookmarkedQuestions] = useState(new Set())
  const [showShortcuts, setShowShortcuts] = useState(false)

  const lang = user?.preferences?.language || 'es'
  const soundEnabled = user?.preferences?.soundEnabled !== false
  const timerRef   = useRef(null)
  const submitLockRef = useRef(false)

  // ── Fetch session ──
  useEffect(() => {
    if (!sessionId) return
    Promise.all([
      fetch('/api/users/bookmarks').then(r => r.ok ? r.json() : {}).catch(() => ({})),
      fetch(`/api/exams/${sessionId}`).then(r => {
        if (!r.ok) throw new Error('Failed to fetch exam session')
        return r.json()
      }),
    ])
    .then(([bookmarksData, examData]) => {
      if (bookmarksData?.bookmarks) setBookmarkedQuestions(new Set(bookmarksData.bookmarks))
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
    .finally(() => setLoading(false))
  }, [sessionId, t])

  const currentQuestion = questions[currentIdx]

  const answeredStatuses = questions.map((q, idx) => {
    if (idx === currentIdx && answered && feedbackData)
      return feedbackData.isCorrect ? 'correct' : 'incorrect'
    const ans = session?.answers?.find(a => a.questionId === q._id)
    if (ans) return ans.isCorrect ? 'correct' : 'incorrect'
    return 'unanswered'
  })

  // ── Submit exam ──
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
        if (soundEnabled) playSound(data.result.passed ? '/sounds/sucess-exam.mp3' : '/sounds/fail-exam.mp3')
        if (data.result.passed) setConfetti(true)
      }
    } catch (e) {
      console.error(e)
      alert(t('Error al enviar el examen. Inténtalo de nuevo.', 'Error submitting exam. Please try again.'))
      submitLockRef.current = false
    } finally {
      setSubmitting(false)
    }
  }, [sessionId, soundEnabled, t])

  // ── Timer ──
  useEffect(() => {
    if (!session?.expiresAt || result) return
    const endTime = new Date(session.expiresAt).getTime()
    const checkTime = () => {
      const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000))
      setTimeLeft(remaining)
      if (remaining <= 0) { clearInterval(timerRef.current); handleSubmitExam() }
      else if (remaining === 300) setTimerWarning('5min')
      else if (remaining === 60)  setTimerWarning('1min')
    }
    checkTime()
    timerRef.current = setInterval(checkTime, 1000)
    return () => clearInterval(timerRef.current)
  }, [session?.expiresAt, result, handleSubmitExam])

  // ── Select option ──
  const handleSelectOption = (optIdx) => {
    if (answered || submitting) return
    setSelectedOption(optIdx)
    setAnswered(true)
    const timeTaken = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0
    setStartTime(Date.now())

    if (session?.assistanceMode === 'instant' && soundEnabled) {
      const localCorrect = currentQuestion.correct_option_idx
      if (localCorrect != null)
        playSound(optIdx === localCorrect ? '/sounds/correct-answer.mp3' : '/sounds/wrong-answer.mp3')
    }

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
      if (data.expired) { handleSubmitExam(); return }
      setFeedbackData(data)
      setSession(prev => {
        if (!prev) return prev
        const answers = [...(prev.answers || [])]
        const existingIdx = answers.findIndex(a => a.questionId === currentQuestion._id)
        const newAnswer = { questionId: currentQuestion._id, selectedOptionIdx: optIdx, isCorrect: data.isCorrect, timeTakenSeconds: timeTaken }
        if (existingIdx >= 0) answers[existingIdx] = newAnswer
        else answers.push(newAnswer)
        return { ...prev, answers }
      })
      if (session?.assistanceMode === 'instant' && soundEnabled && currentQuestion.correct_option_idx == null)
        playSound(data.isCorrect ? '/sounds/correct-answer.mp3' : '/sounds/wrong-answer.mp3')
    })
    .catch(e => {
      console.error('Failed to record answer:', e)
      setAnswered(false)
      setSelectedOption(null)
    })
  }

  const handleNext = () => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(i => i + 1)
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
        body: JSON.stringify({ questionId }),
      })
      const data = await res.json()
      if (data.success) {
        setBookmarkedQuestions(prev => {
          const s = new Set(prev)
          data.isBookmarked ? s.add(questionId) : s.delete(questionId)
          return s
        })
      }
    } catch (err) { console.error('Error toggling bookmark:', err) }
  }

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (expandedImage || showShortcuts) {
        if (e.key === 'Escape') { setExpandedImage(null); setShowShortcuts(false) }
        return
      }
      if (!answered && currentQuestion) {
        const keyMap = { '1': 0, '2': 1, '3': 2, '4': 3, 'a': 0, 'b': 1, 'c': 2, 'd': 3 }
        const optIdx = keyMap[e.key.toLowerCase()]
        if (optIdx !== undefined && currentQuestion.options?.[optIdx]) {
          e.preventDefault(); handleSelectOption(optIdx)
        }
      }
      if (answered) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleNext() }
        if (e.key === 'e' || e.key === 'E') setShowExplanation(p => !p)
      }
      if ((e.key === 's' || e.key === 'S') && currentQuestion) {
        e.preventDefault(); toggleBookmark(currentQuestion._id)
      }
      if (e.key === '?') setShowShortcuts(true)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [answered, currentQuestion, expandedImage, showShortcuts])

  const formatTime = (secs) => `${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, '0')}`

  const getLocalizedText = (obj) => {
    if (!obj) return ''
    if (typeof obj === 'string') return obj
    if (lang === 'en' && obj.en) return obj.en
    return obj.es || obj.en || ''
  }

  // ════════════════════════════════════════
  // RENDER: LOADING
  // ════════════════════════════════════════
  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <p className="text-sm text-base-content/50 animate-pulse">
          {t('Preparando tu examen...', 'Preparing your exam...')}
        </p>
      </div>
    )
  }

  // ════════════════════════════════════════
  // RENDER: RESULT SCREEN
  // ════════════════════════════════════════
  if (result) {
    const accuracy = result.total > 0 ? Math.round((result.score / result.total) * 100) : 0

    return (
      <div className="max-w-lg mx-auto px-4 pt-6 pb-24 space-y-4">
        {/* Confetti */}
        {confetti && (
          <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden" aria-hidden="true">
            {[...Array(30)].map((_, i) => (
              <div key={i} className="absolute w-3 h-3 rounded-sm"
                style={{
                  left: `${Math.random() * 100}%`,
                  backgroundColor: ['#2563EB','#10B981','#F59E0B','#EF4444','#8B5CF6'][i % 5],
                  animation: `confetti-fall ${1 + Math.random() * 2}s ${Math.random() * 2}s ease-in forwards`,
                }}
              />
            ))}
          </div>
        )}

        {/* Result card */}
        <div className={`rounded-3xl border-2 overflow-hidden
          ${result.passed ? 'border-success/30' : 'border-warning/30'} bg-base-100 shadow-lg`}>

          {/* Top colour strip */}
          <div className={`h-1.5 w-full ${result.passed ? 'bg-success' : 'bg-warning'}`} />

          <div className="p-6 text-center space-y-4">
            <div className="text-5xl">{result.passed ? '🎉' : '💪'}</div>

            <div className={`inline-flex items-center gap-2 px-5 py-2 rounded-full text-white font-black text-lg
              ${result.passed ? 'bg-success' : 'bg-warning'}`}>
              {result.passed ? t('¡APROBADO!', 'PASSED!') : t('¡Casi! Inténtalo de nuevo', 'Almost! Try again')}
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-4 gap-2 mt-4">
              {[
                { val: result.score,  label: t('Correctas', 'Correct'), color: 'text-success' },
                { val: result.errors, label: t('Errores', 'Errors'),    color: 'text-error'   },
                { val: `${accuracy}%`, label: t('Precisión','Accuracy'), color: 'text-primary' },
                { val: `+${result.xpEarned ?? 0}`, label: 'XP',         color: 'text-warning' },
              ].map((s, i) => (
                <div key={i} className="rounded-2xl bg-base-200 p-3 text-center">
                  <div className={`text-xl font-black ${s.color}`}>{s.val}</div>
                  <div className="text-[10px] font-semibold text-base-content/50 mt-0.5 uppercase tracking-wide">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Streak */}
            {result.newStreak > 0 && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full
                bg-orange-100 dark:bg-orange-900/30 text-orange-600 text-sm font-bold">
                🔥 {result.newStreak} {t('días de racha', 'day streak')}
              </div>
            )}

            {/* New badges */}
            {result.newBadges?.length > 0 && (
              <div className="p-4 rounded-2xl bg-warning/10 border border-warning/20">
                <p className="text-sm font-bold text-warning mb-2">
                  🎖️ {t('¡Nueva insignia!', 'New badge!')}
                </p>
                <div className="flex justify-center gap-3">
                  {result.newBadges.map((id) => (
                    <span key={id} className="text-3xl">🏅</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="px-5 pb-6 flex flex-col gap-2.5">
            <button
              onClick={() => router.push(`/exam/${sessionId}/review`)}
              className="btn btn-outline w-full h-12 rounded-2xl font-bold"
            >
              🔍 {t('Revisar respuestas', 'Review answers')}
            </button>
            <button
              onClick={() => router.push('/exam')}
              className="btn btn-primary w-full h-12 rounded-2xl font-bold"
            >
              📝 {t('Nuevo examen', 'New exam')}
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="text-sm text-base-content/40 hover:text-base-content/70 transition-colors py-1"
            >
              {t('Volver al inicio', 'Back to dashboard')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════
  // RENDER: EMPTY STATE
  // ════════════════════════════════════════
  if (!currentQuestion) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center px-4">
        <p className="text-base-content/50">
          {t('No se encontraron preguntas.', 'No questions found.')}
        </p>
        <button onClick={() => router.push('/exam')} className="btn btn-primary rounded-xl">
          {t('Volver', 'Go Back')}
        </button>
      </div>
    )
  }

  // ════════════════════════════════════════
  // RENDER: ACTIVE EXAM
  // ════════════════════════════════════════
  const isInstant  = session?.assistanceMode === 'instant'
  const correctIdx = feedbackData?.correctOptionIdx ?? currentQuestion.correct_option_idx
  const questionText = getLocalizedText(currentQuestion.question)
  const isBookmarked = bookmarkedQuestions.has(currentQuestion._id)

  return (
    <div className="max-w-2xl mx-auto px-4 pt-4 pb-28 space-y-3">

      {/* ── Timer warning banner ── */}
      {timerWarning && (
        <div className={`rounded-2xl px-4 py-2.5 text-center text-sm font-bold
          ${timerWarning === '1min'
            ? 'bg-error/10 border border-error/20 text-error'
            : 'bg-warning/10 border border-warning/20 text-warning'}`}
          role="alert">
          {timerWarning === '1min'
            ? `⏰ ${t('¡1 minuto restante!', '1 minute remaining!')}`
            : `⚠️ ${t('5 minutos restantes', '5 minutes remaining')}`}
        </div>
      )}

      {/* ── Header: Exit + Progress + Timer ── */}
      <div className="flex items-center gap-3">
        {/* Exit */}
        <button
          onClick={() => { if (confirm(t('¿Salir del examen? Perderás el progreso.', 'Exit exam? You will lose progress.'))) router.push('/exam') }}
          className="shrink-0 w-9 h-9 rounded-xl bg-base-200 hover:bg-base-300
            flex items-center justify-center text-base-content/50 hover:text-base-content
            transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label={t('Salir', 'Exit')}
        >
          ✕
        </button>

        {/* Progress bar + label */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-semibold text-base-content/50">
            <span>
              {t('Pregunta', 'Question')} <span className="text-base-content font-black">{currentIdx + 1}</span>
              {' '}/{' '}{questions.length}
            </span>
            <span>{Math.round((currentIdx / questions.length) * 100)}%</span>
          </div>

          {/* Main progress bar */}
          <div className="h-2 rounded-full bg-base-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${(currentIdx / questions.length) * 100}%` }}
              role="progressbar"
              aria-valuenow={currentIdx}
              aria-valuemin={0}
              aria-valuemax={questions.length}
            />
          </div>

          {/* Instant-mode per-question dots */}
          {isInstant && (
            <div className="flex gap-0.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
              {answeredStatuses.map((status, i) => (
                <div
                  key={i}
                  className={`flex-1 min-w-[8px] h-1.5 rounded-full transition-all duration-300
                    ${status === 'correct'   ? 'bg-success' :
                      status === 'incorrect' ? 'bg-error'   :
                      i === currentIdx       ? 'bg-primary' : 'bg-base-200'}`}
                  title={`${t('Pregunta', 'Question')} ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Timer */}
        {timeLeft != null && (
          <div className={`shrink-0 px-3 py-1.5 rounded-xl font-mono font-black text-sm
            transition-colors
            ${timeLeft < 60  ? 'bg-error/15  text-error  animate-pulse' :
              timeLeft < 300 ? 'bg-warning/15 text-warning' :
                               'bg-base-200   text-base-content/70'}`}
            role="timer"
            aria-label={`${Math.floor(timeLeft / 60)} minutes ${timeLeft % 60} seconds remaining`}
          >
            ⏱ {formatTime(timeLeft)}
          </div>
        )}
      </div>

      {/* ── Question Card ── */}
      <div className="rounded-2xl border border-base-200 bg-base-100 shadow-sm overflow-hidden">

        {/* Optional image */}
        {currentQuestion.metadata?.image_url && (
          <button
            className="w-full bg-base-200/50 flex items-center justify-center
              min-h-48 cursor-zoom-in hover:opacity-90 transition-opacity
              border-b border-base-200 relative overflow-hidden"
            onClick={() => setExpandedImage(currentQuestion.metadata.image_url)}
            aria-label={t('Ampliar imagen', 'Expand image')}
          >
            <img
              src={currentQuestion.metadata.image_url}
              alt={t('Imagen de la pregunta', 'Question image')}
              className="max-h-56 w-full object-contain p-3"
            />
            <span className="absolute bottom-2 right-2 text-[10px] font-bold
              bg-base-100/80 text-base-content/50 px-2 py-0.5 rounded-full backdrop-blur-sm">
              🔍 {t('Ampliar', 'Zoom')}
            </span>
          </button>
        )}

        {/* Question text */}
        <div className="px-4 pt-5 pb-4">
          <p className="text-base sm:text-lg font-bold text-base-content leading-relaxed">
            {questionText}
          </p>
        </div>

        {/* Answer options */}
        <div className="px-4 pb-4 space-y-2.5">
          {currentQuestion.options?.map((opt) => (
            <OptionButton
              key={opt.idx}
              opt={opt}
              idx={opt.idx}
              answered={answered}
              selected={selectedOption}
              correct={correctIdx}
              isInstant={isInstant}
              feedbackData={feedbackData}
              lang={lang}
              onSelect={handleSelectOption}
            />
          ))}
        </div>

        {/* Explanation (instant mode) */}
        {isInstant && answered && feedbackData?.helpHtml && (
          <div className="border-t border-base-200">
            <button
              onClick={() => setShowExplanation(p => !p)}
              className="w-full flex items-center justify-between gap-2 px-4 py-3
                text-sm font-bold text-primary hover:bg-primary/5 transition-colors"
            >
              <span className="flex items-center gap-2">
                📖 {t('Explicación del manual DGT', 'DGT manual explanation')}
              </span>
              <span className="text-base-content/40 text-xs">
                {showExplanation ? '▲' : '▼'}
              </span>
            </button>

            {showExplanation && (
              <div
                className="px-4 pb-4 text-sm text-base-content/80 leading-relaxed
                  prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(feedbackData.helpHtml) }}
              />
            )}
          </div>
        )}
      </div>

      {/* ── Footer: Topic tag + Bookmark + Next button ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {currentQuestion.topic_tag && (
            <span className="px-2.5 py-1 rounded-full bg-base-200 text-base-content/60
              text-xs font-semibold truncate max-w-[130px] sm:max-w-none">
              {getLocalizedText(currentQuestion.topic_tag)}
            </span>
          )}

          <button
            onClick={() => toggleBookmark(currentQuestion._id)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold
              transition-all active:scale-95 border
              ${isBookmarked
                ? 'bg-warning/10 border-warning/25 text-warning'
                : 'bg-base-200 border-base-200 text-base-content/40 hover:text-base-content/70'}`}
            aria-label={isBookmarked ? t('Quitar guardado', 'Remove bookmark') : t('Guardar pregunta', 'Bookmark')}
          >
            {isBookmarked ? '⭐' : '☆'}
            <span className="hidden sm:inline">
              {isBookmarked ? t('Guardado', 'Saved') : t('Guardar', 'Save')}
            </span>
          </button>
        </div>

        {/* Next / Submit button — only visible after answering */}
        {answered && (
          <button
            onClick={handleNext}
            disabled={submitting}
            className="btn btn-primary rounded-2xl h-11 px-6 font-bold gap-2 shrink-0
              disabled:opacity-50 animate-in slide-in-from-right-2 duration-200"
          >
            {submitting && <span className="loading loading-spinner loading-xs" />}
            {currentIdx < questions.length - 1
              ? t('Siguiente', 'Next')
              : t('Finalizar', 'Finish')}
            <span className="hidden sm:inline text-primary-content/60 text-xs">Enter ↵</span>
          </button>
        )}
      </div>

      {/* ── Expanded image modal ── */}
      {expandedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setExpandedImage(null)}
        >
          <img
            src={expandedImage}
            alt={t('Imagen ampliada', 'Expanded image')}
            className="max-w-full max-h-full object-contain rounded-xl"
          />
          <button
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10
              flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            onClick={() => setExpandedImage(null)}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Keyboard shortcuts modal ── */}
      {showShortcuts && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center
            justify-center p-4"
          onClick={() => setShowShortcuts(false)}
        >
          <div className="bg-base-100 rounded-3xl w-full max-w-sm p-5 space-y-3"
            onClick={e => e.stopPropagation()}>
            <h3 className="font-black text-base-content text-center">
              ⌨️ {t('Atajos de teclado', 'Keyboard shortcuts')}
            </h3>
            <div className="space-y-2 text-sm">
              {[
                ['1 · 2 · 3 · 4', t('Seleccionar opción', 'Select option')],
                ['A · B · C · D', t('Seleccionar opción', 'Select option')],
                ['Enter / Espacio', t('Siguiente pregunta', 'Next question')],
                ['E',              t('Ver/ocultar explicación', 'Toggle explanation')],
                ['S',              t('Guardar/quitar pregunta', 'Bookmark question')],
                ['Esc',            t('Cerrar modales', 'Close modals')],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <kbd className="px-2 py-1 rounded-lg bg-base-200 text-xs font-mono font-bold
                    text-base-content">{key}</kbd>
                  <span className="text-base-content/60 text-right">{desc}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowShortcuts(false)}
              className="btn btn-ghost btn-sm w-full rounded-xl mt-2"
            >
              {t('Cerrar', 'Close')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ExamPage() {
  return (
    <AppShell>
      <ExamInterface />
    </AppShell>
  )
}
