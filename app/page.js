'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthContext'
import {
  RocketOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  ThunderboltOutlined,
  TrophyOutlined,
  GlobalOutlined,
  FireOutlined,
  BulbOutlined,
  LineChartOutlined,
  IdcardOutlined,
} from '@ant-design/icons'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const FEATURES = [
  {
    icon: '🧠',
    iconComponent: BulbOutlined,
    title: 'IA Adaptativa',
    titleEn: 'Adaptive AI',
    desc: 'Nuestro motor analiza tus respuestas en tiempo real para enfocarse en lo que realmente te cuesta.',
    descEn: 'Our engine analyzes your answers in real-time to focus on what you actually struggle with.',
    color: 'from-indigo-500/10 hover:from-indigo-500/20 border-indigo-500/20',
    darkColor: 'dark:from-indigo-500/20 dark:hover:from-indigo-500/30',
  },
  {
    icon: '🌍',
    iconComponent: GlobalOutlined,
    title: 'Modo Bilingüe Instantáneo',
    titleEn: 'Instant Bilingual Mode',
    desc: 'Cambia entre español e inglés con un solo clic. Ideal para residentes internacionales.',
    descEn: 'Switch between Spanish and English with one click. Perfect for international residents.',
    color: 'from-emerald-500/10 hover:from-emerald-500/20 border-emerald-500/20',
    darkColor: 'dark:from-emerald-500/20 dark:hover:from-emerald-500/30',
  },
  {
    icon: '🌌',
    iconComponent: TrophyOutlined,
    title: 'Gamificación Épica',
    titleEn: 'Epic Gamification',
    desc: 'Gana XP, sube de nivel y compite en el ranking. Aprender ya no es una tarea, es un juego.',
    descEn: 'Earn XP, level up, and compete on leaderboards. Learning is no longer a chore, it\'s a game.',
    color: 'from-purple-500/10 hover:from-purple-500/20 border-purple-500/20',
    darkColor: 'dark:from-purple-500/20 dark:hover:from-purple-500/30',
  },
  {
    icon: '⏱️',
    iconComponent: ThunderboltOutlined,
    title: 'Simulacros Reales',
    titleEn: 'Real Exam Simulations',
    desc: 'Base de datos actualizada con las preguntas oficiales de la DGT para este año.',
    descEn: 'Updated database with official DGT questions for this year.',
    color: 'from-blue-500/10 hover:from-blue-500/20 border-blue-500/20',
    darkColor: 'dark:from-blue-500/20 dark:hover:from-blue-500/30',
  },
  {
    icon: '🎴',
    iconComponent: IdcardOutlined,
    title: 'Flashcards Inteligentes',
    titleEn: 'Smart Flashcards',
    desc: 'Repetición espaciada para que no olvides las señales de tráfico nunca más.',
    descEn: 'Spaced repetition so you never forget traffic signs again.',
    color: 'from-pink-500/10 hover:from-pink-500/20 border-pink-500/20',
    darkColor: 'dark:from-pink-500/20 dark:hover:from-pink-500/30',
  },
  {
    icon: '📈',
    iconComponent: LineChartOutlined,
    title: 'Vialia Analytics',
    titleEn: 'Vialia Analytics',
    desc: 'Gráficos detallados de tu evolución. Sabrás que vas a aprobar antes de ir al examen.',
    descEn: 'Detailed progress charts. You\'ll know you\'re ready before taking the exam.',
    color: 'from-amber-500/10 hover:from-amber-500/20 border-amber-500/20',
    darkColor: 'dark:from-amber-500/20 dark:hover:from-amber-500/30',
  },
]

const STATS = [
  { num: '2,000+', numEn: '2,000+', label: 'Preguntas Actualizadas', labelEn: 'Updated Questions' },
  { num: '98%', numEn: '98%', label: 'Precisión de la IA', labelEn: 'AI Accuracy' },
  { num: '24/7', numEn: '24/7', label: 'Soporte e Inteligencia', labelEn: 'Support & Intelligence' },
]

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

/**
 * Animated gradient background
 */
function AnimatedBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute top-0 -left-4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 dark:opacity-10 animate-blob" />
      <div className="absolute top-0 -right-4 w-96 h-96 bg-indigo-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 dark:opacity-10 animate-blob animation-delay-2000" />
      <div className="absolute -bottom-8 left-20 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 dark:opacity-10 animate-blob animation-delay-4000" />
    </div>
  )
}

/**
 * Feature card component
 */
