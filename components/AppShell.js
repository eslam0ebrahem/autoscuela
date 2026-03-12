'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AuthProvider, useAuth } from './AuthContext'
import { ThemeProvider } from './ThemeProvider'
import { ToastProvider } from './Toast'
import ErrorBoundary from './ErrorBoundary'
import Navbar from './Navbar'

function ProtectedLayout({ children, requirePremium = false, requireAdmin = false }) {
  const { user, loading, t } = useAuth()
  const router = useRouter()

  // Route Protection Logic
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/auth/login') // use replace to prevent back-button loops
    }
    if (!loading && user && requireAdmin && user.role !== 'admin') {
      router.replace('/dashboard')
    }
  }, [user, loading, router, requireAdmin])

  // Global Loading State
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 transition-colors">
        <div className="text-center animate-pulse">
          <div className="text-5xl mb-4 animate-bounce" role="img" aria-label="Cargando">🚗</div>
          <div className="text-ink-light dark:text-slate-400 font-medium text-lg">
            {t ? t('Cargando...', 'Loading...') : 'Loading...'}
          </div>
        </div>
      </div>
    )
  }

  // Prevent rendering protected content while redirecting
  if (!user || (requireAdmin && user.role !== 'admin')) {
    return null 
  }

  const isPremiumRequired = requirePremium && !user.isPremium

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors flex flex-col">
      <Navbar />
      
      {/* Using flex-1 allows the main content area to fill the remaining screen height 
        minus the Navbar, preventing double-scrollbars. 
      */}
      <div className="flex-1 flex flex-col relative">
        <ErrorBoundary>
          {isPremiumRequired ? (
            <PaywallScreen />
          ) : (
            <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 animate-fade-in">
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
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (!res.ok) throw new Error('Failed to initialize checkout')
        
      const data = await res.json()
      
      if (data.url) {
        window.location.href = data.url
      } else {
        throw new Error('No checkout URL returned')
      }
    } catch (err) {
      console.error('Checkout error:', err)
      setErrorMsg(t('Hubo un problema al procesar el pago. Inténtalo de nuevo.', 'There was a problem processing the payment. Please try again.'))
      setLoadingCheckout(false)
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center p-4 py-12">
      <div className="card max-w-md w-full text-center animate-scale-in border border-slate-200 dark:border-slate-700 shadow-xl bg-white dark:bg-slate-800">
        <div className="text-6xl mb-6" role="img" aria-label={t('Contenido bloqueado', 'Locked content')}>🔒</div>
        
        <h2 className="text-2xl font-bold text-ink dark:text-white mb-3">
          {t('Acceso Premium Requerido', 'Premium Access Required')}
        </h2>
        
        <p className="text-ink-light dark:text-slate-400 mb-6 leading-relaxed text-sm">
          {t(
            'Desbloquea todos los exámenes, tarjetas de memoria y análisis IA con una suscripción mensual.',
            'Unlock all exams, flashcards, and AI analytics with a monthly subscription.'
          )}
        </p>

        {errorMsg && (
          <div className="mb-6 p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm rounded-lg border border-red-100 dark:border-red-800/50">
            {errorMsg}
          </div>
        )}

        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-5 mb-6 border border-blue-100 dark:border-blue-800/50">
          <div className="text-4xl font-extrabold text-primary dark:text-blue-400 mb-1">
            $9.99<span className="text-sm font-medium text-ink-light dark:text-slate-400">/mes</span>
          </div>
          
          <ul className="text-sm text-left space-y-3 mt-5">
            {[
              t('Exámenes ilimitados', 'Unlimited exams'),
              t('Tarjetas de memoria', 'Flashcard module'),
              t('Análisis IA con Groq', 'AI insights powered by Groq'),
              t('Bilingüe ES/EN', 'Bilingual ES/EN'),
              t('Gamificación completa', 'Full gamification'),
              t('Reto diario', 'Daily challenge'),
            ].map((item, i) => (
              <li key={i} className="text-ink dark:text-slate-300 flex items-start gap-3">
                <span className="text-success font-bold mt-0.5" aria-hidden="true">✓</span> 
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <button 
          onClick={handleSubscribe} 
          disabled={loadingCheckout}
          className="btn-primary w-full text-lg py-3.5 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loadingCheckout ? (
             <span className="animate-pulse">{t('Redirigiendo...', 'Redirecting...')}</span>
          ) : (
            t('Suscribirse ahora', 'Subscribe Now')
          )}
        </button>
        
        <p className="text-xs text-ink-light dark:text-slate-500 mt-4 font-medium">
          {t('Cancela cuando quieras', 'Cancel anytime')}
        </p>
      </div>
    </div>
  )
}

export default function AppShell({ children, requirePremium = false, requireAdmin = false }) {
  return (
    <ProtectedLayout requirePremium={requirePremium} requireAdmin={requireAdmin}>
      {children}
    </ProtectedLayout>
  )
}