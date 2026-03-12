'use client'

import { useState, useEffect } from 'react'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/components/AuthContext'

// Helper to safely extract localized strings or raw string tags
const getLocalizedText = (obj, lang) => {
  if (!obj) return ''
  if (typeof obj === 'string') return obj
  if (lang === 'en' && obj.en) return obj.en
  return obj.es || obj.en || ''
}

function FlashcardDeck({ deck, lang, onBack }) {
  const { t } = useAuth()
  const [cards, setCards] = useState([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  
  const [stats, setStats] = useState({ got: 0, practice: 0 })
  const [done, setDone] = useState(false)
  const [transitioning, setTransitioning] = useState(false)

  useEffect(() => {
    let isMounted = true
    setLoading(true)

    const deckQuery = deck ? `?deck=${encodeURIComponent(deck)}` : ''
    
    fetch(`/api/flashcards/practice${deckQuery}`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to fetch flashcards')
        return r.json()
      })
      .then((d) => {
        if (isMounted) {
          setCards(d.cards || [])
          setLoading(false)
        }
      })
      .catch((err) => {
        console.error(err)
        if (isMounted) {
          setError(true)
          setLoading(false)
        }
      })

    return () => { isMounted = false }
  }, [deck])

  const handleReview = (status) => {
    if (transitioning) return
    setTransitioning(true)

    const currentCard = cards[currentIdx]

    // Fire API call in background (Optimistic UI)
    fetch('/api/flashcards/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ card_id: currentCard._id, status }),
    }).catch(err => console.error('Failed to save review:', err))

    // Update session stats
    setStats((s) => ({ 
      ...s, 
      [status === 'got_it' ? 'got' : 'practice']: s[status === 'got_it' ? 'got' : 'practice'] + 1 
    }))

    // Smooth transition: unflip first, then change content slightly after
    setFlipped(false)
    
    setTimeout(() => {
      if (currentIdx < cards.length - 1) {
        setCurrentIdx((i) => i + 1)
      } else {
        setDone(true)
      }
      setTransitioning(false)
    }, 200) // 200ms allows the card to start turning around before the text swaps
  }

  // ==== RENDER: LOADING & ERROR ====
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-4xl animate-bounce mb-4" role="img" aria-label="Loading">🃏</div>
          <p className="text-ink-light dark:text-slate-400 font-medium">{t('Preparando tarjetas...', 'Preparing cards...')}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12 animate-scale-in px-4">
        <div className="text-5xl mb-4" aria-hidden="true">⚠️</div>
        <h2 className="text-xl font-bold text-ink dark:text-white mb-4">
          {t('Error al cargar las tarjetas', 'Error loading flashcards')}
        </h2>
        <button type="button" onClick={onBack} className="btn-primary">
          {t('← Volver a mazos', '← Back to decks')}
        </button>
      </div>
    )
  }

  // ==== RENDER: SUMMARY / DONE ====
  if (done || cards.length === 0) {
    return (
      <div className="text-center py-16 px-4 animate-scale-in bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm max-w-lg mx-auto">
        <div className="text-6xl mb-6" aria-hidden="true">{cards.length === 0 ? '🎉' : '✅'}</div>
        <h2 className="text-2xl font-bold text-ink dark:text-white mb-6">
          {cards.length === 0 
            ? t('¡No hay tarjetas pendientes!', 'No cards due!') 
            : t('¡Sesión completada!', 'Session complete!')}
        </h2>
        
        {done && (
          <div className="flex justify-center gap-8 mb-8 p-6 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700/50">
            <div className="text-center">
              <div className="text-4xl font-black text-success dark:text-emerald-400">{stats.got}</div>
              <div className="text-xs font-bold uppercase tracking-wider text-ink-light dark:text-slate-400 mt-2">{t('Sabidas', 'Got it')}</div>
            </div>
            <div className="w-px bg-slate-200 dark:bg-slate-700"></div>
            <div className="text-center">
              <div className="text-4xl font-black text-warning dark:text-amber-400">{stats.practice}</div>
              <div className="text-xs font-bold uppercase tracking-wider text-ink-light dark:text-slate-400 mt-2">{t('A repasar', 'Need practice')}</div>
            </div>
          </div>
        )}
        <button type="button" onClick={onBack} className="btn-primary w-full sm:w-auto px-8">
          {t('← Volver a mazos', '← Back to decks')}
        </button>
      </div>
    )
  }

  // ==== RENDER: ACTIVE CARD ====
  const currentCard = cards[currentIdx]
  const questionText = getLocalizedText(currentCard.question, lang)
  const answerOpt = currentCard.options?.find(o => o.idx === currentCard.correct_option_idx)
  const answerText = answerOpt ? getLocalizedText({ es: answerOpt.text_es, en: answerOpt.text_en }, lang) : t('Respuesta no encontrada', 'Answer not found')
  const topicName = getLocalizedText(currentCard.topic_tag, lang)

  return (
    <div className="max-w-lg mx-auto space-y-6 animate-fade-in pb-12">
      
      {/* Header & Progress */}
      <div className="flex items-center justify-between mb-2">
        <button 
          type="button" 
          onClick={onBack} 
          className="text-ink-light dark:text-slate-400 hover:text-ink dark:hover:text-white font-medium transition-colors flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-primary rounded"
        >
          <span aria-hidden="true">←</span> {t('Mazos', 'Decks')}
        </button>
        <span className="text-sm font-bold text-ink-light dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
          {currentIdx + 1} / {cards.length}
        </span>
      </div>

      <div className="progress-bar bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
        <div 
          className="progress-fill bg-primary h-full transition-all duration-300 ease-out" 
          style={{ width: `${(currentIdx / cards.length) * 100}%` }} 
          role="progressbar"
          aria-valuenow={currentIdx + 1}
          aria-valuemin={1}
          aria-valuemax={cards.length}
        />
      </div>

      {/* Flip Card Container */}
      <div 
        className="flip-card perspective-1000 cursor-pointer outline-none group" 
        style={{ height: '320px' }} 
        onClick={() => setFlipped(!flipped)}
        role="button"
        tabIndex={0}
        aria-pressed={flipped}
        aria-label={t('Toca o presiona Enter para voltear la tarjeta', 'Tap or press Enter to flip card')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setFlipped(!flipped)
          }
        }}
      >
        <div className={`flip-card-inner relative w-full h-full transition-transform duration-500 transform-style-3d ${flipped ? 'rotate-y-180' : ''}`}>
          
          {/* Front */}
          <div className="flip-card-front card absolute inset-0 backface-hidden flex flex-col items-center justify-center text-center p-8 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 shadow-sm group-hover:border-primary/50 transition-colors">
            {currentCard.metadata?.image_url && (
              <img
                src={currentCard.metadata.image_url}
                alt={t('Imagen descriptiva', 'Descriptive image')}
                className="max-h-32 object-contain mb-6 rounded-lg bg-slate-50 dark:bg-slate-900 p-2"
              />
            )}
            <p className="text-lg sm:text-xl font-semibold text-ink dark:text-white leading-relaxed">
              {questionText}
            </p>
            <p className="text-sm font-medium text-primary dark:text-blue-400 mt-6 animate-pulse">
              {t('Toca para ver la respuesta', 'Tap to reveal answer')}
            </p>
          </div>

          {/* Back */}
          <div className="flip-card-back card absolute inset-0 backface-hidden rotate-y-180 flex flex-col items-center justify-center text-center p-8 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-2 border-primary shadow-lg">
            <div className="w-12 h-12 rounded-full bg-success/20 text-success flex items-center justify-center text-2xl mb-4" aria-hidden="true">✓</div>
            <p className="text-xl sm:text-2xl font-bold text-primary dark:text-blue-400 leading-snug">
              {answerText}
            </p>
            {topicName && (
              <div className="mt-6 inline-block px-3 py-1 bg-white/50 dark:bg-black/20 rounded-full border border-primary/20">
                <p className="text-xs font-medium text-ink-light dark:text-slate-300">
                  {t('Tema:', 'Topic:')} <span className="text-ink dark:text-white font-bold">{topicName}</span>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons (only visible when flipped) */}
      <div className={`grid grid-cols-2 gap-4 transition-all duration-300 ${flipped ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); handleReview('needs_practice'); }}
          disabled={!flipped || transitioning}
          className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-warning dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 text-warning dark:text-amber-500 font-bold hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-warning"
        >
          <span className="text-2xl" aria-hidden="true">🔄</span>
          {t('A repasar', 'Need practice')}
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); handleReview('got_it'); }}
          disabled={!flipped || transitioning}
          className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-success dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 text-success dark:text-emerald-500 font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-success"
        >
          <span className="text-2xl" aria-hidden="true">✓</span>
          {t('¡Lo sé!', 'Got it!')}
        </button>
      </div>
    </div>
  )
}

function FlashcardsContent() {
  const { user, t } = useAuth()
  const lang = user?.preferences?.language || 'es'
  
  const [decks, setDecks] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeDeck, setActiveDeck] = useState(null)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    let isMounted = true

    fetch('/api/flashcards/decks')
      .then((r) => r.ok ? r.json() : { decks: [] })
      .then((d) => { 
        if (isMounted) {
          setDecks(d.decks || [])
          setLoading(false) 
        }
      })
      .catch((err) => {
        console.error(err)
        if (isMounted) setLoading(false)
      })

    return () => { isMounted = false }
  }, [])

  if (started) {
    return (
      <FlashcardDeck
        deck={activeDeck}
        lang={lang}
        onBack={() => { setStarted(false); setActiveDeck(null) }}
      />
    )
  }

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <div>
        <h1 className="text-3xl font-bold text-ink dark:text-white flex items-center gap-3">
          <span aria-hidden="true">🃏</span> {t('Tarjetas de Memoria', 'Flashcards')}
        </h1>
        <p className="text-ink-light dark:text-slate-400 mt-2 text-lg">
          {t('Repite lo que necesitas, cuando más lo necesitas.', 'Review what you need, when you need it most.')}
        </p>
      </div>

      {/* Main Study Deck */}
      <button
        type="button"
        onClick={() => { setActiveDeck(null); setStarted(true) }}
        className="card-hover w-full text-left block bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center text-3xl shadow-lg shadow-blue-500/20">
            <span aria-hidden="true">🔀</span>
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-ink dark:text-white text-lg">{t('Todas las tarjetas', 'All cards')}</h3>
            <p className="text-ink-light dark:text-slate-400 text-sm mt-0.5">
              {t('Mezcla de todos los temas con repetición espaciada.', 'Mix of all topics with spaced repetition.')}
            </p>
          </div>
          <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </button>

      {/* Topic Decks */}
      <div>
        <h2 className="font-bold text-xl text-ink dark:text-white mb-5">
          {t('Mazos por tema', 'Topic decks')}
        </h2>
        
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-28 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : decks.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {decks.map(({ tag, count }) => {
              // Ensure we extract the string safely regardless of API format
              const rawTag = typeof tag === 'string' ? tag : tag.es
              const displayName = getLocalizedText(tag, lang)

              return (
                <button
                  key={rawTag}
                  type="button"
                  onClick={() => { setActiveDeck(rawTag); setStarted(true) }}
                  className="card-hover p-5 text-left bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 flex flex-col items-start focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <div className="text-3xl mb-3" aria-hidden="true">📚</div>
                  <h3 className="font-bold text-ink dark:text-white text-sm leading-tight flex-1">
                    {displayName}
                  </h3>
                  <p className="text-xs font-medium text-primary dark:text-blue-400 mt-3 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-md">
                    {count} {t('tarjetas', 'cards')}
                  </p>
                </button>
              )
            })}
          </div>
        ) : (
          <p className="text-ink-light dark:text-slate-400 italic">
            {t('No hay mazos disponibles en este momento.', 'No decks available at this moment.')}
          </p>
        )}
      </div>
    </div>
  )
}

export default function FlashcardsPage() {
  return (
    <AppShell requirePremium>
      <FlashcardsContent />
    </AppShell>
  )
}