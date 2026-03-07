'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/components/AuthContext'

function ReadinessRing({ score, t }) {
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const dashoffset = score != null ? circumference - (score / 100) * circumference : circumference

  const color = score >= 90 ? '#10B981' : score >= 70 ? '#2563EB' : score >= 50 ? '#F59E0B' : '#EF4444'
  const label = score >= 90
    ? (t ? t('Listo!', 'Ready!') : 'Ready!')
    : score >= 70
    ? (t ? t('Bien', 'Good') : 'Good')
    : score >= 50
    ? (t ? t('Sigue', 'Keep going') : 'Keep going')
    : (t ? t('Empieza', 'Start') : 'Start')

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-36 h-36">
        <svg className="circular-progress w-full h-full" viewBox="0 0 120 120" role="img" aria-label={score != null ? `Readiness score: ${score}%` : 'No score yet'}>
          <circle cx="60" cy="60" r={radius} fill="none" stroke="currentColor" className="text-slate-200 dark:text-slate-700" strokeWidth="10" />
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
              <span className="text-xs text-ink-light">{label}</span>
            </>
          ) : (
            <span className="text-2xl">🤔</span>
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
    <div className="card">
      <h3 className="font-semibold text-ink dark:text-white mb-4">
        📈 {t('Tendencia de estudio', 'Study Trend')}
      </h3>
      <div className="flex items-end gap-1 h-32" role="img" aria-label="Study trends chart">
        {trends.map((day, i) => {
          const height = (day.questions / maxQuestions) * 100
          const dateLabel = new Date(day.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1 group" title={`${dateLabel}: ${day.questions} ${t('preguntas', 'questions')} (${day.accuracy}%)`}>
              <span className="text-[10px] text-ink-light opacity-0 group-hover:opacity-100 transition-opacity">
                {day.questions}
              </span>
              <div
                className="w-full rounded-t-md transition-all duration-300 hover:opacity-80"
                style={{
                  height: `${Math.max(height, 4)}%`,
                  backgroundColor: day.accuracy >= 80 ? '#10B981' : day.accuracy >= 60 ? '#F59E0B' : '#EF4444',
                }}
              />
              <span className="text-[10px] text-ink-light">{dateLabel.split(' ')[0]}</span>
            </div>
          )
        })}
      </div>
      <div className="flex items-center gap-4 mt-3 text-xs text-ink-light">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-success" /> ≥80%</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-warning" /> ≥60%</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-danger" /> &lt;60%</span>
      </div>
    </div>
  )
}

