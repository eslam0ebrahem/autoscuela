'use client'

import { useState, useEffect } from 'react'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/components/AuthContext'

const getLocalizedText = (obj, lang) => {
  if (!obj) return ''
  if (typeof obj === 'string') return obj
  if (lang === 'en' && obj.en) return obj.en
  return obj.es || obj.en || ''
}

// ── FlashcardDeck ──────────────────────────────────────────
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
      .then((r) => { if (!r.ok) throw new Error('Failed to fetch flashcards'); return r.json() })
      .then((d) => { if (isMounted) { setCards(d.cards || []); setLoading(false) } })
      .catch((err) => { console.error(err); if (isMounted) { setError(true); setLoading(false) } })
    return () => { isMounted = false }
  }, [deck])

  const handleReview = (status) => {
    if (transitioning) return
    setTransitioning(true)
    const currentCard = cards[currentIdx]
    fetch('/api/flashcards/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ card_id: currentCard._id, status }),
    }).catch(err => console.error('Failed to save review:', err))
    setStats((s) => ({
      ...s,
      [status === 'got_it' ? 'got' : 'practice']: s[status === 'got_it' ? 'got' : 'practice'] + 1,
    }))
    setFlipped(false)
    setTimeout(() => {
      if (currentIdx < cards.length - 1) setCurrentIdx((i) => i + 1)
      else setDone(true)
      setTransitioning(false)
    }, 200)
  }

  // ── LOADING ──
  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <p className="text-sm text-base-content/50 animate-pulse">
          {t('Preparando tarjetas...', 'Preparing cards...')}
        </p>
      </div>
    )
  }

  // ── ERROR ──
  if (error) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-4">
        <div className="text-5xl">⚠️</div>
        <h2 className="text-lg font-black text-base-content">
          {t('Error al cargar las tarjetas', 'Error loading flashcards')}
        </h2>
        <button onClick={onBack} className="btn btn-primary rounded-xl">
          {t('← Volver a mazos', '← Back to decks')}
        </button>
      </div>
    )
  }

  // ── DONE / EMPTY ──
  if (done || cards.length === 0) {
    const gotPct = stats.got + stats.practice > 0
      ? Math.round((stats.got / (stats.got + stats.practice)) * 100)
      : 0
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-3xl border border-base-200 bg-base-100 shadow-sm p-8 text-center space-y-6">
          <div className="text-6xl">{cards.length === 0 ? '🎉' : '🏁'}</div>
          <div>
            <h2 className="text-xl font-black text-base-content">
              {cards.length === 0
                ? t('¡No hay tarjetas pendientes!', 'No cards due!')
                : t('¡Sesión completada!', 'Session complete!')}
            </h2>
            {done && (
              <p className="text-sm text-base-content/50 mt-1">
                {t(`${stats.got + stats.practice} tarjetas revisadas`, `${stats.got + stats.practice} cards reviewed`)}
              </p>
            )}
          </div>

          {done && (
            <>
              {/* Score ring */}
              <div className="flex justify-center">
                <div className="relative w-24 h-24">
                  <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
                    <circle cx="48" cy="48" r="40" fill="none" stroke="currentColor"
                      strokeWidth="8" className="text-base-200" />
                    <circle cx="48" cy="48" r="40" fill="none"
                      stroke={gotPct >= 70 ? '#10b981' : '#f59e0b'}
                      strokeWidth="8" strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 40}
                      strokeDashoffset={2 * Math.PI * 40 * (1 - gotPct / 100)}
                      style={{ transition: 'stroke-dashoffset 1s ease' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-black text-base-content">{gotPct}%</span>
                  </div>
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-success/5 border border-success/20 p-3 text-center">
                  <div className="text-2xl font-black text-success">{stats.got}</div>
                  <div className="text-[11px] text-base-content/50 mt-0.5 font-semibold uppercase tracking-wide">
                    {t('Sabidas', 'Got it')}
                  </div>
                </div>
                <div className="rounded-2xl bg-warning/5 border border-warning/20 p-3 text-center">
                  <div className="text-2xl font-black text-warning">{stats.practice}</div>
                  <div className="text-[11px] text-base-content/50 mt-0.5 font-semibold uppercase tracking-wide">
                    {t('A repasar', 'Practice')}
                  </div>
                </div>
              </div>
            </>
          )}

          <button onClick={onBack} className="btn btn-primary w-full rounded-2xl h-12">
            {t('← Volver a mazos', '← Back to decks')}
          </button>
        </div>
      </div>
    )
  }

  // ── ACTIVE CARD ──
  const currentCard = cards[currentIdx]
  const questionText = getLocalizedText(currentCard.question, lang)
  const answerOpt = currentCard.options?.find(o => o.idx === currentCard.correct_option_idx)
  const answerText = answerOpt
    ? getLocalizedText({ es: answerOpt.text_es, en: answerOpt.text_en }, lang)
    : t('Respuesta no encontrada', 'Answer not found')
  const topicName = getLocalizedText(currentCard.topic_tag, lang)
  const progress = ((currentIdx) / cards.length) * 100

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-10 space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-xl bg-base-200 flex items-center justify-center
            text-base-content/60 hover:bg-base-300 transition-colors shrink-0"
        >
          ←
        </button>
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-base-content/40">
              {currentIdx + 1} / {cards.length}
            </span>
            <div className="flex items-center gap-3 text-xs font-semibold">
              <span className="text-success">✓ {stats.got}</span>
              <span className="text-warning">↺ {stats.practice}</span>
            </div>
          </div>
          {/* Progress bar */}
          <div className="h-1.5 rounded-full bg-base-200 overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
              role="progressbar"
              aria-valuenow={currentIdx + 1}
              aria-valuemin={1}
              aria-valuemax={cards.length}
            />
          </div>
        </div>
      </div>

      {/* ── Flip Card ── */}
      <div
        className="cursor-pointer select-none outline-none"
        style={{ perspective: '1200px', height: '320px' }}
        onClick={() => !transitioning && setFlipped(f => !f)}
        role="button"
        tabIndex={0}
        aria-pressed={flipped}
        aria-label={t('Toca o presiona Enter para voltear la tarjeta', 'Tap or press Enter to flip card')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); !transitioning && setFlipped(f => !f) }
        }}
      >
        <div
          className="relative w-full h-full transition-transform duration-500"
          style={{
            transformStyle: 'preserve-3d',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          {/* ── Front ── */}
          <div
            className="absolute inset-0 rounded-3xl border-2 border-base-200 bg-base-100
              flex flex-col items-center justify-center text-center p-7 shadow-sm
              hover:border-primary/40 hover:shadow-md transition-all"
            style={{ backfaceVisibility: 'hidden' }}
          >
            {currentCard.metadata?.image_url && (
              <img
                src={currentCard.metadata.image_url}
                alt={t('Imagen descriptiva', 'Descriptive image')}
                className="max-h-28 object-contain mb-5 rounded-xl bg-base-50 p-2"
              />
            )}
            <p className="text-base sm:text-lg font-semibold text-base-content leading-snug">
              {questionText}
            </p>
            <div className="mt-6 flex items-center gap-1.5 text-xs font-semibold text-primary animate-pulse">
              <span>👆</span>
              {t('Toca para ver la respuesta', 'Tap to reveal answer')}
            </div>
          </div>

          {/* ── Back ── */}
          <div
            className="absolute inset-0 rounded-3xl border-2 border-primary/50
              bg-gradient-to-br from-primary/8 to-purple-500/8
              flex flex-col items-center justify-center text-center p-7 shadow-md"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            <div className="w-11 h-11 rounded-full bg-success/15 text-success
              flex items-center justify-center text-xl mb-4 shrink-0">
              ✓
            </div>
            <p className="text-lg sm:text-xl font-black text-primary leading-snug">
              {answerText}
            </p>
            {topicName && (
              <span className="mt-5 px-3 py-1 rounded-full bg-base-100/70 border border-primary/20
                text-xs font-semibold text-base-content/60">
                {t('Tema:', 'Topic:')} <span className="text-base-content font-bold">{topicName}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Action Buttons (visible after flip) ── */}
      <div
        className={`grid grid-cols-2 gap-3 transition-all duration-300
          ${flipped ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'}`}
      >
        <button
          onClick={(e) => { e.stopPropagation(); handleReview('needs_practice') }}
          disabled={!flipped || transitioning}
          className="flex flex-col items-center gap-2 py-4 rounded-2xl border-2
            border-warning/50 bg-warning/5 text-warning font-bold text-sm
            hover:bg-warning/10 active:scale-95 transition-all"
        >
          <span className="text-2xl">🔄</span>
          {t('A repasar', 'Need practice')}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleReview('got_it') }}
          disabled={!flipped || transitioning}
          className="flex flex-col items-center gap-2 py-4 rounded-2xl border-2
            border-success/50 bg-success/5 text-success font-bold text-sm
            hover:bg-success/10 active:scale-95 transition-all"
        >
          <span className="text-2xl">✅</span>
          {t('¡Lo sé!', 'Got it!')}
        </button>
      </div>

      {/* Skip hint */}
      {!flipped && (
        <p className="text-center text-xs text-base-content/30">
          {t('Voltea la tarjeta para calificarla', 'Flip the card to rate it')}
        </p>
      )}
    </div>
  )
}

