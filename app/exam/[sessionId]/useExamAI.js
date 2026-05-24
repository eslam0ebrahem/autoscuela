'use client'

import { useState, useCallback } from 'react'

export function useExamAI(currentQuestion, feedbackData, selectedOption, lang) {
  const [aiHint, setAiHint] = useState(null)
  const [loadingHint, setLoadingHint] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [aiExplanation, setAiExplanation] = useState(null)
  const [loadingExplanation, setLoadingExplanation] = useState(false)
  const [hintUsed, setHintUsed] = useState(false)

  const handleRequestHint = useCallback(async () => {
    if (!currentQuestion || loadingHint || hintUsed) return
    setLoadingHint(true)
    setShowHint(true)
    setHintUsed(true)
    try {
      const res = await fetch('/api/ai/hint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: currentQuestion._id, lang }),
      })
      const data = await res.json()
      setAiHint(data.hint)
    } catch (err) {
      console.error('[exam] hint error:', err)
    } finally {
      setLoadingHint(false)
    }
  }, [currentQuestion, lang, loadingHint, hintUsed])

  const handleRequestExplanation = useCallback(async () => {
    if (!currentQuestion || !feedbackData || loadingExplanation) return
    setLoadingExplanation(true)
    try {
      const res = await fetch('/api/ai/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: currentQuestion._id,
          selectedIdx: selectedOption,
          lang,
        }),
      })
      const data = await res.json()
      setAiExplanation(data.explanation)
    } catch (err) {
      console.error('[exam] explanation error:', err)
    } finally {
      setLoadingExplanation(false)
    }
  }, [currentQuestion, feedbackData, selectedOption, lang, loadingExplanation])

  const resetAIStates = useCallback(() => {
    setAiHint(null)
    setShowHint(false)
    setHintUsed(false)
    setAiExplanation(null)
  }, [])

  return {
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
  }
}
