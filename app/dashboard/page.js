'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/components/AuthContext'

function ReadinessRing({ score }) {
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const dashoffset = score != null ? circumference - (score / 100) * circumference : circumference

  const color = score >= 90 ? '#10B981' : score >= 70 ? '#2563EB' : score >= 50 ? '#F59E0B' : '#EF4444'
  const label = score >= 90 ? '🎓 ¡Listo!' : score >= 70 ? '📈 Bien' : score >= 50 ? '📚 Sigue' : '🔥 Empieza'

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-36 h-36">
        <svg className="circular-progress w-full h-full" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="#E2E8F0" strokeWidth="10" />
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashoffset}
            style={{ transition: 'stroke-dashoffset 1.5s ease-in-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {score != null ? (
            <>
              <span className="text-3xl font-bold animate-score" style={{ color }}>{score}%</span>
              <span className="text-xs text-ink-light">{label}</span>
            </>
          ) : (
            <span className="text-2xl">🤔</span>
          )}
        </div>
      </div>
      <p className="text-xs text-ink-light mt-2 text-center">
        {score >= 90 ? '¡Preparado para el DGT!' : 'Puntuación de preparación IA'}
      </p>
    </div>
  )
}

function DashboardContent() {
  const { user, t } = useAuth()
  const [insights, setInsights] = useState(null)
  const [stats, setStats] = useState(null)
  const [insightsLoading, setInsightsLoading] = useState(true)
  const [streak, setStreak] = useState(0)
  const [badges, setBadges] = useState([])

  useEffect(() => {
    // Fetch AI insights
    fetch('/api/stats/ai-insights')
      .then((r) => r.json())
      .then((d) => {
        setInsights(d.insights)
        setInsightsLoading(false)
      })
      .catch(() => setInsightsLoading(false))

    // Fetch stats
    fetch('/api/stats/dashboard')
      .then((r) => r.json())
      .then(setStats)

    // Fetch gamification
    fetch('/api/gamification/streak')
      .then((r) => r.json())
      .then((d) => setStreak(d.currentStreak || 0))

    fetch('/api/gamification/badges')
      .then((r) => r.json())
      .then((d) => setBadges(d.badges?.filter((b) => b.unlocked).slice(0, 3) || []))
  }, [])

  const isPremium = user?.isPremium

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-ink">
            {t('¡Hola', 'Hey')}, {user?.nickname}! 👋
          </h1>
          <p className="text-ink-light mt-1">
            {t('¿Listo para estudiar hoy?', "Ready to study today?")}
          </p>
        </div>
        {streak > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-orange-50 border border-orange-200 rounded-2xl">
            <span className="streak-flame text-2xl">🔥</span>
            <div>
              <p className="text-sm font-bold text-orange-700">{streak} {t('días', 'days')}</p>
              <p className="text-xs text-orange-500">{t('racha', 'streak')}</p>
            </div>
          </div>
        )}
      </div>

      {/* AI Insights Hero */}
      <div className="card bg-gradient-to-br from-blue-50 to-purple-50 border-blue-100">
        <div className="flex flex-col md:flex-row gap-6 items-center">
          <ReadinessRing score={insights?.readiness_score ?? null} />

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-purple-500">🤖</span>
              <h2 className="font-bold text-lg text-ink">{t('Análisis IA · Groq', 'AI Analysis · Groq')}</h2>
              {!insightsLoading && insights && (
                <span className="badge-pill bg-purple-100 text-purple-700 text-xs">Live</span>
              )}
            </div>

            {insightsLoading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-4 bg-slate-200 rounded animate-pulse" />
                ))}
              </div>
            ) : insights ? (
              <>
                <p className="text-ink leading-relaxed mb-4">{insights.coach_message}</p>
                {insights.weak_topics?.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className="text-sm text-ink-light">{t('Áreas débiles:', 'Weak areas:')}</span>
                    {insights.weak_topics.map((topic) => (
                      <span key={topic} className="badge-pill bg-red-100 text-danger text-xs">
                        ⚠️ {topic}
                      </span>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-ink-light text-sm leading-relaxed">
                {t(
                  '¡Completa al menos 2 exámenes para desbloquear tu análisis personalizado con IA!',
                  'Complete at least 2 exams to unlock your personalized AI analysis!'
                )}
              </p>
            )}

            {insights?.recommended_action && (
              <Link
                href={`/exam?ai=1&topics=${insights.recommended_action.filters?.join(',') || ''}`}
                className="btn-primary inline-flex"
              >
                ⚡ {t('Iniciar estudio recomendado', 'Start Recommended Study')}
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Stats quick view */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: t('Exámenes', 'Exams'), value: stats.total_exams || 0, icon: '📝', color: 'text-primary' },
            { label: t('Aprobados', 'Passed'), value: `${stats.pass_rate || 0}%`, icon: '✅', color: 'text-success' },
            { label: t('Preguntas', 'Questions'), value: stats.total_answered || 0, icon: '❓', color: 'text-secondary' },
            { label: t('Precisión', 'Accuracy'), value: `${stats.accuracy || 0}%`, icon: '🎯', color: 'text-orange-500' },
            { label: t('Hoy', 'Today'), value: `${stats.study_today?.minutes || 0} min`, icon: '⏱️', color: 'text-emerald-500' },
          ].map((s, i) => (
            <div key={i} className="card text-center">
              <div className="text-2xl mb-1">{s.icon}</div>
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-ink-light mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Main actions + gamification grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Actions column */}
        <div className="space-y-4">
          <h2 className="font-bold text-lg text-ink">{t('Estudiar', 'Study')}</h2>

          <Link
            href="/exam"
            className={`card-hover block ${!isPremium ? 'opacity-60' : ''}`}
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-primary rounded-2xl flex items-center justify-center text-2xl shadow-glow-blue">
                📝
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-ink">{t('Examen DGT Oficial', 'Official DGT Exam')}</h3>
                <p className="text-sm text-ink-light">
                  {t('30 preguntas · 30 min · máx. 3 fallos', '30 questions · 30 min · max 3 errors')}
                </p>
              </div>
              {!isPremium && <span className="text-xl">🔒</span>}
              <svg className="w-5 h-5 text-ink-light" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>

          <Link
            href="/flashcards"
            className={`card-hover block ${!isPremium ? 'opacity-60' : ''}`}
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-purple rounded-2xl flex items-center justify-center text-2xl shadow-glow-purple">
                🃏
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-ink">{t('Tarjetas de Memoria', 'Flashcards')}</h3>
                <p className="text-sm text-ink-light">
                  {t('Repetición espaciada · Señales y normas', 'Spaced repetition · Signs & rules')}
                </p>
              </div>
              {!isPremium && <span className="text-xl">🔒</span>}
              <svg className="w-5 h-5 text-ink-light" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>

          <Link href="/dashboard/bookmarks" className="card-hover block">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center text-2xl shadow-glow-amber">
                ⭐
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-ink">{t('Guardados', 'Bookmarks')}</h3>
                <p className="text-sm text-ink-light">
                  {t('Repasa tus preguntas guardadas', 'Review your saved questions')}
                </p>
              </div>
              <svg className="w-5 h-5 text-ink-light" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>

          <Link href="/stats" className="card-hover block">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-success rounded-2xl flex items-center justify-center text-2xl shadow-glow-green">
                📊
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-ink">{t('Mis Estadísticas', 'My Stats')}</h3>
                <p className="text-sm text-ink-light">
                  {t('Ver progreso detallado por tema', 'View detailed progress by topic')}
                </p>
              </div>
              <svg className="w-5 h-5 text-ink-light" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        </div>

        {/* Gamification column */}
        <div className="space-y-4">
          <h2 className="font-bold text-lg text-ink">{t('Mis Logros', 'My Achievements')}</h2>

          {/* Recent badges */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-ink">{t('Últimas Insignias', 'Recent Badges')}</h3>
              <Link href="/badges" className="text-primary text-sm font-medium hover:underline">
                {t('Ver todas →', 'See all →')}
              </Link>
            </div>
            {badges.length > 0 ? (
              <div className="flex gap-3">
                {badges.map((badge) => (
                  <div
                    key={badge.id}
                    className="flex-1 flex flex-col items-center gap-1 p-3 rounded-xl bg-slate-50"
                    title={badge.name}
                  >
                    <span className="text-3xl">{badge.icon}</span>
                    <span className="text-xs font-medium text-ink text-center leading-tight">{badge.name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-light text-center py-4">
                {t('¡Completa tu primer examen para ganar insignias!', 'Complete your first exam to earn badges!')}
              </p>
            )}
          </div>

          {/* Leaderboard preview */}
          <Link href="/leaderboard" className="card-hover block">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-ink">🏆 {t('Ranking Semanal', 'Weekly Leaderboard')}</h3>
              <span className="text-primary text-sm font-medium">{t('Ver →', 'See →')}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-4xl">🥇</div>
              <p className="text-sm text-ink-light">
                {t(
                  'Gana XP respondiendo preguntas y aparece en el Top 50 de esta semana',
                  'Earn XP by answering questions and appear in the weekly Top 50'
                )}
              </p>
            </div>
          </Link>
        </div>
      </div>

      {/* Paywall banner for free users */}
      {!isPremium && (
        <div className="card bg-gradient-to-r from-blue-600 to-purple-600 text-white border-0">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-xl">⭐ {t('Desbloquea el potencial completo', 'Unlock Full Potential')}</h3>
              <p className="text-white/80 text-sm mt-1">
                {t('Exámenes, tarjetas, IA y gamificación completa por solo €9.99/mes', 'Exams, flashcards, AI & full gamification for just €9.99/month')}
              </p>
            </div>
            <button
              onClick={async () => {
                const res = await fetch('/api/billing/checkout', { method: 'POST' })
                const data = await res.json()
                if (data.url) window.location.href = data.url
              }}
              className="px-6 py-3 bg-white text-primary font-bold rounded-xl hover:bg-blue-50 transition-all active:scale-95 whitespace-nowrap"
            >
              {t('Suscribirse →', 'Subscribe →')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function DashboardPage() {
  return (
    <AppShell>
      <DashboardContent />
    </AppShell>
  )
}
