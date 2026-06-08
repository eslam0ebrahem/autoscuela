'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from './AuthContext'
import { ThemeProvider } from './ThemeProvider'
import { ToastProvider } from './Toast'
import ErrorBoundary from './ErrorBoundary'
import Navbar from './Navbar'

function ProtectedLayout({ children, requirePremium = false, requireAdmin = false }) {
  const { user, loading, t } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.replace('/auth/login')
    if (!loading && user && requireAdmin && user.role !== 'admin') router.replace('/dashboard')
  }, [user, loading, router, requireAdmin])

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50 dark:bg-slate-900">
        <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <p className="text-sm text-ink-light animate-pulse">{t('Cargando...', 'Loading...')}</p>
      </div>
    )
  }

  if (!user) return null

  const isPremiumRequired = requirePremium && !user.isPremium

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors flex flex-col">
      <Navbar />
      <div className="flex-1 flex flex-col relative pb-16 lg:pb-0">
        <ErrorBoundary>
          {isPremiumRequired ? (
            <PaywallScreen />
          ) : (
            // 5.1: Add main-content id for skip-to-content link
            <main
              id="main-content"
              className="w-full max-w-[1600px] 2xl:max-w-[1920px] mx-auto px-4 sm:px-6 md:px-8 lg:px-12 py-6 md:py-8 flex-1 animate-fade-in"
            >
              {children}
            </main>
          )}
        </ErrorBoundary>
      </div>
    </div>
  )
}

function PaywallScreen() {
  const { t } = useAuth()
  const [loadingCheckout, setLoadingCheckout] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubscribe = async () => {
    if (loadingCheckout) return
    setLoadingCheckout(true)
    setErrorMsg('')
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else throw new Error('No checkout URL')
    } catch (err) {
      console.error(err)
      setErrorMsg(t('Error al iniciar el pago', 'Error initiating checkout'))
      setLoadingCheckout(false)
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center p-4 py-12">
      <div className="card max-w-md w-full text-center animate-scale-in border border-slate-200 dark:border-slate-700 shadow-xl bg-white dark:bg-slate-800">
        <div className="text-6xl mb-6">🔒</div>
        <h2 className="text-2xl font-bold text-ink dark:text-white mb-3">
          {t('Acceso Premium Requerido', 'Premium Access Required')}
        </h2>
        <p className="text-ink-light dark:text-slate-400 mb-6 leading-relaxed text-sm">
          {t(
            'Desbloquea todos los exámenes y análisis IA con una suscripción mensual.',
            'Unlock all exams and AI analytics with a monthly subscription.'
          )}
        </p>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-5 mb-6 border border-blue-100 dark:border-blue-800/50">
          <div className="text-4xl font-extrabold text-primary dark:text-blue-400 mb-1">
            $9.99
            <span className="text-sm font-medium text-ink-light dark:text-slate-400">/mes</span>
          </div>
          <ul className="text-sm text-left space-y-3 mt-5">
            {[
              t('Exámenes ilimitados', 'Unlimited exams'),
              t('Práctica por temas', 'Topic practices'),
              t('Análisis IA', 'AI insights'),
            ].map((item, i) => (
              <li key={i} className="text-ink dark:text-slate-300 flex items-start gap-3">
                <span className="text-success font-bold mt-0.5">✓</span> <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        {errorMsg && (
          <div className="text-red-500 text-sm mb-4">
            {errorMsg}
          </div>
        )}
        <button
          onClick={handleSubscribe}
          disabled={loadingCheckout}
          className="btn-primary w-full py-3.5 flex items-center justify-center gap-2"
        >
          {loadingCheckout ? (
            <span className="animate-pulse">{t('Redirigiendo...', 'Redirecting...')}</span>
          ) : (
            t('Suscribirse ahora', 'Subscribe Now')
          )}
        </button>
      </div>
    </div>
  )
}

export default function AppShell({ children, requirePremium = false, requireAdmin = false }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <ProtectedLayout requirePremium={requirePremium} requireAdmin={requireAdmin}>
          {children}
        </ProtectedLayout>
      </ToastProvider>
    </ThemeProvider>
  )
}
