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
              className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 flex-1 animate-fade-in"
            >
              {!user.emailVerified && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 rounded-md shadow-sm">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-yellow-700">
                        {t('Por favor, verifica tu correo electrónico para desbloquear todas las funcionalidades.', 'Please verify your email address to unlock all features.')}
                      </p>
                    </div>
                  </div>
                </div>
              )}
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
