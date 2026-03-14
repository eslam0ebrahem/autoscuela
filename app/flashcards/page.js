'use client'
import { useState, useEffect, useCallback } from 'react'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/components/AuthContext'
import { useToast } from '@/components/Toast'
import {
  IdcardOutlined,
  ExclamationCircleOutlined,
  SmileOutlined,
  CheckCircleOutlined,
  FlagOutlined,
  CloseOutlined,
  ReloadOutlined,
  CheckOutlined,
  InteractionOutlined,
  BookOutlined,
  ArrowRightOutlined,
  LeftOutlined,
  TrophyOutlined,
  WarningOutlined,
} from '@ant-design/icons'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const TRANSITION_DURATION = 250 // ms
const API_ENDPOINTS = {
  PRACTICE: '/api/flashcards/practice',
  REVIEW: '/api/flashcards/review',
  DECKS: '/api/flashcards/decks',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Get localized text from multilingual object or string.
 * @param {Object|string} obj - Text object with 'es' and 'en' keys or plain string
 * @param {string} lang - Language code ('es' or 'en')
 * @returns {string}
 */
const getLocalizedText = (obj, lang) => {
  if (!obj) return ''
  if (typeof obj === 'string') return obj
  if (lang === 'en' && obj.en) return obj.en
  return obj.es || obj.en || ''
}

// ---------------------------------------------------------------------------
// FlashcardDeck Component
// ---------------------------------------------------------------------------
function FlashcardDeck({ deck, lang, onBack }) {
  const { t } = useAuth()
  const toast = useToast()

  // ── State ──────────────────────────────────────────────────────────────
  const [cards, setCards] = useState([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [stats, setStats] = useState({ got: 0, practice: 0 })
  const [done, setDone] = useState(false)
  const [transitioning, setTransitioning] = useState(false)

  // ── Fetch flashcards ───────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true

    const fetchCards = async () => {
      setLoading(true)
      setError(false)

      try {
        const deckQuery = deck ? `?deck=${encodeURIComponent(deck)}` : ''
        const res = await fetch(`${API_ENDPOINTS.PRACTICE}${deckQuery}`)

        if (!res.ok) {
          throw new Error(t('Error al cargar tarjetas', 'Failed to fetch flashcards'))
        }

        const data = await res.json()

        if (isMounted) {
          setCards(data.cards || [])
          setLoading(false)
        }
      } catch (err) {
        console.error('[flashcards] Fetch error:', err)
        if (isMounted) {
          setError(true)
          setLoading(false)
          toast?.error?.(t('Error', 'Error'), err.message)
        }
      }
    }

    fetchCards()

    return () => {
      isMounted = false
    }
  }, [deck, t, toast])

  // ── Handle card review ─────────────────────────────────────────────────
  const handleReview = useCallback(
    async (status) => {
      if (transitioning || !cards[currentIdx]) return

      setTransitioning(true)

      const currentCard = cards[currentIdx]

      // Save review (fire and forget, non-blocking)
      fetch(API_ENDPOINTS.REVIEW, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          card_id: currentCard._id,
          status,
        }),
      }).catch((err) => {
        console.error('[flashcards] Review save error:', err)
        // Don't block user flow on save errors
      })

      // Update stats
      setStats((prev) => ({
        ...prev,
        [status === 'got_it' ? 'got' : 'practice']: prev[status === 'got_it' ? 'got' : 'practice'] + 1,
      }))

      // Reset flip state
      setFlipped(false)

      // Transition to next card or completion
      setTimeout(() => {
        if (currentIdx < cards.length - 1) {
          setCurrentIdx((i) => i + 1)
        } else {
          setDone(true)
        }
        setTransitioning(false)
      }, TRANSITION_DURATION)
    },
    [transitioning, cards, currentIdx]
  )

  // ── Toggle card flip ───────────────────────────────────────────────────
  const toggleFlip = useCallback(() => {
    if (!transitioning) {
      setFlipped((prev) => !prev)
    }
  }, [transitioning])

  // ── Restart session ────────────────────────────────────────────────────
  const handleRestart = useCallback(() => {
    setCurrentIdx(0)
    setFlipped(false)
    setStats({ got: 0, practice: 0 })
    setDone(false)
    setTransitioning(false)
  }, [])

  // ── Loading state ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-ink-light dark:text-slate-400 text-sm">
          {t('Cargando tarjetas...', 'Loading flashcards...')}
        </p>
      </div>
    )
  }

  // ── Error state ────────────────────────────────────────────────────────
  if (error || cards.length === 0) {
    return (
      <div className="card text-center max-w-md mx-auto">
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <WarningOutlined className="text-3xl text-red-600 dark:text-red-400" />
          </div>
          <h3 className="text-lg font-black text-ink dark:text-white">
            {cards.length === 0
              ? t('No hay tarjetas disponibles', 'No flashcards available')
              : t('Error al cargar', 'Failed to load')}
          </h3>
          <p className="text-sm text-ink-light dark:text-slate-400">
            {cards.length === 0
              ? t('Intenta con otro tema o vuelve más tarde', 'Try another topic or come back later')
              : t('Hubo un problema cargando las tarjetas', 'There was a problem loading the flashcards')}
          </p>
          <button
            onClick={onBack}
            className="px-6 py-2 bg-primary text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
          >
            <LeftOutlined />
            {t('Volver', 'Go Back')}
          </button>
        </div>
      </div>
    )
  }

  // ── Completion state ───────────────────────────────────────────────────
  if (done) {
    const accuracy = cards.length > 0 ? Math.round((stats.got / cards.length) * 100) : 0
    const isPerfect = stats.got === cards.length
    const isGood = accuracy >= 70

    return (
      <div className="card max-w-2xl mx-auto text-center">
        <div className="flex flex-col items-center gap-6 py-8">
          <div
            className={`w-24 h-24 rounded-full flex items-center justify-center ${
              isPerfect
                ? 'bg-green-100 dark:bg-green-900/30'
                : isGood
                ? 'bg-indigo-100 dark:bg-indigo-900/30'
                : 'bg-orange-100 dark:bg-orange-900/30'
            }`}
          >
            {isPerfect ? (
              <TrophyOutlined className="text-5xl text-green-600 dark:text-green-400" />
            ) : isGood ? (
              <SmileOutlined className="text-5xl text-indigo-600 dark:text-indigo-400" />
            ) : (
              <ExclamationCircleOutlined className="text-5xl text-orange-600 dark:text-orange-400" />
            )}
          </div>

          <div>
            <h2 className="text-2xl font-black text-ink dark:text-white mb-2">
              {isPerfect
                ? t('¡Perfecto!', 'Perfect!')
                : isGood
                ? t('¡Buen trabajo!', 'Good job!')
                : t('Sigue practicando', 'Keep practicing')}
            </h2>
            <p className="text-ink-light dark:text-slate-400">
              {t('Has completado todas las tarjetas', 'You completed all flashcards')}
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-6 w-full max-w-sm">
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
              <div className="text-3xl font-black text-green-600 dark:text-green-400">{stats.got}</div>
              <p className="text-xs font-semibold text-green-700 dark:text-green-300 mt-1">
                {t('Sabidas', 'Learned')}
              </p>
            </div>
            <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-200 dark:border-orange-800">
              <div className="text-3xl font-black text-orange-600 dark:text-orange-400">{stats.practice}</div>
              <p className="text-xs font-semibold text-orange-700 dark:text-orange-300 mt-1">
                {t('Repasar', 'Review')}
              </p>
            </div>
          </div>

          <div className="text-lg font-black text-primary">
            {t('Precisión:', 'Accuracy:')} {accuracy}%
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
            <button
              onClick={handleRestart}
              className="flex-1 px-6 py-3 bg-primary text-white font-bold rounded-xl hover:bg-indigo-700 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <ReloadOutlined />
              {t('Volver a practicar', 'Practice again')}
            </button>
            <button
              onClick={onBack}
              className="flex-1 px-6 py-3 bg-slate-100 dark:bg-slate-800 text-ink dark:text-white font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <LeftOutlined />
              {t('Cambiar tema', 'Change topic')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Active flashcard view ──────────────────────────────────────────────
  const currentCard = cards[currentIdx]
  const questionText = getLocalizedText(currentCard.question, lang)
  const answerText = getLocalizedText(currentCard.answer, lang)
  const progress = ((currentIdx + 1) / cards.length) * 100

  return (
    <div className="container-wrapper max-w-3xl mx-auto space-y-6">
      {/* Header with progress */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-ink dark:text-white rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-2"
        >
          <LeftOutlined />
          <span className="hidden sm:inline font-semibold">{t('Volver', 'Back')}</span>
        </button>

        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold text-ink-light dark:text-slate-400">
            {currentIdx + 1} / {cards.length}
          </span>
          <div className="flex items-center gap-2">
            <div className="px-3 py-1 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <span className="text-sm font-bold text-green-700 dark:text-green-300">
                <CheckOutlined /> {stats.got}
              </span>
            </div>
            <div className="px-3 py-1 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <span className="text-sm font-bold text-orange-700 dark:text-orange-300">
                <FlagOutlined /> {stats.practice}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary to-indigo-600 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Flashcard */}
      <div className="relative perspective-1000">
        <div
          onClick={toggleFlip}
          className={`card min-h-[400px] cursor-pointer transition-all duration-500 transform ${
            flipped ? 'rotate-y-180' : ''
          } ${transitioning ? 'opacity-50 scale-95' : 'hover:scale-102 active:scale-98'}`}
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* Front (Question) */}
          <div
            className={`absolute inset-0 p-8 flex flex-col items-center justify-center text-center ${
              flipped ? 'invisible' : 'visible'
            }`}
            style={{ backfaceVisibility: 'hidden' }}
          >
            <div className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mb-6">
              <InteractionOutlined className="text-3xl text-primary" />
            </div>
            <h3 className="text-2xl font-black text-ink dark:text-white mb-4">{questionText}</h3>
            <p className="text-sm text-ink-light dark:text-slate-400 flex items-center gap-2">
              <InteractionOutlined className="animate-pulse" />
              {t('Toca para ver la respuesta', 'Tap to reveal answer')}
            </p>
          </div>

          {/* Back (Answer) */}
          <div
            className={`absolute inset-0 p-8 flex flex-col items-center justify-center text-center ${
              flipped ? 'visible' : 'invisible'
            }`}
            style={{
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
          >
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-6">
              <CheckCircleOutlined className="text-3xl text-green-600 dark:text-green-400" />
            </div>
            <p className="text-lg leading-relaxed text-ink dark:text-white font-medium">{answerText}</p>
          </div>
        </div>
      </div>

      {/* Action buttons (only show when flipped) */}
      {flipped && (
        <div className="grid grid-cols-2 gap-4 animate-fade-in">
          <button
            onClick={() => handleReview('need_practice')}
            disabled={transitioning}
            className="px-6 py-4 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <FlagOutlined />
            {t('Necesito practicar', 'Need practice')}
          </button>
          <button
            onClick={() => handleReview('got_it')}
            disabled={transitioning}
            className="px-6 py-4 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <CheckOutlined />
            {t('¡La sé!', 'Got it!')}
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------
function FlashcardsContent() {
  const { user, t } = useAuth()
  const toast = useToast()

  // ── State ──────────────────────────────────────────────────────────────
  const [decks, setDecks] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDeck, setSelectedDeck] = useState(null)

  const lang = user?.preferences?.language || 'es'

  // ── Fetch available decks ──────────────────────────────────────────────
  useEffect(() => {
    const fetchDecks = async () => {
      try {
        const res = await fetch(API_ENDPOINTS.DECKS)
        if (!res.ok) throw new Error(t('Error al cargar temas', 'Failed to load topics'))

        const data = await res.json()
        setDecks(data.decks || [])
      } catch (err) {
        console.error('[flashcards] Decks fetch error:', err)
        toast?.error?.(t('Error', 'Error'), err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchDecks()
  }, [t, toast])

  // ── Handle deck selection ──────────────────────────────────────────────
  const handleSelectDeck = useCallback((deck) => {
    setSelectedDeck(deck)
  }, [])

  const handleBackToDecks = useCallback(() => {
    setSelectedDeck(null)
  }, [])

  // ── If deck selected, show flashcard practice ──────────────────────────
  if (selectedDeck) {
    return <FlashcardDeck deck={selectedDeck} lang={lang} onBack={handleBackToDecks} />
  }

  // ── Loading state ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-ink-light dark:text-slate-400 text-sm">
          {t('Cargando temas...', 'Loading topics...')}
        </p>
      </div>
    )
  }

  // ── Deck selection view ────────────────────────────────────────────────
  return (
    <div className="container-wrapper max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl md:text-3xl font-black text-ink dark:text-white mb-2">
          {t('Tarjetas de Estudio', 'Study Flashcards')}
        </h1>
        <p className="text-sm text-ink-light dark:text-slate-400">
          {t(
            'Memorización inteligente con repetición espaciada',
            'Smart memorization with spaced repetition'
          )}
        </p>
      </div>

      {/* Info card */}
      <div className="card bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800">
        <div className="flex items-start gap-3">
          <IdcardOutlined className="text-2xl text-indigo-600 dark:text-indigo-400 shrink-0 mt-1" />
          <div>
            <h3 className="font-bold text-indigo-900 dark:text-indigo-200 mb-1">
              {t('¿Cómo funciona?', 'How does it work?')}
            </h3>
            <p className="text-sm text-indigo-700 dark:text-indigo-300 leading-relaxed">
              {t(
                'Revisa cada tarjeta y marca si la sabes o necesitas practicar. El sistema priorizará las tarjetas que necesitan más repaso.',
                'Review each card and mark if you know it or need practice. The system will prioritize cards that need more review.'
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Deck grid */}
      {decks.length === 0 ? (
        <div className="card text-center py-12">
          <BookOutlined className="text-5xl text-slate-300 dark:text-slate-700 mb-4" />
          <h3 className="text-lg font-black text-ink dark:text-white mb-2">
            {t('No hay temas disponibles', 'No topics available')}
          </h3>
          <p className="text-sm text-ink-light dark:text-slate-400">
            {t('Vuelve más tarde o contacta soporte', 'Come back later or contact support')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {decks.map((deck, index) => (
            <button
              key={index}
              onClick={() => handleSelectDeck(deck.tag || deck.name)}
              className="card text-left hover:scale-105 active:scale-95 transition-all hover:shadow-lg group"
            >
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center text-white text-xl shrink-0 group-hover:scale-110 transition-transform">
                  <BookOutlined />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-ink dark:text-white mb-1 truncate">
                    {deck.name || deck.tag}
                  </h3>
                  <p className="text-xs text-ink-light dark:text-slate-400">
                    {deck.cardCount || 0} {t('tarjetas', 'cards')}
                  </p>
                </div>
                <ArrowRightOutlined className="text-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page Export
// ---------------------------------------------------------------------------
export default function FlashcardsPage() {
  return (
    <AppShell>
      <FlashcardsContent />
    </AppShell>
  )
}
