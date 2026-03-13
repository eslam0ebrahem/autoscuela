'use client'

import { useState } from 'react'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/components/AuthContext'
import { useTheme } from '@/components/ThemeProvider'

function SettingsContent() {
  const { user, t, refreshUser } = useAuth()
  const { theme, setTheme } = useTheme()

  const [savingProfile, setSavingProfile] = useState(false)
  const [nickname, setNickname] = useState(user?.nickname || '')

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    if (nickname.trim().length < 2) return 
    
    setSavingProfile(true)
    try {
      const res = await fetch('/api/users/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: nickname.trim() }),
      })
      if (res.ok) {
        refreshUser()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSavingProfile(false)
    }
  }

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme)
    fetch('/api/users/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: newTheme }),
    }).catch(console.error)
  }

  const themes = [
    { value: 'light', label: t('Claro', 'Light'), icon: '☀️' },
    { value: 'dark', label: t('Oscuro', 'Dark'), icon: '🌙' },
    { value: 'system', label: t('Auto', 'Auto'), icon: '🖥️' },
  ]

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in pb-12 px-4">
      
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
            <div className="text-center md:text-left p-6">
               <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">{t('Tu Plan', 'Your Plan')}</p>
               <h2 className="text-2xl font-black">{user?.isPremium ? 'Autoscuela PRO' : 'Autoscuela FREE'}</h2>
               <p className="mt-2 text-sm font-medium opacity-80 max-w-sm">
                 {user?.isPremium ? t('Disfrutas de acceso ilimitado a IA y exámenes.', 'You have full access to AI and exams.') : t('Suscríbete para desbloquear el análisis IA y exámenes ilimitados.', 'Subscribe to unlock AI analysis and unlimited exams.')}
               </p>
            </div>
            {!user?.isPremium && (
               <div className="p-6">
                 <button onClick={() => {}} className="px-8 py-3 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 transition-all shadow-xl active:scale-95">
                   {t('Subir a PRO', 'Upgrade to PRO')}
                 </button>
               </div>
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
              </button>
            ))}
          </div>
        </div>
      </div>

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
               <p className="text-2xl font-black text-blue-500">{user?.createdAt ? new Date(user.createdAt).toLocaleDateString(undefined, { year: 'numeric' }) : '-'}</p>
               <p className="text-[10px] font-black uppercase tracking-widest text-ink-light">Since</p>
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
