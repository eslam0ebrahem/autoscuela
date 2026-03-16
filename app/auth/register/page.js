'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AuthProvider, useAuth } from '@/components/AuthContext'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'

function RegisterForm() {
  const [form, setForm] = useState({ email: '', password: '', nickname: '', language: 'es' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()
  const router = useRouter()

  const update = (key, val) => setForm((f) => ({ ...f, [key]: val }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }
    setLoading(true)
    setError('')
    const result = await register(form.email, form.password, form.nickname, form.language)
    if (result.success) router.push('/dashboard')
    else setError(result.error || 'Error al registrarse')
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-6 sm:p-12 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-600/5 to-emerald-600/5 -z-10" />
      
      <div className="w-full max-w-md space-y-8 animate-fade-in">
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-3 group">
            <span className="text-4xl group-hover:scale-110 transition-transform">✨</span>
            <span className="text-3xl font-black tracking-tight text-ink dark:text-white">Vialia</span>
          </Link>
          <p className="text-ink-light font-medium">Empieza tu camino hoy gratis</p>
        </div>

        <div className="card glass p-8 sm:p-10 space-y-6">
          {error && <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 text-danger border-2 border-red-100 dark:border-red-900/50 text-sm font-bold flex items-center gap-2">⚠️ {error}</div>}

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              id="email"
              label="Email"
              type="email"
              value={form.email}
              onChange={e => update('email', e.target.value)}
              placeholder="tu@email.com"
              autoComplete="email"
              required
            />

            <Input
              id="nickname"
              label="Nickname"
              type="text"
              value={form.nickname}
              onChange={e => update('nickname', e.target.value)}
              placeholder="Tu apodo"
              autoComplete="username"
              maxLength={20}
              required
            />

            <Input
              id="password"
              label="Contraseña"
              type="password"
              value={form.password}
              onChange={e => update('password', e.target.value)}
              placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
              required
              helperText="Mínimo 8 caracteres"
            />

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-ink-light ml-1">Idioma</label>
              <div className="grid grid-cols-2 gap-2">
                {[{v:'es',l:'ES',f:'🇪🇸'},{v:'en',l:'EN',f:'🇬🇧'}].map(o => (
                  <button key={o.v} type="button" onClick={() => update('language', o.v)} className={`p-3 rounded-2xl border-2 font-bold transition-all flex items-center justify-center gap-2 ${form.language === o.v ? 'border-primary bg-primary/5 text-primary' : 'border-slate-100 dark:border-slate-800 text-ink-light'}`}>
                    <span>{o.f}</span> {o.l}
                  </button>
                ))}
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={loading}
            >
              Crear Cuenta Gratis
            </Button>
          </form>

          <div className="text-center pt-4 border-t border-slate-100 dark:border-slate-800">
            <p className="text-sm text-ink-light font-medium">
              ¿Ya tienes cuenta?{' '}
              <Link href="/auth/login" className="text-primary font-black hover:underline">Inicia Sesión</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return <RegisterForm />
}
