'use client'
import { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/components/AuthContext'
import { useToast } from '@/components/Toast'
import { useFetch } from '@/lib/useFetch'
import confetti from 'canvas-confetti'
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
  CheckCircleOutlined,
  CalendarOutlined,
  ThunderboltOutlined,
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
  const [examsTakenToday, setExamsTakenToday] = useState(0)
  const [activePlan, setActivePlan] = useState(null)
  const [dailyProgress, setDailyProgress] = useState(null)
  const [planStats, setPlanStats] = useState(null)
  const [planTracking, setPlanTracking] = useState(null)
  const [loading, setLoading] = useState(true)
  const [startingExam, setStartingExam] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [hasCelebrated, setHasCelebrated] = useState(() => {
    // Persist celebration per day so confetti only fires once
    if (typeof window === 'undefined') return false
    const todayKey = `celebrated_${new Date().toISOString().slice(0, 10)}`
    return localStorage.getItem(todayKey) === '1'
  })
  const [pendingReviews, setPendingReviews] = useState(0)

  const isPremium = user?.isPremium

  // ── Fetch Dashboard Data ───────────────────────────────────────────────
  const fetchData = useCallback(
    async (force = false) => {
      try {
        setRefreshing(force)
        const forceParam = force ? '?force=true' : ''

        // Recreate abort controller to avoid using an aborted signal
        if (abortController.current?.signal.aborted) {
          abortController.current = new AbortController()
        }

        const dashRes = await fetch(`/api/dashboard${forceParam}`, {
          signal: abortController.current.signal,
        }).then((r) => r.json())

        if (dashRes.error) {
          console.error('[dashboard] Dashboard API error:', dashRes.error)
          toast?.error?.(t('Error al cargar el panel', 'Failed to load dashboard'), dashRes.error)
        } else {
          setInsights(dashRes.insights || null)
          setStreak(dashRes.streak || 0)
          setBadges(dashRes.badges || [])
          setLeaderboard(dashRes.leaderboard || [])
          setReadinessScore(dashRes.readinessScore || null)
          setExamsTakenToday(dashRes.examsTakenToday || 0)
          setActivePlan(dashRes.activePlan || null)
          setDailyProgress(dashRes.dailyProgress || null)
          setPlanStats(dashRes.planStats || null)
          setPlanTracking(dashRes.planTracking || null)
          setPendingReviews(dashRes.pendingReviewsCount || 0)
          setTrends(dashRes.studyTrends || []) // Use studyTrends directly from dashboard response
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('[dashboard] Fetch error:', err)
          toast?.error?.(t('Error de conexión', 'Connection error'))
        }
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [abortController, t, toast]
  )

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ── Confetti Celebration ───────────────────────────────────────────────
  useEffect(() => {
    if (dailyProgress?.goalsMet && !hasCelebrated) {
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']
      })
      setHasCelebrated(true)
      // Persist so refresh / re-navigation doesn't re-trigger
      const todayKey = `celebrated_${new Date().toISOString().slice(0, 10)}`
      localStorage.setItem(todayKey, '1')
    }
  }, [dailyProgress, hasCelebrated])

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
              {streak > 0
                ? <>{t('Día', 'Day')} {streak} — {t('¿Listo para aprobar?', 'Ready to pass?')}</>
                : t('¡Bienvenido a Vialia!', 'Welcome to Vialia!')}
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
        <div className="card text-center hover:shadow-lg transition-shadow">
          <div className="text-3xl md:text-4xl font-black text-indigo-500 flex items-center justify-center gap-2">
            <CheckCircleOutlined /> {examsTakenToday}
          </div>
          <p className="text-xs md:text-sm text-ink-light dark:text-slate-400 mt-1 font-semibold">
            {t('Exámenes hoy', 'Exams today')}
          </p>
        </div>
        <div className="card text-center hover:shadow-lg transition-shadow">
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

      {/* ── Daily Plan Progress ────────────────────────────────────── */}
      {activePlan && dailyProgress ? (
        <div className="card shadow-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 animate-fade-in relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none scale-150 rotate-12">
            <CalendarOutlined style={{ fontSize: '100px' }} />
          </div>
          <div className="relative z-10">
            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
                <CalendarOutlined className="text-2xl" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-black text-ink dark:text-white">
                  {t('Tu Plan de Hoy', 'Your Daily Plan')}
                </h2>
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                  {dailyProgress.goalsMet
                    ? `🎉 ${t('¡Objetivos cumplidos!', 'Goals completed!')}`
                    : `${dailyProgress.overallPercent || 0}% ${t('completado', 'complete')}`}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                {planTracking?.planStreak > 0 && (
                  <span className="flex items-center gap-1 text-xs font-black text-orange-500 bg-orange-50 dark:bg-orange-900/20 px-2.5 py-1 rounded-full">
                    <FireOutlined /> {planTracking.planStreak} {t('días', 'days')}
                  </span>
                )}
                <Link href="/study-plan" className="text-primary text-xs font-bold bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-lg transition-colors">
                  {t('Ver plan', 'View plan')}
                </Link>
              </div>
            </div>

            {/* Overall Progress Bar */}
            <div className="mb-5">
              <div className="h-2 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ease-out ${
                    dailyProgress.goalsMet
                      ? 'bg-gradient-to-r from-emerald-400 to-green-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]'
                      : 'bg-gradient-to-r from-primary to-indigo-500 shadow-[0_0_10px_rgba(79,70,229,0.3)]'
                  }`}
                  style={{ width: `${dailyProgress.overallPercent || 0}%` }}
                />
              </div>
            </div>

            {/* Three Metric Cards */}
            <div className="grid grid-cols-3 gap-3">
              {/* Exams */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 text-center">
                <FileTextOutlined className="text-lg text-primary mb-1" />
                <div className="font-black text-xl text-ink dark:text-white leading-none mt-1">
                  {dailyProgress.exams.current}<span className="text-sm text-slate-400 font-bold">/{dailyProgress.exams.target}</span>
                </div>
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wide">
                  {t('Exámenes', 'Exams')}
                </p>
                <div className="h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mt-2">
                  <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: `${dailyProgress.exams.percent}%` }} />
                </div>
                {dailyProgress.exams.current >= dailyProgress.exams.target && (
                  <CheckCircleOutlined className="text-emerald-500 text-xs mt-1.5" />
                )}
              </div>

              {/* Questions */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 text-center">
                <BulbOutlined className="text-lg text-purple-500 mb-1" />
                <div className="font-black text-xl text-ink dark:text-white leading-none mt-1">
                  {dailyProgress.questions.current}<span className="text-sm text-slate-400 font-bold">/{dailyProgress.questions.target}</span>
                </div>
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wide">
                  {t('Preguntas', 'Questions')}
                </p>
                <div className="h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mt-2">
                  <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-700" style={{ width: `${dailyProgress.questions.percent}%` }} />
                </div>
                {dailyProgress.questions.current >= dailyProgress.questions.target && (
                  <CheckCircleOutlined className="text-emerald-500 text-xs mt-1.5" />
                )}
              </div>

              {/* Minutes */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 text-center">
                <ThunderboltOutlined className="text-lg text-amber-500 mb-1" />
                <div className="font-black text-xl text-ink dark:text-white leading-none mt-1">
                  {dailyProgress.minutes.current}<span className="text-sm text-slate-400 font-bold">/{dailyProgress.minutes.target}</span>
                </div>
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wide">
                  {t('Minutos', 'Minutes')}
                </p>
                <div className="h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mt-2">
                  <div className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-700" style={{ width: `${dailyProgress.minutes.percent}%` }} />
                </div>
                {dailyProgress.minutes.current >= dailyProgress.minutes.target && (
                  <CheckCircleOutlined className="text-emerald-500 text-xs mt-1.5" />
                )}
              </div>
            </div>

            {/* Plan Timeline + History Dots */}
            {planStats && (
              <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    {planStats.daysRemaining} {t('días restantes', 'days remaining')}
                  </span>
                  <span className="text-xs font-bold text-slate-400">
                    {planStats.timelinePercent}%
                  </span>
                </div>
                <div className="h-1.5 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-indigo-400 to-violet-500 rounded-full transition-all duration-500" style={{ width: `${planStats.timelinePercent}%` }} />
                </div>

                {/* 7-day history dots */}
                {planTracking?.dailyHistory?.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-3 justify-end">
                    <span className="text-[10px] text-slate-400 mr-1">{t('Últimos 7d', 'Last 7d')}</span>
                    {planTracking.dailyHistory.map((day, i) => (
                      <div
                        key={i}
                        title={`${day.date}: ${day.goalsMet ? '✅' : '❌'}`}
                        className={`w-3 h-3 rounded-full transition-all ${
                          day.goalsMet
                            ? 'bg-emerald-500 shadow-sm shadow-emerald-500/40'
                            : 'bg-slate-300 dark:bg-slate-600'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : !activePlan && !loading && (
        /* CTA to create a plan when none exists */
        <div className="card border-2 border-dashed border-indigo-300 dark:border-indigo-700 bg-indigo-50/50 dark:bg-indigo-900/10 hover:border-indigo-400 dark:hover:border-indigo-600 transition-colors group">
          <div className="flex flex-col md:flex-row items-center gap-4 text-center md:text-left">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl shadow-lg group-hover:scale-110 transition-transform">
              <CalendarOutlined />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-black text-ink dark:text-white">
                {t('Crea tu Plan de Estudio', 'Create Your Study Plan')}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {t('Nuestra IA diseñará una ruta personalizada para tu examen.', 'Our AI will design a personalized path for your exam.')}
              </p>
            </div>
            <Link
              href="/study-plan"
              className="btn-primary px-6 py-2.5 font-bold rounded-xl shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all flex items-center gap-2"
            >
              <StarOutlined /> {t('Empezar', 'Get Started')}
            </Link>
          </div>
        </div>
      )}

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
        <QuickActionCard
          icon={<ThunderboltOutlined />}
          title={t('Repaso Inteligente', 'Smart Review')}
          desc={pendingReviews > 0 ? `${pendingReviews} ${t('pendientes', 'pending')}` : t('Todo al día', 'All caught up')}
          color="from-blue-500 to-cyan-600"
          onClick={() => router.push('/exam?mode=spaced_repetition')}
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
                      <span className="text-primary text-[10px] ml-1">{t('(tú)', '(you)')}</span>
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
