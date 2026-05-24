'use client'

import { useState, useEffect, useCallback, useRef, memo } from 'react'
import Image from 'next/image'
import { useRouter, useParams } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/components/AuthContext'
import DOMPurify from 'dompurify'
import { useExamSession } from './useExamSession'
import { useExamAI } from './useExamAI'
import {
  CloseOutlined,
  ClockCircleOutlined,
  CheckOutlined,
  StarOutlined,
  StarFilled,
  ArrowRightOutlined,
  BulbOutlined,
  SmileOutlined,
  FrownOutlined,
  ZoomInOutlined,
  RobotOutlined,
  LoadingOutlined,
  ExperimentOutlined,
  RocketOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'

/**
 * KEYBOARD SHORTCUTS MODAL
 */
function KeyboardShortcutsModal({ onClose, t }) {
  return (
    <div
      className="fixed inset-0 z-[150] bg-black/50 flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-3xl p-8 max-w-sm w-full shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-black">{t('Atajos de Teclado', 'Keyboard Shortcuts')}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700 text-ink-light hover:text-ink"
          >
            <CloseOutlined />
          </button>
        </div>
        <div className="space-y-3 text-sm">
          {[
            ['1–4 / A–D', t('Seleccionar opción', 'Select option')],
            ['Enter / Space', t('Siguiente pregunta', 'Next question')],
            ['E', t('Mostrar/ocultar ayuda', 'Toggle explanation')],
            ['S', t('Guardar marcador', 'Toggle bookmark')],
            ['Esc', t('Cerrar modal', 'Close modal')],
            ['?', t('Mostrar atajos', 'Show shortcuts')],
          ].map(([key, desc]) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded-lg font-mono text-xs font-bold shrink-0">
                {key}
              </kbd>
              <span className="text-ink-light text-right">{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * SESSION INTRO OVERLAY
 */
function SessionIntroOverlay({ session, onStart, t }) {
  const prediction = session?.aiPassPrediction
  const tip = session?.aiSessionTip

  return (
    <div className="fixed inset-0 z-[100] glass flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 md:p-12 max-w-2xl w-full shadow-2xl border-4 border-slate-100 dark:border-slate-800 animate-scale-in text-center">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center text-white text-4xl mx-auto mb-8 shadow-xl shadow-primary/20">
          <RocketOutlined />
        </div>

        <h2 className="text-3xl md:text-4xl font-black text-ink dark:text-white mb-4">
          {t('Sesión Preparada', 'Session Ready')}
        </h2>

        <p className="text-lg text-ink-light dark:text-slate-400 mb-10 max-w-md mx-auto">
          {t(
            'Hemos seleccionado las mejores preguntas para tu nivel actual.',
            'We have selected the best questions for your current level.'
          )}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10 text-left">
          {prediction && (
            <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-100 dark:border-slate-800">
              <p className="text-[10px] font-black uppercase tracking-widest text-ink-light mb-2">
                {t('Probabilidad de Éxito', 'Pass Probability')}
              </p>
              <div className="flex items-end gap-2">
                <span
                  className={`text-4xl font-black ${
                    prediction.level === 'high'
                      ? 'text-success'
                      : prediction.level === 'medium'
                        ? 'text-warning'
                        : 'text-danger'
                  }`}
                >
                  {prediction.probability}%
                </span>
                <span className="text-xs font-bold text-ink-light mb-1">
                  {prediction.level === 'high'
                    ? t('Alta', 'High')
                    : prediction.level === 'medium'
                      ? t('Media', 'Medium')
                      : t('Baja', 'Low')}
                </span>
              </div>
            </div>
          )}

          {tip && (
            <div className="p-6 rounded-3xl bg-indigo-50 dark:bg-indigo-900/20 border-2 border-indigo-100 dark:border-indigo-900/30">
              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-2">
                {t('Consejo de la IA', 'AI Session Tip')}
              </p>
              <p className="text-sm font-bold text-ink dark:text-white italic">"{tip}"</p>
            </div>
          )}
        </div>

        <button
          onClick={onStart}
          className="w-full btn-primary py-5 rounded-3xl font-black text-xl shadow-2xl shadow-primary/30 active:scale-95 transition-all flex items-center justify-center gap-3"
        >
          {t('¡Empezar ahora!', 'Start Now!')}
          <ArrowRightOutlined />
        </button>

        <p className="mt-6 text-xs text-ink-light dark:text-slate-500 font-medium">
          {session.mode === 'official'
            ? t(
                'El cronómetro de 30 minutos empezará al hacer clic.',
                'The 30-minute timer will start upon clicking.'
              )
            : t(
                'Sin límite de tiempo. Tómate tu tiempo para aprender.',
                'No time limit. Take your time to learn.'
              )}
        </p>
      </div>
    </div>
  )
}

function sanitizeHtml(html) {
  if (typeof window === 'undefined') return ''
  return DOMPurify.sanitize(html)
}

// ── Audio ─────────────────────────────────────────────────
const audioCache = {}
const preloadAudio = (src) => {
  if (typeof window !== 'undefined' && !audioCache[src]) {
    const audio = new window.Audio(src)
    audio.preload = 'auto'
    audioCache[src] = audio
  }
}

if (typeof window !== 'undefined') {
  ;[
    '/sounds/correct-answer.mp3',
    '/sounds/wrong-answer.mp3',
    '/sounds/sucess-exam.mp3',
    '/sounds/fail-exam.mp3',
  ].forEach(preloadAudio)
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
const OptionButton = memo(function OptionButton({
  opt,
  idx,
  displayIdx,
  answered,
  selected,
  correct,
  isInstant,
  feedbackData,
  lang,
  onSelect,
}) {
  const text = lang === 'en' ? opt.text_en || opt.text_es : opt.text_es || opt.text_en
  const letter = ['A', 'B', 'C', 'D'][displayIdx]

  let state = 'idle'
  if (answered) {
    if (isInstant && feedbackData) {
      if (idx === correct) state = 'correct'
      else if (idx === selected) state = 'wrong'
      else state = 'dimmed'
    } else {
      if (idx === selected) state = 'selected'
      else state = 'dimmed'
    }
  }

  const stateClasses = {
    idle: 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800 hover:border-primary/50 hover:bg-primary/5 active:scale-[0.98]',
    correct: 'border-success bg-success/10 text-success shadow-sm shadow-success/20',
    wrong: 'border-danger   bg-danger/10   text-danger   shadow-sm shadow-danger/20',
    selected: 'border-primary bg-primary/10 text-primary shadow-sm shadow-primary/20',
    dimmed: 'border-slate-50 dark:border-slate-900 bg-slate-50 dark:bg-slate-900 opacity-45',
  }

  const letterClasses = {
    idle: 'bg-slate-100 dark:bg-slate-700 text-ink-light',
    correct: 'bg-success text-white',
    wrong: 'bg-danger   text-white',
    selected: 'bg-primary text-white',
    dimmed: 'bg-slate-100 dark:bg-slate-700 text-ink-light/30',
  }

  return (
    <button
      onClick={() => onSelect(idx)}
      disabled={answered}
      role="radio"
      aria-checked={idx === selected}
      className={`w-full flex items-center gap-4 p-5 rounded-3xl border-2 text-left transition-all duration-200 ${stateClasses[state]}`}
    >
      <span
        className={`shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-black transition-colors ${letterClasses[state]}`}
      >
        {letter}
      </span>
      <span className="flex-1 font-bold text-lg">{text}</span>
      {isInstant && answered && feedbackData && idx === correct && (
        <span className="text-2xl">
          <CheckOutlined />
        </span>
      )}
      {isInstant && answered && feedbackData && idx === selected && idx !== correct && (
        <span className="text-2xl">
          <CloseOutlined />
        </span>
      )}
    </button>
  )
})

/**
 * TYPEWRITER HOOK
 */
function useTypewriter(text, speed = 18) {
  const [displayed, setDisplayed] = useState('')
  const [done, setDone] = useState(false)
  useEffect(() => {
    if (!text) {
      setDisplayed('')
      setDone(false)
      return
    }
    setDisplayed('')
    setDone(false)
    let i = 0
    const id = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      if (i >= text.length) {
        clearInterval(id)
        setDone(true)
      }
    }, speed)
    return () => clearInterval(id)
  }, [text, speed])
  return { displayed, done }
}

/**
 * AI HINT PANEL COMPONENT
 */
function AIHintPanel({ hint, loading, onClose, t }) {
  const { displayed } = useTypewriter(hint?.hint || '')
  if (!loading && !hint) return null
  return (
    <div className="mt-4 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200 dark:border-indigo-700 rounded-2xl">
      <div className="flex items-center justify-between mb-2">
        <span className="flex items-center gap-2 text-sm font-bold text-indigo-700 dark:text-indigo-300">
          <RobotOutlined />
          {t('Pista IA', 'AI Hint')}
          {hint?.difficulty && (
            <span
              className={`px-2 py-0.5 rounded-full text-xs ${
                hint.difficulty === 'easy'
                  ? 'bg-green-100 text-green-700'
                  : hint.difficulty === 'hard'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-amber-100 text-amber-700'
              }`}
            >
              {hint.difficulty}
            </span>
          )}
        </span>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        >
          <CloseOutlined />
        </button>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
          <LoadingOutlined className="animate-spin" />
          <span className="text-sm">{t('Generando pista...', 'Generating hint...')}</span>
        </div>
      ) : (
        <>
          {hint?.concept && (
            <p className="text-xs text-indigo-500 dark:text-indigo-400 mb-1 font-medium uppercase tracking-wide">
              {hint.concept}
            </p>
          )}
          <p className="text-sm text-ink dark:text-white leading-relaxed">{displayed}</p>
        </>
      )}
    </div>
  )
}

/**
 * AI EXPLANATION PANEL COMPONENT
 */
function AIExplanationPanel({ explanation, loading, t }) {
  const { displayed: summaryText } = useTypewriter(explanation?.summary || '')
  const { displayed: correctText } = useTypewriter(explanation?.correct_explanation || '')
  const { displayed: tipText } = useTypewriter(explanation?.memory_tip || '')

  if (!loading && !explanation) return null

  return (
    <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border border-blue-200 dark:border-blue-700 rounded-2xl space-y-3">
      <div className="flex items-center gap-2 text-sm font-bold text-blue-700 dark:text-blue-300">
        <RobotOutlined />
        {t('Explicación IA', 'AI Explanation')}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
          <LoadingOutlined className="animate-spin" />
          <span className="text-sm">{t('Analizando con IA...', 'Analyzing with AI...')}</span>
        </div>
      ) : (
        <div className="space-y-3">
          {explanation?.summary && (
            <p className="text-sm font-semibold text-ink dark:text-white">{summaryText}</p>
          )}
          {explanation?.correct_explanation && (
            <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-blue-100 dark:border-blue-800">
              <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-1 uppercase tracking-wide">
                {t('¿Por qué es correcta?', 'Why is it correct?')}
              </p>
              <p className="text-sm text-ink dark:text-white leading-relaxed">{correctText}</p>
            </div>
          )}
          {explanation?.memory_tip && (
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
              <p className="text-xs font-bold text-amber-600 dark:text-amber-400 mb-1 uppercase tracking-wide">
                💡 {t('Tip para recordar', 'Memory tip')}
              </p>
              <p className="text-sm text-ink dark:text-white leading-relaxed">{tipText}</p>
            </div>
          )}
          {explanation?.law_reference && (
            <p className="text-xs text-slate-500 dark:text-slate-400 italic">
              📋 {explanation.law_reference}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function ExamInterface() {
  const { user, t } = useAuth()
  const params = useParams()
  const router = useRouter()
  const sessionId = params?.sessionId

  const lang = user?.preferences?.language || 'es'
  const soundEnabled = user?.preferences?.soundEnabled !== false

  const {
    session,
    questions,
    currentIdx,
    currentQuestion,
    selectedOption,
    answered,
    feedbackData,
    showExplanation,
    setShowExplanation,
    timeLeft,
    timerWarning,
    setTimerWarning,
    loading,
    submitting,
    result,
    confetti,
    bookmarkedQuestions,
    isSessionStarted,
    setIsSessionStarted,
    setStartTime,
    fetchSessionData,
    handleSubmitExam,
    handleSelectOption,
    handleNext,
    toggleBookmark,
  } = useExamSession(sessionId, soundEnabled, () => resetAIStates())

  const {
    aiHint,
    loadingHint,
    showHint,
    setShowHint,
    aiExplanation,
    loadingExplanation,
    hintUsed,
    handleRequestHint,
    handleRequestExplanation,
    resetAIStates,
  } = useExamAI(currentQuestion, feedbackData, selectedOption, lang)

  const [expandedImage, setExpandedImage] = useState(null)
  const [showShortcuts, setShowShortcuts] = useState(false)

  useEffect(() => {
    fetchSessionData(router)
  }, [fetchSessionData, router])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (expandedImage || showShortcuts || !isSessionStarted) {
        if (e.key === 'Escape') {
          setExpandedImage(null)
          setShowShortcuts(false)
        }
        return
      }
      if (!answered && currentQuestion) {
        const keyMap = { 1: 0, 2: 1, 3: 2, 4: 3, a: 0, b: 1, c: 2, d: 3 }
        const optIdx = keyMap[e.key.toLowerCase()]
        if (optIdx !== undefined && currentQuestion.options?.[optIdx]) {
          e.preventDefault()
          handleSelectOption(currentQuestion.options[optIdx].idx)
        }
      }
      if (answered) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleNext()
        }
        if (e.key === 'e' || e.key === 'E') setShowExplanation((p) => !p)
      }
      if ((e.key === 's' || e.key === 'S') && currentQuestion) {
        e.preventDefault()
        toggleBookmark(currentQuestion._id)
      }
      if (e.key === '?') setShowShortcuts(true)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    answered,
    currentQuestion,
    expandedImage,
    showShortcuts,
    isSessionStarted,
    handleSelectOption,
    handleNext,
    toggleBookmark,
    setShowExplanation,
  ])

  if (loading)
    return <div className="flex h-96 items-center justify-center animate-pulse text-4xl">🚗</div>

  if (result) {
    return (
      <div className="max-w-xl mx-auto space-y-8 animate-scale-in">
        {/* FIX 5: render confetti overlay when the exam is passed */}
        {confetti && (
          <div className="fixed inset-0 z-[200] pointer-events-none overflow-hidden">
            {Array.from({ length: 60 }).map((_, i) => (
              <span
                key={i}
                className="absolute animate-bounce"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `-${10 + Math.random() * 10}%`,
                  animationDelay: `${Math.random() * 2}s`,
                  animationDuration: `${1.5 + Math.random() * 2}s`,
                  fontSize: `${14 + Math.random() * 14}px`,
                }}
              >
                {['🎉', '⭐', '✨', '🏆', '🎊'][Math.floor(Math.random() * 5)]}
              </span>
            ))}
          </div>
        )}

        <div
          className={`card text-center p-12 border-t-8 ${result.passed ? 'border-success' : 'border-danger'}`}
        >
          <div className="text-7xl mb-6">
            {result.passed ? (
              <SmileOutlined className="text-success" />
            ) : (
              <FrownOutlined className="text-danger" />
            )}
          </div>
          <h2 className="text-4xl font-black mb-2">
            {result.passed ? t('¡APROBADO!', 'PASSED!') : t('¡CASI!', 'NOT YET!')}
          </h2>
          <p className="text-ink-light font-medium mb-8">
            {result.passed
              ? t('Has superado el examen con éxito.', 'You passed the exam successfully.')
              : t('Sigue practicando, te falta poco.', 'Keep practicing, you are almost there.')}
          </p>

          <div className="grid grid-cols-2 gap-4 mb-10">
            <div className="bg-slate-50 dark:bg-slate-900 rounded-3xl p-6">
              <p className="text-4xl font-black text-success">{result.score}</p>
              <p className="text-xs font-black uppercase tracking-widest text-ink-light mt-1">
                {t('Aciertos', 'Correct')}
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900 rounded-3xl p-6">
              <p className="text-4xl font-black text-danger">{result.errors}</p>
              <p className="text-xs font-black uppercase tracking-widest text-ink-light mt-1">
                {t('Errores', 'Errors')}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => router.push(`/exam/${sessionId}/review`)}
              className="btn-secondary flex-1 py-4 rounded-2xl font-black"
            >
              {t('Revisar', 'Review')}
            </button>
            <button
              onClick={() => router.push('/exam')}
              className="btn-primary flex-1 py-4 rounded-2xl font-black shadow-xl shadow-primary/20"
            >
              {t('Nuevo Intento', 'New Try')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // FIX 1 + 2: guard against undefined currentQuestion before accessing its properties
  // (also makes correctIdx safe to compute below)
  if (!currentQuestion)
    return (
      <div className="flex h-96 items-center justify-center text-ink-light">
        {t('No hay preguntas disponibles.', 'No questions available.')}
      </div>
    )

  const isInstant = session?.assistanceMode === 'instant'
  // FIX 2: now safe — currentQuestion is guaranteed non-null here
  const correctIdx = feedbackData?.correctOptionIdx ?? currentQuestion.correct_option_idx

  return (
    <div className="max-w-4xl mx-auto flex flex-col min-h-[calc(100vh-12rem)] px-4">
      {!isSessionStarted && (
        <SessionIntroOverlay
          session={session}
          onStart={() => {
            setIsSessionStarted(true)
            setStartTime(Date.now())
          }}
          t={t}
        />
      )}

      {/* FIX 7: timer warning with a dismiss button so it doesn't stay forever */}
      {timerWarning && (
        <div
          className={`rounded-2xl px-4 py-2 text-center text-sm font-black mb-4 flex items-center justify-center gap-3
          ${timerWarning === '1min' ? 'bg-danger/10 text-danger' : 'bg-warning/10 text-warning'}`}
        >
          <span>
            {timerWarning === '1min'
              ? t('¡1 minuto restante!', '1 minute remaining!')
              : t('5 minutos restantes', '5 minutes remaining')}
          </span>
          <button
            onClick={() => setTimerWarning(false)}
            className="opacity-60 hover:opacity-100 transition-opacity"
          >
            <CloseOutlined />
          </button>
        </div>
      )}

      {/* Top Bar */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={async () => {
            if (
              confirm(
                t(
                  '¿Seguro que quieres salir? El examen se guardará como completado.',
                  'Are you sure you want to exit? The exam will be saved as completed.'
                )
              )
            ) {
              try {
                // Submit the exam as-is to make it "completed"
                await fetch(`/api/exams/${sessionId}/submit`, { method: 'POST' })
                router.push('/exam')
              } catch (err) {
                console.error('Failed to submit exam on exit:', err)
                router.push('/exam')
              }
            }
          }}
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-ink-light hover:text-ink"
        >
          <CloseOutlined />
        </button>
        <div className="flex-1">
          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-ink-light mb-2">
            <span>
              {t('Pregunta', 'Question')} {currentIdx + 1} / {questions.length}
            </span>
            {timeLeft != null && (
              <span className={timeLeft < 60 ? 'text-danger animate-pulse' : ''}>
                <ClockCircleOutlined /> {Math.floor(timeLeft / 60)}:
                {String(timeLeft % 60).padStart(2, '0')}
              </span>
            )}
          </div>
          <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-500 ease-out"
              style={{
                width: `${questions.length > 0 ? ((currentIdx + 1) / questions.length) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex-1 flex flex-col lg:flex-row gap-8">
        <div className="flex-1 space-y-8">
          <h2 className="text-2xl md:text-3xl font-black leading-tight text-ink dark:text-white">
            {lang === 'en'
              ? currentQuestion.question.en || currentQuestion.question.es
              : currentQuestion.question.es || currentQuestion.question.en}
          </h2>

          <div className="space-y-3">
            {!answered && !hintUsed && (
              <button
                onClick={handleRequestHint}
                className="flex items-center gap-2 px-4 py-2 text-sm text-indigo-600 dark:text-indigo-400
                           bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700
                           rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
              >
                <ExperimentOutlined />
                {t('Pedir pista IA', 'Ask AI for hint')}
              </button>
            )}

            <AIHintPanel
              hint={aiHint}
              loading={loadingHint}
              onClose={() => setShowHint(false)}
              t={t}
            />

            <div role="radiogroup" aria-label={t('Opciones de respuesta', 'Answer options')}>
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
          </div>

          {showExplanation && feedbackData?.helpHtml && (
            <div className="p-6 bg-blue-50 dark:bg-blue-900/10 rounded-3xl border border-blue-100 dark:border-blue-800/50 animate-fade-in">
              <div
                className="help-html"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(feedbackData.helpHtml) }}
              />
            </div>
          )}

          {answered && session?.assistanceMode === 'instant' && (
            <>
              {!aiExplanation && !loadingExplanation && (
                <button
                  onClick={handleRequestExplanation}
                  className="mt-3 flex items-center gap-2 px-4 py-2 text-sm text-blue-600 dark:text-blue-400
                             bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700
                             rounded-xl hover:bg-blue-100 transition-colors"
                >
                  <RobotOutlined />
                  {t('Explicación detallada IA', 'Detailed AI Explanation')}
                </button>
              )}
              <AIExplanationPanel explanation={aiExplanation} loading={loadingExplanation} t={t} />
            </>
          )}
        </div>

        {currentQuestion.metadata?.image_url && (
          <div className="lg:w-80 shrink-0">
            <div
              className="sticky top-24 card p-0 overflow-hidden group cursor-zoom-in"
              onClick={() => setExpandedImage(currentQuestion.metadata.image_url)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setExpandedImage(currentQuestion.metadata.image_url)
                }
              }}
              role="button"
              tabIndex={0}
            >
              {/* 5.7: Ensure all question images have alt text */}
              <div className="relative w-full aspect-square overflow-hidden">
                <Image
                  src={currentQuestion.metadata.image_url}
                  alt={`Imagen de la pregunta: ${currentQuestion.question?.es?.substring(0, 80) || 'pregunta de examen'}`}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                />
              </div>
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-white text-3xl">
                  <ZoomInOutlined />
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-12 flex items-center justify-between pb-8">
        <div className="flex gap-4">
          {isInstant && answered && feedbackData?.helpHtml && (
            <button
              onClick={() => setShowExplanation(!showExplanation)}
              className="px-6 py-3 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-black text-sm uppercase tracking-widest flex items-center gap-2"
              aria-label={
                showExplanation
                  ? t('Ocultar explicación', 'Hide explanation')
                  : t('Mostrar explicación', 'Show explanation')
              }
            >
              <BulbOutlined /> {showExplanation ? t('Ocultar', 'Hide') : t('Ayuda', 'Help')}
            </button>
          )}
          {/* 5.4: Add aria-label to icon-only buttons */}
          <button
            onClick={() => toggleBookmark(currentQuestion._id)}
            className={`w-12 h-12 flex items-center justify-center rounded-2xl border-2 transition-all
              ${
                bookmarkedQuestions.has(currentQuestion._id)
                  ? 'bg-amber-50 border-amber-200 text-amber-500'
                  : 'bg-slate-50 border-slate-100 text-slate-400'
              }`}
            aria-label={
              bookmarkedQuestions.has(currentQuestion._id)
                ? t('Eliminar de guardados', 'Remove from bookmarks')
                : t('Guardar pregunta', 'Save question')
            }
          >
            {bookmarkedQuestions.has(currentQuestion._id) ? <StarFilled /> : <StarOutlined />}
          </button>
        </div>

        {answered && (
          <button
            onClick={handleNext}
            className="btn-primary px-10 py-4 rounded-2xl font-black shadow-2xl shadow-primary/30 animate-scale-in flex items-center gap-2"
          >
            {currentIdx === questions.length - 1
              ? t('Finalizar', 'Finish')
              : t('Siguiente', 'Next')}
            <ArrowRightOutlined />
          </button>
        )}
      </div>

      {/* Expanded image overlay */}
      {expandedImage && (
        <div
          className="fixed inset-0 z-[100] glass flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setExpandedImage(null)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' || e.key === 'Enter') {
              setExpandedImage(null)
            }
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Expanded question image"
          tabIndex={0}
        >
          {/* 5.7: Ensure all question images have alt text */}
          <div className="relative w-full h-full max-w-5xl max-h-[90vh]">
            <Image
              src={expandedImage}
              className="rounded-3xl shadow-2xl animate-scale-in object-contain"
              alt={`Enlarged image: ${currentQuestion?.question?.es?.substring(0, 80) || 'exam question'}`}
              fill
              priority
            />
          </div>
        </div>
      )}

      {/* FIX 6: keyboard shortcuts modal */}
      {showShortcuts && <KeyboardShortcutsModal onClose={() => setShowShortcuts(false)} t={t} />}
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
