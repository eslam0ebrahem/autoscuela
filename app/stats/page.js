'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/components/AuthContext'

const getLocalizedText = (obj, lang) => {
  if (!obj) return ''
  if (typeof obj === 'string') return obj
  if (lang === 'en' && obj.en) return obj.en
  return obj.es || obj.en || ''
}

// ── TopicBar ───────────────────────────────────────────────
function TopicBar({ tag, accuracy, attempted, lang }) {
  const barColor  = accuracy >= 80 ? 'bg-success' : accuracy >= 60 ? 'bg-warning' : 'bg-error'
  const textColor = accuracy >= 80 ? 'text-success' : accuracy >= 60 ? 'text-warning' : 'text-error'

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-medium text-base-content truncate flex-1 min-w-0">
          {getLocalizedText(tag, lang)}
        </span>
        <span className={`shrink-0 font-black text-xs ${textColor}`}>
          {accuracy}%{' '}
          <span className="font-normal text-base-content/40">({attempted})</span>
        </span>
      </div>
      <div className="h-2 rounded-full bg-base-200 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${barColor}`}
          style={{ width: `${accuracy}%` }}
          role="progressbar"
          aria-valuenow={accuracy}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  )
}

// ── StatsContent ───────────────────────────────────────────
function StatsContent() {
  const router = useRouter()
  const { user, t } = useAuth()
  const lang = user?.preferences?.language || 'es'

  const [stats, setStats] = useState(null)
  const [insights, setInsights] = useState(null)
  const [loading, setLoading] = useState(true)
  const [insightsLoading, setInsightsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    fetch('/api/stats/dashboard')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (isMounted && d) { setStats(d); setLoading(false) } })
      .catch((err) => { console.error('Failed to fetch stats:', err); if (isMounted) setLoading(false) })

    fetch('/api/stats/ai-insights')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (isMounted && d) { setInsights(d.insights); setInsightsLoading(false) } })
      .catch((err) => { console.error('Failed to fetch AI insights:', err); if (isMounted) setInsightsLoading(false) })

    return () => { isMounted = false }
  }, [])

  // ── LOADING ──
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-base-100">
        <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <p className="text-sm text-base-content/50 animate-pulse">
          {t('Cargando estadísticas...', 'Loading stats...')}
        </p>
      </div>
    )
  }

  // Readiness ring calc
  const radius       = 54
  const circumference = 2 * Math.PI * radius
  const score        = insights?.readiness_score
  const validScore = typeof score === 'number' && !isNaN(score) ? score : 0
  const dashoffset   = score != null ? circumference - (validScore / 100) * circumference : circumference
  const scoreColor   = score >= 90 ? '#10B981' : score >= 70 ? '#2563EB' : '#F59E0B'

  const mainStats = [
    { val: stats?.total_exams    || 0,    label: t('Exámenes', 'Exams'),       icon: '📝', color: 'text-primary'  },
    { val: `${stats?.pass_rate   || 0}%`, label: t('Aprobados', 'Pass rate'),  icon: '✅', color: 'text-success'  },
    { val: stats?.total_answered || 0,    label: t('Preguntas', 'Questions'),  icon: '❓', color: 'text-secondary' },
    { val: `${stats?.accuracy    || 0}%`, label: t('Precisión', 'Accuracy'),   icon: '🎯', color: 'text-warning'  },
  ]

  return (
    <div className="min-h-screen bg-base-100">
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-24 space-y-5">

        {/* ── Header ── */}
        <div>
          <h1 className="text-2xl font-black text-base-content flex items-center gap-2">
            📊 {t('Mis Estadísticas', 'My Stats')}
          </h1>
          <p className="text-sm text-base-content/50 mt-0.5">
            {t('Tu progreso en detalle.', 'Your progress in detail.')}
          </p>
        </div>

        {/* ── Main Stats Grid (2×2 on mobile) ── */}
        <div className="grid grid-cols-2 gap-3">
          {mainStats.map((s, i) => (
            <div
              key={i}
              className="rounded-2xl border border-base-200 bg-base-100 p-4 flex items-center gap-3 shadow-sm"
            >
              <span className="text-2xl shrink-0">{s.icon}</span>
              <div className="min-w-0">
                <div className={`text-xl font-black ${s.color}`}>{s.val}</div>
                <div className="text-[11px] font-semibold text-base-content/50 uppercase tracking-wide mt-0.5 truncate">
                  {s.label}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── AI Readiness Card ── */}
        <div className="rounded-2xl border border-base-200 bg-base-100 overflow-hidden shadow-sm">
          <div className="px-4 py-3 bg-base-200/50 border-b border-base-200 flex items-center gap-2">
            <span>🤖</span>
            <span className="font-black text-sm text-base-content">
              {t('Puntuación IA de Preparación', 'AI Readiness Score')}
            </span>
          </div>

          <div className="p-5">
            {insightsLoading ? (
              <div className="flex flex-col items-center gap-4">
                <div className="w-32 h-32 rounded-full bg-base-200 animate-pulse" />
                <div className="h-3 w-48 rounded-full bg-base-200 animate-pulse" />
                <div className="h-3 w-36 rounded-full bg-base-200 animate-pulse" />
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-6">
                {/* Ring */}
                <div className="relative w-32 h-32 shrink-0">
                  <svg className="w-32 h-32 -rotate-90" viewBox="0 0 128 128">
                    <circle cx="64" cy="64" r={radius} fill="none"
                      stroke="currentColor" strokeWidth="10" className="text-base-200" />
                    <circle cx="64" cy="64" r={radius} fill="none"
                      stroke={scoreColor} strokeWidth="10" strokeLinecap="round"
                      strokeDasharray={circumference} strokeDashoffset={dashoffset}
                      style={{ transition: 'stroke-dashoffset 1.5s ease-in-out' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    {score != null ? (
                      <>
                        <span className="text-2xl font-black" style={{ color: scoreColor }}>
                          {score}%
                        </span>
                        <span className="text-[10px] text-base-content/40 font-semibold mt-0.5">
                          {t('listo', 'ready')}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-center text-base-content/40 px-3 leading-snug">
                        {t('Más datos', 'More data needed')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Coach message + ready badge */}
                <div className="flex-1 min-w-0 text-center sm:text-left space-y-3">
                  {score >= 90 && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full
                      bg-success/10 border border-success/25 text-success text-xs font-black">
                      🎓 {t('¡Listo para el DGT!', 'Ready for the DGT!')}
                    </div>
                  )}
                  {insights?.coach_message && (
                    <p className="text-sm text-base-content/70 leading-relaxed">
                      {insights.coach_message}
                    </p>
                  )}
                  {!insights?.coach_message && !score && (
                    <p className="text-sm text-base-content/50 italic">
                      {t(
                        'Completa más exámenes para obtener tu análisis IA personalizado.',
                        'Complete more exams to unlock your personalized AI analysis.'
                      )}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Weak Areas ── */}
        <div className="rounded-2xl border border-base-200 bg-base-100 overflow-hidden shadow-sm">
          <div className="px-4 py-3 bg-base-200/50 border-b border-base-200 flex items-center gap-2">
            <span>⚠️</span>
            <span className="font-black text-sm text-base-content">
              {t('Áreas Débiles', 'Weak Areas')}
            </span>
          </div>

          <div className="p-4">
            {insightsLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-11 rounded-xl bg-base-200 animate-pulse" />
                ))}
              </div>
            ) : insights?.weak_topics?.length > 0 ? (
              <div className="space-y-2">
                {insights.weak_topics.map((topic, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl
                      bg-error/5 border border-error/15"
                  >
                    <span className="shrink-0 w-6 h-6 rounded-full bg-error/15 text-error
                      text-[11px] font-black flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium text-base-content flex-1 leading-snug">
                      {topic}
                    </span>
                  </div>
                ))}

                {insights.recommended_action?.filters?.length > 0 && (
                  <Link
                    href={`/exam?ai=1&topics=${insights.recommended_action.filters.join(',')}`}
                    className="btn btn-primary btn-sm w-full rounded-xl h-11 mt-2 gap-2"
                  >
                    ⚡ {t('Practicar estas áreas', 'Practice these areas')}
                  </Link>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center py-8 text-center">
                <span className="text-4xl mb-3">🎉</span>
                <p className="text-sm text-base-content/50">
                  {t('¡Completa más exámenes para ver tus áreas débiles!', 'Complete more exams to see weak areas!')}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Topic Breakdown ── */}
        {stats?.topic_stats?.length > 0 && (
          <div className="rounded-2xl border border-base-200 bg-base-100 overflow-hidden shadow-sm">
            <div className="px-4 py-3 bg-base-200/50 border-b border-base-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>📚</span>
                <span className="font-black text-sm text-base-content">
                  {t('Rendimiento por Tema', 'Performance by Topic')}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-bold text-base-content/40">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-success inline-block"/>≥80%</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-warning inline-block"/>≥60%</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-error inline-block"/>&lt;60%</span>
              </div>
            </div>
            <div className="p-4 space-y-4">
              {stats.topic_stats.map((topic) => (
                <TopicBar
                  key={topic.tag}
                  tag={topic.tag || t('Sin etiqueta', 'Untagged')}
                  accuracy={topic.accuracy}
                  attempted={topic.attempted}
                  lang={lang}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Recent Exams ── */}
        {stats?.recent_sessions?.length > 0 && (
          <div className="rounded-2xl border border-base-200 bg-base-100 overflow-hidden shadow-sm">
            <div className="px-4 py-3 bg-base-200/50 border-b border-base-200 flex items-center gap-2">
              <span>🕐</span>
              <span className="font-black text-sm text-base-content">
                {t('Exámenes Recientes', 'Recent Exams')}
              </span>
            </div>
            <div className="divide-y divide-base-200">
              {stats.recent_sessions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => router.push(`/exam/${s._id}`)}
                  className="w-full flex items-center gap-3 px-4 py-3.5
                    hover:bg-base-200/50 active:bg-base-200 transition-colors text-left"
                >
                  {/* Pass/fail icon */}
                  <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg
                    ${s.passed ? 'bg-success/10' : 'bg-error/10'}`}>
                    {s.passed ? '✅' : '❌'}
                  </div>

                  {/* Mode + date */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-base-content truncate">
                      {s.mode === 'official'
                        ? t('Simulación Oficial', 'Official Simulation')
                        : t('Práctica Personalizada', 'Custom Practice')}
                    </p>
                    <p className="text-xs text-base-content/40 mt-0.5">
                      {new Date(s.completedAt).toLocaleDateString(
                        lang === 'en' ? 'en-US' : 'es-ES',
                        { month: 'short', day: 'numeric', year: 'numeric' }
                      )}
                    </p>
                  </div>

                  {/* Score */}
                  <div className="shrink-0 text-right">
                    <p className={`text-sm font-black
                      ${s.passed ? 'text-success' : 'text-error'}`}>
                      {s.score}/{s.score + s.errorCount}
                    </p>
                    <p className="text-[10px] text-base-content/40 font-semibold mt-0.5">
                      {s.errorCount} {t('err.', 'err.')}
                    </p>
                  </div>

                  <span className="shrink-0 text-base-content/25 text-sm">→</span>
                </button>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

export default function StatsPage() {
  return (
    <AppShell>
      <StatsContent />
    </AppShell>
  )
}
