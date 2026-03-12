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
      if (playPromise !== undefined) playPromise.catch(() => {})
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
  const [selectedOption, setSelectedOption] = useState(null)
  const [answered, setAnswered] = useState(false)
  const [feedbackData, setFeedbackData] = useState(null)
  const [showExplanation, setShowExplanation] = useState(false)
  const [expandedImage, setExpandedImage] = useState(null)
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
    if (idx === currentIdx && answered && feedbackData) {
      return feedbackData.isCorrect ? 'correct' : 'incorrect'
    }
    const ans = session?.answers?.find(a => a.questionId === q._id)
    if (ans) return ans.isCorrect ? 'correct' : 'incorrect'
    return 'unanswered'
  })

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

  useEffect(() => {
    if (!session?.expiresAt || result) return
    const endTime = new Date(session.expiresAt).getTime()
    const checkTime = () => {
      const now = Date.now()
      const remaining = Math.max(0, Math.floor((endTime - now) / 1000))
      setTimeLeft(remaining)
      if (remaining <= 0) { clearInterval(timerRef.current); handleSubmitExam() }
      else if (remaining === 300) setTimerWarning('5min')
      else if (remaining === 60) setTimerWarning('1min')
    }
    checkTime()
    timerRef.current = setInterval(checkTime, 1000)
    return () => clearInterval(timerRef.current)
  }, [session?.expiresAt, result, handleSubmitExam])

  const handleSelectOption = (optIdx) => {
    if (answered || submitting) return
    setSelectedOption(optIdx)
    setAnswered(true)
    const timeTaken = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0
    setStartTime(Date.now())
    if (session?.assistanceMode === 'instant' && soundEnabled) {
      const localCorrect = currentQuestion.correct_option_idx
      if (localCorrect != null) playSound(optIdx === localCorrect ? '/sounds/correct-answer.mp3' : '/sounds/wrong-answer.mp3')
    }
    fetch(`/api/exams/${sessionId}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question_id: currentQuestion._id, selected_option_idx: optIdx, time_taken: timeTaken }),
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
        if (session?.assistanceMode === 'instant' && soundEnabled && currentQuestion.correct_option_idx == null) {
          playSound(data.isCorrect ? '/sounds/correct-answer.mp3' : '/sounds/wrong-answer.mp3')
        }
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
          const newSet = new Set(prev)
          data.isBookmarked ? newSet.add(questionId) : newSet.delete(questionId)
          return newSet
        })
      }
    } catch (error) {
      console.error('Error toggling bookmark:', error)
    }
  }

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
          e.preventDefault()
          handleSelectOption(optIdx)
        }
      }
      if (answered) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleNext() }
        if (e.key === 'e' || e.key === 'E') setShowExplanation(prev => !prev)
      }
      if (e.key === 's' || e.key === 'S') {
        if (currentQuestion) { e.preventDefault(); toggleBookmark(currentQuestion._id) }
      }
      if (e.key === '?') setShowShortcuts(true)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [answered, currentQuestion, expandedImage, showShortcuts])

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // ── LOADING ──────────────────────────────────────────────
  if (loading) {
    return (
      <AppShell>
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-base-100 px-4">
          <div className="w-14 h-14 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-base-content/60 text-sm font-medium animate-pulse">
            {t('Preparando tu examen...', 'Preparing your exam...')}
          </p>
        </div>
      </AppShell>
    )
  }

  // ── NO QUESTIONS ─────────────────────────────────────────
  if (!questions.length) {
    return (
      <AppShell>
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="text-center">
            <div className="text-5xl mb-4">📭</div>
            <p className="text-base-content/60">{t('No se encontraron preguntas.', 'No questions found.')}</p>
            <button onClick={() => router.back()} className="btn btn-primary mt-6">
              {t('Volver', 'Go Back')}
            </button>
          </div>
        </div>
      </AppShell>
    )
  }

  // ── RESULT SCREEN ─────────────────────────────────────────
  if (result) {
    const passedColor = result.passed ? 'text-success' : 'text-error'
    const passedBg = result.passed ? 'from-success/10 to-success/5 border-success/30' : 'from-error/10 to-error/5 border-error/30'
    return (
      <AppShell>
        {confetti && (
          <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
            {[...Array(30)].map((_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 rounded-sm animate-bounce opacity-80"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 60}%`,
                  backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][i % 5],
                  animationDelay: `${Math.random() * 2}s`,
                  animationDuration: `${1 + Math.random()}s`,
                }}
              />
            ))}
          </div>
        )}

        <div className="min-h-screen bg-base-100 flex flex-col items-center justify-center px-4 py-10">
          <div className="w-full max-w-md space-y-5">

            {/* Score Card */}
            <div className={`rounded-2xl border bg-gradient-to-br ${passedBg} p-6 text-center shadow-sm`}>
              <div className="text-6xl mb-3">{result.passed ? '🏆' : '📚'}</div>
              <div className={`text-5xl font-black ${passedColor}`}>{result.score ?? '--'}%</div>
              <p className={`text-lg font-bold mt-1 ${passedColor}`}>
                {result.passed
                  ? t('¡Aprobado!', 'Passed!')
                  : t('Suspendido', 'Failed')}
              </p>
              <p className="text-base-content/50 text-sm mt-1">
                {t(`${result.errors ?? 0} errores de ${result.total ?? 30}`, `${result.errors ?? 0} errors out of ${result.total ?? 30}`)}
              </p>
            </div>

            {/* XP & Badges */}
            {(result.xpEarned > 0 || result.newBadges?.length > 0) && (
              <div className="bg-base-200 rounded-2xl p-4 space-y-3">
                {result.xpEarned > 0 && (
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">⚡</span>
                    <div>
                      <p className="font-bold text-sm">{t('XP Ganado', 'XP Earned')}</p>
                      <p className="text-warning font-black text-lg">+{result.xpEarned} XP</p>
                    </div>
                  </div>
                )}
                {result.newBadges?.map((badge, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-base-100 rounded-xl border border-warning/30">
                    <span className="text-2xl">🎖️</span>
                    <div>
                      <p className="text-xs text-base-content/50">{t('¡Nueva insignia!', 'New badge!')}</p>
                      <p className="font-bold text-sm">{badge.name || badge}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => router.push(`/exams/${sessionId}/review`)}
                className="btn btn-outline btn-sm h-12 rounded-xl text-sm"
              >
                {t('Revisar', 'Review')}
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="btn btn-primary btn-sm h-12 rounded-xl text-sm"
              >
                {t('Inicio', 'Home')}
              </button>
            </div>
          </div>
        </div>
      </AppShell>
    )
  }

  // ── EXAM INTERFACE ─────────────────────────────────────────
  const isWarning = timerWarning === '1min' || (timeLeft !== null && timeLeft <= 60)
  const isAlertWarning = timerWarning === '5min' || (timeLeft !== null && timeLeft <= 300 && timeLeft > 60)
  const isBookmarked = bookmarkedQuestions.has(currentQuestion?._id)
  const questionText = typeof currentQuestion?.question === 'string'
    ? currentQuestion.question
    : (lang === 'en' ? currentQuestion?.question?.en : currentQuestion?.question?.es) || ''

  const optionLabels = ['A', 'B', 'C', 'D']

  return (
    <AppShell>
      <div className="min-h-screen bg-base-100 flex flex-col">

        {/* ── Sticky Header ── */}
        <div className="sticky top-0 z-30 bg-base-100/95 backdrop-blur border-b border-base-200 shadow-sm">
          <div className="max-w-2xl mx-auto px-4 py-2.5 flex items-center gap-3">

            {/* Question counter */}
            <span className="text-xs font-bold text-base-content/50 shrink-0">
              {currentIdx + 1}/{questions.length}
            </span>

            {/* Progress dots – scrollable row on mobile */}
            <div className="flex gap-1 overflow-x-auto scrollbar-hide flex-1 py-1">
              {answeredStatuses.map((status, i) => (
                <div
                  key={i}
                  onClick={() => {
                    if (answered || status !== 'unanswered') {
                      setCurrentIdx(i)
                      setSelectedOption(null)
                      setAnswered(false)
                      setFeedbackData(null)
                      setShowExplanation(false)
                    }
                  }}
                  className={`shrink-0 rounded-full transition-all cursor-pointer
                    ${i === currentIdx ? 'w-5 h-2.5' : 'w-2.5 h-2.5'}
                    ${status === 'correct' ? 'bg-success' :
                      status === 'incorrect' ? 'bg-error' :
                      i === currentIdx ? 'bg-primary' : 'bg-base-300'}`}
                />
              ))}
            </div>

            {/* Timer */}
            {timeLeft !== null && (
              <div className={`shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold border
                ${isWarning
                  ? 'bg-error/10 border-error/40 text-error animate-pulse'
                  : isAlertWarning
                    ? 'bg-warning/10 border-warning/40 text-warning'
                    : 'bg-base-200 border-base-300 text-base-content/70'}`}>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                </svg>
                {formatTime(timeLeft)}
              </div>
            )}

            {/* Bookmark */}
            <button
              onClick={() => toggleBookmark(currentQuestion?._id)}
              className={`shrink-0 w-8 h-8 flex items-center justify-center rounded-full transition-colors
                ${isBookmarked ? 'text-warning bg-warning/10' : 'text-base-content/30 hover:text-warning hover:bg-warning/10'}`}
              aria-label="Bookmark"
            >
              {isBookmarked ? '★' : '☆'}
            </button>
          </div>
        </div>

        {/* ── Main Content ── */}
        <div className="flex-1 max-w-2xl mx-auto w-full px-4 pt-5 pb-28 space-y-4">

          {/* Question image */}
          {currentQuestion?.image_url && (
            <div
              className="rounded-2xl overflow-hidden border border-base-200 cursor-zoom-in shadow-sm"
              onClick={() => setExpandedImage(currentQuestion.image_url)}
            >
              <img
                src={currentQuestion.image_url}
                alt="question"
                className="w-full object-cover max-h-52"
              />
            </div>
          )}

          {/* Question text */}
          <div className="bg-base-200/50 rounded-2xl p-4 border border-base-200">
            <p
              className="text-base sm:text-lg font-semibold text-base-content leading-snug"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(questionText) }}
            />
          </div>

          {/* Options */}
          <div className="space-y-2.5">
            {currentQuestion?.options?.map((opt, optIdx) => {
              const optText = typeof opt === 'string' ? opt : (lang === 'en' ? opt.en : opt.es) || ''
              const isSelected = selectedOption === optIdx
              const isCorrectOption = feedbackData?.correctOptionIdx === optIdx || feedbackData?.correct_option_idx === optIdx
              const isWrong = answered && isSelected && !feedbackData?.isCorrect

              let optStyle = 'bg-base-100 border-base-200 text-base-content hover:border-primary hover:bg-primary/5'
              if (answered) {
                if (isCorrectOption) optStyle = 'bg-success/10 border-success text-success-content'
                else if (isWrong) optStyle = 'bg-error/10 border-error text-error-content'
                else optStyle = 'bg-base-100 border-base-200 text-base-content/40'
              } else if (isSelected) {
                optStyle = 'bg-primary/10 border-primary text-primary'
              }

              return (
                <button
                  key={optIdx}
                  onClick={() => handleSelectOption(optIdx)}
                  disabled={answered || submitting}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 transition-all text-left
                    min-h-[56px] active:scale-[0.98] ${optStyle}
                    ${!answered ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <span className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2
                    ${answered && isCorrectOption ? 'border-success bg-success text-white' :
                      answered && isWrong ? 'border-error bg-error text-white' :
                      isSelected ? 'border-primary bg-primary text-white' :
                      'border-base-300 bg-base-200 text-base-content/60'}`}>
                    {optionLabels[optIdx]}
                  </span>
                  <span
                    className="text-sm sm:text-base leading-snug"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(optText) }}
                  />
                  {answered && isCorrectOption && (
                    <span className="ml-auto text-success text-lg">✓</span>
                  )}
                  {answered && isWrong && (
                    <span className="ml-auto text-error text-lg">✗</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Feedback / Explanation */}
          {answered && feedbackData && session?.assistanceMode === 'instant' && (
            <div className={`rounded-2xl border-2 overflow-hidden transition-all
              ${feedbackData.isCorrect ? 'border-success/40 bg-success/5' : 'border-error/40 bg-error/5'}`}>
              <div className={`px-4 py-3 flex items-center gap-2 font-bold text-sm
                ${feedbackData.isCorrect ? 'text-success' : 'text-error'}`}>
                <span className="text-lg">{feedbackData.isCorrect ? '✅' : '❌'}</span>
                {feedbackData.isCorrect
                  ? t('¡Correcto!', 'Correct!')
                  : t('Respuesta incorrecta', 'Incorrect answer')}
                {feedbackData.explanation && (
                  <button
                    onClick={() => setShowExplanation(p => !p)}
                    className="ml-auto text-xs font-normal underline opacity-70"
                  >
                    {showExplanation ? t('Ocultar', 'Hide') : t('Ver explicación', 'Explanation')}
                  </button>
                )}
              </div>
              {showExplanation && feedbackData.explanation && (
                <div
                  className="px-4 pb-4 text-sm text-base-content/80 leading-relaxed border-t border-base-200"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(
                    typeof feedbackData.explanation === 'string'
                      ? feedbackData.explanation
                      : (lang === 'en' ? feedbackData.explanation?.en : feedbackData.explanation?.es) || ''
                  )}}
                />
              )}
            </div>
          )}
        </div>

        {/* ── Sticky Bottom CTA ── */}
        {answered && (
          <div className="fixed bottom-0 left-0 right-0 z-20 bg-base-100/95 backdrop-blur border-t border-base-200 p-4 safe-area-pb">
            <div className="max-w-2xl mx-auto flex gap-3">
              {feedbackData?.explanation && !showExplanation && (
                <button
                  onClick={() => setShowExplanation(true)}
                  className="btn btn-ghost btn-sm h-12 rounded-xl flex-1 border border-base-300"
                >
                  {t('Explicación', 'Explanation')}
                </button>
              )}
              <button
                onClick={handleNext}
                disabled={submitting}
                className="btn btn-primary h-12 rounded-xl flex-1 font-bold text-base"
              >
                {submitting
                  ? <span className="loading loading-spinner loading-sm" />
                  : currentIdx < questions.length - 1
                    ? t('Siguiente →', 'Next →')
                    : t('Enviar examen', 'Submit exam')}
              </button>
            </div>
          </div>
        )}

        {/* ── Keyboard shortcuts hint (desktop) ── */}
        <button
          onClick={() => setShowShortcuts(true)}
          className="hidden sm:flex fixed bottom-5 right-5 w-9 h-9 items-center justify-center
            rounded-full bg-base-200 border border-base-300 text-base-content/40
            hover:text-base-content/80 hover:bg-base-300 transition-colors text-sm font-mono z-10"
        >
          ?
        </button>
      </div>

      {/* ── Expanded Image Modal ── */}
      {expandedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setExpandedImage(null)}
        >
          <img src={expandedImage} alt="expanded" className="max-w-full max-h-full rounded-2xl shadow-2xl" />
          <button className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center text-lg">
            ✕
          </button>
        </div>
      )}

      {/* ── Keyboard Shortcuts Modal ── */}
      {showShortcuts && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowShortcuts(false)}
        >
          <div
            className="w-full max-w-sm bg-base-100 rounded-3xl p-6 shadow-2xl space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">{t('Atajos de teclado', 'Keyboard shortcuts')}</h3>
              <button onClick={() => setShowShortcuts(false)} className="btn btn-ghost btn-sm btn-circle">✕</button>
            </div>
            <div className="space-y-2 text-sm">
              {[
                ['1–4 / A–D', t('Seleccionar opción', 'Select option')],
                ['Enter / Space', t('Siguiente pregunta', 'Next question')],
                ['E', t('Ver/ocultar explicación', 'Toggle explanation')],
                ['S', t('Guardar pregunta', 'Bookmark question')],
                ['Esc', t('Cerrar modal', 'Close modal')],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between py-1.5 border-b border-base-200 last:border-0">
                  <span className="text-base-content/70">{desc}</span>
                  <kbd className="px-2 py-0.5 bg-base-200 rounded-md font-mono text-xs border border-base-300">{key}</kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}

export default function ExamPage() {
  return <ExamInterface />
}
