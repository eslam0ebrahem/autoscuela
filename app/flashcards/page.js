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

  if (loading) return <div className="flex h-96 items-center justify-center animate-pulse text-4xl">🃏</div>

  if (error) {
    return (
      <div className="max-w-md mx-auto text-center space-y-8 animate-scale-in">
        <div className="card glass p-12 space-y-6">
           <div className="text-5xl">⚠️</div>
           <h2 className="text-xl font-black">{t('Error al cargar', 'Error loading')}</h2>
           <button onClick={onBack} className="btn-primary w-full py-4 rounded-2xl font-black">{t('Volver', 'Go Back')}</button>
        </div>
      </div>
    )
  }

  if (done || cards.length === 0) {
    const gotPct = stats.got + stats.practice > 0
      ? Math.round((stats.got / (stats.got + stats.practice)) * 100)
      : 0
    return (
      <div className="max-w-md mx-auto text-center space-y-8 animate-scale-in">
        <div className="card glass p-12 space-y-6">
           <div className="text-7xl">{cards.length === 0 ? '🎉' : '🏁'}</div>
           <h2 className="text-3xl font-black">{cards.length === 0 ? t('¡Todo al día!', 'All caught up!') : t('¡Buen Trabajo!', 'Good Job!')}</h2>
           
           {done && (
             <>
               <div className="flex justify-center">
                 <div className="relative w-24 h-24">
                   <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
                     <circle cx="48" cy="48" r="40" fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-100 dark:text-slate-800" />
                     <circle cx="48" cy="48" r="40" fill="none" stroke={gotPct >= 70 ? '#10b981' : '#f59e0b'} strokeWidth="8" strokeLinecap="round" strokeDasharray={2 * Math.PI * 40} strokeDashoffset={2 * Math.PI * 40 * (1 - gotPct / 100)} className="transition-all duration-1000" />
                   </svg>
                   <div className="absolute inset-0 flex items-center justify-center font-black">{gotPct}%</div>
                 </div>
               </div>
               <div className="flex justify-center gap-8 py-6 bg-white dark:bg-slate-900 rounded-3xl">
                  <div>
                    <p className="text-3xl font-black text-success">{stats.got}</p>
                    <p className="text-[10px] font-black uppercase text-ink-light tracking-widest">{t('Sabidas', 'Learned')}</p>
                  </div>
                  <div className="w-px bg-slate-100 dark:bg-slate-800"></div>
                  <div>
                    <p className="text-3xl font-black text-warning">{stats.practice}</p>
                    <p className="text-[10px] font-black uppercase text-ink-light tracking-widest">{t('Repasar', 'Review')}</p>
                  </div>
               </div>
             </>
           )}
           <button onClick={onBack} className="btn-primary w-full py-4 rounded-2xl font-black">{t('Volver', 'Go Back')}</button>
        </div>
      </div>
    )
  }

  const currentCard = cards[currentIdx]
  const questionText = getLocalizedText(currentCard.question, lang)
  const answerOpt = currentCard.options?.find(o => o.idx === currentCard.correct_option_idx)
  const answerText = answerOpt ? getLocalizedText({ es: answerOpt.text_es, en: answerOpt.text_en }, lang) : '...'

  return (
    <div className="max-w-md mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
         <button onClick={onBack} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-ink-light">✕</button>
         <span className="text-[10px] font-black uppercase tracking-widest text-ink-light">{currentIdx + 1} / {cards.length}</span>
      </div>

      <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
         <div className="h-full bg-primary transition-all duration-500" style={{ width: `${cards.length > 0 ? ((currentIdx + 1) / cards.length) * 100 : 0}%` }} />
      </div>

      <div 
        className="flip-card cursor-pointer group h-[400px] outline-none" 
        onClick={() => !transitioning && setFlipped(!flipped)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); !transitioning && setFlipped(!flipped) } }}
      >
        <div className={`flip-card-inner relative w-full h-full transition-transform duration-500 transform-style-3d ${flipped ? 'rotate-y-180' : ''}`}>
          <div className="flip-card-front card absolute inset-0 backface-hidden flex flex-col items-center justify-center text-center p-8 border-4 border-slate-100 dark:border-slate-800 hover:border-primary/30 transition-colors">
            {currentCard.metadata?.image_url && <img src={currentCard.metadata.image_url} className="max-h-40 mb-8 rounded-2xl" />}
            <p className="text-xl md:text-2xl font-black leading-tight">{questionText}</p>
            <p className="absolute bottom-8 text-[10px] font-black uppercase tracking-widest text-primary animate-pulse">{t('Toca para ver', 'Tap to reveal')}</p>
          </div>
          <div className="flip-card-back card absolute inset-0 backface-hidden rotate-y-180 flex flex-col items-center justify-center text-center p-8 bg-gradient-to-br from-indigo-600 to-blue-700 text-white border-0 shadow-2xl">
            <p className="text-2xl md:text-3xl font-black leading-snug">{answerText}</p>
            <div className="mt-8 px-4 py-2 bg-white/20 backdrop-blur-md rounded-xl text-[10px] font-black uppercase tracking-widest">
              {getLocalizedText(currentCard.topic_tag, lang)}
            </div>
          </div>
        </div>
      </div>

      <div className={`grid grid-cols-2 gap-4 transition-all duration-300 ${flipped ? 'opacity-100' : 'opacity-0 pointer-events-none translate-y-4'}`}>
        <button onClick={(e) => { e.stopPropagation(); handleReview('needs_practice') }} className="flex flex-col items-center gap-2 p-6 rounded-3xl bg-red-50 dark:bg-red-900/20 text-danger border-2 border-red-100 dark:border-red-900/50">
           <span className="text-2xl">🔄</span>
           <span className="text-[10px] font-black uppercase tracking-widest">{t('Repasar', 'Review')}</span>
        </button>
        <button onClick={(e) => { e.stopPropagation(); handleReview('got_it') }} className="flex flex-col items-center gap-2 p-6 rounded-3xl bg-emerald-50 dark:bg-emerald-900/20 text-success border-2 border-emerald-100 dark:border-emerald-900/50">
           <span className="text-2xl">✓</span>
           <span className="text-[10px] font-black uppercase tracking-widest">{t('Lo sé', 'Got it')}</span>
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
    fetch('/api/flashcards/decks').then(r => r.json()).then(d => {
      setDecks(d.decks || [])
      setLoading(false)
    })
  }, [])

  if (started) return <FlashcardDeck deck={activeDeck} lang={lang} onBack={() => { setStarted(false); setActiveDeck(null) }} />

  return (
    <div className="space-y-10 animate-fade-in pb-12">
      <div className="text-center md:text-left">
        <h1 className="text-4xl font-black text-ink dark:text-white">{t('Tarjetas', 'Flashcards')}</h1>
        <p className="text-ink-light font-medium mt-2">{t('Memorización inteligente con repetición espaciada.', 'Smart memorization with spaced repetition.')}</p>
      </div>

      <button onClick={() => { setActiveDeck(null); setStarted(true) }} className="card bg-gradient-to-br from-indigo-600 to-blue-700 text-white border-0 shadow-2xl group flex items-center justify-between p-8">
         <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">🔀</div>
            <div className="text-left">
               <h3 className="text-2xl font-black">{t('Mezcla Global', 'Global Mix')}</h3>
               <p className="text-blue-100 font-medium">{t('Todos los temas en uno.', 'All topics in one.')}</p>
            </div>
         </div>
         <span className="text-4xl">→</span>
      </button>

      <div className="space-y-6">
        <h2 className="text-xl font-black">{t('Mazos por Tema', 'Topic Decks')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {decks.map(({ tag, count }) => (
            <button key={typeof tag === 'string' ? tag : tag.es} onClick={() => { setActiveDeck(typeof tag === 'string' ? tag : tag.es); setStarted(true) }} className="card glass p-6 flex items-center gap-4 group">
               <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-xl group-hover:bg-primary group-hover:text-white transition-colors">📚</div>
               <div className="flex-1 text-left">
                  <h4 className="font-black text-sm leading-tight">{getLocalizedText(tag, lang)}</h4>
                  <p className="text-[10px] font-black uppercase text-ink-light tracking-widest mt-1">{count} {t('tarjetas', 'cards')}</p>
               </div>
            </button>
          ))}
        </div>
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
