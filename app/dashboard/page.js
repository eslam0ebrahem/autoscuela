'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/components/AuthContext'
import { useToast } from '@/components/Toast'

// ── ReadinessRing ──────────────────────────────────────────
function ReadinessRing({ score, t }) {
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const dashoffset =
    score != null
      ? circumference - (score / 100) * circumference
      : circumference

  const color =
    score >= 90 ? '#10B981' :
    score >= 70 ? '#2563EB' :
    score >= 50 ? '#F59E0B' :
    '#EF4444'

  const label =
    score >= 90 ? t('¡Listo!', 'Ready!') :
    score >= 70 ? t('Bien', 'Good') :
    score >= 50 ? t('Sigue', 'Keep going') :
    t('Empieza', 'Start')

  return (
    <div className="relative flex items-center justify-center w-32 h-32">
      <svg width="128" height="128" className="-rotate-90">
        <circle cx="64" cy="64" r={radius} fill="none" stroke="currentColor"
          strokeWidth="10" className="text-base-200" />
        <circle cx="64" cy="64" r={radius} fill="none" stroke={color}
          strokeWidth="10" strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashoffset}
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-black text-base-content leading-none">
          {score ?? '--'}
        </span>
        <span className="text-[11px] font-semibold mt-0.5" style={{ color }}>
          {label}
        </span>
      </div>
    </div>
  )
}

