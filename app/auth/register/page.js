'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AuthProvider, useAuth } from '@/components/AuthContext'

function RegisterForm() {
  const [form, setForm] = useState({ email: '', password: '', nickname: '', language: 'es' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()
  const router = useRouter()

  const update = (key, val) => setForm((f) => ({ ...f, [key]: val }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres / Password must be at least 6 characters')
      return
    }
    setLoading(true)
    setError('')
    const result = await register(form.email, form.password, form.nickname, form.language)
    if (result.success) {
      router.push('/dashboard')
    } else {
      setError(result.error || 'Registration failed')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-scale-in">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-white text-2xl font-bold">
            <span className="text-3xl">🚗</span>
            <span>Autoscuela</span>
          </Link>
          <p className="text-white/60 mt-2 text-sm">Crea tu cuenta gratis / Create your free account</p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <h1 className="text-2xl font-bold text-ink mb-6">Empezar es gratis 🎉</h1>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-danger text-sm">
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                className="input"
                placeholder="tu@email.com"
                required
              />
            </div>

            <div>
              <label className="label">Apodo / Nickname</label>
              <input
                type="text"
                value={form.nickname}
                onChange={(e) => update('nickname', e.target.value)}
                className="input"
                placeholder="Para el ranking anónimo"
                required
                maxLength={20}
              />
              <p className="text-xs text-ink-light mt-1">Solo se mostrará en el ranking · Only shown on leaderboard</p>
            </div>

            <div>
              <label className="label">Contraseña / Password</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
                className="input"
                placeholder="Mínimo 6 caracteres"
                required
              />
            </div>

            <div>
              <label className="label">Idioma preferido / Preferred Language</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { val: 'es', flag: '🇪🇸', label: 'Español' },
                  { val: 'en', flag: '🇬🇧', label: 'English' },
                ].map((opt) => (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => update('language', opt.val)}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 font-semibold transition-all ${
                      form.language === opt.val
                        ? 'border-primary bg-blue-50 text-primary'
                        : 'border-slate-200 text-ink hover:border-slate-300'
                    }`}
                  >
                    <span className="text-xl">{opt.flag}</span>
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full mt-2 text-base">
              {loading ? 'Creando cuenta...' : '🚀 Crear cuenta gratis'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-ink-light">
            ¿Ya tienes cuenta?{' '}
            <Link href="/auth/login" className="text-primary font-semibold hover:underline">
              Iniciar sesión
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <AuthProvider>
      <RegisterForm />
    </AuthProvider>
  )
}
