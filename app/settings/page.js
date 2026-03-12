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

  // Separated loading states to prevent UI locking
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [loadingBilling, setLoadingBilling] = useState(false)

  // Profile State
  const [nickname, setNickname] = useState(user?.nickname || '')
  
  // Password State
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // ==== HANDLERS ====

  const handleSaveProfile = async (e) => {
    e.preventDefault() // Added to support standard form submission (Enter key)
    
    if (nickname.trim().length < 2) {
      toast.error(t('El nombre debe tener al menos 2 caracteres', 'Nickname must be at least 2 characters'))
      return
    }

    setSavingProfile(true)
    try {
      const res = await fetch('/api/users/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: nickname.trim() }),
      })
      const data = await res.json()
      
      if (res.ok) {
        toast.success(t('Perfil actualizado', 'Profile updated'))
        refreshUser()
      } else {
        toast.error(data.error || t('Error al actualizar el perfil', 'Error updating profile'))
      }
    } catch (err) {
      console.error(err)
      toast.error(t('Hubo un problema de conexión', 'Connection error'))
    } finally {
      setSavingProfile(false)
    }
  }

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

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme)
    
    // Optimistic UI update with background save and silent catch
    fetch('/api/users/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: newTheme }),
    }).catch(err => {
      console.error('Failed to save theme preference to server:', err)
      // We fail silently here because the local context already updated the UI smoothly
    })
  }

  const handleSubscribe = async () => {
    if (loadingBilling) return
    setLoadingBilling(true)
    
    try {
      const res = await fetch('/api/billing/checkout', { method: 'POST' })
      const data = await res.json()
      
      if (data.url) {
        window.location.href = data.url
      } else {
        throw new Error('No checkout URL returned')
      }
    } catch (err) {
      console.error(err)
      toast.error(t('Error al iniciar el pago', 'Error initiating checkout'))
      setLoadingBilling(false) // Only reset if failed (otherwise page redirects)
    }
  }

  const themes = [
    { value: 'light', label: t('Claro', 'Light'), icon: '☀️' },
    { value: 'dark', label: t('Oscuro', 'Dark'), icon: '🌙' },
    { value: 'system', label: t('Sistema', 'System'), icon: '🖥️' },
  ]

  // ==== RENDER ====
  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in pb-12">
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-ink dark:text-white">
          {t('Ajustes', 'Settings')}
        </h1>
        <p className="text-ink-light dark:text-slate-400 mt-1">
          {t('Personaliza tu experiencia', 'Customize your experience')}
        </p>
      </div>

      {/* Profile Form */}
      <div className="card bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
        <h2 className="font-bold text-lg text-ink dark:text-white mb-4">
          {t('Perfil', 'Profile')}
        </h2>
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="label text-sm font-medium text-ink-light dark:text-slate-300">
              {t('Email', 'Email')}
            </label>
            <input 
              id="email" 
              type="email" 
              value={user?.email || ''} 
              disabled 
              className="input opacity-60 cursor-not-allowed bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-ink dark:text-slate-400" 
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="nickname" className="label text-sm font-medium text-ink-light dark:text-slate-300">
              {t('Nombre de usuario', 'Nickname')}
            </label>
            <input
              id="nickname"
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="input bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-ink dark:text-white focus:ring-2 focus:ring-primary outline-none"
              maxLength={20}
              required
            />
          </div>
          <button 
            type="submit" 
            disabled={savingProfile || nickname === user?.nickname} 
            className="btn-primary mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {savingProfile ? t('Guardando...', 'Saving...') : t('Guardar perfil', 'Save profile')}
          </button>
        </form>
      </div>

      {/* Appearance */}
      <div className="card bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
        <h2 className="font-bold text-lg text-ink dark:text-white mb-4">
          {t('Apariencia', 'Appearance')}
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {themes.map((t_item) => {
            const isActive = theme === t_item.value
            return (
              <button
                key={t_item.value}
                type="button"
                onClick={() => handleThemeChange(t_item.value)}
                className={`p-4 rounded-xl border-2 text-center transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-slate-800 ${
                  isActive
                    ? 'border-primary bg-blue-50 dark:bg-blue-900/30'
                    : 'border-slate-100 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-slate-50 dark:bg-slate-900/50'
                }`}
                aria-pressed={isActive}
              >
                <div className="text-2xl mb-1" aria-hidden="true">{t_item.icon}</div>
                <div className={`text-sm font-medium ${isActive ? 'text-primary dark:text-blue-400' : 'text-ink dark:text-slate-300'}`}>
                  {t_item.label}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Password Form */}
      <div className="card bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
        <h2 className="font-bold text-lg text-ink dark:text-white mb-4">
          {t('Cambiar contraseña', 'Change Password')}
        </h2>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="currentPassword" className="label text-sm font-medium text-ink-light dark:text-slate-300">
              {t('Contraseña actual', 'Current password')}
            </label>
            <input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="input bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-ink dark:text-white focus:ring-2 focus:ring-primary outline-none"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="newPassword" className="label text-sm font-medium text-ink-light dark:text-slate-300">
              {t('Nueva contraseña', 'New password')}
            </label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="input bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-ink dark:text-white focus:ring-2 focus:ring-primary outline-none"
              minLength={8}
              required
            />
            <p className="text-xs text-ink-light dark:text-slate-500">{t('Mínimo 8 caracteres', 'Minimum 8 characters')}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="confirmPassword" className="label text-sm font-medium text-ink-light dark:text-slate-300">
              {t('Confirmar contraseña', 'Confirm password')}
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-ink dark:text-white focus:ring-2 focus:ring-primary outline-none"
              required
            />
          </div>
          <button
            type="submit"
            disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
            className="btn-primary mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {savingPassword ? t('Cambiando...', 'Changing...') : t('Cambiar contraseña', 'Change password')}
          </button>
        </form>
      </div>

      {/* Subscription Status */}
      <div className={`card border-2 transition-colors ${user?.isPremium ? 'bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/10 dark:to-purple-900/10 border-blue-100 dark:border-blue-900/50' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
        <h2 className="font-bold text-lg text-ink dark:text-white mb-4">
          {t('Suscripción', 'Subscription')}
        </h2>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="font-medium text-ink dark:text-slate-200 text-lg">
              {user?.isPremium
                ? t('Plan Premium Activo', 'Premium Plan Active')
                : t('Plan Gratuito', 'Free Plan')
              }
            </p>
            <p className="text-sm text-ink-light dark:text-slate-400 mt-1">
              {user?.isPremium
                ? t('Acceso completo a todas las funciones y análisis IA.', 'Full access to all features and AI analytics.')
                : t('Suscríbete para acceder a todos los exámenes y funciones.', 'Subscribe to unlock all exams and features.')
              }
            </p>
          </div>
          
          {user?.isPremium ? (
            <span className="badge-pill bg-success/10 text-success text-sm px-4 py-2 rounded-full font-bold whitespace-nowrap self-start sm:self-auto">
              ✓ {t('Activo', 'Active')}
            </span>
          ) : (
            <button
              type="button"
              onClick={handleSubscribe}
              disabled={loadingBilling}
              className="btn-primary whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto flex justify-center"
            >
              {loadingBilling ? t('Redirigiendo...', 'Redirecting...') : t('Suscribirse', 'Subscribe')}
            </button>
          )}
        </div>
      </div>

      {/* Account Info Stats */}
      <div className="card bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
        <h2 className="font-bold text-lg text-ink dark:text-white mb-4">
          {t('Cuenta', 'Account')}
        </h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between items-center py-2 border-b border-slate-50 dark:border-slate-700/50">
            <span className="text-ink-light dark:text-slate-400">{t('Miembro desde', 'Member since')}</span>
            <span className="text-ink dark:text-slate-200 font-medium">
              {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}
            </span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-slate-50 dark:border-slate-700/50">
            <span className="text-ink-light dark:text-slate-400">XP Total</span>
            <span className="text-ink dark:text-slate-200 font-bold text-amber-500">
              {user?.gamification?.totalXP || 0} XP
            </span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-slate-50 dark:border-slate-700/50">
            <span className="text-ink-light dark:text-slate-400">{t('Racha máxima', 'Max streak')}</span>
            <span className="text-ink dark:text-slate-200 font-medium flex items-center gap-1">
              <span aria-hidden="true">🔥</span> {user?.gamification?.maxStreak || 0} {t('días', 'days')}
            </span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-ink-light dark:text-slate-400">{t('Insignias', 'Badges')}</span>
            <span className="text-ink dark:text-slate-200 font-medium flex items-center gap-1">
               <span aria-hidden="true">🎖️</span> {user?.gamification?.earnedBadges?.length || 0}
            </span>
          </div>
        </div>
      </div>
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