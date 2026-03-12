'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/components/AuthContext'
import { useToast } from '@/components/Toast'

// ==== SUB-COMPONENTS ====

function ReadinessRing({ score, t }) {
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const dashoffset = score != null ? circumference - (score / 100) * circumference : circumference

  // Dynamic colors based on score
  const color = score >= 90 ? '#10B981' : score >= 70 ? '#2563EB' : score >= 50 ? '#F59E0B' : '#EF4444'
  
  const label = score >= 90
    ? t('¡Listo!', 'Ready!')
    : score >= 70
    ? t('Bien', 'Good')
    : score >= 50
    ? t('Sigue', 'Keep going')
    : t('Empieza', 'Start')

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-36 h-36">
        <svg className="circular-progress w-full h-full transform -rotate-90" viewBox="0 0 120 120" role="img" aria-label={score != null ? `Readiness score: ${score}%` : 'No score yet'}>
          <circle cx="60" cy="60" r={radius} fill="none" stroke="currentColor" className="text-slate-100 dark:text-slate-800" strokeWidth="10" />
          <circle
            cx="60" cy="60" r={radius} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={dashoffset}
            style={{ transition: 'stroke-dashoffset 1.5s ease-in-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {score != null ? (
            <>
              <span className="text-3xl font-bold animate-score" style={{ color }}>{score}%</span>
              <span className="text-xs text-ink-light dark:text-slate-400 font-medium uppercase tracking-wide mt-1">{label}</span>
            </>
          ) : (
            <span className="text-3xl" aria-label="Calculando">🤔</span>
          )}
        </div>
      </div>
    </div>
  )
}

function StudyTrendsChart({ trends, t }) {
  if (!trends || trends.length === 0) return null

  const maxQuestions = Math.max(...trends.map(d => d.questions), 1)

  return (
    <div className="card bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
      <h3 className="font-semibold text-ink dark:text-white mb-4 flex items-center gap-2">
        <span aria-hidden="true">📈</span> {t('Tendencia de estudio', 'Study Trend')}
      </h3>
      
      <div className="flex items-end gap-1.5 h-32" role="img" aria-label={t('Gráfico de tendencias de estudio', 'Study trends chart')}>
        {trends.map((day, i) => {
          const height = (day.questions / maxQuestions) * 100
          const dateLabel = new Date(day.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })
          
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative" title={`${dateLabel}: ${day.questions} ${t('preguntas', 'questions')} (${day.accuracy}%)`}>
              <span className="text-[10px] font-bold text-ink-light dark:text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity absolute -top-5">
                {day.questions}
              </span>
              <div
                className="w-full rounded-t-md transition-all duration-300 hover:opacity-80"
                style={{
                  height: `${Math.max(height, 4)}%`,
                  backgroundColor: day.accuracy >= 80 ? '#10B981' : day.accuracy >= 60 ? '#F59E0B' : '#EF4444',
                }}
              />
              <span className="text-[10px] text-ink-light dark:text-slate-500 font-medium truncate w-full text-center">
                {dateLabel.split(' ')[0]}
              </span>
            </div>
          )
        })}
      </div>
      
      <div className="flex items-center gap-4 mt-4 text-xs font-medium text-ink-light dark:text-slate-400 border-t border-slate-100 dark:border-slate-700 pt-3">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-success" /> ≥80%</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-warning" /> ≥60%</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-danger" /> &lt;60%</span>
      </div>
    </div>
  )
}

