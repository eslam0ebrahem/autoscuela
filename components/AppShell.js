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
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!loading && !user) router.replace('/auth/login')
    if (!loading && user && requireAdmin && user.role !== 'admin') router.replace('/dashboard')
  }, [user, loading, router, requireAdmin])

  // ── Global loading ──
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-base-100">
        <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <p className="text-sm text-base-content/40 animate-pulse">
          {t('Cargando...', 'Loading...')}
        </p>
      </div>
    )
  }

  if (!user) return null

  // ── Premium gate ──
  if (requirePremium && !user.isPremium) {
    const handleSubscribe = async () => {
      setCheckoutLoading(true)
      setErrorMsg('')
      try {
        const res = await fetch('/api/billing/checkout', { method: 'POST' })
        const data = await res.json()
        if (data.url) window.location.href = data.url
        else throw new Error('No checkout URL')
      } catch (err) {
        console.error(err)
        setErrorMsg(t('Error al iniciar el pago. Inténtalo de nuevo.', 'Error initiating checkout. Please try again.'))
        setCheckoutLoading(false)
      }
    }

    return (
      <div className="min-h-screen bg-base-100 flex flex-col items-center justify-center px-4">
        {/* Glow orb */}
        <div className="absolute w-80 h-80 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative w-full max-w-sm rounded-3xl border border-primary/20
          bg-base-100 shadow-xl overflow-hidden">

          {/* Gradient top strip */}
          <div className="h-1.5 bg-gradient-to-r from-primary via-purple-500 to-primary" />

          <div className="p-8 text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-500/20
              border border-primary/20 flex items-center justify-center text-3xl mx-auto">
              ✨
            </div>

            <div>
              <h2 className="text-xl font-black text-base-content">
                {t('Función Premium', 'Premium Feature')}
              </h2>
              <p className="text-sm text-base-content/50 mt-2 leading-relaxed">
                {t(
                  'Desbloquea todos los exámenes, tarjetas de memoria y análisis IA con una suscripción mensual.',
                  'Unlock all exams, flashcards, and AI analytics with a monthly subscription.'
                )}
              </p>
            </div>

            {/* Feature list */}
            {[
              t('Exámenes ilimitados', 'Unlimited exams'),
              t('Tarjetas de memoria', 'Flashcard decks'),
              t('Análisis IA personalizados', 'AI-powered insights'),
              t('Banco de errores completo', 'Full mistake bank'),
            ].map((feat, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-base-content/70">
                <span className="text-success shrink-0">✓</span>
                {feat}
              </div>
            ))}

            {errorMsg && (
              <p className="text-xs text-error bg-error/10 px-3 py-2 rounded-xl">{errorMsg}</p>
            )}

            <button
              onClick={handleSubscribe}
              disabled={checkoutLoading}
              className="btn btn-primary w-full h-12 rounded-2xl font-bold text-base disabled:opacity-50"
            >
              {checkoutLoading
                ? <><span className="loading loading-spinner loading-sm" /> {t('Redirigiendo...', 'Redirecting...')}</>
                : `✨ ${t('Suscribirse · 9.99€/mes', 'Subscribe · €9.99/mo')}`}
            </button>

            <p className="text-xs text-base-content/30">
              {t('Cancela cuando quieras', 'Cancel anytime')} · No hidden fees
            </p>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

export default function AppShell({ children, requirePremium = false, requireAdmin = false }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <ErrorBoundary>
          <ProtectedLayout requirePremium={requirePremium} requireAdmin={requireAdmin}>
            <div className="flex flex-col min-h-screen bg-base-100">
              <Navbar />
              {/* pb-20 ensures content isn't hidden behind bottom nav on mobile */}
              <main className="flex-1 pb-20 lg:pb-6">
                <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6">
                  {children}
                </div>
              </main>
            </div>
          </ProtectedLayout>
        </ErrorBoundary>
      </ToastProvider>
    </ThemeProvider>
  )
}
