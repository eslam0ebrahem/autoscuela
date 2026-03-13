'use client'

import { useState } from 'react'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/components/AuthContext'
import { useTheme } from '@/components/ThemeProvider'
import { useToast } from '@/components/Toast'

function SettingsContent() {
  const { user, t, refreshUser } = useAuth()
  const { theme, setTheme } = useTheme()
  const toast = useToast()

  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [loadingBilling, setLoadingBilling] = useState(false)

  const [nickname, setNickname] = useState(user?.nickname || '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

<<<<<<< HEAD
  // ── HANDLERS ──────────────────────────────────────────────
  const handleSaveProfile = async (e) => {
    e.preventDefault()
    if (nickname.trim().length < 2) {
      toast.error(t('El nombre debe tener al menos 2 caracteres', 'Nickname must be at least 2 characters'))
      return
    }
=======
  const handleSaveProfile = async (e) => {
    e.preventDefault()
    if (nickname.trim().length < 2) return toast.error(t('Mínimo 2 caracteres', 'Min 2 characters'))
>>>>>>> 4e5aace (feat(ui): implement mobile-first navigation and core layout refactor)
    setSavingProfile(true)
    try {
      const res = await fetch('/api/users/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: nickname.trim() }),
      })
<<<<<<< HEAD
      const data = await res.json()
      if (res.ok) { toast.success(t('Perfil actualizado', 'Profile updated')); refreshUser() }
      else toast.error(data.error || t('Error al actualizar el perfil', 'Error updating profile'))
    } catch (err) {
      console.error(err)
      toast.error(t('Hubo un problema de conexión', 'Connection error'))
=======
      if (res.ok) {
        toast.success(t('Perfil actualizado', 'Profile updated'))
        refreshUser()
      }
>>>>>>> 4e5aace (feat(ui): implement mobile-first navigation and core layout refactor)
    } finally {
      setSavingProfile(false)
    }
  }

<<<<<<< HEAD
  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (newPassword.length < 8) {
      toast.error(t('La contraseña debe tener al menos 8 caracteres', 'Password must be at least 8 characters'))
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error(t('Las contraseñas no coinciden', 'Passwords do not match'))
      return
    }
    setSavingPassword(true)
    try {
      const res = await fetch('/api/users/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(t('Contraseña actualizada', 'Password updated'))
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        toast.error(data.error || t('Error al cambiar la contraseña', 'Error changing password'))
      }
    } catch (err) {
      console.error(err)
      toast.error(t('Hubo un problema de conexión', 'Connection error'))
    } finally {
      setSavingPassword(false)
    }
  }

=======
>>>>>>> 4e5aace (feat(ui): implement mobile-first navigation and core layout refactor)
  const handleThemeChange = (newTheme) => {
    setTheme(newTheme)
    fetch('/api/users/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: newTheme }),
<<<<<<< HEAD
    }).catch(err => console.error('Failed to save theme preference to server:', err))
  }

  const handleSubscribe = async () => {
    if (loadingBilling) return
    setLoadingBilling(true)
    try {
      const res = await fetch('/api/billing/checkout', { method: 'POST' })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else throw new Error('No checkout URL returned')
    } catch (err) {
      console.error(err)
      toast.error(t('Error al iniciar el pago', 'Error initiating checkout'))
      setLoadingBilling(false)
    }
  }

  const themes = [
    { value: 'light',  label: t('Claro', 'Light'),   icon: '☀️' },
    { value: 'dark',   label: t('Oscuro', 'Dark'),    icon: '🌙' },
    { value: 'system', label: t('Sistema', 'System'), icon: '🖥️' },
  ]

  const accountRows = [
    {
      label: t('Miembro desde', 'Member since'),
      value: user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-',
      icon: '📅',
    },
    {
      label: 'XP Total',
      value: `${user?.gamification?.totalXP || 0} XP`,
      icon: '⚡',
      valueClass: 'text-warning font-black',
    },
    {
      label: t('Racha máxima', 'Max streak'),
      value: `🔥 ${user?.gamification?.maxStreak || 0} ${t('días', 'days')}`,
      icon: '🔥',
    },
    {
      label: t('Insignias', 'Badges'),
      value: `🎖️ ${user?.gamification?.earnedBadges?.length || 0}`,
      icon: '🎖️',
    },
  ]

  // ── SECTION WRAPPER ───────────────────────────────────────
  const Section = ({ icon, title, children }) => (
    <div className="rounded-2xl border border-base-200 bg-base-100 overflow-hidden shadow-sm">
      <div className="px-4 py-3.5 bg-base-200/50 border-b border-base-200 flex items-center gap-2">
        <span className="text-base">{icon}</span>
        <h2 className="font-black text-sm text-base-content">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )

  // ── FORM FIELD ────────────────────────────────────────────
  const Field = ({ id, label, hint, children }) => (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-bold text-base-content/50 uppercase tracking-wide">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-base-content/40">{hint}</p>}
    </div>
  )

  // ── RENDER ────────────────────────────────────────────────
  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-24 space-y-4">

      {/* ── Page Header ── */}
      <div className="mb-2">
        <h1 className="text-2xl font-black text-base-content">
          {t('Ajustes', 'Settings')}
        </h1>
        <p className="text-sm text-base-content/50 mt-0.5">
          {t('Personaliza tu experiencia', 'Customize your experience')}
        </p>
      </div>

      {/* ── Subscription Banner ── */}
      {user?.isPremium ? (
        <div className="rounded-2xl border border-success/30 bg-gradient-to-r
          from-success/10 to-emerald-500/5 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-success/15 flex items-center justify-center text-xl shrink-0">
            ✨
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-sm text-base-content">
              {t('Plan Premium Activo', 'Premium Plan Active')}
            </p>
            <p className="text-xs text-base-content/50 mt-0.5">
              {t('Acceso completo a todas las funciones y análisis IA.', 'Full access to all features and AI analytics.')}
            </p>
          </div>
          <span className="shrink-0 px-2.5 py-1 rounded-full bg-success/15 border border-success/25
            text-success text-xs font-black">
            ✓ {t('Activo', 'Active')}
          </span>
        </div>
      ) : (
        <div className="rounded-2xl border border-primary/25 bg-gradient-to-r
          from-primary/10 to-purple-500/10 p-4">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center text-xl shrink-0">
              🚀
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-sm text-base-content">
                {t('Plan Gratuito', 'Free Plan')}
              </p>
              <p className="text-xs text-base-content/50 mt-0.5">
                {t('Suscríbete para acceder a todos los exámenes y funciones.', 'Subscribe to unlock all exams and features.')}
              </p>
            </div>
          </div>
          <button
            onClick={handleSubscribe}
            disabled={loadingBilling}
            className="btn btn-primary w-full h-11 rounded-xl font-bold text-sm"
          >
            {loadingBilling
              ? <><span className="loading loading-spinner loading-xs" /> {t('Redirigiendo...', 'Redirecting...')}</>
              : `✨ ${t('Suscribirse · $9.99/mes', 'Subscribe · $9.99/mo')}`}
          </button>
        </div>
      )}

      {/* ── Profile ── */}
      <Section icon="👤" title={t('Perfil', 'Profile')}>
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <Field id="email" label={t('Email', 'Email')}>
            <input
              id="email"
              type="email"
              value={user?.email || ''}
              disabled
              className="input input-bordered input-sm w-full rounded-xl bg-base-200 opacity-60 cursor-not-allowed"
            />
          </Field>
          <Field id="nickname" label={t('Nombre de usuario', 'Nickname')}>
            <input
              id="nickname"
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="input input-bordered input-sm w-full rounded-xl bg-base-100"
              maxLength={20}
              required
            />
          </Field>
          <button
            type="submit"
            disabled={savingProfile || nickname.trim() === (user?.nickname || '')}
            className="btn btn-primary btn-sm h-11 w-full rounded-xl font-bold disabled:opacity-40"
          >
            {savingProfile
              ? <><span className="loading loading-spinner loading-xs" /> {t('Guardando...', 'Saving...')}</>
              : t('Guardar perfil', 'Save profile')}
          </button>
        </form>
      </Section>

      {/* ── Appearance ── */}
      <Section icon="🎨" title={t('Apariencia', 'Appearance')}>
        <div className="grid grid-cols-3 gap-2">
          {themes.map((item) => {
            const isActive = theme === item.value
            return (
              <button
                key={item.value}
                onClick={() => handleThemeChange(item.value)}
                aria-pressed={isActive}
                className={`py-3.5 rounded-xl border-2 flex flex-col items-center gap-1.5
                  transition-all active:scale-95
                  ${isActive
                    ? 'border-primary bg-primary/10 shadow-sm'
                    : 'border-base-200 bg-base-50 hover:border-base-300'}`}
              >
                <span className="text-2xl">{item.icon}</span>
                <span className={`text-xs font-bold ${isActive ? 'text-primary' : 'text-base-content/60'}`}>
                  {item.label}
                </span>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                )}
=======
    }).catch(console.error)
  }

  const themes = [
    { value: 'light', label: t('Claro', 'Light'), icon: '☀️' },
    { value: 'dark', label: t('Oscuro', 'Dark'), icon: '🌙' },
    { value: 'system', label: t('Auto', 'Auto'), icon: '🖥️' },
  ]

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in pb-12">
      
      <div className="flex items-center gap-6">
         <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-3xl text-white font-black shadow-xl shadow-blue-500/20">
           {user?.nickname?.[0]?.toUpperCase()}
         </div>
         <div>
            <h1 className="text-3xl font-black text-ink dark:text-white">{t('Tu Perfil', 'Your Profile')}</h1>
            <p className="text-ink-light font-medium">{user?.email}</p>
         </div>
      </div>

      {/* Subscription Hero */}
      <div className={`card border-0 overflow-hidden relative ${user?.isPremium ? 'bg-gradient-to-br from-indigo-600 to-blue-700 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>
         {user?.isPremium && <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12 scale-150"><span className="text-9xl">💎</span></div>}
         <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-center md:text-left">
               <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">{t('Tu Plan', 'Your Plan')}</p>
               <h2 className="text-2xl font-black">{user?.isPremium ? 'Autoscuela PRO' : 'Autoscuela FREE'}</h2>
               <p className="mt-2 text-sm font-medium opacity-80 max-w-sm">
                 {user?.isPremium ? t('Disfrutas de acceso ilimitado a IA y exámenes.', 'You have full access to AI and exams.') : t('Suscríbete para desbloquear el análisis IA y exámenes ilimitados.', 'Subscribe to unlock AI analysis and unlimited exams.')}
               </p>
            </div>
            {!user?.isPremium && (
               <button onClick={() => {}} className="px-8 py-3 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 transition-all shadow-xl active:scale-95">
                 {t('Subir a PRO', 'Upgrade to PRO')}
               </button>
            )}
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Profile Settings */}
        <div className="card glass space-y-4">
          <h3 className="font-black text-lg flex items-center gap-2"><span>👤</span> {t('Ajustes', 'Settings')}</h3>
          <form onSubmit={handleSaveProfile} className="space-y-4">
             <div className="space-y-1">
               <label className="text-[10px] font-black uppercase tracking-widest text-ink-light ml-1">{t('Nickname', 'Nickname')}</label>
               <input value={nickname} onChange={e => setNickname(e.target.value)} className="w-full p-4 rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 focus:border-primary outline-none font-bold transition-all" />
             </div>
             <button type="submit" disabled={savingProfile || nickname === user?.nickname} className="btn-primary w-full py-4 rounded-2xl font-black shadow-lg shadow-primary/20">
               {savingProfile ? '...' : t('Guardar', 'Save')}
             </button>
          </form>
        </div>

        {/* Appearance */}
        <div className="card glass space-y-4">
          <h3 className="font-black text-lg flex items-center gap-2"><span>🎨</span> {t('Tema', 'Theme')}</h3>
          <div className="grid grid-cols-3 gap-2">
            {themes.map(t_item => (
              <button
                key={t_item.value}
                onClick={() => handleThemeChange(t_item.value)}
                className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all ${theme === t_item.value ? 'border-primary bg-primary/5 text-primary' : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-ink-light'}`}
              >
                <span className="text-xl">{t_item.icon}</span>
                <span className="text-[10px] font-black uppercase tracking-widest">{t_item.label}</span>
