'use client'
import { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/components/AuthContext'
import { useToast } from '@/components/Toast'
import { useFetch } from '@/lib/useFetch'
import Spinner from '@/components/ui/Spinner'
import {
  LineChartOutlined,
  RobotOutlined,
  BulbOutlined,
  TrophyOutlined,
  FireOutlined,
  GlobalOutlined,
  FileTextOutlined,
  IdcardOutlined,
  CloseCircleOutlined,
  StarOutlined,
  CrownOutlined,
  ArrowRightOutlined,
  TrophyFilled,
  ReloadOutlined,
} from '@ant-design/icons'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const READINESS_THRESHOLDS = {
  READY: 90,
  GOOD: 70,
  PROGRESS: 50,
}

const READINESS_COLORS = {
  READY: '#10B981',
  GOOD: '#6366F1',
  PROGRESS: '#F59E0B',
  START: '#F43F5E',
}

// ---------------------------------------------------------------------------
// ReadinessRing Component (Memoized)
// ---------------------------------------------------------------------------
const ReadinessRing = memo(function ReadinessRing({ score, t }) {
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const validScore = typeof score === 'number' && !isNaN(score) ? score : 0
  const dashoffset =
    score != null ? circumference - (validScore / 100) * circumference : circumference

  const { color, label } = useMemo(() => {
    if (score >= READINESS_THRESHOLDS.READY) {
      return { color: READINESS_COLORS.READY, label: t('¡Listo!', 'Ready!') }
    }
    if (score >= READINESS_THRESHOLDS.GOOD) {
      return { color: READINESS_COLORS.GOOD, label: t('Bien', 'Good') }
    }
    if (score >= READINESS_THRESHOLDS.PROGRESS) {
      return { color: READINESS_COLORS.PROGRESS, label: t('Sigue', 'Keep going') }
    }
    return { color: READINESS_COLORS.START, label: t('Empieza', 'Start') }
  }, [score, t])

  return (
    <div className="flex flex-col items-center shrink-0">
      <div className="relative w-28 h-28 md:w-36 md:h-36">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="currentColor"
            className="text-slate-100 dark:text-slate-800"
            strokeWidth="8"
          />
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
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {score != null ? (
            <>
              <span className="text-2xl md:text-3xl font-black text-ink dark:text-white">
                {validScore}
              </span>
              <span
                className="text-[10px] md:text-xs font-bold uppercase tracking-wider"
                style={{ color }}
              >
                {label}
              </span>
            </>
          ) : (
            <span className="text-sm text-slate-400">—</span>
          )}
        </div>
      </div>
    </div>
  )
})

// ---------------------------------------------------------------------------
// QuickActionCard Component (Memoized)
// ---------------------------------------------------------------------------
const QuickActionCard = memo(function QuickActionCard({
  icon,
  title,
  desc,
  color,
  onClick,
  loading = false,
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`card hover:scale-105 active:scale-95 transition-all duration-200 text-left disabled:opacity-50 disabled:cursor-not-allowed ${loading ? 'animate-pulse' : ''}`}
    >
      <div
        className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center text-white text-2xl mb-3 shadow-lg`}
      >
        {icon}
      </div>
      <h3 className="text-base font-black text-ink dark:text-white">{title}</h3>
      <p className="text-xs text-ink-light dark:text-slate-400 mt-1">{desc}</p>
    </button>
  )
})

// ---------------------------------------------------------------------------
// Main Dashboard Content
// ---------------------------------------------------------------------------
function DashboardContent() {
  const { user, t } = useAuth()
  const router = useRouter()
  const toast = useToast()
  const abortController = useFetch()

  // ── State ──────────────────────────────────────────────────────────────
  const [insights, setInsights] = useState(null)
  const [streak, setStreak] = useState(0)
  const [badges, setBadges] = useState([])
  const [trends, setTrends] = useState([])
  const [leaderboard, setLeaderboard] = useState([])
  const [readinessScore, setReadinessScore] = useState(null)
  const [loading, setLoading] = useState(true)
  const [startingExam, setStartingExam] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const isPremium = user?.isPremium

  // ── Fetch Dashboard Data ───────────────────────────────────────────────
  const fetchData = useCallback(
    async (force = false) => {
      try {
        setRefreshing(force)
        const forceParam = force ? '?force=true' : ''

        const [dashResult, trendsResult] = await Promise.allSettled([
          fetch(`/api/dashboard${forceParam}`, { signal: abortController.current.signal }).then(
            (r) => r.json()
          ),
          fetch('/api/stats/trends?days=7', { signal: abortController.current.signal }).then((r) =>
            r.json()
          ),
        ])

        if (dashResult.status === 'fulfilled') {
          const dashRes = dashResult.value
          if (dashRes.error) {
            console.error('[dashboard] Dashboard API error:', dashRes.error)
            toast?.error?.(t('Error al cargar el panel', 'Failed to load dashboard'), dashRes.error)
          } else {
            setInsights(dashRes.insights ?? null)
            setStreak(dashRes.streak ?? 0)
            setBadges(dashRes.badges ?? [])
            setLeaderboard(dashRes.leaderboard ?? [])
            setReadinessScore(dashRes.readinessScore != null ? Number(dashRes.readinessScore) : 0)
          }
        } else {
          // dashResult.status === 'rejected'
          if (dashResult.reason?.name !== 'AbortError') {
            console.error('[dashboard] Dashboard fetch failed:', dashResult.reason)
            toast?.error?.(
              t('Error al cargar el panel', 'Failed to load dashboard'),
              dashResult.reason?.message
            )
          }
        }

        if (trendsResult.status === 'fulfilled') {
          setTrends(trendsResult.value?.trends ?? [])
        } else {
          if (trendsResult.reason?.name !== 'AbortError') {
            console.error('[dashboard] Trends fetch failed:', trendsResult.reason)
          }
        }
      } catch (e) {
        // Ignore abort errors (component unmounted)
        if (e.name === 'AbortError') return
        console.error('[dashboard] Fetch error:', e)
        toast?.error?.(t('Error al cargar el panel', 'Failed to load dashboard'), e.message)
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [t, toast, abortController]
  )

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ── Start Exam Handler ─────────────────────────────────────────────────
  const handleStartExam = useCallback(async () => {
    if (startingExam) return
    setStartingExam(true)

    try {
      const res = await fetch('/api/exams/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'official' }),
        signal: abortController.current.signal,
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data.error || t('Error al iniciar examen', 'Failed to start exam'))
      }

      if (data.examId) {
        router.push(`/exam/${data.examId}`)
      } else {
        throw new Error(t('ID de examen no recibido', 'No exam ID received'))
      }
    } catch (e) {
      if (e.name === 'AbortError') return
      console.error('[dashboard] Start exam error:', e)
      toast?.error?.(t('Error', 'Error'), e.message)
      setStartingExam(false)
    }
  }, [startingExam, router, toast, t, abortController])

  // ── Refresh Handler ────────────────────────────────────────────────────
  const handleRefresh = useCallback(() => {
    if (!refreshing) fetchData(true)
  }, [refreshing, fetchData])

  // ── Loading State ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Spinner size="lg" message={t('Cargando tu panel...', 'Loading your dashboard...')} />
      </div>
    )
  }

  return (
    <div className="container-wrapper space-y-6">
      {/* ── Hero Header ────────────────────────────────────────────── */}
      <div className="card bg-gradient-to-br from-primary to-indigo-600 text-white border-0 shadow-2xl">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left">
            <h1 className="text-2xl md:text-3xl font-black">
              {t('Día', 'Day')} {streak || 1} — {t('¿Listo para aprobar?', 'Ready to pass?')}
            </h1>
            {insights?.coachMessage && (
              <p className="text-indigo-100 font-medium mt-2 text-sm md:text-base max-w-2xl">
                {insights.coachMessage}
              </p>
            )}
          </div>
          <ReadinessRing score={readinessScore} t={t} />
        </div>
      </div>

      {/* ── Quick Stats ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="card text-center hover:shadow-lg transition-shadow">
          <div className="text-3xl md:text-4xl font-black text-primary">{badges.length}</div>
          <p className="text-xs md:text-sm text-ink-light dark:text-slate-400 mt-1 font-semibold">
            {t('Insignias', 'Badges')}
          </p>
        </div>
        <div className="card text-center hover:shadow-lg transition-shadow">
          <div className="text-3xl md:text-4xl font-black text-orange-500 flex items-center justify-center gap-2">
            <FireOutlined /> {streak}
          </div>
          <p className="text-xs md:text-sm text-ink-light dark:text-slate-400 mt-1 font-semibold">
            {t('Racha', 'Streak')}
          </p>
        </div>
        <div className="card text-center hover:shadow-lg transition-shadow col-span-2 md:col-span-1">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="w-full h-full flex flex-col items-center justify-center disabled:opacity-50"
          >
            <ReloadOutlined
              className={`text-2xl md:text-3xl text-slate-500 dark:text-slate-400 ${refreshing ? 'animate-spin' : ''}`}
            />
            <p className="text-xs md:text-sm text-ink-light dark:text-slate-400 mt-1 font-semibold">
              {refreshing ? t('Actualizando...', 'Refreshing...') : t('Actualizar', 'Refresh')}
            </p>
          </button>
        </div>
      </div>

      {/* ── Quick Actions ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <QuickActionCard
          icon={<FileTextOutlined />}
          title={t('Nuevo Examen', 'New Exam')}
          desc={t('Oficial DGT 30Q', 'Official DGT 30Q')}
          color="from-primary to-indigo-600"
          onClick={handleStartExam}
          loading={startingExam}
        />
        <QuickActionCard
          icon={<LineChartOutlined />}
          title={t('Progreso', 'Progress')}
          desc={t('Ver estadísticas', 'View stats')}
          color="from-green-400 to-emerald-600"
          onClick={() => router.push('/stats')}
        />
        <QuickActionCard
          icon={<RobotOutlined />}
          title={t('IA Coach', 'AI Coach')}
          desc={t('Análisis personalizado', 'Personalized insights')}
          color="from-purple-400 to-violet-600"
          onClick={() => router.push('/ai-insights')}
        />
        <QuickActionCard
          icon={<BulbOutlined />}
          title={t('Temas', 'Topics')}
          desc={t('Practicar por tema', 'Practice by topic')}
          color="from-amber-400 to-orange-600"
          onClick={() => router.push('/exam?mode=custom')}
        />
      </div>

      {/* ── Leaderboard ────────────────────────────────────────────── */}
      {leaderboard?.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center text-white">
              <TrophyOutlined className="text-xl" />
            </div>
            <div>
              <h2 className="text-lg font-black text-ink dark:text-white">
                {t('Ranking Global', 'Global Ranking')}
              </h2>
              <p className="text-xs text-ink-light dark:text-slate-400">
                {t('Top semanal', 'Weekly Top')}
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {leaderboard.map((entry, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                  entry.isCurrentUser
                    ? 'bg-primary/10 border-2 border-primary shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${
                    i === 0
                      ? 'bg-yellow-500 text-white'
                      : i === 1
                        ? 'bg-slate-300 text-white'
                        : i === 2
                          ? 'bg-amber-700 text-white'
                          : 'text-ink-light'
                  }`}
                >
                  {i === 0 ? <TrophyFilled /> : (entry.rank ?? i + 1)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-ink dark:text-white truncate">
                    {entry.nickname || entry.name || 'Anonymous'}{' '}
                    {entry.isCurrentUser && (
                      <span className="text-primary text-[10px] ml-1">(tú)</span>
                    )}
                  </p>
                </div>
                <div className="text-sm font-black text-primary">
                  {entry.weeklyXP ?? entry.xp ?? entry.score ?? 0} XP
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Upgrade Banner ─────────────────────────────────────────── */}
      {!isPremium && (
        <div className="card bg-gradient-to-r from-amber-400 to-orange-500 text-white border-0 shadow-xl overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-20 rotate-12 scale-150">
            <CrownOutlined style={{ fontSize: '100px' }} />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-center md:text-left">
              <h3 className="text-xl font-black">
                {t('Desbloquea Vialia Premium', 'Unlock Vialia Premium')}
              </h3>
              <p className="text-orange-100 font-medium text-sm mt-1">
                {t(
                  'Acceso ilimitado a todos los exámenes e IA.',
                  'Unlimited access to all exams and AI.'
                )}
              </p>
            </div>
            <Link
              href="/settings"
              className="px-8 py-3 bg-white text-orange-600 font-black rounded-xl hover:bg-orange-50 transition-all shadow-lg active:scale-95"
            >
              {t('Saber más', 'Learn More')} <ArrowRightOutlined />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page Export
// ---------------------------------------------------------------------------
export default function DashboardPage() {
  return (
    <AppShell>
      <DashboardContent />
    </AppShell>
  )
}
