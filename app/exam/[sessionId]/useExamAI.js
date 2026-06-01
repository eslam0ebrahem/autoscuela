'use client'

import { useState, useCallback } from 'react'

export function useExamAI({ currentQuestion, feedbackData, selectedOption, lang, isPremium, toast, t, router }) {
  const [aiHint, setAiHint] = useState(null)
  const [loadingHint, setLoadingHint] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [aiExplanation, setAiExplanation] = useState(null)
  const [loadingExplanation, setLoadingExplanation] = useState(false)
  const [hintUsed, setHintUsed] = useState(false)

  const handleRequestHint = useCallback(async () => {
    if (!currentQuestion || loadingHint || hintUsed) return
    if (!isPremium) {
      toast?.error?.(
        t('Función Premium', 'Premium Feature'),
        t('Mejora tu plan para usar las pistas IA', 'Upgrade your plan to use AI hints')
      )
      router?.push('/settings')
      return
    }

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
      if (!res.ok) throw new Error(data.error || 'Failed to get hint')
      setAiHint(data.hint)
    } catch (err) {
      console.error('[exam] hint error:', err)
      toast?.error?.(t('Error', 'Error'), err.message)
      setHintUsed(false)
      setShowHint(false)
    } finally {
      setLoadingHint(false)
    }
  }, [currentQuestion, lang, loadingHint, hintUsed, isPremium, toast, t, router])

  const handleRequestExplanation = useCallback(async () => {
    if (!currentQuestion || !feedbackData || loadingExplanation) return
    if (!isPremium) {
      toast?.error?.(
        t('Función Premium', 'Premium Feature'),
        t('Mejora tu plan para explicaciones IA', 'Upgrade your plan for AI explanations')
      )
      router?.push('/settings')
      return
    }

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
      if (!res.ok) throw new Error(data.error || 'Failed to get explanation')
      setAiExplanation(data.explanation)
    } catch (err) {
      console.error('[exam] explanation error:', err)
      toast?.error?.(t('Error', 'Error'), err.message)
    } finally {
      setLoadingExplanation(false)
    }
  }, [currentQuestion, feedbackData, selectedOption, lang, loadingExplanation, isPremium, toast, t, router])

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