// ── FlashcardsContent (Deck Selector) ─────────────────────
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
      .then((d) => { if (isMounted) { setDecks(d.decks || []); setLoading(false) } })
      .catch((err) => { console.error(err); if (isMounted) setLoading(false) })
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
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-24 space-y-6">

      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-black text-base-content flex items-center gap-2">
          🃏 {t('Tarjetas de Memoria', 'Flashcards')}
        </h1>
        <p className="text-sm text-base-content/50 mt-1">
          {t('Repite lo que necesitas, cuando más lo necesitas.', 'Review what you need, when you need it most.')}
        </p>
      </div>

      {/* ── All Cards CTA ── */}
      <button
        onClick={() => { setActiveDeck(null); setStarted(true) }}
        className="w-full rounded-2xl border-2 border-primary/30 bg-gradient-to-r
          from-primary/10 to-purple-500/10 p-5 text-left
          hover:border-primary/60 active:scale-[0.98] transition-all"
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-purple-600
            flex items-center justify-center text-2xl shadow-lg shadow-primary/25 shrink-0">
            🔀
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-base text-base-content">
              {t('Todas las tarjetas', 'All cards')}
            </p>
            <p className="text-xs text-base-content/50 mt-0.5">
              {t('Mezcla de todos los temas con repetición espaciada.', 'Mix of all topics with spaced repetition.')}
            </p>
          </div>
          <span className="text-primary text-lg shrink-0">→</span>
        </div>
      </button>

      {/* ── Topic Decks ── */}
      <div>
        <h2 className="text-xs font-bold text-base-content/40 uppercase tracking-widest mb-3">
          {t('Mazos por tema', 'Topic decks')}
        </h2>

        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-28 rounded-2xl bg-base-200 animate-pulse" />
            ))}
          </div>
        ) : decks.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {decks.map(({ tag, count }) => {
              const rawTag = typeof tag === 'string' ? tag : tag.es
              const displayName = getLocalizedText(tag, lang)
              return (
                <button
                  key={rawTag}
                  onClick={() => { setActiveDeck(rawTag); setStarted(true) }}
                  className="rounded-2xl border border-base-200 bg-base-100 p-4 text-left
                    hover:border-primary/40 hover:shadow-sm active:scale-[0.97] transition-all"
                >
                  <div className="text-2xl mb-3">📚</div>
                  <p className="font-bold text-sm text-base-content leading-tight line-clamp-2">
                    {displayName}
                  </p>
                  <span className="inline-block mt-2 px-2 py-0.5 rounded-full
                    bg-primary/10 text-primary text-[11px] font-bold">
                    {count} {t('tarjetas', 'cards')}
                  </span>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-base-300 p-8 text-center">
            <p className="text-sm text-base-content/50">
              {t('No hay mazos disponibles en este momento.', 'No decks available at this moment.')}
            </p>
          </div>
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
