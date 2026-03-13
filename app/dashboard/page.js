'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/components/AuthContext'
import { useToast } from '@/components/Toast'
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
  TrophyFilled
} from '@ant-design/icons'

// ── ReadinessRing ──────────────────────────────────────────
function ReadinessRing({ score, t }) {
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const validScore = typeof score === 'number' && !isNaN(score) ? score : 0
  const dashoffset = score != null ? circumference - (validScore / 100) * circumference : circumference

  const color = score >= 90 ? '#10B981' : score >= 70 ? '#2563EB' : score >= 50 ? '#F59E0B' : '#EF4444'
  
  const label = score >= 90
    ? t('¡Listo!', 'Ready!')
    : score >= 70
    ? t('Bien', 'Good')
    : score >= 50
    ? t('Sigue', 'Keep going')
    : t('Empieza', 'Start')

  return (
    <div className="flex flex-col items-center shrink-0">
      <div className="relative w-28 h-28 md:w-36 md:h-36">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="currentColor" className="text-slate-100 dark:text-slate-800" strokeWidth="8" />
          <circle
            cx="60" cy="60" r={radius} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={dashoffset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {score != null ? (
            <>
              <span className="text-2xl md:text-3xl font-black" style={{ color }}>{score}%</span>
              <span className="text-[10px] md:text-xs text-ink-light font-bold uppercase tracking-widest">{label}</span>
            </>
          ) : (
            <span className="text-3xl animate-pulse text-primary"><FileTextOutlined /></span>
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
    <div className="card glass">
      <h3 className="font-bold text-ink dark:text-white mb-6 flex items-center gap-2">
        <LineChartOutlined className="text-primary" /> {t('Tu Actividad', 'Your Activity')}
      </h3>
      
      <div className="flex items-end gap-2 h-32 px-1">
        {trends.map((day, i) => {
          const height = maxQuestions > 0 ? (day.questions / maxQuestions) * 100 : 0
          const date = day.date ? new Date(day.date) : new Date()
          const isInvalidDate = isNaN(date.getTime())
          const dayName = isInvalidDate ? '?' : date.toLocaleDateString(undefined, { weekday: 'short' }).charAt(0)
          
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-2 group relative">
              <div
                className="w-full rounded-t-lg transition-all duration-300 group-hover:brightness-110 shadow-sm"
                style={{
                  height: `${Math.max(Number(height) || 0, 5)}%`,
                  backgroundColor: (day.accuracy || 0) >= 80 ? '#10B981' : (day.accuracy || 0) >= 60 ? '#F59E0B' : '#EF4444',
                }}
              />
              <span className="text-[10px] font-bold text-ink-light dark:text-slate-500 uppercase">
                {dayName}
              </span>
              
              <div className="absolute bottom-full mb-2 hidden group-hover:block z-10 glass px-2 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap shadow-xl">
                {day.questions} q / {day.accuracy}%
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ActionCard({ href, onClick, icon, title, desc, color, premium, t, disabled, loading }) {
  const content = (
    <div className={`card-hover h-full flex flex-col gap-4 border-b-4 ${color} ${disabled ? 'opacity-60 grayscale' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl bg-white dark:bg-slate-700 shadow-inner text-primary">
          {loading ? <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" /> : icon}
        </div>
        {premium && <span className="text-xs font-black uppercase tracking-widest text-primary bg-primary/10 px-2 py-1 rounded-lg">PRO</span>}
      </div>
      <div>
        <h3 className="font-black text-lg text-ink dark:text-white flex items-center gap-2">
          {title}
        </h3>
        <p className="text-sm text-ink-light dark:text-slate-400 mt-1 leading-snug">
          {desc}
        </p>
      </div>
    </div>
  )

  if (disabled) return <div className="cursor-not-allowed">{content}</div>
  if (onClick) return <button onClick={onClick} className="block w-full text-left transition-transform active:scale-95">{content}</button>
  return <Link href={href} className="block transition-transform active:scale-95">{content}</Link>
}

// ==== MAIN DASHBOARD CONTENT ====

function DashboardContent() {
  const { user, t } = useAuth()
  const router = useRouter()
  const toast = useToast()
  
  const [insights, setInsights] = useState(null)
  const [stats, setStats] = useState(null)
  const [streak, setStreak] = useState(0)
  const [badges, setBadges] = useState([])
  const [trends, setTrends] = useState([])
  const [leaderboard, setLeaderboard] = useState([])
  const [loading, setLoading] = useState(true)
  const [startingExam, setStartingExam] = useState(false)

  const isPremium = user?.isPremium

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [dashRes, trendsRes] = await Promise.all([
          fetch('/api/dashboard').then(r => r.json()),
          fetch('/api/stats/trends?days=7').then(r => r.json())
        ])

        setInsights(dashRes.insights)
        setStreak(dashRes.streak || 0)
        setBadges(dashRes.badges || [])
        setLeaderboard(dashRes.leaderboard || [])
        setReadinessScore(Number(dashRes.readinessScore) || 0)
        setTrends(trendsRes?.trends || [])
      } catch (e) {
        console.error('Dashboard Fetch Error:', e)
        if (e instanceof Error) {
           console.error('Error Message:', e.message)
           console.error('Error Stack:', e.stack)
        }
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const [readinessScore, setReadinessScore] = useState(null)

  const handleStartExam = async () => {
    if (startingExam) return
    setStartingExam(true)
    try {
      const res = await fetch('/api/exams', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to start exam')
      const data = await res.json()
      router.push(`/exam/${data.sessionId}`)
    } catch (err) {
      console.error(err)
      toast.error(t('Error al iniciar el examen', 'Error starting exam'))
      setStartingExam(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <p className="text-sm text-base-content/50 animate-pulse">
          {t('Cargando tu panel...', 'Loading your dashboard...')}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      
      {/* Welcome Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-ink dark:text-white">
            {t('¡Hola', 'Hey')}, {user?.nickname}!
          </h1>
          <p className="text-ink-light dark:text-slate-400 font-medium">
            {t('Día', 'Day')} {streak || 1} — {t('¿Listo para aprobar?', "Ready to pass?")}
          </p>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          <div className="flex flex-col items-end">
             <span className="text-xl md:text-2xl font-black text-amber-500">{user?.gamification?.totalXP || 0}</span>
             <span className="text-[10px] font-black uppercase tracking-widest text-ink-light">XP</span>
          </div>
          {streak > 0 && (
            <div className="w-12 h-12 md:w-14 md:h-14 bg-orange-50 dark:bg-orange-900/20 rounded-2xl flex items-center justify-center text-xl md:text-2xl border border-orange-100 dark:border-orange-800/50 shadow-sm text-orange-500">
              <FireOutlined />
            </div>
          )}
        </div>
      </div>

      {/* Hero: AI Status & Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card bg-gradient-to-br from-indigo-600 to-blue-700 text-white border-0 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-700">
             <BulbOutlined style={{ fontSize: '120px' }} />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
            <ReadinessRing score={readinessScore} t={t} />
            <div className="flex-1 text-center md:text-left space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest">
                <RobotOutlined /> AI Coach
              </div>
              <h2 className="text-xl md:text-2xl font-black leading-tight">
                {insights?.coach_message || t('Sigue practicando para activar el análisis IA.', 'Keep practicing to unlock AI analysis.')}
              </h2>
              {insights?.recommended_action && (
                <Link
                  href={insights.recommended_action}
                  className="inline-flex items-center gap-3 px-6 py-3 bg-white text-blue-700 font-black rounded-xl hover:bg-blue-50 transition-all active:scale-95 shadow-lg shadow-black/10"
                >
                  ⚡ {t('Iniciar estudio recomendado', 'Start Recommended Study')}
                </Link>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 h-full">
           <div className="card glass flex flex-col justify-between">
              <TrophyOutlined className="text-2xl text-amber-500" />
              <div>
                <p className="text-2xl font-black text-ink dark:text-white">{badges.length}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-ink-light">{t('Insignias', 'Badges')}</p>
              </div>
           </div>
           <div className="card glass flex flex-col justify-between">
              <FireOutlined className="text-2xl text-orange-500" />
              <div>
                <p className="text-2xl font-black text-ink dark:text-white">{streak}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-ink-light">{t('Racha', 'Streak')}</p>
              </div>
           </div>
           <div className="card glass flex flex-col justify-between lg:col-span-2">
              <GlobalOutlined className="text-2xl text-blue-500" />
              <div>
                <p className="text-sm font-black text-ink dark:text-white uppercase">{t('Ranking Global', 'Global Ranking')}</p>
                <p className="text-[10px] font-bold text-ink-light uppercase">{t('Top semanal', 'Weekly Top')}</p>
              </div>
           </div>
        </div>
      </div>

      {/* Main Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <ActionCard
          onClick={handleStartExam}
          loading={startingExam}
          icon={<FileTextOutlined />}
          title={t('Examen DGT', 'DGT Exam')}
          desc={t('Simulacro oficial de 30 preguntas.', 'Official 30-question simulation.')}
          color="border-blue-500"
          premium={!isPremium}
          t={t}
        />
        <ActionCard
          href="/flashcards"
          icon={<IdcardOutlined />}
          title={t('Tarjetas', 'Flashcards')}
          desc={t('Memoriza señales y normas rápido.', 'Memorize signs & rules fast.')}
          color="border-purple-500"
          premium={!isPremium}
          t={t}
        />
        <ActionCard
          href="/mistakes"
          icon={<CloseCircleOutlined />}
          title={t('Repasar Errores', 'Review Mistakes')}
          desc={t('Practica las que has fallado.', 'Practice what you missed.')}
          color="border-red-500"
          t={t}
        />
        <ActionCard
          href="/dashboard/bookmarks"
          icon={<StarOutlined />}
          title={t('Guardadas', 'Bookmarked')}
          desc={t('Tus preguntas favoritas.', 'Your favorite questions.')}
          color="border-amber-500"
          t={t}
        />
      </div>

      {/* Activity & Social */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StudyTrendsChart trends={trends} t={t} />
        
        <div className="card glass flex flex-col justify-between">
           <div className="flex items-center justify-between mb-6">
             <h3 className="font-bold text-ink dark:text-white flex items-center gap-2">
               <TrophyOutlined className="text-amber-500" /> {t('Ranking Global', 'Global Ranking')}
             </h3>
             <Link href="/leaderboard" className="text-xs font-black text-primary uppercase tracking-widest hover:underline">
               {t('Ver todo', 'See all')}
             </Link>
           </div>
           
           <div className="space-y-4 divide-y divide-slate-100 dark:divide-slate-800">
              {leaderboard.slice(0, 3).map((entry, i) => (
                <div key={i} className="flex items-center gap-4 py-3 first:pt-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${i === 0 ? 'bg-yellow-500 text-white' : i === 1 ? 'bg-slate-300 text-white' : i === 2 ? 'bg-amber-700 text-white' : 'text-ink-light'}`}>
                    {i === 0 ? <TrophyFilled /> : i + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-ink dark:text-white">{entry.nickname || entry.name} {entry.isCurrentUser && <span className="text-primary text-[10px] ml-1">(tú)</span>}</p>
                  </div>
                  <div className="text-sm font-black text-primary">{entry.xp ?? entry.score} XP</div>
                </div>
              ))}
           </div>
        </div>
      </div>

      {/* Upgrade Banner */}
      {!isPremium && (
        <div className="card bg-gradient-to-r from-amber-400 to-orange-500 text-white border-0 shadow-xl overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-20 rotate-12 scale-150">
            <CrownOutlined style={{ fontSize: '100px' }} />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-center md:text-left">
              <h3 className="text-xl font-black">{t('Desbloquea Autoscuela PRO', 'Unlock Autoscuela PRO')}</h3>
              <p className="text-orange-100 font-medium text-sm mt-1">
                {t('Acceso ilimitado a todos los exámenes e IA.', 'Unlimited access to all exams and AI.')}
              </p>
            </div>
            <Link href="/settings" className="px-8 py-3 bg-white text-orange-600 font-black rounded-xl hover:bg-orange-50 transition-all shadow-lg active:scale-95">
              {t('Saber más', 'Learn More')} <ArrowRightOutlined />
            </Link>
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