// ── DashboardContent ───────────────────────────────────────
function DashboardContent() {
  const { user, t } = useAuth()
  const router = useRouter()
  const toast = useToast()

  const [loading, setLoading] = useState(true)
  const [readinessScore, setReadinessScore] = useState(null)
  const [streak, setStreak] = useState(0)
  const [challenge, setChallenge] = useState(null)
  const [insights, setInsights] = useState(null)
  const [badges, setBadges] = useState([])
  const [leaderboard, setLeaderboard] = useState([])
  const [startingExam, setStartingExam] = useState(false)
  const [startingChallenge, setStartingChallenge] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard').then(r => r.ok ? r.json() : {}),
    ])
      .then(([data]) => {
        setReadinessScore(data.readinessScore ?? null)
        setStreak(data.streak ?? 0)
        setChallenge(data.dailyChallenge ?? null)
        setInsights(data.insights ?? null)
        setBadges(data.badges ?? [])
        setLeaderboard(data.leaderboard ?? [])
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false))
  }, [])

  const handleStartExam = async () => {
    if (startingExam) return
    setStartingExam(true)
    try {
      const res = await fetch('/api/exams', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to start exam')
      const data = await res.json()
      router.push(`/exams/${data.sessionId}`)
    } catch (err) {
      console.error(err)
      toast.error(t('Error al iniciar el examen', 'Error starting exam'))
      setStartingExam(false)
    }
  }

  const handleStartChallenge = async () => {
    if (startingChallenge || challenge?.completedToday) return
    setStartingChallenge(true)
    try {
      const res = await fetch('/api/exams/daily-challenge', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to start challenge')
      const data = await res.json()
      router.push(`/exams/${data.sessionId}`)
    } catch (err) {
      console.error(err)
      toast.error(t('Error al iniciar el reto', 'Error starting challenge'))
      setStartingChallenge(false)
    }
  }

  // ── LOADING ──
  if (loading) {
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

  const quickActions = [
    {
      href: null,
      onClick: handleStartExam,
      icon: '📝',
      label: t('Examen Oficial', 'Official Exam'),
      sub: t('30 preguntas · 30 min', '30 questions · 30 min'),
      color: 'from-blue-500/10 to-blue-500/5 border-blue-500/20 hover:border-blue-500/50',
      loading: startingExam,
    },
    {
      href: '/flashcards',
      icon: '🃏',
      label: t('Tarjetas', 'Flashcards'),
      sub: t('Repetición espaciada', 'Spaced repetition'),
      color: 'from-pink-500/10 to-pink-500/5 border-pink-500/20 hover:border-pink-500/50',
    },
    {
      href: '/bookmarks',
      icon: '⭐',
      label: t('Guardadas', 'Bookmarks'),
      sub: t('Repasa tus favoritas', 'Review your saved'),
      color: 'from-amber-500/10 to-amber-500/5 border-amber-500/20 hover:border-amber-500/50',
    },
    {
      href: '/stats',
      icon: '📊',
      label: t('Progreso', 'Progress'),
      sub: t('Detalle por tema', 'By topic detail'),
      color: 'from-emerald-500/10 to-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/50',
    },
  ]

  return (
    <AppShell>
      <div className="min-h-screen bg-base-100">
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-24 space-y-5">

          {/* ── Hero card: greeting + ring + streak ── */}
          <div className="rounded-3xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-primary/70 uppercase tracking-widest mb-1">
                  {t('¿Listo para estudiar hoy?', 'Ready to study today?')}
                </p>
                <h1 className="text-xl sm:text-2xl font-black text-base-content truncate">
                  {t('Hola', 'Hey')}, {user?.nickname || user?.name || t('estudiante', 'student')} 👋
                </h1>
                <div className="mt-3 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/25 text-orange-500 text-sm font-bold">
                    🔥 {streak} {t('días', 'days')}
                  </span>
                  <span className="text-xs text-base-content/40">
                    {t('Racha actual', 'Current streak')}
                  </span>
                </div>
              </div>
              <ReadinessRing score={readinessScore} t={t} />
            </div>
            <p className="mt-3 text-xs text-base-content/50 text-center">
              {t('Puntuación de preparación en tiempo real', 'Real-time readiness score')}
            </p>
          </div>

          {/* ── Daily Challenge ── */}
          <button
            onClick={handleStartChallenge}
            disabled={challenge?.completedToday || startingChallenge}
            className={`w-full rounded-2xl border-2 p-4 text-left transition-all active:scale-[0.98]
              ${challenge?.completedToday
                ? 'bg-success/5 border-success/30 cursor-default'
                : 'bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border-indigo-500/30 hover:border-indigo-500/60 cursor-pointer'}`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0
                ${challenge?.completedToday ? 'bg-success/15' : 'bg-indigo-500/10'}`}>
                {challenge?.completedToday ? '✅' : '⚡'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-base-content">
                  {t('Reto diario', 'Daily Challenge')}
                </p>
                <p className={`text-xs mt-0.5 ${challenge?.completedToday ? 'text-success' : 'text-base-content/50'}`}>
                  {challenge?.completedToday
                    ? t('¡Completado hoy! Vuelve mañana.', 'Completed today! Come back tomorrow.')
                    : t('10 preguntas rápidas por +15 XP', '10 quick questions for +15 XP')}
                </p>
                {challenge?.streak > 0 && (
                  <p className="text-xs text-orange-500 font-semibold mt-1">
                    🔥 {challenge.streak} {t('días consecutivos', 'consecutive days')}
                  </p>
                )}
              </div>
              {!challenge?.completedToday && (
                <div className="shrink-0">
                  {startingChallenge
                    ? <span className="loading loading-spinner loading-sm text-primary" />
                    : <span className="text-indigo-500 text-lg">→</span>}
                </div>
              )}
            </div>
          </button>

          {/* ── AI Coach Insights ── */}
          {insights && (
            <div className="rounded-2xl border border-base-200 bg-base-50 overflow-hidden">
              <div className="px-4 py-3 bg-base-200/60 flex items-center gap-2 border-b border-base-200">
                <span className="text-base">🤖</span>
                <span className="font-bold text-sm text-base-content">
                  {t('Consejo de tu Coach IA', 'AI Coach Tip')}
                </span>
              </div>
              <div className="p-4 space-y-3">
                {insights.coach_message ? (
                  <p className="text-sm text-base-content/80 leading-relaxed">
                    {insights.coach_message}
                  </p>
                ) : (
                  <p className="text-sm text-base-content/50 italic">
                    {t(
                      'Completa al menos 2 exámenes para desbloquear tu análisis personalizado con IA.',
                      'Complete at least 2 exams to unlock your personalized AI analysis.'
                    )}
                  </p>
                )}

                {insights.weak_topics?.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-base-content/50 uppercase tracking-wide mb-2">
                      {t('Temas a reforzar', 'Topics to improve')}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {insights.weak_topics.map((topic, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-1 rounded-full bg-error/10 border border-error/25 text-error text-xs font-semibold"
                        >
                          {typeof topic === 'string' ? topic : topic.es || topic.en}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {insights.recommended_action && (
                  <Link
                    href={insights.recommended_action}
                    className="btn btn-primary btn-sm w-full rounded-xl mt-1"
                  >
                    {t('Iniciar estudio recomendado', 'Start Recommended Study')}
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* ── Quick Actions Grid ── */}
          <div>
            <h2 className="text-xs font-bold text-base-content/40 uppercase tracking-widest mb-3">
              {t('Acciones rápidas', 'Quick actions')}
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {quickActions.map((action, i) => {
                const inner = (
                  <div className={`rounded-2xl border bg-gradient-to-br ${action.color} p-4 h-full
                    flex flex-col gap-2 transition-all active:scale-[0.97]`}>
                    <span className="text-2xl">{action.icon}</span>
                    <div>
                      <p className="font-bold text-sm text-base-content leading-tight">
                        {action.loading
                          ? <span className="loading loading-dots loading-xs" />
                          : action.label}
                      </p>
                      <p className="text-xs text-base-content/50 mt-0.5 leading-tight">{action.sub}</p>
                    </div>
                  </div>
                )
                return action.href ? (
                  <Link key={i} href={action.href} className="block min-h-[100px]">{inner}</Link>
                ) : (
                  <button key={i} onClick={action.onClick} disabled={action.loading}
                    className="block min-h-[100px] text-left w-full">
                    {inner}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Badges ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold text-base-content/40 uppercase tracking-widest">
                {t('Insignias', 'Badges')}
              </h2>
              <Link href="/stats" className="text-xs text-primary font-semibold">
                {t('Ver todo', 'See all')}
              </Link>
            </div>
            {badges.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-base-300 p-5 text-center">
                <p className="text-3xl mb-2">🏅</p>
                <p className="text-sm text-base-content/50">
                  {t('¡Completa tu primer examen para ganar insignias!', 'Complete your first exam to earn badges!')}
                </p>
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
                {badges.map((badge, i) => (
                  <div
                    key={i}
                    className="shrink-0 flex flex-col items-center gap-1.5 w-16"
                    title={badge.name}
                  >
                    <div className="w-14 h-14 rounded-2xl bg-warning/10 border border-warning/25 flex items-center justify-center text-2xl shadow-sm">
                      {badge.icon || '🏅'}
                    </div>
                    <span className="text-[10px] text-center text-base-content/60 leading-tight line-clamp-2">
                      {badge.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Leaderboard teaser ── */}
          {leaderboard.length > 0 && (
            <div className="rounded-2xl border border-base-200 overflow-hidden">
              <div className="px-4 py-3 bg-base-200/60 flex items-center justify-between border-b border-base-200">
                <div className="flex items-center gap-2">
                  <span>🏆</span>
                  <span className="font-bold text-sm">{t('Top semanal', 'Weekly Top')}</span>
                </div>
                <Link href="/leaderboard" className="text-xs text-primary font-semibold">
                  {t('Ver ranking', 'Full ranking')}
                </Link>
              </div>
              <div className="divide-y divide-base-200">
                {leaderboard.slice(0, 3).map((entry, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <span className={`w-6 text-center font-black text-sm
                      ${i === 0 ? 'text-yellow-500' : i === 1 ? 'text-slate-400' : 'text-amber-700'}`}>
                      {i + 1}
                    </span>
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                      {(entry.nickname || entry.name || '?')[0].toUpperCase()}
                    </div>
                    <span className="flex-1 text-sm font-semibold truncate">
                      {entry.nickname || entry.name}
                      {entry.isCurrentUser && (
                        <span className="ml-1.5 text-[10px] text-primary font-bold">
                          {t('(tú)', '(you)')}
                        </span>
                      )}
                    </span>
                    <span className="text-sm font-black text-warning">
                      {entry.xp ?? entry.score} XP
                    </span>
                  </div>
                ))}
              </div>
              <div className="px-4 py-2.5 bg-base-50 border-t border-base-200">
                <p className="text-xs text-center text-base-content/40">
                  {t(
                    'Gana XP respondiendo preguntas y compite para entrar en el Top 50.',
                    'Earn XP by answering questions and compete to enter the Top 50.'
                  )}
                </p>
              </div>
            </div>
          )}

          {/* ── Premium upsell ── */}
          {!user?.isPremium && (
            <Link
              href="/settings"
              className="block rounded-2xl bg-gradient-to-r from-primary/15 via-purple-500/10 to-pink-500/15
                border border-primary/25 p-5 transition-all active:scale-[0.98] hover:border-primary/50"
            >
              <div className="flex items-start gap-4">
                <span className="text-3xl shrink-0">✨</span>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-base text-base-content">
                    {t('Desbloquea Premium', 'Unlock Premium')}
                  </p>
                  <p className="text-xs text-base-content/60 mt-1 leading-snug">
                    {t(
                      'Exámenes, tarjetas, IA y gamificación completa por solo $9.99/mes.',
                      'Exams, flashcards, AI & full gamification for just $9.99/month.'
                    )}
                  </p>
                </div>
                <span className="text-primary font-bold text-lg shrink-0">→</span>
              </div>
            </Link>
          )}

        </div>
      </div>
    </AppShell>
  )
}

export default function DashboardPage() {
  return <DashboardContent />
}