function FeatureCard({ feature, lang }) {
  const Icon = feature.iconComponent

  return (
    <div
      className={`relative p-6 bg-gradient-to-br ${feature.color} ${feature.darkColor} border rounded-2xl transition-all duration-300 hover:scale-105 hover:shadow-xl group`}
    >
      {/* Icon */}
      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center text-white text-3xl mb-4 group-hover:scale-110 transition-transform">
        <Icon />
      </div>

      {/* Title */}
      <h3 className="text-lg font-black text-ink dark:text-white mb-2">
        {lang === 'en' ? feature.titleEn : feature.title}
      </h3>

      {/* Description */}
      <p className="text-sm text-ink-light dark:text-slate-400 leading-relaxed">
        {lang === 'en' ? feature.descEn : feature.desc}
      </p>

      {/* Shine effect */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
    </div>
  )
}

/**
 * Stat card component
 */
function StatCard({ stat, lang }) {
  return (
    <div className="text-center p-6 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 hover:shadow-lg transition-shadow">
      <div className="text-4xl font-black bg-gradient-to-r from-primary to-indigo-600 bg-clip-text text-transparent mb-2">
        {lang === 'en' ? stat.numEn : stat.num}
      </div>
      <p className="text-sm text-ink-light dark:text-slate-400 font-semibold">
        {lang === 'en' ? stat.labelEn : stat.label}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------
export default function LandingPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [lang, setLang] = useState('es')

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (user) {
      router.push('/dashboard')
    }
  }, [user, router])

  const handleGetStarted = () => {
    router.push('/auth/register')
  }

  const handleDemo = () => {
    router.push('/demo')
  }

  const t = (es, en) => (lang === 'en' ? en : es)

  // Don't render landing page if user is authenticated
  if (user) {
    return null
  }

  return (
    <div className="min-h-screen bg-surface dark:bg-slate-950 overflow-hidden">
      {/* ── Hero Section ────────────────────────────────────────────── */}
      <section className="relative pt-20 pb-32 px-4">
        <AnimatedBackground />

        <div className="container-wrapper max-w-6xl mx-auto relative z-10">
          {/* Badge */}
          <div className="flex justify-center mb-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 dark:bg-primary/20 border border-primary/20 rounded-full text-sm font-semibold text-primary">
              <ThunderboltOutlined />
              DGT Tipo B · IA Adaptive Learning
            </div>
          </div>

          {/* Main Heading */}
          <h1 className="text-4xl md:text-6xl font-black text-center text-ink dark:text-white mb-6 leading-tight">
            {t('Domina el DGT con', 'Master DGT with')}{' '}
            <span className="bg-gradient-to-r from-primary to-indigo-600 bg-clip-text text-transparent">
              {t('Inteligencia', 'Intelligence')}
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg md:text-xl text-center text-ink-light dark:text-slate-400 max-w-3xl mx-auto mb-10 leading-relaxed">
            {t(
              'La evolución del aprendizaje vial. ',
              'The evolution of driving education. '
            )}
            <strong className="text-ink dark:text-white">Vialia</strong>{' '}
            {t(
              'utiliza IA de última generación para que apruebes tu examen teórico en tiempo récord y con total confianza.',
              'uses cutting-edge AI to help you pass your theoretical exam in record time with total confidence.'
            )}
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <button
              onClick={handleGetStarted}
              className="px-8 py-4 bg-gradient-to-r from-primary to-indigo-600 text-white font-black rounded-xl hover:shadow-2xl hover:scale-105 transition-all active:scale-95 flex items-center gap-2"
            >
              <RocketOutlined />
              {t('🚀 Empieza Gratis', '🚀 Start Free')}
            </button>
            <button
              onClick={handleDemo}
              className="px-8 py-4 bg-white dark:bg-slate-800 text-ink dark:text-white font-bold rounded-xl hover:shadow-lg transition-all border border-slate-200 dark:border-slate-700 flex items-center gap-2"
            >
              <PlayCircleOutlined />
              {t('Ver Demo', 'View Demo')}
            </button>
          </div>

          {/* Social Proof */}
          <div className="flex items-center justify-center gap-4 text-sm text-ink-light dark:text-slate-400">
            <div className="flex items-center gap-1">
              <GlobalOutlined />
              {t('Bilingüe Español / English', 'Bilingual Spanish / English')}
            </div>
            <span>·</span>
            <div className="flex items-center gap-1">
              <CheckCircleOutlined />
              {t('Sin tarjeta', 'No credit card')}
            </div>
            <span>·</span>
            <div className="flex items-center gap-1">
              <FireOutlined />
              {t('100% Online', '100% Online')}
            </div>
          </div>
        </div>
      </section>

      {/* ── Features Section ────────────────────────────────────────── */}
      <section className="py-20 px-4 bg-slate-50 dark:bg-slate-900/50">
        <div className="container-wrapper max-w-6xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black text-ink dark:text-white mb-4">
              {t('¿Por qué elegir Vialia?', 'Why choose Vialia?')}
            </h2>
            <p className="text-lg text-ink-light dark:text-slate-400 max-w-2xl mx-auto">
              {t(
                'Tecnología diseñada para optimizar tu tiempo y garantizar tu aprobado.',
                'Technology designed to optimize your time and guarantee your success.'
              )}
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature, index) => (
              <FeatureCard key={index} feature={feature} lang={lang} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats Section ───────────────────────────────────────────── */}
      <section className="py-20 px-4">
        <div className="container-wrapper max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {STATS.map((stat, index) => (
              <StatCard key={index} stat={stat} lang={lang} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA Section ───────────────────────────────────────── */}
      <section className="py-20 px-4 bg-gradient-to-r from-primary to-indigo-600">
        <div className="container-wrapper max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
            {t('Tu aprobado empieza en Vialia', 'Your success starts at Vialia')}
          </h2>
          <p className="text-lg text-indigo-100 mb-8 max-w-2xl mx-auto">
            {t(
              'Únete a la nueva era de la formación vial. Inteligente, rápido y efectivo.',
              'Join the new era of driving education. Smart, fast, and effective.'
            )}
          </p>
          <button
            onClick={handleGetStarted}
            className="px-10 py-4 bg-white text-primary font-black rounded-xl hover:shadow-2xl hover:scale-105 transition-all active:scale-95 flex items-center gap-2 mx-auto"
          >
            <RocketOutlined />
            {t('🚀 Comenzar Gratis', '🚀 Start Free')}
          </button>
        </div>
      </section>

      {/* ── Language Toggle (Floating) ──────────────────────────────── */}
      <button
        onClick={() => setLang(lang === 'es' ? 'en' : 'es')}
        className="fixed bottom-6 right-6 w-14 h-14 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center text-xl z-50"
        title={lang === 'es' ? 'Switch to English' : 'Cambiar a Español'}
      >
        {lang === 'es' ? '🇬🇧' : '🇪🇸'}
      </button>
    </div>
  )
}
