'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/components/AuthContext'
import DOMPurify from 'dompurify'
import {
  AimOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  SettingOutlined,
  UpOutlined,
  DownOutlined,
  SmileOutlined,
  RightOutlined,
  BulbOutlined,
  LeftOutlined,
  CheckOutlined,
  FilterOutlined
} from '@ant-design/icons'

function sanitizeHtml(html) {
  if (typeof window === 'undefined') return ''
  return DOMPurify.sanitize(html)
}

const getLocalizedText = (obj, lang) => {
  if (!obj) return ''
  if (typeof obj === 'string') return obj
  if (lang === 'en' && (obj.en || obj.text_en)) return obj.en || obj.text_en
  return obj.es || obj.text_es || obj.en || obj.text_en || ''
}

function MistakeBank() {
  const router = useRouter()
  const { user, t } = useAuth()
  const lang = user?.preferences?.language || 'es'

  const [mistakes, setMistakes] = useState([])
  const [stats, setStats] = useState(null)
  const [topics, setTopics] = useState([])
  const [loading, setLoading] = useState(true)
  const [practiceLoading, setPracticeLoading] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [topicFilter, setTopicFilter] = useState(null)
  const [difficultyFilter, setDifficultyFilter] = useState(null)
  const [correctedOnly, setCorrectedOnly] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  const limit = 15

  useEffect(() => {
    fetch('/api/flashcards/decks')
      .then((r) => r.ok ? r.json() : { decks: [] })
      .then((d) => setTopics(d.decks || []))
      .catch(console.error)
  }, [])

  useEffect(() => {
    setLoading(true)
    const query = new URLSearchParams({
      page,
      limit,
      ...(topicFilter && { topic: topicFilter }),
      ...(difficultyFilter && { difficulty: difficultyFilter }),
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
      .finally(() => setLoading(false))
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

  const activeFiltersCount = [topicFilter, difficultyFilter, correctedOnly].filter(Boolean).length

  // ── LOADING ──
  if (loading && !mistakes.length) {
    return (
      <AppShell>
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-base-100">
          <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-base-content/50 animate-pulse">
            {t('Cargando tu panel...', 'Loading your dashboard...')}
          </p>
        </div>
      </AppShell>
    )
  }

  const diffColors = {
    easy:   'bg-success/10 text-success border-success/25',
    medium: 'bg-warning/10 text-warning border-warning/25',
    hard:   'bg-error/10 text-error border-error/25',
  }

  return (
    <AppShell>
      <div className="min-h-screen bg-base-100">
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-24 space-y-5">

          {/* ── Page Header ── */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black text-base-content">
                {t('Banco de Errores', 'Mistake Bank')}
              </h1>
              <p className="text-sm text-base-content/50 mt-0.5">
                {t(
                  'Revisa y practica tus respuestas incorrectas para dominarlas.',
                  'Review and practice your incorrect answers to master them.'
                )}
              </p>
            </div>
            <button
              onClick={handlePracticeMistakes}
              disabled={mistakes.length === 0 || practiceLoading}
              className="btn btn-primary btn-sm h-11 rounded-xl shrink-0 gap-2 px-4 flex items-center justify-center"
            >
              {practiceLoading
                ? <span className="loading loading-spinner loading-xs" />
                : <AimOutlined />}
              <span className="hidden sm:inline">
                {t('Practicar', 'Practice')}
              </span>
            </button>
          </div>

          {/* ── Stats Row ── */}
          {stats && (
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  label: t('Total', 'Total'),
                  value: stats.totalMistakes,
                  color: 'text-error',
                  bg: 'bg-error/5 border-error/15',
                  icon: <CloseCircleOutlined />,
                },
                {
                  label: t('Sin corregir', 'Uncorrected'),
                  value: stats.uncorrectedCount,
                  color: 'text-warning',
                  bg: 'bg-warning/5 border-warning/15',
                  icon: <ExclamationCircleOutlined />,
                },
                {
                  label: t('Corregidos', 'Corrected'),
                  value: `${stats.correctionRate}%`,
                  color: 'text-success',
                  bg: 'bg-success/5 border-success/15',
                  icon: <CheckCircleOutlined />,
                },
              ].map((s, i) => (
                <div key={i} className={`rounded-2xl border p-3 text-center ${s.bg}`}>
                  <div className="text-base mb-1 text-primary">{s.icon}</div>
                  <div className={`text-xl font-black ${s.color}`}>{s.value}</div>
                  <div className="text-[10px] text-base-content/50 mt-0.5 leading-tight">{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* ── Filter Toggle ── */}
          <div>
            <button
              onClick={() => setShowFilters(p => !p)}
              className="flex items-center gap-2 text-sm font-semibold text-base-content/70
                hover:text-base-content transition-colors"
            >
              <span className={`w-8 h-8 rounded-xl flex items-center justify-center border transition-colors
                ${showFilters || activeFiltersCount > 0
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'bg-base-200 border-base-300 text-base-content/50'}`}>
                <FilterOutlined />
              </span>
              {t('Filtros', 'Filters')}
              {activeFiltersCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-primary text-white text-[10px] font-black flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
              <span className="ml-auto text-base-content/30">{showFilters ? <UpOutlined /> : <DownOutlined />}</span>
            </button>

            {showFilters && (
              <div className="mt-3 rounded-2xl border border-base-200 bg-base-50 p-4 space-y-4">
                {/* Topic */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-base-content/50 uppercase tracking-wide">
                    {t('Tema', 'Topic')}
                  </label>
                  <select
                    value={topicFilter || ''}
                    onChange={(e) => { setTopicFilter(e.target.value || null); setPage(1) }}
                    className="select select-bordered select-sm w-full rounded-xl bg-base-100"
                  >
                    <option value="">{t('Todos los temas', 'All topics')}</option>
                    {topics.map((topic) => (
                      <option key={topic.tag} value={topic.tag}>
                        {lang === 'en' ? (topic.tagEn || topic.tag) : (topic.tag || topic.tagEn)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Difficulty */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-base-content/50 uppercase tracking-wide">
                    {t('Dificultad', 'Difficulty')}
                  </label>
                  <div className="flex gap-2">
                    {[
                      { value: null,     label: t('Todas', 'All'),       style: 'bg-base-200 border-base-300' },
                      { value: 'easy',   label: t('Fácil', 'Easy'),      style: 'bg-success/10 border-success/30 text-success' },
                      { value: 'medium', label: t('Medio', 'Medium'),    style: 'bg-warning/10 border-warning/30 text-warning' },
                      { value: 'hard',   label: t('Difícil', 'Hard'),    style: 'bg-error/10 border-error/30 text-error' },
                    ].map((opt) => (
                      <button
                        key={String(opt.value)}
                        onClick={() => { setDifficultyFilter(opt.value); setPage(1) }}
                        className={`flex-1 py-1.5 rounded-xl border text-xs font-bold transition-all
                          ${difficultyFilter === opt.value
                            ? opt.style + ' ring-2 ring-offset-1 ring-primary/30'
                            : 'bg-base-100 border-base-300 text-base-content/50 hover:border-base-400'}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Toggle corrected */}
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={correctedOnly}
                    onChange={(e) => { setCorrectedOnly(e.target.checked); setPage(1) }}
                    className="toggle toggle-primary toggle-sm"
                  />
                  <span className="text-sm font-medium text-base-content/80">
                    {t('Ocultar ya corregidos', 'Hide corrected')}
                  </span>
                </label>

                {/* Clear filters */}
                {activeFiltersCount > 0 && (
                  <button
                    onClick={() => {
                      setTopicFilter(null)
                      setDifficultyFilter(null)
                      setCorrectedOnly(false)
                      setPage(1)
                    }}
                    className="btn btn-ghost btn-xs text-error w-full flex items-center justify-center gap-2"
                  >
                    <CloseCircleOutlined /> {t('Limpiar filtros', 'Clear filters')}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── Questions List ── */}
          <div className="space-y-3 relative">
            {/* Page-change overlay */}
            {loading && mistakes.length > 0 && (
              <div className="absolute inset-0 bg-base-100/70 backdrop-blur-sm z-10 flex items-center justify-center rounded-2xl">
                <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
              </div>
            )}

            {/* Empty state */}
            {mistakes.length === 0 && !loading && (
              <div className="rounded-2xl border-2 border-dashed border-base-300 p-10 text-center">
                <div className="text-5xl mb-3 text-primary"><SmileOutlined /></div>
                <h3 className="font-bold text-base-content">
                  {t('¡Todo limpio!', 'All clear!')}
                </h3>
                <p className="text-sm text-base-content/50 mt-1">
                  {t(
                    'No tienes errores que coincidan con estos filtros.',
                    'You have no mistakes matching these filters.'
                  )}
                </p>
              </div>
            )}

            {mistakes.map((m) => {
              const isExpanded = expandedId === m.questionId.toString()
              return (
                <div
                  key={m.questionId.toString()}
                  className={`rounded-2xl border overflow-hidden transition-all
                    ${isExpanded ? 'border-primary/40 shadow-sm' : 'border-base-200 hover:border-base-300'}`}
                >
                  {/* ── Collapsed Header ── */}
                  <button
                    className="w-full text-left p-4 flex items-start gap-3 bg-base-100 active:bg-base-200 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : m.questionId.toString())}
                    aria-expanded={isExpanded}
                  >
                    {/* Chevron */}
                    <span className={`mt-0.5 text-xs shrink-0 transition-transform duration-200
                      ${isExpanded ? 'rotate-90 text-primary' : 'text-base-content/30'}`}>
                      <RightOutlined />
                    </span>

                    <div className="flex-1 min-w-0 space-y-2">
                      <p className={`text-sm font-semibold leading-snug
                        ${isExpanded ? 'text-primary' : 'text-base-content'}`}>
                        {getLocalizedText(m.question, lang)}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {/* Topic */}
                        <span className="px-2 py-0.5 rounded-full bg-base-200 text-base-content/60 text-[11px] font-semibold">
                          {lang === 'en' ? (m.topicEn || m.topic) : (m.topic || m.topicEn)}
                        </span>
                        {/* Difficulty */}
                        {m.difficulty && (
                          <span className={`px-2 py-0.5 rounded-full border text-[11px] font-bold ${diffColors[m.difficulty] || diffColors.medium}`}>
                            {m.difficulty === 'easy' ? t('Fácil', 'Easy') :
                             m.difficulty === 'medium' ? t('Medio', 'Medium') :
                             t('Difícil', 'Hard')}
                          </span>
                        )}
                        {/* Times wrong */}
                        <span className="px-2 py-0.5 rounded-full bg-error/10 border border-error/20 text-error text-[11px] font-bold">
                          {t('Fallado', 'Failed')} {m.timesWrong}×
                        </span>
                        {/* Corrected badge */}
                        {m.isCorrected && (
                          <span className="px-2 py-0.5 rounded-full bg-success/10 border border-success/20 text-success text-[11px] font-bold">
                            <CheckOutlined /> {t('Corregido', 'Corrected')}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>

                  {/* ── Expanded Detail ── */}
                  {isExpanded && (
                    <div className="border-t border-base-200 bg-base-50 p-4 space-y-4">
                      {/* Image */}
                      {m.metadata?.image_url && (
                        <div className="rounded-xl overflow-hidden border border-base-200">
                          <img
                            src={m.metadata.image_url}
                            alt={t('Imagen de la pregunta', 'Question image')}
                            className="w-full max-h-48 object-contain bg-base-100"
                          />
                        </div>
                      )}

                      {/* Options */}
                      <div>
                        <p className="text-[11px] font-bold text-base-content/40 uppercase tracking-widest mb-2">
                          {t('Opciones', 'Options')}
                        </p>
                        <div className="space-y-2">
                          {m.options.map((opt, i) => {
                            const isCorrect = opt.idx === m.options.find((o) => o.correct)?.idx
                            return (
                              <div
                                key={i}
                                className={`flex items-start gap-3 px-3 py-2.5 rounded-xl border-2 text-sm
                                  ${isCorrect
                                    ? 'border-success bg-success/10 text-success font-semibold'
                                    : 'border-base-200 bg-base-100 text-base-content/50'}`}
                              >
                                <span className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                                  ${isCorrect ? 'bg-success text-white' : 'bg-base-200 text-base-content/40'}`}>
                                  {String.fromCharCode(65 + i)}
                                </span>
                                <span className="leading-snug">{getLocalizedText(opt, lang)}</span>
                                {isCorrect && (
                                  <span className="ml-auto shrink-0 text-success font-bold"><CheckOutlined /></span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* Explanation */}
                      {m.metadata?.help_html && (
                        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                          <p className="text-[11px] font-bold text-primary uppercase tracking-widest mb-2 flex items-center gap-1.5">
                            <BulbOutlined /> {t('Explicación Oficial DGT', 'Official DGT Explanation')}
                          </p>
                          <div
                            className="text-sm text-base-content/80 leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(m.metadata.help_html) }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* ── Pagination ── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => { setPage(Math.max(1, page - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                disabled={page === 1 || loading}
                className="btn btn-ghost btn-sm rounded-xl border border-base-300 disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <LeftOutlined /> {t('Anterior', 'Prev')}
              </button>
              <span className="text-sm font-semibold text-base-content/50">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => { setPage(Math.min(totalPages, page + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                disabled={page === totalPages || loading}
                className="btn btn-ghost btn-sm rounded-xl border border-base-300 disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {t('Siguiente', 'Next')} <RightOutlined />
              </button>
            </div>
          )}

        </div>
      </div>
    </AppShell>
  )
}

export default MistakeBank
