'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AuthProvider, useAuth } from '@/components/AuthContext'

function LoginForm() {
  const router = useRouter()
  const { login } = useAuth()
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (loading) return

    setLoading(true)
    setError('')
    
    try {
      const result = await login(email, password)
      
      if (result.success) {
        // Use replace to prevent users from hitting the 'back' button and returning to the login screen
        router.replace('/dashboard') 
      } else {
        setError(result.error || 'Login failed. Please check your credentials.')
      }
    } catch (err) {
      console.error('Login submission error:', err)
      setError('Hubo un problema de conexión. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0F1C] bg-gradient-to-br from-slate-900 via-[#0a1930] to-[#110c24] flex items-center justify-center p-4 selection:bg-blue-500/30">
      
      {/* Optional decorative background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/20 blur-[120px] rounded-full pointer-events-none" aria-hidden="true" />

      <div className="w-full max-w-md animate-scale-in relative z-10">
        
        {/* Logo */}
        <div className="text-center mb-8">
          <Link 
            href="/" 
            className="inline-flex items-center gap-2 text-white text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg px-2 py-1"
          >
            <span className="text-3xl" aria-hidden="true">🚗</span>
            <span className="tracking-tight">Autoscuela</span>
          </Link>
          <p className="text-slate-400 mt-2 text-sm font-medium">Inicia sesión / Sign in</p>
        </div>

        {/* Login Card */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 border border-white/10 dark:border-slate-700">
          <h1 className="text-2xl font-bold text-ink dark:text-white mb-6 text-center">
            Bienvenido de vuelta
          </h1>

          {/* Error Banner */}
          {error && (
            <div 
              className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 text-danger dark:text-red-400 text-sm font-medium flex items-start gap-2 animate-fade-in"
              role="alert"
            >
              <span aria-hidden="true">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* Email Field */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="label text-sm font-semibold text-ink-light dark:text-slate-300">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-ink dark:text-white focus:ring-2 focus:ring-primary outline-none transition-all placeholder:text-slate-400"
                placeholder="tu@email.com"
                required
                disabled={loading}
              />
            </div>

            {/* Password Field */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="label text-sm font-semibold text-ink-light dark:text-slate-300">
                Contraseña / Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input w-full bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-ink dark:text-white focus:ring-2 focus:ring-primary outline-none transition-all placeholder:text-slate-400 pr-12"
                  placeholder="••••••••"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex="-1" // Prevents tab stopping here while quickly filling the form
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-ink dark:hover:text-slate-200 focus:outline-none focus:text-primary transition-colors rounded-lg"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.29 3.29m0 0a10.05 10.05 0 015.71-1.591c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0l-3.29-3.29" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button 
              type="submit" 
              disabled={loading || !email || !password} 
              className="btn-primary w-full mt-2 text-base py-3.5 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-slate-800"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Entrando...
                </span>
              ) : (
                'Iniciar sesión →'
              )}
            </button>
          </form>

          {/* Footer Links */}
          <div className="mt-8 text-center text-sm font-medium text-ink-light dark:text-slate-400 border-t border-slate-100 dark:border-slate-700/50 pt-6">
            ¿No tienes cuenta?{' '}
            <Link 
              href="/auth/register" 
              className="text-primary dark:text-blue-400 font-bold hover:underline focus:outline-none focus:ring-2 focus:ring-primary rounded px-1"
            >
              Regístrate gratis
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

// Ensure the page provides the Auth Context if it's not wrapped globally in this route group
export default function LoginPage() {
  return (
    <AuthProvider>
      <LoginForm />
    </AuthProvider>
  )
}