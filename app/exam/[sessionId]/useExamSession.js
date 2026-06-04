'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

function playSound(src) {
  if (typeof window === 'undefined') return
  if (window.audioCache && window.audioCache[src]) {
    const audio = window.audioCache[src]
    audio.currentTime = 0
    audio.play().catch(() => {})
  }
}

export function useExamSession(sessionId, soundEnabled, resetAIStates) {
  const [session, setSession] = useState(null)
  const [questions, setQuestions] = useState([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const currentQuestion = questions[currentIdx]

  const [selectedOption, setSelectedOption] = useState(null)
  const [answered, setAnswered] = useState(false)
  const [feedbackData, setFeedbackData] = useState(null)
  const [showExplanation, setShowExplanation] = useState(false)

  const [timeLeft, setTimeLeft] = useState(null)
  const [timerWarning, setTimerWarning] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const [startTime, setStartTime] = useState(null)
  const [confetti, setConfetti] = useState(false)
  const [bookmarkedQuestions, setBookmarkedQuestions] = useState(new Set())
  const [isSessionStarted, setIsSessionStarted] = useState(false)
  const [sessionCorrect, setSessionCorrect] = useState(0)
  const [sessionErrors, setSessionErrors] = useState(0)
  const [autoAdvanceTimer, setAutoAdvanceTimer] = useState(null)

  const timerRef = useRef(null)
  const answerFetchRef = useRef(null)
  const autoAdvanceRef = useRef(null)

  const fetchSessionData = useCallback(async (router) => {
    if (!sessionId) return
    try {
      const [bookmarksData, examData] = await Promise.all([
        fetch('/api/bookmarks?idsOnly=true')
          .then((r) => (r.ok ? r.json() : {}))
          .catch(() => ({})),
        fetch(`/api/exams/${sessionId}`).then((r) => r.json()),
      ])
      
      if (bookmarksData?.bookmarks) {
        setBookmarkedQuestions(new Set(bookmarksData.bookmarks))
      }

      if (examData?.session) {
        setSession(examData.session)
        setQuestions(examData.questions || [])
        if (examData.session.status === 'completed') {
          setResult({
            score: examData.session.score,
            errors: examData.session.errorCount,
            passed: examData.session.passed,
            total: examData.questions?.length || 0,
          })
          setIsSessionStarted(true)
        } else {
          setCurrentIdx(examData.session.currentQuestionIndex || 0)
          
          let correct = 0
          let errors = 0
          ;(examData.session.answers || []).forEach((a) => {
            if (a.isCorrect) correct++
            else errors++
          })
          setSessionCorrect(correct)
          setSessionErrors(errors)

          if (examData.session.currentQuestionIndex > 0) {
            setIsSessionStarted(true)
            setStartTime(Date.now())
          }
        }
      } else {
        console.error('Session not found or error:', examData?.error)
        router.push('/exam')
      }
    } catch (err) {
      console.error('Error fetching session data:', err)
      router.push('/exam')
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  const handleSubmitExam = useCallback(async () => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/exams/${sessionId}/submit`, { method: 'POST' })
      const data = await res.json()
      if (data.result) {
        setResult(data.result)
        if (soundEnabled)
          playSound(data.result.passed ? '/sounds/sucess-exam.mp3' : '/sounds/fail-exam.mp3')
        if (data.result.passed) setConfetti(true)
      }
    } finally {
      setSubmitting(false)
    }
  }, [sessionId, soundEnabled])

  useEffect(() => {
    if (!session?.expiresAt || result || !isSessionStarted) return
    const endTime = new Date(session.expiresAt).getTime()
    const checkTime = () => {
      const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000))
      setTimeLeft(remaining)
      if (remaining <= 0) {
        clearInterval(timerRef.current)
        handleSubmitExam()
      } else if (remaining === 300) setTimerWarning('5min')
      else if (remaining === 60) setTimerWarning('1min')
    }
    checkTime()
    timerRef.current = setInterval(checkTime, 1000)
    return () => clearInterval(timerRef.current)
  }, [session, result, isSessionStarted, handleSubmitExam])

  const handleNext = useCallback(() => {
    answerFetchRef.current?.abort()
    answerFetchRef.current = null
    
    if (autoAdvanceRef.current) {
      clearTimeout(autoAdvanceRef.current)
      autoAdvanceRef.current = null
    }
    setAutoAdvanceTimer(null)

    if (currentIdx < questions.length - 1) {
      setCurrentIdx((i) => i + 1)
      setSelectedOption(null)
      setAnswered(false)
      setFeedbackData(null)
      setShowExplanation(false)
      if (resetAIStates) resetAIStates()
      setStartTime(Date.now())
    } else {
      handleSubmitExam()
    }
  }, [currentIdx, questions.length, handleSubmitExam, resetAIStates])

  const cancelAutoAdvance = useCallback(() => {
    if (autoAdvanceRef.current) {
      clearTimeout(autoAdvanceRef.current)
      autoAdvanceRef.current = null
      setAutoAdvanceTimer(null)
    }
  }, [])

  const handleSelectOption = useCallback(
    (optIdx) => {
      if (answered || submitting) return

      answerFetchRef.current?.abort()
      const controller = new AbortController()
      answerFetchRef.current = controller

      setSelectedOption(optIdx)
      setAnswered(true)
      const timeTaken = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0

      if (session?.assistanceMode === 'instant' && soundEnabled) {
        const localCorrect = currentQuestion?.correct_option_idx
        if (localCorrect != null)
          playSound(
            optIdx === localCorrect ? '/sounds/correct-answer.mp3' : '/sounds/wrong-answer.mp3'
          )
      }

      fetch(`/api/exams/${sessionId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_id: currentQuestion?._id,
          selected_option_idx: optIdx,
          time_taken: timeTaken,
        }),
        signal: controller.signal,
      })
        .then((r) => r.json())
        .then((data) => {
          if (answerFetchRef.current !== controller) return

          setFeedbackData(data)
          
          if (data.isCorrect) setSessionCorrect(c => c + 1)
          else setSessionErrors(e => e + 1)

          if (
            soundEnabled &&
            session?.assistanceMode === 'instant' &&
            currentQuestion?.correct_option_idx == null
          ) {
            playSound(data.isCorrect ? '/sounds/correct-answer.mp3' : '/sounds/wrong-answer.mp3')
          }

          // Auto-advance logic for instant mode
          if (session?.assistanceMode === 'instant' && data.isCorrect) {
            setAutoAdvanceTimer(true)
            autoAdvanceRef.current = setTimeout(() => {
              handleNext()
            }, 2500)
          }
        })
        .catch((err) => {
          if (err.name !== 'AbortError') console.error('Answer fetch error:', err)
        })
    },
    [answered, submitting, startTime, session, soundEnabled, currentQuestion, sessionId, handleNext]
  )



  const toggleBookmark = useCallback(async (questionId) => {
    try {
      const res = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId }),
      })
      const data = await res.json()
      if (data.success) {
        setBookmarkedQuestions((prev) => {
          const s = new Set(prev)
          data.isBookmarked ? s.add(questionId) : s.delete(questionId)
          return s
        })
      }
    } catch (err) {
      console.error('Error toggling bookmark:', err)
    }
  }, [])

  return {
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
    sessionCorrect,
    sessionErrors,
    autoAdvanceTimer,
    cancelAutoAdvance,
    setStartTime,
    fetchSessionData,
    handleSubmitExam,
    handleSelectOption,
    handleNext,
    toggleBookmark,
  }
}
