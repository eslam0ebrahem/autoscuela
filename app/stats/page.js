'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/components/AuthContext'

// Helper to safely extract localized strings
const getLocalizedText = (obj, lang) => {
  if (!obj) return ''
  if (typeof obj === 'string') return obj
  if (lang === 'en' && obj.en) return obj.en
  return obj.es || obj.en || ''
}

function TopicBar({ tag, accuracy, attempted, lang }) {
  const color = accuracy >= 80 ? 'bg-success' : accuracy >= 60 ? 'bg-warning' : 'bg-danger'
  const textColor = accuracy >= 80 ? 'text-success dark:text-emerald-400' : accuracy >= 60 ? 'text-warning dark:text-amber-400' : 'text-danger dark:text-red-400'
  
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-ink dark:text-slate-200 truncate max-w-[65%]">
          {getLocalizedText(tag, lang)}
        </span>
        <span className={`font-bold ${textColor}`}>
          {accuracy}% <span className="text-xs font-normal text-ink-light dark:text-slate-500">({attempted})</span>
        </span>
      </div>
      <div className="progress-bar bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
        <div 
          className={`${color} h-full transition-all duration-700 ease-out`} 
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

    // Fetch General Stats
    fetch('/api/stats/dashboard')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { 
        if (isMounted && d) {
          setStats(d)
          setLoading(false)
        }
      })
      .catch((err) => {
        console.error('Failed to fetch stats:', err)
        if (isMounted) setLoading(false)
      })

    // Fetch AI Insights
    fetch('/api/stats/ai-insights')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { 
        if (isMounted && d) {
          setInsights(d.insights)
          setInsightsLoading(false)
        }
      })
      .catch((err) => {
        console.error('Failed to fetch AI insights:', err)
        if (isMounted) setInsightsLoading(false)
      })

    return () => { isMounted = false }
  }, [])

  // ==== RENDER: LOADING ====
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-4xl animate-spin-slow mb-4" role="img" aria-label="Cargando">📊</div>
          <p className="text-ink-light dark:text-slate-400 font-medium">{t('Cargando estadísticas...', 'Loading stats...')}</p>
        </div>
      </div>
    )
  }

  // SVG Calculations
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const score = insights?.readiness_score
  const dashoffset = score != null ? circumference - (score / 100) * circumference : circumference
  const scoreColor = score >= 90 ? '#10B981' : score >= 70 ? '#2563EB' : '#F59E0B'

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-ink dark:text-white flex items-center gap-3">
          <span aria-hidden="true">📊</span> {t('Mis Estadísticas', 'My Stats')}
        </h1>
        <p className="text-ink-light dark:text-slate-400 mt-2 text-lg">
          {t('Tu progreso en detalle.', 'Your progress in detail.')}
        </p>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { val: stats?.total_exams || 0, label: t('Exámenes', 'Exams'), icon: '📝', color: 'text-primary dark:text-blue-400' },
          { val: `${stats?.pass_rate || 0}%`, label: t('Tasa aprobado', 'Pass rate'), icon: '✅', color: 'text-success dark:text-emerald-400' },
          { val: stats?.total_answered || 0, label: t('Preguntas', 'Questions'), icon: '❓', color: 'text-secondary dark:text-purple-400' },
          { val: `${stats?.accuracy || 0}%`, label: t('Precisión', 'Accuracy'), icon: '🎯', color: 'text-orange-500 dark:text-orange-400' },
        ].map((s, i) => (
          <div key={i} className="card bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-center py-5">
            <div className="text-3xl mb-3" aria-hidden="true">{s.icon}</div>
            <div className={`text-3xl font-bold ${s.color}`}>{s.val}</div>
            <div className="text-xs font-bold uppercase tracking-wide text-ink-light dark:text-slate-400 mt-2">{s.label}</div>
          </div>
        ))}
      </div>

      {/* AI Readiness + Weak topics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Readiness Ring */}
        <div className="card bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 flex flex-col items-center text-center">
          <h2 className="font-bold text-lg text-ink dark:text-white mb-6 flex items-center gap-2">
            <span aria-hidden="true">🤖</span> {t('Puntuación IA de Preparación', 'AI Readiness Score')}
          </h2>
          
          {insightsLoading ? (
            <div className="w-36 h-36 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
          ) : (
            <>
              <div className="relative w-36 h-36">
                <svg className="circular-progress w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r={radius} fill="none" stroke="currentColor" className="text-slate-100 dark:text-slate-700" strokeWidth="10" />
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
                    <span className="text-sm font-medium text-ink-light dark:text-slate-400 text-center px-2">
                      {t('Necesita más datos', 'More data needed')}
                    </span>
                  )}
                </div>
              </div>

              {score >= 90 && (
                <div className="mt-6 px-5 py-2.5 bg-success/10 border border-success/20 rounded-full text-success dark:text-emerald-400 text-sm font-bold animate-bounce-in flex items-center gap-2">
                  <span aria-hidden="true">🎓</span> {t('¡Listo para el DGT!', 'Ready for the DGT!')}
                </div>
              )}

              {insights?.coach_message && (
                <p className="text-sm text-ink-light dark:text-slate-300 mt-6 leading-relaxed max-w-sm">
                  {insights.coach_message}
                </p>
              )}
            </>
          )}
        </div>

        {/* Weak Topics */}
        <div className="card bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
          <h2 className="font-bold text-lg text-ink dark:text-white mb-5 flex items-center gap-2">
            <span aria-hidden="true">⚠️</span> {t('Áreas Débiles', 'Weak Areas')}
          </h2>
          
          {insightsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-12 bg-slate-100 dark:bg-slate-700/50 rounded-xl animate-pulse" />)}
            </div>
          ) : insights?.weak_topics?.length > 0 ? (
            <div className="space-y-3">
              {insights.weak_topics.map((topic, i) => (
                <div key={i} className="flex items-center gap-3 p-3.5 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-900/50">
                  <span className="text-danger dark:text-red-400 font-bold text-lg w-6 text-center">#{i + 1}</span>
                  <span className="font-medium text-ink dark:text-slate-200 flex-1">{topic}</span>
                </div>
              ))}
              
              {insights.recommended_action?.filters?.length > 0 && (
                <Link
                  href={`/exam?ai=1&topics=${insights.recommended_action.filters.join(',')}`}
                  className="btn-primary w-full text-sm mt-5 flex items-center justify-center gap-2"
                >
                  <span aria-hidden="true">⚡</span> {t('Practicar estas áreas', 'Practice these areas')}
                </Link>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center py-8 h-full">
              <span className="text-4xl mb-3" aria-hidden="true">🎉</span>
              <p className="text-ink-light dark:text-slate-400 font-medium">
                {t('¡Completa más exámenes para ver tus áreas débiles!', 'Complete more exams to see weak areas!')}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Topic Breakdown */}
      {stats?.topic_stats?.length > 0 && (
        <div className="card bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
          <h2 className="font-bold text-lg text-ink dark:text-white mb-6">
            {t('Rendimiento por Tema', 'Performance by Topic')}
          </h2>
          <div className="space-y-5">
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

      {/* Recent Exams */}
      {stats?.recent_sessions?.length > 0 && (
        <div className="card bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
          <h2 className="font-bold text-lg text-ink dark:text-white mb-5">
            {t('Exámenes Recientes', 'Recent Exams')}
          </h2>
          <div className="space-y-3">
            {stats.recent_sessions.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => router.push(`/exam/${s._id}`)}
                className="w-full flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 hover:border-slate-200 dark:hover:border-slate-600 transition-all text-left focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${s.passed ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                    {s.passed ? '✅' : '❌'}
                  </div>
                  <div>
                    <span className="text-sm font-bold text-ink dark:text-white block">
                      {s.mode === 'official' ? t('Simulación Oficial', 'Official Simulation') : t('Práctica Personalizada', 'Custom Practice')}
                    </span>
                    <span className="text-xs font-medium text-ink-light dark:text-slate-400 mt-0.5 block">
                      {new Date(s.completedAt).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                </div>
                <div className="text-right flex items-center gap-4">
                  <div>
                    <span className={`text-sm font-bold block ${s.passed ? 'text-success dark:text-emerald-400' : 'text-warning dark:text-amber-400'}`}>
                      {s.score} / {s.score + s.errorCount}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-ink-light dark:text-slate-500 block mt-0.5">
                      ({s.errorCount} {t('errores', 'errors')})
                    </span>
                  </div>
                  <svg className="w-5 h-5 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
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