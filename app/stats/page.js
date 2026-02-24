'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/components/AuthContext'

function TopicBar({ tag, accuracy, attempted }) {
  const color = accuracy >= 80 ? 'bg-success' : accuracy >= 60 ? 'bg-warning' : 'bg-danger'
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-ink truncate max-w-[60%]">{tag}</span>
        <span className={`font-bold ${accuracy >= 80 ? 'text-success' : accuracy >= 60 ? 'text-warning' : 'text-danger'}`}>
          {accuracy}% <span className="text-xs font-normal text-ink-light">({attempted})</span>
        </span>
      </div>
      <div className="progress-bar">
        <div className={`${color} h-full rounded-full transition-all duration-700`} style={{ width: `${accuracy}%` }} />
      </div>
    </div>
  )
}

function StatsContent() {
  const { user, t } = useAuth()
  const [stats, setStats] = useState(null)
  const [insights, setInsights] = useState(null)
  const [loading, setLoading] = useState(true)
  const [insightsLoading, setInsightsLoading] = useState(true)

  useEffect(() => {
    fetch('/api/stats/dashboard')
      .then((r) => r.json())
      .then((d) => { setStats(d); setLoading(false) })

    fetch('/api/stats/ai-insights')
      .then((r) => r.json())
      .then((d) => { setInsights(d.insights); setInsightsLoading(false) })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-4xl animate-spin-slow">📊</div>
      </div>
    )
  }

  const radius = 54
  const circumference = 2 * Math.PI * radius
  const score = insights?.readiness_score
  const dashoffset = score != null ? circumference - (score / 100) * circumference : circumference
  const scoreColor = score >= 90 ? '#10B981' : score >= 70 ? '#2563EB' : '#F59E0B'

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-ink">📊 {t('Mis Estadísticas', 'My Stats')}</h1>
        <p className="text-ink-light mt-1">{t('Tu progreso en detalle', 'Your progress in detail')}</p>
      </div>

      {/* Main stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { val: stats?.total_exams || 0, label: t('Exámenes', 'Exams'), icon: '📝', color: 'text-primary' },
          { val: `${stats?.pass_rate || 0}%`, label: t('Tasa aprobado', 'Pass rate'), icon: '✅', color: 'text-success' },
          { val: stats?.total_answered || 0, label: t('Preguntas', 'Questions'), icon: '❓', color: 'text-secondary' },
          { val: `${stats?.accuracy || 0}%`, label: t('Precisión', 'Accuracy'), icon: '🎯', color: 'text-orange-500' },
        ].map((s, i) => (
          <div key={i} className="card text-center">
            <div className="text-3xl mb-2">{s.icon}</div>
            <div className={`text-3xl font-bold ${s.color}`}>{s.val}</div>
            <div className="text-xs text-ink-light mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* AI Readiness + Weak topics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Readiness ring */}
        <div className="card flex flex-col items-center text-center">
          <h2 className="font-bold text-lg text-ink mb-4">🤖 {t('Puntuación IA de Preparación', 'AI Readiness Score')}</h2>
          {insightsLoading ? (
            <div className="w-36 h-36 rounded-full bg-slate-200 animate-pulse" />
          ) : (
            <>
              <div className="relative w-36 h-36">
                <svg className="circular-progress w-full h-full" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r={radius} fill="none" stroke="#E2E8F0" strokeWidth="10" />
                  <circle
                    cx="60" cy="60" r={radius} fill="none" stroke={scoreColor}
                    strokeWidth="10" strokeLinecap="round"
                    strokeDasharray={circumference} strokeDashoffset={dashoffset}
                    style={{ transition: 'stroke-dashoffset 1.5s ease-in-out' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  {score != null ? (
                    <span className="text-3xl font-bold" style={{ color: scoreColor }}>{score}%</span>
                  ) : (
                    <span className="text-sm text-ink-light text-center px-2">
                      {t('Necesitas más datos', 'More data needed')}
                    </span>
                  )}
                </div>
              </div>

              {score >= 90 && (
                <div className="mt-4 px-4 py-2 bg-success rounded-full text-white text-sm font-bold animate-bounce-in">
                  🎓 {t('¡Listo para el DGT!', 'Ready for the DGT!')}
                </div>
              )}

              {insights?.coach_message && (
                <p className="text-sm text-ink-light mt-4 leading-relaxed">
                  {insights.coach_message}
                </p>
              )}
            </>
          )}
        </div>

        {/* Weak topics */}
        <div className="card">
          <h2 className="font-bold text-lg text-ink mb-4">⚠️ {t('Áreas Débiles', 'Weak Areas')}</h2>
          {insightsLoading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-8 bg-slate-200 rounded animate-pulse" />)}
            </div>
          ) : insights?.weak_topics?.length > 0 ? (
            <div className="space-y-3">
              {insights.weak_topics.map((topic, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-red-50 rounded-xl border border-red-100">
                  <span className="text-danger font-bold text-lg">#{i + 1}</span>
                  <span className="font-medium text-ink">{topic}</span>
                </div>
              ))}
              {insights.recommended_action?.filters?.length > 0 && (
                <a
                  href={`/exam?ai=1&topics=${insights.recommended_action.filters.join(',')}`}
                  className="btn-primary w-full text-sm mt-4"
                >
                  ⚡ {t('Practicar estas áreas', 'Practice these areas')}
                </a>
              )}
            </div>
          ) : (
            <p className="text-ink-light text-sm text-center py-8">
              {t('¡Completa más exámenes para ver tus áreas débiles!', 'Complete more exams to see weak areas!')}
            </p>
          )}
        </div>
      </div>

      {/* Topic breakdown */}
      {stats?.topic_stats?.length > 0 && (
        <div className="card">
          <h2 className="font-bold text-lg text-ink mb-6">{t('Rendimiento por Tema', 'Performance by Topic')}</h2>
          <div className="space-y-4">
            {stats.topic_stats.map((topic) => (
              <TopicBar
                key={topic.tag}
                tag={topic.tag || t('Sin etiqueta', 'Untagged')}
                accuracy={topic.accuracy}
                attempted={topic.attempted}
              />
            ))}
          </div>
        </div>
      )}

      {/* Recent exams */}
      {stats?.recent_sessions?.length > 0 && (
        <div className="card">
          <h2 className="font-bold text-lg text-ink mb-4">{t('Exámenes Recientes', 'Recent Exams')}</h2>
          <div className="space-y-2">
            {stats.recent_sessions.map((s, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                <div className="flex items-center gap-3">
                  <span className={s.passed ? 'text-success' : 'text-warning'}>{s.passed ? '✅' : '❌'}</span>
                  <div>
                    <span className="text-sm font-medium text-ink">
                      {s.mode === 'official' ? t('Oficial', 'Official') : t('Personalizado', 'Custom')}
                    </span>
                    <span className="text-xs text-ink-light ml-2">
                      {new Date(s.completedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-sm font-bold ${s.passed ? 'text-success' : 'text-warning'}`}>
                    {s.score}/{s.score + s.errors}
                  </span>
                  <span className="text-xs text-ink-light ml-1">({s.errors} {t('errores', 'errors')})</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
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