function DailyChallengeCard({ t }) {
  const router = useRouter()
  const toast = useToast()
  
  const [challenge, setChallenge] = useState(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    let isMounted = true

    fetch('/api/gamification/daily-challenge')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (isMounted && data) setChallenge(data)
      })
      .catch(console.error)
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => { isMounted = false }
  }, [])

  const startChallenge = async () => {
    if (starting) return
    setStarting(true)
    
    try {
      const res = await fetch('/api/gamification/daily-challenge', { method: 'POST' })
      const data = await res.json()
      
      if (res.ok && data.sessionId) {
        router.push(`/exam/${data.sessionId}`)
      } else {
        toast.error(data.error || t('No se pudo iniciar el reto', 'Could not start challenge'))
        setStarting(false)
      }
    } catch (err) {
      console.error(err)
      toast.error(t('Hubo un problema de conexión', 'Connection error'))
      setStarting(false)
    }
  }

  if (loading) return null

  return (
    <div className={`card transition-colors ${challenge?.completedToday
      ? 'bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 border-emerald-200 dark:border-emerald-800'
      : 'bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-200 dark:border-amber-800'
    }`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="text-4xl" aria-hidden="true">{challenge?.completedToday ? '✅' : '📅'}</div>
          <div>
            <h3 className="font-bold text-lg text-ink dark:text-white">
              {t('Reto Diario', 'Daily Challenge')}
            </h3>
            <p className="text-sm text-ink-light dark:text-slate-400 mt-0.5">
              {challenge?.completedToday
                ? t('¡Completado hoy! Vuelve mañana.', 'Completed today! Come back tomorrow.')
                : t('10 preguntas rápidas por +15 XP', '10 quick questions for +15 XP')
              }
            </p>
            {challenge?.streak > 0 && (
              <span className="inline-flex items-center gap-1 mt-2 px-2.5 py-1 bg-white/50 dark:bg-black/20 rounded-lg text-xs text-amber-600 dark:text-amber-400 font-bold border border-amber-200/50 dark:border-amber-800/50">
                🔥 {challenge.streak} {t('días consecutivos', 'consecutive days')}
              </span>
            )}
          </div>
        </div>
        {!challenge?.completedToday && (
          <button
            type="button"
            onClick={challenge?.activeSessionId ? () => router.push(`/exam/${challenge.activeSessionId}`) : startChallenge}
            disabled={starting}
            className="btn-primary whitespace-nowrap disabled:opacity-70 disabled:cursor-not-allowed w-full sm:w-auto flex justify-center"
          >
            {challenge?.activeSessionId
              ? t('Continuar', 'Continue')
              : starting ? <span className="animate-pulse">{t('Iniciando...', 'Starting...')}</span> : t('Empezar', 'Start')
            }
          </button>
        )}
      </div>
    </div>
  )
}

// ==== MAIN DASHBOARD COMPONENT ====