>>>>>>> 4e5aace (feat(ui): implement mobile-first navigation and core layout refactor)
              </button>
            ))}
          </div>
        </div>
      </Section>

<<<<<<< HEAD
      {/* ── Change Password ── */}
      <Section icon="🔒" title={t('Cambiar contraseña', 'Change Password')}>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <Field id="currentPassword" label={t('Contraseña actual', 'Current password')}>
            <input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="input input-bordered input-sm w-full rounded-xl bg-base-100"
              required
              autoComplete="current-password"
            />
          </Field>
          <Field
            id="newPassword"
            label={t('Nueva contraseña', 'New password')}
            hint={t('Mínimo 8 caracteres', 'Minimum 8 characters')}
          >
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="input input-bordered input-sm w-full rounded-xl bg-base-100"
              minLength={8}
              required
              autoComplete="new-password"
            />
          </Field>
          <Field id="confirmPassword" label={t('Confirmar contraseña', 'Confirm password')}>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={`input input-bordered input-sm w-full rounded-xl bg-base-100
                ${confirmPassword && confirmPassword !== newPassword ? 'border-error' : ''}`}
              required
              autoComplete="new-password"
            />
            {confirmPassword && confirmPassword !== newPassword && (
              <p className="text-xs text-error mt-1">
                {t('Las contraseñas no coinciden', 'Passwords do not match')}
              </p>
            )}
          </Field>
          <button
            type="submit"
            disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
            className="btn btn-outline btn-sm h-11 w-full rounded-xl font-bold disabled:opacity-40"
          >
            {savingPassword
              ? <><span className="loading loading-spinner loading-xs" /> {t('Cambiando...', 'Changing...')}</>
              : t('Cambiar contraseña', 'Change password')}
          </button>
        </form>
      </Section>

      {/* ── Account Stats ── */}
      <Section icon="📊" title={t('Cuenta', 'Account')}>
        <div className="space-y-0 divide-y divide-base-200">
          {accountRows.map((row, i) => (
            <div key={i} className="flex items-center justify-between py-3">
              <span className="text-sm text-base-content/60">{row.label}</span>
              <span className={`text-sm font-bold text-base-content ${row.valueClass || ''}`}>
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </Section>

=======
      {/* Stats Summary */}
      <div className="card glass">
         <h3 className="font-black text-lg mb-6 flex items-center gap-2"><span>📊</span> {t('Tus Logros', 'Your Stats')}</h3>
         <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center">
               <p className="text-2xl font-black text-amber-500">{user?.gamification?.totalXP || 0}</p>
               <p className="text-[10px] font-black uppercase tracking-widest text-ink-light">XP Total</p>
            </div>
            <div className="text-center">
               <p className="text-2xl font-black text-orange-500">{user?.gamification?.maxStreak || 0}</p>
               <p className="text-[10px] font-black uppercase tracking-widest text-ink-light">Max Streak</p>
            </div>
            <div className="text-center">
               <p className="text-2xl font-black text-purple-500">{user?.gamification?.earnedBadges?.length || 0}</p>
               <p className="text-[10px] font-black uppercase tracking-widest text-ink-light">Badges</p>
            </div>
            <div className="text-center">
               <p className="text-2xl font-black text-blue-500">{new Date(user?.createdAt).toLocaleDateString(undefined, { year: 'numeric' })}</p>
               <p className="text-[10px] font-black uppercase tracking-widest text-ink-light">Since</p>
            </div>
         </div>
      </div>

      <div className="text-center pt-8">
         <button onClick={() => {}} className="text-danger font-black text-xs uppercase tracking-widest hover:underline opacity-60 hover:opacity-100 transition-opacity">
           {t('Cerrar Sesión', 'Log Out')}
         </button>
      </div>
>>>>>>> 4e5aace (feat(ui): implement mobile-first navigation and core layout refactor)
    </div>
  )
}

export default function SettingsPage() {
  return (
    <AppShell>
      <SettingsContent />
    </AppShell>
  )
}
