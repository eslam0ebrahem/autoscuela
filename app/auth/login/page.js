'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AuthProvider, useAuth } from '@/components/AuthContext'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login, t } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const result = await login(email, password, rememberMe)
      if (result.success) {
        const from = searchParams.get('from')
        router.replace(from && from.startsWith('/') ? from : '/dashboard')
      } else setError(result.error || 'Error al entrar')
    } catch (err) {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-6 sm:p-12 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-600/5 to-emerald-600/5 -z-10" />
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />

      <div className="w-full max-w-md space-y-8 animate-fade-in">
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-3 group">
            <span className="text-4xl group-hover:scale-110 transition-transform">✨</span>
            <span className="text-3xl font-black tracking-tight text-ink dark:text-white">
              Vialia
            </span>
          </Link>
          <p className="text-ink-light font-medium">
            {t('Inicia sesión para continuar', 'Sign in to continue')}
          </p>
        </div>

        <div className="card glass p-8 sm:p-10 space-y-6">
          {/* 5.8: Add aria-live regions for form errors */}
          {error && (
            <div
              className="p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 text-danger border-2 border-red-100 dark:border-red-900/50 text-sm font-bold flex items-center gap-2"
              role="alert"
              aria-live="polite"
            >
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              id="email"
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@ejemplo.com"
              autoComplete="email"
              required
            />

            <div className="space-y-1">
              <label
                htmlFor="password"
                className="text-[10px] font-black uppercase tracking-widest text-ink-light ml-1"
              >
                {t('Contraseña', 'Password')}
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-4 pr-12 rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 focus:border-primary outline-none font-bold transition-all"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
                {/* 5.4: Add aria-label to icon-only buttons */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-light hover:text-primary transition-colors"
                  aria-label={
                    showPassword
                      ? t('Ocultar contraseña', 'Hide password')
                      : t('Mostrar contraseña', 'Show password')
                  }
                >
                  {showPassword ? '👁️' : '🔒'}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between px-1">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className="relative flex items-center justify-center">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <div className="w-5 h-5 rounded-lg border-2 border-slate-200 dark:border-slate-700 peer-checked:bg-primary peer-checked:border-primary transition-all" />
                  <span className="absolute text-white text-[10px] font-black opacity-0 peer-checked:opacity-100 scale-50 peer-checked:scale-100 transition-all">
                    ✓
                  </span>
                </div>
                <span className="text-sm font-bold text-ink-light group-hover:text-ink transition-colors">
                  {t('Recordarme', 'Remember me')}
                </span>
              </label>
              <Link href="/auth/forgot" className="text-xs font-bold text-primary hover:underline">
                {t('¿Olvidaste la clave?', 'Forgot password?')}
              </Link>
            </div>

            <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
              {t('Entrar', 'Sign In')} →
            </Button>
          </form>

          <div className="text-center pt-4">
            <p className="text-sm text-ink-light font-medium">
              {t('¿No tienes cuenta?', "Don't have an account?")}{' '}
              <Link href="/auth/register" className="text-primary font-black hover:underline">
                {t('Regístrate', 'Register')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas" />}>
      <LoginForm />
    </Suspense>
  )
}