function DashboardContent() {
  const { user, t } = useAuth()
  const router = useRouter()
  const toast = useToast()
  
  const [insights, setInsights] = useState(null)
  const [stats, setStats] = useState(null)
  const [streak, setStreak] = useState(0)
  const [badges, setBadges] = useState([])
  const [trends, setTrends] = useState([])
  
  const [insightsLoading, setInsightsLoading] = useState(true)
  const [billingLoading, setBillingLoading] = useState(false)

  const isPremium = user?.isPremium

  // Progressive Data Fetching
  useEffect(() => {
    let isMounted = true

    // AI Insights
    fetch('/api/stats/ai-insights')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (isMounted && d) setInsights(d.insights) })
      .catch(console.error)
      .finally(() => { if (isMounted) setInsightsLoading(false) })

    // Dashboard Stats
    fetch('/api/stats/dashboard')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (isMounted && d) setStats(d) })
      .catch(console.error)

    // Gamification Streak
    fetch('/api/gamification/streak')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (isMounted && d) setStreak(d.currentStreak || 0) })
      .catch(console.error)

    // Badges
    fetch('/api/gamification/badges')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (isMounted && d?.badges) setBadges(d.badges.filter(b => b.unlocked).slice(0, 3)) })
      .catch(console.error)

    // Trends
    fetch('/api/stats/trends?days=14')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (isMounted && d) setTrends(d.trends || []) })
      .catch(console.error)

    return () => { isMounted = false }
  }, [])

  const handleSubscribe = async () => {
    if (billingLoading) return
    setBillingLoading(true)
    
    try {
      const res = await fetch('/api/billing/checkout', { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.url) {
        window.location.href = data.url
      } else {
        toast.error(t('Error al iniciar el pago', 'Error initiating checkout'))
        setBillingLoading(false)
      }
    } catch (err) {
      console.error(err)
      toast.error(t('Hubo un problema de conexión', 'Connection error'))
      setBillingLoading(false)
    }
  }

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      
      {/* Welcome header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-ink dark:text-white">
            {t('¡Hola', 'Hey')}, {user?.nickname}! <span aria-hidden="true">👋</span>
          </h1>
          <p className="text-ink-light dark:text-slate-400 mt-1">
            {t('¿Listo para estudiar hoy?', "Ready to study today?")}
          </p>
        </div>
        {streak > 0 && (
          <div className="flex items-center gap-3 px-4 py-2.5 bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-2xl shadow-sm self-start sm:self-auto">
            <span className="streak-flame text-2xl" aria-hidden="true">🔥</span>
            <div>
              <p className="text-sm font-bold text-orange-700 dark:text-orange-400 leading-none">{streak} {t('días', 'days')}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-orange-500 dark:text-orange-500 mt-1">{t('Racha actual', 'Current streak')}</p>
            </div>
          </div>
        )}
      </div>

      {/* Daily Challenge (Premium Only) */}
      {isPremium && <DailyChallengeCard t={t} />}

      {/* AI Insights Hero */}
      <div className="card bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-blue-100 dark:border-blue-800">
        <div className="flex flex-col md:flex-row gap-8 items-center">
          <ReadinessRing score={insights?.readiness_score ?? null} t={t} />

          <div className="flex-1 w-full text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2 mb-3">
              <span aria-hidden="true">🤖</span>
              <h2 className="font-bold text-lg text-ink dark:text-white">{t('Análisis IA', 'AI Analysis')}</h2>
              {!insightsLoading && insights && (
                <span className="badge-pill bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-[10px] uppercase font-bold tracking-wider">Live</span>
              )}
            </div>

            {insightsLoading ? (
              <div className="space-y-3 w-full max-w-md mx-auto md:mx-0">
                <div className="h-4 bg-slate-200 dark:bg-slate-700/50 rounded animate-pulse" />
                <div className="h-4 bg-slate-200 dark:bg-slate-700/50 rounded w-4/5 animate-pulse" />
              </div>
            ) : insights ? (
              <>
                <p className="text-ink dark:text-slate-300 leading-relaxed mb-4">{insights.coach_message}</p>
                {insights.weak_topics?.length > 0 && (
                  <div className="flex flex-wrap justify-center md:justify-start gap-2 mb-5">
                    <span className="text-sm font-medium text-ink-light dark:text-slate-400 mt-1">{t('Áreas débiles:', 'Weak areas:')}</span>
                    {insights.weak_topics.map((topic) => (
                      <span key={topic} className="badge-pill bg-red-100 dark:bg-red-900/30 text-danger dark:text-red-400 text-xs font-medium border border-red-200 dark:border-red-800/50">
                        ⚠️ {topic}
                      </span>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-ink-light dark:text-slate-400 text-sm leading-relaxed mb-4">
                {t(
                  'Completa al menos 2 exámenes para desbloquear tu análisis personalizado con IA.',
                  'Complete at least 2 exams to unlock your personalized AI analysis.'
                )}
              </p>
            )}

            {insights?.recommended_action && (
              <Link
                href={`/exam?ai=1&topics=${insights.recommended_action.filters?.join(',') || ''}`}
                className="btn-primary inline-flex items-center gap-2 mt-2"
              >
                <span aria-hidden="true">⚡</span> {t('Iniciar estudio recomendado', 'Start Recommended Study')}
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Stats quick view */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: t('Exámenes', 'Exams'), value: stats.total_exams || 0, icon: '📝', color: 'text-primary dark:text-blue-400' },
            { label: t('Aprobados', 'Passed'), value: `${stats.pass_rate || 0}%`, icon: '✅', color: 'text-success dark:text-emerald-400' },
            { label: t('Preguntas', 'Questions'), value: stats.total_answered || 0, icon: '❓', color: 'text-secondary dark:text-purple-400' },
            { label: t('Precisión', 'Accuracy'), value: `${stats.accuracy || 0}%`, icon: '🎯', color: 'text-orange-500 dark:text-orange-400' },
            { label: t('Hoy', 'Today'), value: `${stats.study_today?.minutes || 0} min`, icon: '⏱️', color: 'text-emerald-500 dark:text-teal-400' },
          ].map((s, i) => (
            <div key={i} className="card bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-center py-4 px-2">
              <div className="text-2xl mb-2" aria-hidden="true">{s.icon}</div>
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs font-medium uppercase tracking-wide text-ink-light dark:text-slate-400 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Grid: Study Actions & Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Actions column */}
        <div className="space-y-4">
          <h2 className="font-bold text-lg text-ink dark:text-white mb-2">{t('Estudiar', 'Study')}</h2>

          <Link href="/exam" className={`card-hover block bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary ${!isPremium ? 'opacity-70 grayscale-[30%]' : ''}`}>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-blue-500/20">
                📝
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-ink dark:text-white flex items-center gap-2">
                  {t('Examen DGT Oficial', 'Official DGT Exam')}
                  {!isPremium && <span className="text-sm" title={t('Requiere Premium', 'Premium Required')}>🔒</span>}
                </h3>
                <p className="text-sm text-ink-light dark:text-slate-400 mt-0.5">
                  {t('30 preguntas · 30 min · máx. 3 fallos', '30 questions · 30 min · max 3 errors')}
                </p>
              </div>
              <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>

          <Link href="/flashcards" className={`card-hover block bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary ${!isPremium ? 'opacity-70 grayscale-[30%]' : ''}`}>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-purple-500/20">
                🃏
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-ink dark:text-white flex items-center gap-2">
                  {t('Tarjetas de Memoria', 'Flashcards')}
                  {!isPremium && <span className="text-sm" title={t('Requiere Premium', 'Premium Required')}>🔒</span>}
                </h3>
                <p className="text-sm text-ink-light dark:text-slate-400 mt-0.5">
                  {t('Repetición espaciada · Señales y normas', 'Spaced repetition · Signs & rules')}
                </p>
              </div>
              <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>

          <Link href="/dashboard/bookmarks" className="card-hover block bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-orange-500/20">
                ⭐
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-ink dark:text-white">{t('Guardados', 'Bookmarks')}</h3>
                <p className="text-sm text-ink-light dark:text-slate-400 mt-0.5">
                  {t('Repasa tus preguntas guardadas', 'Review your saved questions')}
                </p>
              </div>
              <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>

          <Link href="/stats" className="card-hover block bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-emerald-500/20">
                📊
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-ink dark:text-white">{t('Mis Estadísticas', 'My Stats')}</h3>
                <p className="text-sm text-ink-light dark:text-slate-400 mt-0.5">
                  {t('Ver progreso detallado por tema', 'View detailed progress by topic')}
                </p>
              </div>
              <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        </div>

        {/* Right column: Trends + Gamification */}
        <div className="space-y-4">
          <StudyTrendsChart trends={trends} t={t} />

          <h2 className="font-bold text-lg text-ink dark:text-white mb-2 pt-2">{t('Mis Logros', 'My Achievements')}</h2>

          <div className="card bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-700/50 pb-3">
              <h3 className="font-semibold text-ink dark:text-white">{t('Últimas Insignias', 'Recent Badges')}</h3>
              <Link href="/badges" className="text-primary hover:text-blue-600 dark:text-blue-400 text-sm font-semibold transition-colors focus:outline-none focus:underline">
                {t('Ver todas', 'See all')}
              </Link>
            </div>
            {badges.length > 0 ? (
              <div className="grid grid-cols-3 gap-3">
                {badges.map((badge) => (
                  <div
                    key={badge.id}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 transition-transform hover:scale-105"
                    title={badge.name}
                  >
                    <span className="text-3xl" aria-hidden="true">{badge.icon}</span>
                    <span className="text-xs font-semibold text-ink dark:text-slate-300 text-center leading-tight">{badge.name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 px-4 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                <span className="text-3xl mb-2 block" aria-hidden="true">🎖️</span>
                <p className="text-sm text-ink-light dark:text-slate-400 font-medium">
                  {t('¡Completa tu primer examen para ganar insignias!', 'Complete your first exam to earn badges!')}
                </p>
              </div>
            )}
          </div>

          <Link href="/leaderboard" className="card-hover block bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-ink dark:text-white flex items-center gap-2">
                <span aria-hidden="true">🏆</span> {t('Ranking Semanal', 'Weekly Leaderboard')}
              </h3>
              <span className="text-primary dark:text-blue-400 text-sm font-semibold">{t('Ver ranking', 'See ranking')}</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-4xl bg-yellow-50 dark:bg-yellow-900/20 w-14 h-14 rounded-full flex items-center justify-center" aria-hidden="true">🥇</div>
              <p className="text-sm text-ink-light dark:text-slate-400 leading-relaxed">
                {t(
                  'Gana XP respondiendo preguntas y compite para entrar en el Top 50.',
                  'Earn XP by answering questions and compete to enter the Top 50.'
                )}
              </p>
            </div>
          </Link>
        </div>
      </div>

      {/* Paywall banner for free users */}
      {!isPremium && (
        <div className="card bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-900 dark:to-purple-900 text-white border-0 shadow-xl mt-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 p-2">
            <div className="text-center md:text-left">
              <h3 className="font-bold text-xl md:text-2xl flex items-center justify-center md:justify-start gap-2">
                <span aria-hidden="true">⭐</span> {t('Desbloquea el potencial completo', 'Unlock Full Potential')}
              </h3>
              <p className="text-blue-100 text-sm md:text-base mt-2 max-w-lg">
                {t('Exámenes, tarjetas, IA y gamificación completa por solo $9.99/mes.', 'Exams, flashcards, AI & full gamification for just $9.99/month.')}
              </p>
            </div>
            <button
              type="button"
              disabled={billingLoading}
              onClick={handleSubscribe}
              className="px-8 py-3.5 bg-white text-blue-700 font-bold rounded-xl hover:bg-blue-50 transition-all active:scale-95 whitespace-nowrap shadow-lg disabled:opacity-80 disabled:cursor-not-allowed w-full md:w-auto"
            >
              {billingLoading ? t('Redirigiendo...', 'Redirecting...') : t('Suscribirse ahora', 'Subscribe Now')}
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