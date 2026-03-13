'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/components/AuthContext'
import DOMPurify from 'dompurify'
import {
  CloseOutlined,
  ClockCircleOutlined,
  CheckOutlined,
  SearchOutlined,
  StarOutlined,
  StarFilled,
  ArrowRightOutlined,
  BulbOutlined,
  SmileOutlined,
  FrownOutlined,
  ZoomInOutlined
} from '@ant-design/icons'

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
  ['/sounds/correct-answer.mp3', '/sounds/wrong-answer.mp3', '/sounds/sucess-exam.mp3', '/sounds/fail-exam.mp3'].forEach(preloadAudio)
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
function OptionButton({ opt, idx, displayIdx, answered, selected, correct, isInstant, feedbackData, lang, onSelect }) {
  const text  = lang === 'en' && opt.text_en ? opt.text_en : opt.text_es
  const letter = ['A', 'B', 'C', 'D'][displayIdx]

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
    idle:     'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800 hover:border-primary/50 hover:bg-primary/5 active:scale-[0.98]',
    correct:  'border-success bg-success/10 text-success shadow-sm shadow-success/20',
    wrong:    'border-danger   bg-danger/10   text-danger   shadow-sm shadow-danger/20',
    selected: 'border-primary bg-primary/10 text-primary shadow-sm shadow-primary/20',
    dimmed:   'border-slate-50 dark:border-slate-900 bg-slate-50 dark:bg-slate-900 opacity-45',
  }

  const letterClasses = {
    idle:     'bg-slate-100 dark:bg-slate-700 text-ink-light',
    correct:  'bg-success text-white',
    wrong:    'bg-danger   text-white',
    selected: 'bg-primary text-white',
    dimmed:   'bg-slate-100 dark:bg-slate-700 text-ink-light/30',
  }

  return (
    <button
      onClick={() => onSelect(idx)}
      disabled={answered}
      className={`w-full flex items-center gap-4 p-5 rounded-3xl border-2 text-left transition-all duration-200 ${stateClasses[state]}`}
    >
      <span className={`shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-black transition-colors ${letterClasses[state]}`}>
        {letter}
      </span>
      <span className="flex-1 font-bold text-lg">{text}</span>
      {isInstant && answered && feedbackData && idx === correct && <span className="text-2xl"><CheckOutlined /></span>}
      {isInstant && answered && feedbackData && idx === selected && idx !== correct && <span className="text-2xl"><CloseOutlined /></span>}
    </button>
  )
}

