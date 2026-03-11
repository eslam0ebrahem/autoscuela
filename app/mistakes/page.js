'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'

function MistakeBank() {
  const router = useRouter()
  const { t } = useAuth()
  const [mistakes, setMistakes] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [topicFilter, setTopicFilter] = useState(null)
  const [difficultyFilter, setDifficultyFilter] = useState(null)
  const [correctedOnly, setCorrectedOnly] = useState(false)
  const [practiceLoading, setPracticeLoading] = useState(false)
  const [topics, setTopics] = useState([])

  const limit = 15

  useEffect(() => {
    // Fetch unique topics for filter
    fetch('/api/flashcards/decks')
      .then((r) => r.json())
      .then((d) => setTopics(d.decks || []))
  }, [])

  useEffect(() => {
    const query = new URLSearchParams({
      page,
      limit,
      ...(topicFilter && { topic: topicFilter }),
      ...(difficultyFilter && { difficulty: difficultyFilter }),
      ...(correctedOnly !== null && { corrected: !correctedOnly }), // Get uncorrected by default
    })

    fetch(`/api/mistakes?${query}`)
      .then((r) => r.json())
      .then((d) => {
        setMistakes(d.mistakes || [])
        setStats(d.stats)
        setTotalPages(d.totalPages)
        setLoading(false)
      })
  }, [page, topicFilter, difficultyFilter, correctedOnly])

  const handlePracticeMistakes = async () => {
    setPracticeLoading(true)
    try {
      const res = await fetch('/api/mistakes/practice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic_filter: topicFilter,
          difficulty_filter: difficultyFilter,
          count: 30,
        }),
      })
      const data = await res.json()
      if (data.sessionId) {
        router.push(`/exam/${data.sessionId}`)
      }
    } finally {
      setPracticeLoading(false)
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="text-4xl animate-spin-slow">❌</div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">{t('Banco de Errores', 'Mistake Bank')}</h1>
          <p className="text-ink-light">{t('Revisa y practica tus respuestas incorrectas', 'Review and practice your incorrect answers')}</p>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="card">
              <div className="text-sm text-ink-light">{t('Total Errores', 'Total Mistakes')}</div>
              <div className="text-3xl font-bold text-danger">{stats.totalMistakes}</div>
            </div>
            <div className="card">
              <div className="text-sm text-ink-light">{t('Sin Corregir', 'Uncorrected')}</div>
              <div className="text-3xl font-bold text-warning">{stats.uncorrectedCount}</div>
            </div>
            <div className="card">
              <div className="text-sm text-ink-light">{t('Tasa Corrección', 'Correction Rate')}</div>
              <div className="text-3xl font-bold text-success">{stats.correctionRate}%</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="card mb-6 p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="label">{t('Tema', 'Topic')}</label>
              <select
                value={topicFilter || ''}
                onChange={(e) => {
                  setTopicFilter(e.target.value || null)
                  setPage(1)
                }}
                className="input w-full"
              >
                <option value="">{t('Todos', 'All')}</option>
                {topics.map((t) => (
                  <option key={t.tag} value={t.tag}>
                    {t.tag}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">{t('Dificultad', 'Difficulty')}</label>
              <select
                value={difficultyFilter || ''}
                onChange={(e) => {
                  setDifficultyFilter(e.target.value || null)
                  setPage(1)
                }}
                className="input w-full"
              >
                <option value="">{t('Todos', 'All')}</option>
                <option value="easy">{t('Fácil', 'Easy')}</option>
                <option value="medium">{t('Medio', 'Medium')}</option>
                <option value="hard">{t('Difícil', 'Hard')}</option>
              </select>
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={correctedOnly}
                  onChange={(e) => {
                    setCorrectedOnly(e.target.checked)
                    setPage(1)
                  }}
                  className="w-4 h-4"
                />
                <span className="text-sm">{t('Solo Sin Corregir', 'Uncorrected Only')}</span>
              </label>
            </div>

            <div className="flex items-end">
              <button
                onClick={handlePracticeMistakes}
                disabled={mistakes.length === 0 || practiceLoading}
                className="btn-primary w-full disabled:opacity-50"
              >
                {practiceLoading ? '⏳' : '🎯'} {t('Practicar', 'Practice')}
              </button>
            </div>
          </div>
        </div>

        {/* Questions List */}
        <div className="space-y-3">
          {mistakes.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-ink-light">{t('No hay errores que mostrar', 'No mistakes to show')}</p>
            </div>
          ) : (
            mistakes.map((m) => (
              <div key={m.questionId.toString()} className="card p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-start gap-3 mb-2">
                      <button
                        onClick={() => setExpandedId(expandedId === m.questionId.toString() ? null : m.questionId.toString())}
                        className="text-lg font-semibold text-ink flex-1 text-left hover:text-primary"
                      >
                        {expandedId === m.questionId.toString() ? '▼' : '▶'}{' '}
                        {m.question.es.substring(0, 80)}...
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className="badge-pill bg-blue-100 dark:bg-blue-900 text-sm">{m.topic}</span>
                      <span
                        className={`badge-pill text-sm ${
                          m.difficulty === 'easy'
                            ? 'bg-green-100 dark:bg-green-900'
                            : m.difficulty === 'medium'
                              ? 'bg-yellow-100 dark:bg-yellow-900'
                              : 'bg-red-100 dark:bg-red-900'
                        }`}
                      >
                        {m.difficulty}
                      </span>
                      {m.isCorrected && <span className="badge-pill bg-green-100 dark:bg-green-900 text-sm">✓ {t('Corregido', 'Corrected')}</span>}
                      <span className="badge-pill bg-slate-100 dark:bg-slate-700 text-sm">{t('Errado', 'Wrong')} {m.timesWrong}x</span>
                    </div>
                  </div>
                </div>

                {expandedId === m.questionId.toString() && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="mb-4">
                      <h3 className="font-semibold mb-2 text-ink">{t('Pregunta', 'Question')}</h3>
                      <p className="text-ink-light">{m.question.es}</p>
                      {m.metadata?.image_url && (
                        <img
                          src={m.metadata.image_url}
                          alt="question"
                          className="mt-3 max-w-sm rounded border border-border"
                        />
                      )}
                    </div>

                    <div className="mb-4">
                      <h3 className="font-semibold mb-2 text-ink">{t('Opciones', 'Options')}</h3>
                      <div className="space-y-2">
                        {m.options.map((opt, i) => (
                          <div
                            key={i}
                            className={`p-2 rounded border ${
                              opt.idx === m.options.find((o) => o.correct)?.idx
                                ? 'border-success bg-success/10'
                                : 'border-border'
                            }`}
                          >
                            <span className="font-semibold">{String.fromCharCode(65 + i)}.</span> {opt.text_es}
                          </div>
                        ))}
                      </div>
                    </div>

                    {m.metadata?.help_html && (
                      <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                        <h3 className="font-semibold mb-2 text-sm text-ink">{t('Explicación', 'Explanation')}</h3>
                        <div
                          className="text-sm text-ink-light prose-sm"
                          dangerouslySetInnerHTML={{ __html: m.metadata.help_html }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex justify-center gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="btn-secondary disabled:opacity-50"
            >
              ← {t('Anterior', 'Previous')}
            </button>
            <span className="flex items-center px-4 text-sm">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="btn-secondary disabled:opacity-50"
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
