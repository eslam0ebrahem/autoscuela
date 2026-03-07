'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AuthProvider, useAuth } from './AuthContext'
import { ThemeProvider } from './ThemeProvider'
import { ToastProvider } from './Toast'
import ErrorBoundary from './ErrorBoundary'
import Navbar from './Navbar'

function ProtectedLayout({ children, requirePremium = false, requireAdmin = false }) {
  const { user, loading, t } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login')
    }
    if (!loading && user && requireAdmin && user.role !== 'admin') {
      router.push('/dashboard')
    }
  }, [user, loading, router, requireAdmin])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas dark:bg-slate-900">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-bounce" role="img" aria-label="Loading">🚗</div>
          <div className="text-ink-light font-medium">{t ? t('Cargando...', 'Loading...') : 'Loading...'}</div>
        </div>
      </div>
    )
  }

  if (!user) return null

  const isPremiumRequired = requirePremium && !user.isPremium

  return (
    <div className="min-h-screen bg-canvas dark:bg-slate-900">
      <Navbar />
      <ErrorBoundary>
        {isPremiumRequired ? (
          <PaywallScreen />
        ) : (
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
        )}
      </ErrorBoundary>
    </div>
  )
}

function PaywallScreen() {
  const { t } = useAuth()

  const handleSubscribe = async () => {
    const res = await fetch('/api/billing/checkout', { method: 'POST' })
    const data = await res.json()
    if (data.url) window.location.href = data.url
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card max-w-md w-full text-center animate-scale-in">
        <div className="text-6xl mb-6" role="img" aria-label="Locked">🔒</div>
        <h2 className="text-2xl font-bold text-ink dark:text-white mb-3">
          {t('Acceso Premium Requerido', 'Premium Access Required')}
        </h2>
        <p className="text-ink-light mb-6 leading-relaxed">
          {t(
            'Desbloquea todos los examenes, tarjetas de memoria y analisis IA con una suscripcion mensual.',
            'Unlock all exams, flashcards, and AI analytics with a monthly subscription.'
          )}
        </p>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 mb-6">
          <div className="text-3xl font-bold text-primary mb-1">
            $9.99<span className="text-sm font-normal text-ink-light">/mes</span>
          </div>
          <ul className="text-sm text-left space-y-2 mt-3">
            {[
              t('Examenes ilimitados', 'Unlimited exams'),
              t('Tarjetas de memoria', 'Flashcard module'),
              t('Analisis IA con Groq', 'AI insights powered by Groq'),
              t('Bilingue ES/EN', 'Bilingual ES/EN'),
              t('Gamificacion completa', 'Full gamification'),
              t('Reto diario', 'Daily challenge'),
            ].map((item, i) => (
              <li key={i} className="text-ink dark:text-slate-300 flex items-center gap-2">
                <span className="text-success">✓</span> {item}
              </li>
            ))}
          </ul>
        </div>
        <button onClick={handleSubscribe} className="btn-primary w-full text-lg">
          {t('Suscribirse ahora', 'Subscribe Now')}
        </button>
        <p className="text-xs text-ink-light mt-3">
          {t('Cancela cuando quieras', 'Cancel anytime')}
        </p>
      </div>
    </div>
  )
}

export default function AppShell({ children, requirePremium = false, requireAdmin = false }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <ProtectedLayout requirePremium={requirePremium} requireAdmin={requireAdmin}>
            {children}
          </ProtectedLayout>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}