function ExamInterface() {
  const { user, t } = useAuth()
  const params = useParams()
  const router = useRouter()
  const sessionId = params?.sessionId

  const [session, setSession] = useState(null)
  const [questions, setQuestions] = useState([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const currentQuestion = questions[currentIdx]
  
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

  useEffect(() => {
    if (!sessionId) return
    Promise.all([
      fetch('/api/users/bookmarks').then(r => r.ok ? r.json() : {}).catch(() => ({})),
      fetch(`/api/exams/${sessionId}`).then(r => r.json())
    ]).then(([bookmarksData, examData]) => {
      if (bookmarksData?.bookmarks) setBookmarkedQuestions(new Set(bookmarksData.bookmarks))
      setSession(examData.session)
      setQuestions(examData.questions || [])
      if (examData.session.status === 'completed') {
        setResult({ score: examData.session.score, errors: examData.session.errorCount, passed: examData.session.passed, total: examData.questions?.length })
      } else {
        setCurrentIdx(examData.session.currentQuestionIndex || 0)
        setStartTime(Date.now())
      }
    }).finally(() => setLoading(false))
  }, [sessionId])

  const handleSubmitExam = useCallback(async () => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/exams/${sessionId}/submit`, { method: 'POST' })
      const data = await res.json()
      if (data.result) {
        setResult(data.result)
        if (soundEnabled) playSound(data.result.passed ? '/sounds/sucess-exam.mp3' : '/sounds/fail-exam.mp3')
        if (data.result.passed) setConfetti(true)
      }
    } finally {
      setSubmitting(false)
    }
  }, [sessionId, soundEnabled])

  useEffect(() => {
    if (!session?.expiresAt || result) return
    const endTime = new Date(session.expiresAt).getTime()
    const checkTime = () => {
      const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000))
      setTimeLeft(remaining)
      if (remaining <= 0) { clearInterval(timerRef.current); handleSubmitExam() }
      else if (remaining === 300) setTimerWarning('5min')
      else if (remaining === 60) setTimerWarning('1min')
    }
    checkTime()
    timerRef.current = setInterval(checkTime, 1000)
    return () => clearInterval(timerRef.current)
  }, [session, result, handleSubmitExam])

  const handleSelectOption = (optIdx) => {
    if (answered || submitting) return
    setSelectedOption(optIdx)
    setAnswered(true)
    const timeTaken = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0

    if (session?.assistanceMode === 'instant' && soundEnabled) {
      const localCorrect = currentQuestion.correct_option_idx
      if (localCorrect != null)
        playSound(optIdx === localCorrect ? '/sounds/correct-answer.mp3' : '/sounds/wrong-answer.mp3')
    }

    fetch(`/api/exams/${sessionId}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question_id: questions[currentIdx]._id, selected_option_idx: optIdx, time_taken: timeTaken }),
    }).then(r => r.json()).then(data => {
      setFeedbackData(data)
      if (soundEnabled && session?.assistanceMode === 'instant' && currentQuestion.correct_option_idx == null) {
        playSound(data.isCorrect ? '/sounds/correct-answer.mp3' : '/sounds/wrong-answer.mp3')
      }
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
          e.preventDefault(); handleSelectOption(currentQuestion.options[optIdx].idx)
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

  if (loading) return <div className="flex h-96 items-center justify-center animate-pulse text-4xl">🚗</div>

  if (result) {
    return (
      <div className="max-w-xl mx-auto space-y-8 animate-scale-in">
        <div className={`card text-center p-12 border-t-8 ${result.passed ? 'border-success' : 'border-danger'}`}>
          <div className="text-7xl mb-6">{result.passed ? <SmileOutlined className="text-success" /> : <FrownOutlined className="text-danger" />}</div>
          <h2 className="text-4xl font-black mb-2">{result.passed ? t('¡APROBADO!', 'PASSED!') : t('¡CASI!', 'NOT YET!')}</h2>
          <p className="text-ink-light font-medium mb-8">
            {result.passed ? t('Has superado el examen con éxito.', 'You passed the exam successfully.') : t('Sigue practicando, te falta poco.', 'Keep practicing, you are almost there.')}
          </p>
          
          <div className="grid grid-cols-2 gap-4 mb-10">
            <div className="bg-slate-50 dark:bg-slate-900 rounded-3xl p-6">
              <p className="text-4xl font-black text-success">{result.score}</p>
              <p className="text-xs font-black uppercase tracking-widest text-ink-light mt-1">{t('Aciertos', 'Correct')}</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900 rounded-3xl p-6">
              <p className="text-4xl font-black text-danger">{result.errors}</p>
              <p className="text-xs font-black uppercase tracking-widest text-ink-light mt-1">{t('Errores', 'Errors')}</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <button onClick={() => router.push(`/exam/${sessionId}/review`)} className="btn-secondary flex-1 py-4 rounded-2xl font-black">
              {t('Revisar', 'Review')}
            </button>
            <button onClick={() => router.push('/exam')} className="btn-primary flex-1 py-4 rounded-2xl font-black shadow-xl shadow-primary/20">
              {t('Nuevo Intento', 'New Try')}
            </button>
          </div>
        </div>
      </div>
    )
  }


  const isInstant = session?.assistanceMode === 'instant'
  const correctIdx = feedbackData?.correctOptionIdx ?? currentQuestion.correct_option_idx

  return (
    <div className="max-w-4xl mx-auto flex flex-col min-h-[calc(100vh-12rem)] px-4">
      
      {/* Timer warning */}
      {timerWarning && (
        <div className={`rounded-2xl px-4 py-2 text-center text-sm font-black mb-4 ${timerWarning === '1min' ? 'bg-danger/10 text-danger' : 'bg-warning/10 text-warning'}`}>
          {timerWarning === '1min' ? t('¡1 minuto restante!', '1 minute remaining!') : t('5 minutos restantes', '5 minutes remaining')}
        </div>
      )}

      {/* Top Bar */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => { if (confirm(t('¿Salir?', 'Exit?'))) router.push('/exam') }} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-ink-light hover:text-ink">
          <CloseOutlined />
        </button>
        <div className="flex-1">
           <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-ink-light mb-2">
             <span>{t('Pregunta', 'Question')} {currentIdx + 1} / {questions.length}</span>
             {timeLeft != null && <span className={timeLeft < 60 ? 'text-danger animate-pulse' : ''}>
               <ClockCircleOutlined /> {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
             </span>}
           </div>
           <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
             <div className="h-full bg-primary transition-all duration-500 ease-out" style={{ width: `${questions.length > 0 ? ((currentIdx + 1) / questions.length) * 100 : 0}%` }} />
           </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex-1 flex flex-col lg:flex-row gap-8">
        <div className="flex-1 space-y-8">
          <h2 className="text-2xl md:text-3xl font-black leading-tight text-ink dark:text-white">
            {lang === 'en' ? currentQuestion.question.en : currentQuestion.question.es}
          </h2>

          <div className="space-y-3">
            {currentQuestion.options.map((opt, i) => (
              <OptionButton
                key={i}
                opt={opt}
                idx={opt.idx}
                displayIdx={i}
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

          {showExplanation && feedbackData?.helpHtml && (
            <div className="p-6 bg-blue-50 dark:bg-blue-900/10 rounded-3xl border border-blue-100 dark:border-blue-800/50 animate-fade-in">
              <div className="help-html" dangerouslySetInnerHTML={{ __html: sanitizeHtml(feedbackData.helpHtml) }} />
            </div>
          )}
        </div>

        {currentQuestion.metadata?.image_url && (
          <div className="lg:w-80 shrink-0">
             <div className="sticky top-24 card p-0 overflow-hidden group cursor-zoom-in" onClick={() => setExpandedImage(currentQuestion.metadata.image_url)}>
                <img src={currentQuestion.metadata.image_url} alt="Question" className="w-full aspect-square object-cover transition-transform duration-500 group-hover:scale-110" />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                   <span className="text-white text-3xl"><ZoomInOutlined /></span>
                </div>
             </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-12 flex items-center justify-between pb-8">
        <div className="flex gap-4">
           {isInstant && answered && feedbackData?.helpHtml && (
             <button onClick={() => setShowExplanation(!showExplanation)} className="px-6 py-3 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-black text-sm uppercase tracking-widest flex items-center gap-2">
               <BulbOutlined /> {showExplanation ? t('Ocultar', 'Hide') : t('Ayuda', 'Help')}
             </button>
           )}
           <button onClick={() => toggleBookmark(currentQuestion._id)} className={`w-12 h-12 flex items-center justify-center rounded-2xl border-2 transition-all ${bookmarkedQuestions.has(currentQuestion._id) ? 'bg-amber-50 border-amber-200 text-amber-500' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
             {bookmarkedQuestions.has(currentQuestion._id) ? <StarFilled /> : <StarOutlined />}
           </button>
        </div>
        
        {answered && (
          <button onClick={handleNext} className="btn-primary px-10 py-4 rounded-2xl font-black shadow-2xl shadow-primary/30 animate-scale-in flex items-center gap-2">
            {currentIdx === questions.length - 1 ? t('Finalizar', 'Finish') : t('Siguiente', 'Next')} <ArrowRightOutlined />
          </button>
        )}
      </div>

      {expandedImage && (
        <div className="fixed inset-0 z-[100] glass flex items-center justify-center p-4 animate-fade-in" onClick={() => setExpandedImage(null)}>
           <img src={expandedImage} className="max-w-full max-h-full rounded-3xl shadow-2xl animate-scale-in" alt="Enlarged" />
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
