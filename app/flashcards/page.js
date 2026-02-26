'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/components/AuthContext'

function FlashcardDeck({ deck, lang, onBack }) {
  const { t } = useAuth()
  const [cards, setCards] = useState([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ got: 0, practice: 0 })
  const [done, setDone] = useState(false)

  useEffect(() => {
    fetch(`/api/flashcards/practice${deck ? `?deck=${encodeURIComponent(deck)}` : ''}`)
      .then((r) => r.json())
      .then((d) => {
        setCards(d.cards || [])
        setLoading(false)
      })
  }, [deck])

  const currentCard = cards[currentIdx]

  const handleReview = async (status) => {
    try {
      await fetch('/api/flashcards/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ card_id: currentCard._id, status }),
      })
    } catch (e) { }

    setStats((s) => ({ ...s, [status === 'got_it' ? 'got' : 'practice']: s[status === 'got_it' ? 'got' : 'practice'] + 1 }))

    if (currentIdx < cards.length - 1) {
      setCurrentIdx((i) => i + 1)
      setFlipped(false)
    } else {
      setDone(true)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-4xl animate-bounce">🃏</div>
      </div>
    )
  }

  if (done || cards.length === 0) {
    return (
      <div className="text-center py-12 animate-scale-in">
        <div className="text-6xl mb-4">{cards.length === 0 ? '🎉' : '✅'}</div>
        <h2 className="text-2xl font-bold text-ink mb-4">
          {cards.length === 0 ? t('¡No hay tarjetas pendientes!', 'No cards due!') : t('¡Sesión completada!', 'Session complete!')}
        </h2>
        {done && (
          <div className="flex justify-center gap-6 mb-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-success">{stats.got}</div>
              <div className="text-sm text-ink-light">{t('Sabidas', 'Got it')}</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-warning">{stats.practice}</div>
              <div className="text-sm text-ink-light">{t('A repasar', 'Need practice')}</div>
            </div>
          </div>
        )}
        <button onClick={onBack} className="btn-primary">
          {t('← Volver a mazos', '← Back to decks')}
        </button>
      </div>
    )
  }

  const questionText = lang === 'en' ? currentCard.question?.en : currentCard.question?.es
  const answerOpt = currentCard.options?.find(o => o.idx === currentCard.correct_option_idx)
  const answerText = lang === 'en' ? answerOpt?.text_en : answerOpt?.text_es

  return (
    <div className="max-w-lg mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-ink-light hover:text-ink">
          ← {t('Mazos', 'Decks')}
        </button>
        <span className="text-sm font-medium text-ink-light">
          {currentIdx + 1} / {cards.length}
        </span>
      </div>

      {/* Progress */}
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${(currentIdx / cards.length) * 100}%` }} />
      </div>

      {/* Flip card */}
      <div className={`flip-card h-64 cursor-pointer`} style={{ height: '280px' }} onClick={() => setFlipped(!flipped)}>
        <div className={`flip-card-inner h-full ${flipped ? 'flipped' : ''}`}>
          {/* Front */}
          <div className="flip-card-front card flex flex-col items-center justify-center text-center p-8 h-full">
            {currentCard.metadata?.image_url && (
              <img
                src={currentCard.metadata.image_url}
                alt="card"
                className="max-h-24 object-contain mb-4 rounded-lg"
              />
            )}
            <p className="text-lg font-semibold text-ink leading-relaxed">{questionText}</p>
            <p className="text-sm text-ink-light mt-4">{t('Toca para ver la respuesta', 'Tap to reveal answer')}</p>
          </div>

          {/* Back */}
          <div className="flip-card-back card flex flex-col items-center justify-center text-center p-8 h-full bg-gradient-to-br from-blue-50 to-purple-50 border-primary">
            <div className="text-3xl mb-3">✓</div>
            <p className="text-xl font-bold text-primary">{answerText}</p>
            <p className="text-xs text-ink-light mt-3">
              {t('Tema:', 'Topic:')} {lang === 'en' ? currentCard.topic_tag?.en || currentCard.topic_tag?.es : currentCard.topic_tag?.es}
            </p>
          </div>
        </div>
      </div>

      {/* Buttons (only show after flip) */}
      {flipped && (
        <div className="grid grid-cols-2 gap-4 animate-slide-up">
          <button
            onClick={() => handleReview('needs_practice')}
            className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-warning bg-amber-50 text-warning font-bold hover:bg-amber-100 transition-all active:scale-95"
          >
            <span className="text-2xl">🔄</span>
            {t('A repasar', 'Need practice')}
          </button>
          <button
            onClick={() => handleReview('got_it')}
            className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-success bg-emerald-50 text-success font-bold hover:bg-emerald-100 transition-all active:scale-95"
          >
            <span className="text-2xl">✓</span>
            {t('¡Lo sé!', 'Got it!')}
          </button>
        </div>
      )}
    </div>
  )
}

function FlashcardsContent() {
  const { user, t } = useAuth()
  const [decks, setDecks] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeDeck, setActiveDeck] = useState(null)
  const [started, setStarted] = useState(false)
  const lang = user?.preferences?.language || 'es'

  useEffect(() => {
    fetch('/api/flashcards/decks')
      .then((r) => r.json())
      .then((d) => { setDecks(d.decks || []); setLoading(false) })
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
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-ink">🃏 {t('Tarjetas de Memoria', 'Flashcards')}</h1>
        <p className="text-ink-light mt-1">{t('Repite lo que necesitas, cuando más lo necesitas', 'Review what you need, when you need it most')}</p>
      </div>

      {/* All cards deck */}
      <button
        onClick={() => { setActiveDeck(null); setStarted(true) }}
        className="card-hover w-full text-left block"
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-primary rounded-2xl flex items-center justify-center text-2xl">
            🔀
          </div>
          <div>
            <h3 className="font-bold text-ink text-lg">{t('Todas las tarjetas', 'All cards')}</h3>
            <p className="text-ink-light text-sm">{t('Mezcla de todos los temas con repetición espaciada', 'Mix of all topics with spaced repetition')}</p>
          </div>
          <svg className="ml-auto w-5 h-5 text-ink-light" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </button>

      {/* Topic decks */}
      <div>
        <h2 className="font-bold text-lg text-ink mb-4">{t('Mazos por tema', 'Topic decks')}</h2>
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-24 bg-white rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {decks.map(({ tag, count }) => (
              <button
                key={tag.es}
                onClick={() => { setActiveDeck(tag.es); setStarted(true) }}
                className="card-hover p-4 text-left"
              >
                <div className="text-2xl mb-2">📚</div>
                <h3 className="font-bold text-ink text-sm leading-tight">{lang === 'en' ? tag.en || tag.es : tag.es}</h3>
                <p className="text-xs text-ink-light mt-1">{count} {t('tarjetas', 'cards')}</p>
              </button>
            ))}
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