function DailyChallengeCard({ t }) {
  const [challenge, setChallenge] = useState(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/gamification/daily-challenge')
      .then(r => r.json())
      .then(data => {
        setChallenge(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const startChallenge = async () => {
    setStarting(true)
    try {
      const res = await fetch('/api/gamification/daily-challenge', { method: 'POST' })
      const data = await res.json()
      if (data.sessionId) {
        router.push(`/exam/${data.sessionId}`)
      }
    } catch {
      setStarting(false)
    }
  }

  if (loading) return null

  return (
    <div className={`card ${challenge?.completedToday
      ? 'bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 border-emerald-200 dark:border-emerald-800'
      : 'bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-200 dark:border-amber-800'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-3xl">{challenge?.completedToday ? '✅' : '📅'}</div>
          <div>
            <h3 className="font-bold text-ink dark:text-white">
              {t('Reto Diario', 'Daily Challenge')}
            </h3>
            <p className="text-sm text-ink-light">
              {challenge?.completedToday
                ? t('Completado hoy! Vuelve manana', 'Completed today! Come back tomorrow')
                : t('10 preguntas rapidas por +15 XP', '10 quick questions for +15 XP')
              }
            </p>
            {challenge?.streak > 0 && (
              <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                🔥 {challenge.streak} {t('dias consecutivos', 'consecutive days')}
              </span>
            )}
          </div>
        </div>
        {!challenge?.completedToday && (
          <button
            onClick={challenge?.activeSessionId ? () => router.push(`/exam/${challenge.activeSessionId}`) : startChallenge}
            disabled={starting}
            className="btn-primary whitespace-nowrap"
          >
            {challenge?.activeSessionId
              ? t('Continuar', 'Continue')
              : starting ? '...' : t('Empezar', 'Start')
            }
          </button>
        )}
      </div>
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
  const [trends, setTrends] = useState([])
  const [activeExam, setActiveExam] = useState(null)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/stats/ai-insights')
      .then((r) => r.json())
      .then((d) => {
        setInsights(d.insights)
        setInsightsLoading(false)
      })
      .catch(() => setInsightsLoading(false))

    fetch('/api/stats/dashboard')
      .then((r) => r.json())
      .then(setStats)

    fetch('/api/gamification/streak')
      .then((r) => r.json())
      .then((d) => setStreak(d.currentStreak || 0))

    fetch('/api/gamification/badges')
      .then((r) => r.json())
      .then((d) => setBadges(d.badges?.filter((b) => b.unlocked).slice(0, 3) || []))

    fetch('/api/stats/trends?days=14')
      .then((r) => r.json())
      .then((d) => setTrends(d.trends || []))
  }, [])

  const isPremium = user?.isPremium

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-ink dark:text-white">
            {t('Hola', 'Hey')}, {user?.nickname}! 👋
          </h1>
          <p className="text-ink-light mt-1">
            {t('Listo para estudiar hoy?', "Ready to study today?")}
          </p>
        </div>
        {streak > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-2xl">
            <span className="streak-flame text-2xl">🔥</span>
            <div>
              <p className="text-sm font-bold text-orange-700 dark:text-orange-400">{streak} {t('dias', 'days')}</p>
              <p className="text-xs text-orange-500 dark:text-orange-500">{t('racha', 'streak')}</p>
            </div>
          </div>
        )}
      </div>

      {/* Daily Challenge */}
      {isPremium && <DailyChallengeCard t={t} />}

      {/* AI Insights Hero */}
      <div className="card bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-blue-100 dark:border-blue-800">
        <div className="flex flex-col md:flex-row gap-6 items-center">
          <ReadinessRing score={insights?.readiness_score ?? null} t={t} />

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <span>🤖</span>
              <h2 className="font-bold text-lg text-ink dark:text-white">{t('Analisis IA', 'AI Analysis')}</h2>
              {!insightsLoading && insights && (
                <span className="badge-pill bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs">Live</span>
              )}
            </div>

            {insightsLoading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                ))}
              </div>
            ) : insights ? (
              <>
                <p className="text-ink dark:text-slate-300 leading-relaxed mb-4">{insights.coach_message}</p>
                {insights.weak_topics?.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className="text-sm text-ink-light">{t('Areas debiles:', 'Weak areas:')}</span>
                    {insights.weak_topics.map((topic) => (
                      <span key={topic} className="badge-pill bg-red-100 dark:bg-red-900/30 text-danger text-xs">
                        ⚠️ {topic}
                      </span>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-ink-light text-sm leading-relaxed">
                {t(
                  'Completa al menos 2 examenes para desbloquear tu analisis personalizado con IA!',
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
            { label: t('Examenes', 'Exams'), value: stats.total_exams || 0, icon: '📝', color: 'text-primary' },
            { label: t('Aprobados', 'Passed'), value: `${stats.pass_rate || 0}%`, icon: '✅', color: 'text-success' },
            { label: t('Preguntas', 'Questions'), value: stats.total_answered || 0, icon: '❓', color: 'text-secondary' },
            { label: t('Precision', 'Accuracy'), value: `${stats.accuracy || 0}%`, icon: '🎯', color: 'text-orange-500' },
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

      {/* Study Trends + Actions grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Actions column */}
        <div className="space-y-4">
          <h2 className="font-bold text-lg text-ink dark:text-white">{t('Estudiar', 'Study')}</h2>

          <Link
            href="/exam"
            className={`card-hover block ${!isPremium ? 'opacity-60' : ''}`}
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-primary rounded-2xl flex items-center justify-center text-2xl shadow-glow-blue">
                📝
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-ink dark:text-white">{t('Examen DGT Oficial', 'Official DGT Exam')}</h3>
                <p className="text-sm text-ink-light">
                  {t('30 preguntas · 30 min · max. 3 fallos', '30 questions · 30 min · max 3 errors')}
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
                <h3 className="font-bold text-ink dark:text-white">{t('Tarjetas de Memoria', 'Flashcards')}</h3>
                <p className="text-sm text-ink-light">
                  {t('Repeticion espaciada · Senales y normas', 'Spaced repetition · Signs & rules')}
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
                <h3 className="font-bold text-ink dark:text-white">{t('Guardados', 'Bookmarks')}</h3>
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
                <h3 className="font-bold text-ink dark:text-white">{t('Mis Estadisticas', 'My Stats')}</h3>
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

        {/* Right column: Trends + Gamification */}
        <div className="space-y-4">
          {/* Study Trends Chart */}
          <StudyTrendsChart trends={trends} t={t} />

          {/* Gamification */}
          <h2 className="font-bold text-lg text-ink dark:text-white">{t('Mis Logros', 'My Achievements')}</h2>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-ink dark:text-white">{t('Ultimas Insignias', 'Recent Badges')}</h3>
              <Link href="/badges" className="text-primary text-sm font-medium hover:underline">
                {t('Ver todas', 'See all')}
              </Link>
            </div>
            {badges.length > 0 ? (
              <div className="flex gap-3">
                {badges.map((badge) => (
                  <div
                    key={badge.id}
                    className="flex-1 flex flex-col items-center gap-1 p-3 rounded-xl bg-slate-50 dark:bg-slate-700"
                    title={badge.name}
                  >
                    <span className="text-3xl">{badge.icon}</span>
                    <span className="text-xs font-medium text-ink dark:text-slate-300 text-center leading-tight">{badge.name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-light text-center py-4">
                {t('Completa tu primer examen para ganar insignias!', 'Complete your first exam to earn badges!')}
              </p>
            )}
          </div>

          <Link href="/leaderboard" className="card-hover block">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-ink dark:text-white">🏆 {t('Ranking Semanal', 'Weekly Leaderboard')}</h3>
              <span className="text-primary text-sm font-medium">{t('Ver', 'See')}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-4xl">🥇</div>
              <p className="text-sm text-ink-light">
                {t(
                  'Gana XP respondiendo preguntas y aparece en el Top 50',
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
                {t('Examenes, tarjetas, IA y gamificacion completa por solo $9.99/mes', 'Exams, flashcards, AI & full gamification for just $9.99/month')}
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
              {t('Suscribirse', 'Subscribe')}
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
