'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import FormattedText from '@/components/FormattedText'
import { useAuth } from '@/components/AuthContext'
import { useToast } from '@/components/Toast'
import {
  LineChartOutlined,
  TrophyOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FireOutlined,
  RocketOutlined,
  BarChartOutlined,
  RiseOutlined,
  FallOutlined,
  ReloadOutlined,
  BulbOutlined,
  WarningOutlined,
  InteractionOutlined,
  BookOutlined,
  ClockCircleOutlined,
  HourglassOutlined,
  SearchOutlined,
  StarOutlined,
  SunOutlined,
  MoonOutlined,
  DashboardOutlined
} from '@ant-design/icons'
import StudyTrendsChart from '@/components/stats/StudyTrendsChart'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const ACCURACY_THRESHOLDS = {
  EXCELLENT: 80,
  GOOD: 60,
}

const ACCURACY_COLORS = {
  EXCELLENT: {
    bg: 'bg-green-500',
    text: 'text-green-600',
    light: 'bg-green-100 dark:bg-green-900/30',
  },
  GOOD: { bg: 'bg-amber-500', text: 'text-amber-600', light: 'bg-amber-100 dark:bg-amber-900/30' },
  POOR: { bg: 'bg-red-500', text: 'text-red-600', light: 'bg-red-100 dark:bg-red-900/30' },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Get localized text from multilingual object or string.
 */
const getLocalizedText = (obj, lang) => {
  if (!obj) return ''
  if (typeof obj === 'string') return obj
  if (lang === 'en' && obj.en) return obj.en
  return obj.es || obj.en || ''
}

/**
 * Get accuracy color scheme based on percentage.
 */
const getAccuracyColors = (accuracy) => {
  if (accuracy >= ACCURACY_THRESHOLDS.EXCELLENT) return ACCURACY_COLORS.EXCELLENT
  if (accuracy >= ACCURACY_THRESHOLDS.GOOD) return ACCURACY_COLORS.GOOD
  return ACCURACY_COLORS.POOR
}

/**
 * Format seconds to a readable time string
 */
const formatTime = (seconds) => {
  if (!seconds || seconds <= 0) return '0s'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.round(seconds % 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return `${s}s`
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

/**
 * Topic progress bar component
 */
function TopicBar({ tag, originalTag, accuracy, attempted, avg_time_sec, lang, onPractice }) {
  const colors = getAccuracyColors(accuracy)
  const percentage = Math.round(accuracy)

  return (
    <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-bold text-ink dark:text-white text-sm">{tag}</h4>
        <span className={`text-sm font-black ${colors.text}`}>{percentage}%</span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-2">
        <div
          className={`h-full ${colors.bg} transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-ink-light dark:text-slate-400">
        <div className="flex gap-3">
          <span>
            {attempted} {lang === 'es' ? 'preguntas' : 'questions'}
          </span>
          {avg_time_sec > 0 && (
            <span className="flex items-center gap-1">
              <ClockCircleOutlined /> {formatTime(avg_time_sec)}
            </span>
          )}
        </div>
        {onPractice && (
          <button
            onClick={() => onPractice(originalTag || tag)}
            className="text-primary hover:text-indigo-700 font-semibold transition-colors"
          >
            {lang === 'es' ? 'Practicar' : 'Practice'} →
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Stat card component
 */
function StatCard({ icon, label, value, trend, trendValue, color = 'primary' }) {
  const showTrend = trend && trendValue !== undefined
  const isPositive = trendValue > 0
  const isNegative = trendValue < 0

  return (
    <div className="card hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <div
          className={`w-12 h-12 rounded-xl bg-gradient-to-br from-${color} to-indigo-600 flex items-center justify-center text-white text-xl`}
        >
          {icon}
        </div>
        {showTrend && (
          <div
            className={`flex items-center gap-1 text-xs font-bold ${isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-slate-400'}`}
          >
            {isPositive && <RiseOutlined />}
            {isNegative && <FallOutlined />}
            {isPositive ? '+' : ''}
            {trendValue}%
          </div>
        )}
      </div>
      <div className="text-3xl font-black text-ink dark:text-white mb-1">{value}</div>
      <p className="text-xs text-ink-light dark:text-slate-400 font-semibold">{label}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
function ProgressContent() {
  const { user, t } = useAuth()
  const router = useRouter()
  const toast = useToast()

  const lang = user?.preferences?.language || 'es'

  // ── State ──────────────────────────────────────────────────────────────
  const [stats, setStats] = useState(null)
  const [insights, setInsights] = useState(null)
  const [topicStats, setTopicStats] = useState([])
  const [calendarData, setCalendarData] = useState([])
  const [criticalMistakes, setCriticalMistakes] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [topicSearch, setTopicSearch] = useState('')
  const [topicSort, setTopicSort] = useState('accuracy-asc')

  // ── Fetch data ─────────────────────────────────────────────────────────
  const fetchData = useCallback(
    async (force = false) => {
      try {
        setRefreshing(force)

        const [statsRes, insightsRes, topicsRes, calendarRes, mistakesRes] = await Promise.all([
          fetch('/api/stats/overall'),
          fetch(`/api/stats/ai-insights${force ? '?force=true' : ''}`),
          fetch('/api/stats/topics'),
          fetch('/api/stats/calendar'),
          fetch('/api/mistakes?limit=3&corrected=false'),
        ])

        const statsData = await statsRes.json().catch(() => ({}))
        const insightsData = await insightsRes.json().catch(() => ({}))
        const topicsData = await topicsRes.json().catch(() => ({}))
        const calendarJson = await calendarRes.json().catch(() => ({}))
        const mistakesData = await mistakesRes.json().catch(() => ({}))

        setStats(statsData.stats || null)
        setInsights(insightsData.insights || null)
        setTopicStats(topicsData.topics || [])
        setCalendarData(calendarJson.calendarData || [])
        setCriticalMistakes(mistakesData.mistakes || [])
      } catch (err) {
        console.error('[progress] Fetch error:', err)
        toast?.error?.(
          t('Error', 'Error'),
          t('Error al cargar estadísticas', 'Failed to load stats')
        )
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [t, toast]
  )

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ── Handle practice topic ──────────────────────────────────────────────
  const handlePracticeTopic = useCallback(
    (topic) => {
      router.push(`/exam?mode=custom&topics=${encodeURIComponent(topic)}`)
    },
    [router]
  )

  // ── Computed values ────────────────────────────────────────────────────
  const overallAccuracy = useMemo(() => {
    if (!stats?.answeredQuestions || stats.answeredQuestions === 0) return 0
    return Math.round((stats.correctAnswers / stats.answeredQuestions) * 100)
  }, [stats])

  const weakTopics = useMemo(() => {
    return topicStats
      .filter((t) => t.accuracy < ACCURACY_THRESHOLDS.GOOD)
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 3)
  }, [topicStats])

  const strongTopics = useMemo(() => {
    return topicStats
      .filter((t) => t.accuracy >= ACCURACY_THRESHOLDS.EXCELLENT)
      .sort((a, b) => b.accuracy - a.accuracy)
      .slice(0, 3)
  }, [topicStats])

  const filteredTopics = useMemo(() => {
    let result = [...topicStats]
    if (topicSearch) {
      const q = topicSearch.toLowerCase()
      result = result.filter(t => 
        (t.tag?.es && t.tag.es.toLowerCase().includes(q)) || 
        (t.tag?.en && t.tag.en.toLowerCase().includes(q)) ||
        (typeof t.tag === 'string' && t.tag.toLowerCase().includes(q))
      )
    }
    
    result.sort((a, b) => {
      if (topicSort === 'accuracy-asc') return a.accuracy - b.accuracy
      if (topicSort === 'accuracy-desc') return b.accuracy - a.accuracy
      if (topicSort === 'attempted-desc') return b.attempted - a.attempted
      if (topicSort === 'time-asc') return (a.avg_time_sec || 0) - (b.avg_time_sec || 0)
      if (topicSort === 'time-desc') return (b.avg_time_sec || 0) - (a.avg_time_sec || 0)
      return 0
    })

    return result
  }, [topicStats, topicSearch, topicSort])

  const masteryDist = useMemo(() => {
    let mastered = 0
    let learning = 0
    let struggling = 0
    topicStats.forEach(t => {
      if (t.accuracy >= 80) mastered++
      else if (t.accuracy >= 50) learning++
      else struggling++
    })
    return { mastered, learning, struggling, total: topicStats.length }
  }, [topicStats])

  const timeOfDayInsights = useMemo(() => {
    if (!stats?.timeOfDay || stats.timeOfDay.length === 0) return null
    const buckets = {
      morning: { name: t('Mañana (6-12h)', 'Morning (6-12h)'), total: 0, correct: 0, icon: <SunOutlined className="text-amber-500" /> },
      afternoon: { name: t('Tarde (12-18h)', 'Afternoon (12-18h)'), total: 0, correct: 0, icon: <SunOutlined className="text-orange-500" /> },
      evening: { name: t('Noche (18-24h)', 'Evening (18-24h)'), total: 0, correct: 0, icon: <MoonOutlined className="text-indigo-500" /> },
      night: { name: t('Madrugada (0-6h)', 'Night (0-6h)'), total: 0, correct: 0, icon: <MoonOutlined className="text-slate-500" /> },
    }
    stats.timeOfDay.forEach(h => {
      const hour = h._id
      let b = 'night'
      if (hour >= 6 && hour < 12) b = 'morning'
      else if (hour >= 12 && hour < 18) b = 'afternoon'
      else if (hour >= 18 && hour < 24) b = 'evening'
      
      buckets[b].total += h.total
      buckets[b].correct += h.correct
    })
    
    let bestBucket = null
    let bestAcc = -1
    Object.keys(buckets).forEach(k => {
      const b = buckets[k]
      if (b.total >= 5) { // minimum attempts
        const acc = b.correct / b.total
        if (acc > bestAcc) {
          bestAcc = acc
          bestBucket = b
        }
      }
    })
    
    return { buckets, bestBucket, bestAcc: Math.round(bestAcc * 100) }
  }, [stats?.timeOfDay, t])

  // ── Loading state ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-ink-light dark:text-slate-400 text-sm">
          {t('Cargando estadísticas...', 'Loading stats...')}
        </p>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="container-wrapper space-y-6 max-w-6xl mx-auto">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-ink dark:text-white">
            {t('Tu Progreso', 'Your Progress')}
          </h1>
          <p className="text-sm text-ink-light dark:text-slate-400 mt-1">
            {t('Tu progreso en detalle', 'Your progress in detail')}
          </p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-ink dark:text-white rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          <ReloadOutlined className={refreshing ? 'animate-spin' : ''} />
          <span className="font-semibold">
            {refreshing ? t('Actualizando...', 'Refreshing...') : t('Actualizar', 'Refresh')}
          </span>
        </button>
      </div>

      {/* ── AI Insights Card ────────────────────────────────────────── */}
      {insights?.coachMessage && (
        <div className="card bg-gradient-to-br from-primary to-indigo-600 text-white border-0">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <BulbOutlined className="text-2xl" />
            </div>
            <div className="flex-1">
              <h3 className="font-black text-lg mb-2">
                {t('Mensaje del Coach IA', 'AI Coach Message')}
              </h3>
              <p className="text-indigo-100 leading-relaxed"><FormattedText text={insights.coachMessage} /></p>
            </div>
          </div>
        </div>
      )}

      {!insights?.coachMessage && (
        <div className="card bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800">
          <div className="flex items-start gap-3">
            <BulbOutlined className="text-2xl text-indigo-600 dark:text-indigo-400 shrink-0" />
            <div>
              <h3 className="font-bold text-indigo-900 dark:text-indigo-200 mb-1">
                {t('Análisis IA Disponible', 'AI Analysis Available')}
              </h3>
              <p className="text-sm text-indigo-700 dark:text-indigo-300">
                {t(
                  'Completa más exámenes para obtener tu análisis IA personalizado',
                  'Complete more exams to unlock your personalized AI analysis'
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Critical Mistakes ─────────────────────────────────────── */}
      {criticalMistakes.length > 0 && (
        <div className="card border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black text-red-600 dark:text-red-400 flex items-center gap-2">
              <WarningOutlined />
              {t('Errores Críticos', 'Critical Mistakes')}
            </h2>
            <Link
              href="/mistakes"
              className="px-4 py-2 bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 font-semibold rounded-lg hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors text-sm"
            >
              {t('Revisar Todos', 'Review All')}
            </Link>
          </div>
          <div className="space-y-3">
            {criticalMistakes.map((mistake, idx) => (
              <div key={idx} className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-red-100 dark:border-red-900/30 flex justify-between items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400">
                      Score: {mistake.severityScore}
                    </span>
                    <span className="text-xs font-semibold text-slate-500 truncate">
                      {getLocalizedText({es: mistake.topic, en: mistake.topicEn}, lang)}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-ink dark:text-white line-clamp-2">
                    {getLocalizedText(mistake.question, lang)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-lg font-black text-red-500">{mistake.timesWrong}x</div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">{t('Errores', 'Mistakes')}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Gamification Profile ──────────────────────────────────── */}
      {stats && (stats.totalXP > 0 || stats.earnedBadges?.length > 0) && (
        <div className="card bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-purple-200 dark:border-purple-800">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white shadow-lg shrink-0">
                <StarOutlined className="text-3xl" />
              </div>
              <div>
                <h2 className="text-xl font-black text-purple-900 dark:text-purple-200">
                  {t('Perfil de Juego', 'Gamification Profile')}
                </h2>
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex flex-col">
                    <span className="text-xs uppercase font-bold tracking-widest text-purple-600/70 dark:text-purple-400/70">Total XP</span>
                    <span className="font-black text-purple-700 dark:text-purple-300">{stats.totalXP}</span>
                  </div>
                  {stats.rank > 0 && (
                    <div className="flex flex-col">
                      <span className="text-xs uppercase font-bold tracking-widest text-purple-600/70 dark:text-purple-400/70">Rank</span>
                      <span className="font-black text-purple-700 dark:text-purple-300">#{stats.rank}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {stats.earnedBadges?.length > 0 && (
              <div className="flex-1 max-w-sm">
                <span className="text-xs uppercase font-bold tracking-widest text-purple-600/70 dark:text-purple-400/70 block mb-2">
                  {t('Insignias Recientes', 'Recent Badges')}
                </span>
                <div className="flex flex-wrap gap-2">
                  {stats.earnedBadges.slice(-4).map((b, i) => (
                    <span key={i} className="px-3 py-1 bg-white dark:bg-slate-800 rounded-full text-xs font-bold text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-700/50 shadow-sm">
                      {b}
                    </span>
                  ))}
                  {stats.earnedBadges.length > 4 && (
                    <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/50 rounded-full text-xs font-bold text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-700/50 shadow-sm">
                      +{stats.earnedBadges.length - 4}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Study Trends Chart ────────────────────────────────────── */}
      {calendarData.length > 0 && (
        <StudyTrendsChart data={calendarData} />
      )}

      {/* ── Best Time to Study ────────────────────────────────────── */}
      {timeOfDayInsights?.bestBucket && (
        <div className="card">
          <h2 className="text-lg font-black text-ink dark:text-white flex items-center gap-2 mb-4">
            <ClockCircleOutlined className="text-indigo-500" />
            {t('Tu Mejor Momento de Estudio', 'Your Best Time to Study')}
          </h2>
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="flex flex-col items-center justify-center p-6 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800 shrink-0 w-full md:w-auto">
              <span className="text-4xl mb-2">{timeOfDayInsights.bestBucket.icon}</span>
              <span className="text-lg font-black text-indigo-900 dark:text-indigo-200">{timeOfDayInsights.bestBucket.name}</span>
              <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 mt-1">{timeOfDayInsights.bestAcc}% {t('Precisión', 'Accuracy')}</span>
            </div>
            
            <div className="flex-1 w-full grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.keys(timeOfDayInsights.buckets).map(k => {
                const b = timeOfDayInsights.buckets[k]
                const acc = b.total > 0 ? Math.round((b.correct / b.total) * 100) : 0
                return (
                  <div key={k} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 flex flex-col items-center text-center">
                    <div className="text-lg mb-1">{b.icon}</div>
                    <span className="text-[10px] font-bold uppercase text-slate-500">{b.name.split(' ')[0]}</span>
                    {b.total > 0 ? (
                      <>
                        <span className="text-lg font-black text-ink dark:text-white mt-1">{acc}%</span>
                        <span className="text-[10px] text-slate-400 mt-1">{b.total} qs</span>
                      </>
                    ) : (
                      <span className="text-xs text-slate-400 mt-2">-</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Overall Stats ───────────────────────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard
            icon={<LineChartOutlined />}
            label={t('Precisión Global', 'Overall Accuracy')}
            value={`${overallAccuracy}%`}
            trend={stats.weeklyTrend}
            trendValue={stats.weeklyAccuracyChange}
            color="primary"
          />
          <StatCard
            icon={<CheckCircleOutlined />}
            label={t('Respuestas Correctas', 'Correct Answers')}
            value={stats.correctAnswers || 0}
            color="green-500"
          />
          <StatCard
            icon={<CloseCircleOutlined />}
            label={t('Errores', 'Mistakes')}
            value={stats.incorrectAnswers || 0}
            color="red-500"
          />
          <StatCard
            icon={<DashboardOutlined />}
            label={t('Aprobados (Oficial)', 'Passed (Official)')}
            value={`${stats.officialExamsPassed || 0} / ${stats.officialExamsTotal || 0}`}
            color="indigo-500"
          />
          <StatCard
            icon={<FireOutlined />}
            label={t('Racha Actual', 'Current Streak')}
            value={`${stats.currentStreak || 0} ${t('días', 'days')}`}
            color="orange-500"
          />
          <StatCard
            icon={<StarOutlined />}
            label={t('Experiencia', 'Experience')}
            value={`${stats.totalXP || 0} XP`}
            color="purple-500"
          />
          <StatCard
            icon={<InteractionOutlined />}
            label={t('Preguntas Realizadas', 'Attempted')}
            value={stats.answeredQuestions || 0}
            color="blue-500"
          />
          <StatCard
            icon={<BookOutlined />}
            label={t('Banco de Preguntas', 'Question Bank')}
            value={`${stats.seenQuestions || 0} / ${stats.totalQuestionsInDB || 0}`}
            color="indigo-500"
          />
          <StatCard
            icon={<ClockCircleOutlined />}
            label={t('Tiempo Total de Estudio', 'Total Study Time')}
            value={formatTime(stats.totalStudyTimeSeconds)}
            color="purple-500"
          />
          <StatCard
            icon={<HourglassOutlined />}
            label={t('Tiempo Promedio', 'Avg Time/Q')}
            value={formatTime(stats.avgTimePerQuestion)}
            color="teal-500"
          />
        </div>
      )}

      {/* ── Mastery Distribution ────────────────────────────────────── */}
      {masteryDist.total > 0 && (
        <div className="card">
          <h2 className="text-lg font-black text-ink dark:text-white mb-4">
            {t('Distribución de Dominio', 'Mastery Distribution')}
          </h2>
          <div className="flex h-4 rounded-full overflow-hidden mb-4">
            <div 
              style={{ width: `${(masteryDist.mastered / masteryDist.total) * 100}%` }} 
              className="bg-green-500 transition-all duration-500" 
            />
            <div 
              style={{ width: `${(masteryDist.learning / masteryDist.total) * 100}%` }} 
              className="bg-amber-400 transition-all duration-500" 
            />
            <div 
              style={{ width: `${(masteryDist.struggling / masteryDist.total) * 100}%` }} 
              className="bg-red-500 transition-all duration-500" 
            />
          </div>
          <div className="flex justify-between text-xs font-bold px-2">
            <div className="text-green-600 dark:text-green-400 flex flex-col items-start">
              <span>{masteryDist.mastered} {t('Temas', 'Topics')}</span>
              <span className="text-ink-light dark:text-slate-500 text-[10px] uppercase">{t('Dominado', 'Mastered')} (&ge;80%)</span>
            </div>
            <div className="text-amber-600 dark:text-amber-400 flex flex-col items-center">
              <span>{masteryDist.learning} {t('Temas', 'Topics')}</span>
              <span className="text-ink-light dark:text-slate-500 text-[10px] uppercase">{t('En Proceso', 'Learning')} (50-79%)</span>
            </div>
            <div className="text-red-600 dark:text-red-400 flex flex-col items-end">
              <span>{masteryDist.struggling} {t('Temas', 'Topics')}</span>
              <span className="text-ink-light dark:text-slate-500 text-[10px] uppercase">{t('Dificultad', 'Struggling')} (&lt;50%)</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Weak Topics ─────────────────────────────────────────────── */}
      {weakTopics.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black text-ink dark:text-white flex items-center gap-2">
              <WarningOutlined className="text-orange-600" />
              {t('Áreas de Mejora', 'Areas for Improvement')}
            </h2>
            <Link
              href="/exam?mode=weak_topics"
              className="px-4 py-2 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors text-sm flex items-center gap-2"
            >
              <RocketOutlined />
              {t('Practicar', 'Practice')}
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {weakTopics.map((topic, index) => (
              <TopicBar
                key={index}
                tag={getLocalizedText(topic.tag, lang)}
                originalTag={topic.tag.es}
                accuracy={topic.accuracy}
                attempted={topic.attempted}
                avg_time_sec={topic.avg_time_sec}
                lang={lang}
                onPractice={handlePracticeTopic}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Strong Topics ───────────────────────────────────────────── */}
      {strongTopics.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-black text-ink dark:text-white flex items-center gap-2 mb-4">
            <TrophyOutlined className="text-green-600" />
            {t('Tus Fortalezas', 'Your Strengths')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {strongTopics.map((topic, index) => (
              <TopicBar
                key={index}
                tag={getLocalizedText(topic.tag, lang)}
                originalTag={topic.tag.es}
                accuracy={topic.accuracy}
                attempted={topic.attempted}
                avg_time_sec={topic.avg_time_sec}
                lang={lang}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── All Topics ──────────────────────────────────────────────── */}
      {topicStats.length > 0 && (
        <div className="card">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <h2 className="text-lg font-black text-ink dark:text-white flex items-center gap-2">
              <BarChartOutlined />
              {t('Todos los Temas', 'All Topics')}
            </h2>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative">
                <SearchOutlined className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder={t('Buscar tema...', 'Search topic...')}
                  value={topicSearch}
                  onChange={(e) => setTopicSearch(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary w-full sm:w-48"
                />
              </div>
              <select
                value={topicSort}
                onChange={(e) => setTopicSort(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary w-full sm:w-auto"
              >
                <option value="accuracy-asc">{t('Precisión: Menor a Mayor', 'Accuracy: Low to High')}</option>
                <option value="accuracy-desc">{t('Precisión: Mayor a Menor', 'Accuracy: High to Low')}</option>
                <option value="attempted-desc">{t('Más Practicados', 'Most Practiced')}</option>
                <option value="time-desc">{t('Más Lentos', 'Slowest')}</option>
                <option value="time-asc">{t('Más Rápidos', 'Fastest')}</option>
              </select>
            </div>
          </div>
          
          {filteredTopics.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTopics.map((topic, index) => (
                <TopicBar
                  key={index}
                  tag={getLocalizedText(topic.tag, lang)}
                  originalTag={topic.tag.es}
                  accuracy={topic.accuracy}
                  attempted={topic.attempted}
                  avg_time_sec={topic.avg_time_sec}
                  lang={lang}
                  onPractice={handlePracticeTopic}
                />
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-slate-500">
              {t('No se encontraron temas.', 'No topics found.')}
            </div>
          )}
        </div>
      )}


      {/* ── Empty State ─────────────────────────────────────────────── */}
      {(!stats || !topicStats.length) && (
        <div className="card text-center py-12">
          <div className="flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
              <LineChartOutlined className="text-5xl text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-black text-ink dark:text-white mb-2">
                {t('Comienza a Practicar', 'Start Practicing')}
              </h3>
              <p className="text-sm text-ink-light dark:text-slate-400 max-w-md mx-auto">
                {t(
                  'Completa tu primer examen para ver tus estadísticas aquí',
                  'Complete your first exam to see your stats here'
                )}
              </p>
            </div>
            <button
              onClick={() => router.push('/exam')}
              className="px-8 py-3 bg-primary text-white font-black rounded-xl hover:bg-indigo-700 transition-all shadow-lg active:scale-95 flex items-center gap-2"
            >
              <RocketOutlined />
              {t('Empezar Examen', 'Start Exam')}
            </button>
          </div>
        </div>
      )}

      {/* ── Study Recommendations ───────────────────────────────────── */}
      {insights?.studyTips && insights.studyTips.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-black text-ink dark:text-white flex items-center gap-2 mb-4">
            <BulbOutlined className="text-indigo-600" />
            {t('Consejos de Estudio', 'Study Tips')}
          </h2>
          <div className="space-y-3">
            {insights.studyTips.map((tip, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800"
              >
                <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                  {index + 1}
                </div>
                <p className="text-sm text-indigo-900 dark:text-indigo-200 leading-relaxed">
                  <FormattedText text={tip} />
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page Export
// ---------------------------------------------------------------------------
export default function ProgressPage() {
  return (
    <AppShell>
      <ProgressContent />
    </AppShell>
  )
}
