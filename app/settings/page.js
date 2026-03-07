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

  const [nickname, setNickname] = useState(user?.nickname || '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSaveProfile = async () => {
    if (nickname.trim().length < 2) {
      toast.error(t('El nombre debe tener al menos 2 caracteres', 'Nickname must be at least 2 characters'))
      return
    }

    setSaving(true)
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
        toast.error(data.error)
      }
    } catch {
      toast.error(t('Error al guardar', 'Failed to save'))
    }
    setSaving(false)
  }

  const handleChangePassword = async () => {
    if (newPassword.length < 8) {
      toast.error(t('La contrasena debe tener al menos 8 caracteres', 'Password must be at least 8 characters'))
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error(t('Las contrasenas no coinciden', 'Passwords do not match'))
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/users/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(t('Contrasena actualizada', 'Password updated'))
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        toast.error(data.error)
      }
    } catch {
      toast.error(t('Error al cambiar contrasena', 'Failed to change password'))
    }
    setSaving(false)
  }

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme)
    // Also save to server for persistence
    fetch('/api/users/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: newTheme }),
    })
  }

  const themes = [
    { value: 'light', label: t('Claro', 'Light'), icon: '☀️' },
    { value: 'dark', label: t('Oscuro', 'Dark'), icon: '🌙' },
    { value: 'system', label: t('Sistema', 'System'), icon: '🖥️' },
  ]

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-ink dark:text-white">
          {t('Ajustes', 'Settings')}
        </h1>
        <p className="text-ink-light mt-1">
          {t('Personaliza tu experiencia', 'Customize your experience')}
        </p>
      </div>

      {/* Profile */}
      <div className="card">
        <h2 className="font-bold text-lg text-ink dark:text-white mb-4">
          {t('Perfil', 'Profile')}
        </h2>
        <div className="space-y-4">
          <div>
            <label className="label">{t('Email', 'Email')}</label>
            <input type="email" value={user?.email || ''} disabled className="input opacity-60 cursor-not-allowed" />
          </div>
          <div>
            <label className="label">{t('Nombre de usuario', 'Nickname')}</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="input"
              maxLength={20}
            />
          </div>
          <button onClick={handleSaveProfile} disabled={saving} className="btn-primary">
            {saving ? t('Guardando...', 'Saving...') : t('Guardar perfil', 'Save profile')}
          </button>
        </div>
      </div>

      {/* Appearance */}
      <div className="card">
        <h2 className="font-bold text-lg text-ink dark:text-white mb-4">
          {t('Apariencia', 'Appearance')}
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {themes.map((t_item) => (
            <button
              key={t_item.value}
              onClick={() => handleThemeChange(t_item.value)}
              className={`p-4 rounded-xl border-2 text-center transition-all ${
                theme === t_item.value
                  ? 'border-primary bg-blue-50 dark:bg-blue-900/30'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <div className="text-2xl mb-1">{t_item.icon}</div>
              <div className="text-sm font-medium text-ink dark:text-slate-200">{t_item.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Password */}
      <div className="card">
        <h2 className="font-bold text-lg text-ink dark:text-white mb-4">
          {t('Cambiar contrasena', 'Change Password')}
        </h2>
        <div className="space-y-4">
          <div>
            <label className="label">{t('Contrasena actual', 'Current password')}</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label">{t('Nueva contrasena', 'New password')}</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="input"
              minLength={8}
            />
            <p className="text-xs text-ink-light mt-1">{t('Minimo 8 caracteres', 'Minimum 8 characters')}</p>
          </div>
          <div>
            <label className="label">{t('Confirmar contrasena', 'Confirm password')}</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input"
            />
          </div>
          <button
            onClick={handleChangePassword}
            disabled={saving || !currentPassword || !newPassword}
            className="btn-primary"
          >
            {saving ? t('Cambiando...', 'Changing...') : t('Cambiar contrasena', 'Change password')}
          </button>
        </div>
      </div>

      {/* Subscription */}
      <div className="card">
        <h2 className="font-bold text-lg text-ink dark:text-white mb-4">
          {t('Suscripcion', 'Subscription')}
        </h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-ink dark:text-slate-200">
              {user?.isPremium
                ? t('Plan Premium activo', 'Premium plan active')
                : t('Plan gratuito', 'Free plan')
              }
            </p>
            <p className="text-sm text-ink-light">
              {user?.isPremium
                ? t('Acceso completo a todas las funciones', 'Full access to all features')
                : t('Suscribete para acceder a todos los examenes y funciones', 'Subscribe to unlock all exams and features')
              }
            </p>
          </div>
          {user?.isPremium ? (
            <span className="badge-pill bg-success/10 text-success text-sm">
              {t('Activo', 'Active')}
            </span>
          ) : (
            <button
              onClick={async () => {
                const res = await fetch('/api/billing/checkout', { method: 'POST' })
                const data = await res.json()
                if (data.url) window.location.href = data.url
              }}
              className="btn-primary"
            >
              {t('Suscribirse', 'Subscribe')}
            </button>
          )}
        </div>
      </div>

      {/* Account info */}
      <div className="card">
        <h2 className="font-bold text-lg text-ink dark:text-white mb-4">
          {t('Cuenta', 'Account')}
        </h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-ink-light">{t('Miembro desde', 'Member since')}</span>
            <span className="text-ink dark:text-slate-200">{user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-light">XP Total</span>
            <span className="text-ink dark:text-slate-200">{user?.gamification?.totalXP || 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-light">{t('Racha maxima', 'Max streak')}</span>
            <span className="text-ink dark:text-slate-200">{user?.gamification?.maxStreak || 0} {t('dias', 'days')}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-light">{t('Insignias', 'Badges')}</span>
            <span className="text-ink dark:text-slate-200">{user?.gamification?.earnedBadges?.length || 0}</span>
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
