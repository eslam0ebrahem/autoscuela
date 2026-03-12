'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/components/AuthContext'
import DOMPurify from 'dompurify'

// Properly use DOMPurify to prevent XSS attacks when rendering explanations
function sanitizeHtml(html) {
  if (typeof window === 'undefined') return ''
  return DOMPurify.sanitize(html)
}

function MistakeBank() {
  const router = useRouter()
  const { t } = useAuth()
  
  // Data State
  const [mistakes, setMistakes] = useState([])
  const [stats, setStats] = useState(null)
  const [topics, setTopics] = useState([])
  
  // UI State
  const [loading, setLoading] = useState(true)
  const [practiceLoading, setPracticeLoading] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  
  // Filter & Pagination State
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [topicFilter, setTopicFilter] = useState(null)
  const [difficultyFilter, setDifficultyFilter] = useState(null)
  const [correctedOnly, setCorrectedOnly] = useState(false)

  const limit = 15

  // 1. Fetch available topics for the filter dropdown
  useEffect(() => {
    fetch('/api/flashcards/decks')
      .then((r) => r.ok ? r.json() : { decks: [] })
      .then((d) => setTopics(d.decks || []))
      .catch(console.error)
  }, [])

  // 2. Fetch mistakes based on current filters and pagination
  useEffect(() => {
    setLoading(true)
    
    const query = new URLSearchParams({
      page,
      limit,
      ...(topicFilter && { topic: topicFilter }),
      ...(difficultyFilter && { difficulty: difficultyFilter }),
      // API expects "corrected" boolean. By default, user wants to see uncorrected (false).
      ...(correctedOnly !== null && { corrected: !correctedOnly }), 
    })

    fetch(`/api/mistakes?${query}`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to fetch mistakes')
        return r.json()
      })
      .then((d) => {
        setMistakes(d.mistakes || [])
        setStats(d.stats || null)
        setTotalPages(d.totalPages || 1)
      })
      .catch((err) => {
        console.error('Error loading mistake bank:', err)
        setMistakes([])
      })
      .finally(() => {
        setLoading(false)
      })
  }, [page, topicFilter, difficultyFilter, correctedOnly])

  // 3. Launch a practice exam using the current filters
  const handlePracticeMistakes = async () => {
    setPracticeLoading(true)
    try {
      const res = await fetch('/api/mistakes/practice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic_filter: topicFilter,
          difficulty_filter: difficultyFilter,
          count: 30, // Max 30 questions for practice mode
        }),
      })
      
      const data = await res.json()
      
      if (res.ok && data.sessionId) {
        router.push(`/exam/${data.sessionId}`)
      } else {
        alert(data.error || t('Error al iniciar práctica', 'Error starting practice session'))
      }
    } catch (err) {
      console.error(err)
      alert(t('Hubo un problema de conexión', 'Connection error'))
    } finally {
      setPracticeLoading(false)
    }
  }

  // ==== RENDER: LOADING ====
  if (loading && !mistakes.length) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
             <div className="text-4xl animate-bounce mb-4" role="img" aria-label="Loading">📚</div>
             <p className="text-ink-light dark:text-slate-400 font-medium">
               {t('Cargando banco de errores...', 'Loading mistake bank...')}
             </p>
          </div>
        </div>
      </AppShell>
    )
  }

  // ==== RENDER: MAIN INTERFACE ====
  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 animate-fade-in pb-16">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold mb-2 text-ink dark:text-white">
            {t('Banco de Errores', 'Mistake Bank')}
          </h1>
          <p className="text-ink-light dark:text-slate-400">
            {t('Revisa y practica tus respuestas incorrectas para dominarlas.', 'Review and practice your incorrect answers to master them.')}
          </p>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            <div className="card bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-center py-6">
              <div className="text-sm font-medium uppercase tracking-wide text-ink-light dark:text-slate-400 mb-1">
                {t('Total Errores', 'Total Mistakes')}
              </div>
              <div className="text-4xl font-bold text-danger">{stats.totalMistakes}</div>
            </div>
            <div className="card bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-center py-6">
              <div className="text-sm font-medium uppercase tracking-wide text-ink-light dark:text-slate-400 mb-1">
                {t('Sin Corregir', 'Uncorrected')}
              </div>
              <div className="text-4xl font-bold text-warning">{stats.uncorrectedCount}</div>
            </div>
            <div className="card bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-center py-6 col-span-2 md:col-span-1">
              <div className="text-sm font-medium uppercase tracking-wide text-ink-light dark:text-slate-400 mb-1">
                {t('Tasa Corrección', 'Correction Rate')}
              </div>
              <div className="text-4xl font-bold text-success">{stats.correctionRate}%</div>
            </div>
          </div>
        )}

        {/* Filters Panel */}
        <div className="card mb-8 p-5 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
            
            <div className="flex flex-col gap-1.5">
              <label htmlFor="topic-filter" className="label text-sm font-medium text-ink-light dark:text-slate-300">
                {t('Tema', 'Topic')}
              </label>
              <select
                id="topic-filter"
                value={topicFilter || ''}
                onChange={(e) => {
                  setTopicFilter(e.target.value || null)
                  setPage(1)
                }}
                className="input w-full bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary outline-none"
              >
                <option value="">{t('Todos los temas', 'All topics')}</option>
                {topics.map((t) => (
                  <option key={t.tag} value={t.tag}>{t.tag}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="diff-filter" className="label text-sm font-medium text-ink-light dark:text-slate-300">
                {t('Dificultad', 'Difficulty')}
              </label>
              <select
                id="diff-filter"
                value={difficultyFilter || ''}
                onChange={(e) => {
                  setDifficultyFilter(e.target.value || null)
                  setPage(1)
                }}
                className="input w-full bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary outline-none"
              >
                <option value="">{t('Todas', 'All')}</option>
                <option value="easy">{t('Fácil', 'Easy')}</option>
                <option value="medium">{t('Medio', 'Medium')}</option>
                <option value="hard">{t('Difícil', 'Hard')}</option>
              </select>
            </div>

            <div className="flex h-[42px] items-center">
              <label className="flex items-center gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={correctedOnly}
                  onChange={(e) => {
                    setCorrectedOnly(e.target.checked)
                    setPage(1)
                  }}
                  className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary dark:border-slate-600 dark:bg-slate-800 cursor-pointer"
                />
                <span className="text-sm font-medium text-ink dark:text-slate-200 group-hover:text-primary transition-colors">
                  {t('Ocultar ya corregidos', 'Hide corrected')}
                </span>
              </label>
            </div>

            <button
              type="button"
              onClick={handlePracticeMistakes}
              disabled={mistakes.length === 0 || practiceLoading}
              className="btn-primary w-full h-[42px] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {practiceLoading ? (
                <span className="animate-pulse">{t('Preparando...', 'Preparing...')}</span>
              ) : (
                <>
                  <span aria-hidden="true">🎯</span> {t('Practicar Errores', 'Practice Mistakes')}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Questions List */}
        <div className="space-y-4 relative min-h-[200px]">
          
          {/* Transparent loading overlay when changing pages */}
          {loading && mistakes.length > 0 && (
             <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm z-10 flex items-center justify-center rounded-xl">
               <div className="text-2xl animate-spin">⏳</div>
             </div>
          )}

          {mistakes.length === 0 && !loading ? (
            <div className="card text-center py-16 bg-white dark:bg-slate-800 border-dashed border-2 border-slate-200 dark:border-slate-700">
              <div className="text-5xl mb-4" aria-hidden="true">🎉</div>
              <h3 className="text-xl font-bold text-ink dark:text-white mb-2">{t('¡Todo limpio!', 'All clear!')}</h3>
              <p className="text-ink-light dark:text-slate-400">
                {t('No tienes errores que coincidan con estos filtros.', 'You have no mistakes matching these filters.')}
              </p>
            </div>
          ) : (
            mistakes.map((m) => {
              const isExpanded = expandedId === m.questionId.toString()
              
              // Map difficulty to visual colors
              const diffColors = {
                easy: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400',
                medium: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400',
                hard: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'
              }

              return (
                <div key={m.questionId.toString()} className="card p-0 overflow-hidden bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-primary/50 transition-colors">
                  
                  {/* Collapsed View (Clickable Header) */}
                  <button
                    className="w-full text-left p-5 flex flex-col gap-3 focus:outline-none focus:bg-slate-50 dark:focus:bg-slate-700/50"
                    onClick={() => setExpandedId(isExpanded ? null : m.questionId.toString())}
                    aria-expanded={isExpanded}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`text-sm mt-0.5 transition-transform duration-200 ${isExpanded ? 'text-primary' : 'text-slate-400'}`}>
                        {isExpanded ? '▼' : '▶'}
                      </span>
                      <h3 className={`text-lg font-semibold leading-snug flex-1 ${isExpanded ? 'text-primary' : 'text-ink dark:text-white'}`}>
                        {m.question.es}
                      </h3>
                    </div>

                    <div className="flex flex-wrap gap-2 pl-6">
                      <span className="badge-pill bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold">
                        {m.topic}
                      </span>
                      
                      {m.difficulty && (
                        <span className={`badge-pill text-xs font-semibold ${diffColors[m.difficulty] || diffColors.medium}`}>
                          {m.difficulty.toUpperCase()}
                        </span>
                      )}
                      
                      <span className="badge-pill bg-red-50 dark:bg-red-900/20 text-danger text-xs font-semibold border border-red-100 dark:border-red-800/50">
                        {t('Fallado', 'Failed')} {m.timesWrong}x
                      </span>

                      {m.isCorrected && (
                        <span className="badge-pill bg-success/10 text-success text-xs font-semibold border border-success/20">
                          ✓ {t('Corregido', 'Corrected')}
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Expanded View (Details) */}
                  {isExpanded && (
                    <div className="px-5 pb-5 pt-2 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/20 animate-fade-in">
                      
                      {m.metadata?.image_url && (
                        <div className="mb-6 bg-white dark:bg-slate-900 rounded-xl p-2 inline-block border border-slate-200 dark:border-slate-700">
                          <img
                            src={m.metadata.image_url}
                            alt={t('Imagen de la pregunta', 'Question image')}
                            className="max-w-full sm:max-w-sm max-h-48 object-contain rounded-lg"
                          />
                        </div>
                      )}

                      <div className="mb-6">
                        <h4 className="font-bold text-sm uppercase tracking-wide text-ink-light dark:text-slate-400 mb-3">
                          {t('Opciones', 'Options')}
                        </h4>
                        <div className="space-y-2">
                          {m.options.map((opt, i) => {
                            const isCorrect = opt.idx === m.options.find((o) => o.correct)?.idx
                            
                            return (
                              <div
                                key={i}
                                className={`px-4 py-3 rounded-xl border-2 flex items-start gap-3 ${
                                  isCorrect
                                    ? 'border-success bg-success/10 text-success dark:text-green-400'
                                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-ink dark:text-slate-300 opacity-60'
                                }`}
                              >
                                <span className="font-bold">{String.fromCharCode(65 + i)}.</span> 
                                <span>{opt.text_es}</span>
                                {isCorrect && <span className="ml-auto font-bold text-lg" aria-label="Respuesta correcta">✓</span>}
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* Safely Rendered HTML Explanation */}
                      {m.metadata?.help_html && (
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800/50">
                          <h4 className="font-bold text-sm uppercase tracking-wide text-primary dark:text-blue-400 mb-2 flex items-center gap-2">
                            <span aria-hidden="true">💡</span> {t('Explicación Oficial DGT', 'Official DGT Explanation')}
                          </h4>
                          <div
                            className="text-sm text-ink-light dark:text-slate-300 leading-relaxed help-html"
                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(m.metadata.help_html) }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="mt-10 flex items-center justify-center gap-4">
            <button
              onClick={() => {
                setPage(Math.max(1, page - 1))
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
              disabled={page === 1 || loading}
              className="btn-secondary px-6 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ← {t('Anterior', 'Previous')}
            </button>
            <span className="font-medium text-ink-light dark:text-slate-400">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => {
                setPage(Math.min(totalPages, page + 1))
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
              disabled={page === totalPages || loading}
              className="btn-secondary px-6 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('Siguiente', 'Next')} →
            </button>
          </div>
        )}
      </div>
    </AppShell>
  )
}

export default MistakeBank