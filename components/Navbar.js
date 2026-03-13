'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from './AuthContext'
import { useTheme } from './ThemeProvider'
import {
  HomeOutlined,
  FileTextOutlined,
  IdcardOutlined,
  CloseCircleOutlined,
  BarChartOutlined,
  StarOutlined,
  BulbOutlined,
  SunOutlined,
  MoonOutlined,
  DesktopOutlined,
  FireOutlined,
  UserOutlined,
  SettingOutlined,
  SafetyCertificateOutlined,
  LogoutOutlined,
  GlobalOutlined,
  TranslationOutlined
} from '@ant-design/icons'

export default function Navbar() {
  const { user, logout, updateLanguage, t } = useAuth()
  const { theme, setTheme } = useTheme()
  const pathname = usePathname()
  
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)
  const lang = user?.preferences?.language || 'es'
  const streak = user?.gamification?.currentStreak || 0

  useEffect(() => {
    if (!dropdownOpen) return
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target))
        setDropdownOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [dropdownOpen])

  useEffect(() => {
    if (!dropdownOpen) return
    const handleEscape = (e) => { if (e.key === 'Escape') setDropdownOpen(false) }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [dropdownOpen])

  useEffect(() => { setDropdownOpen(false) }, [pathname])

  const themeIcon = theme === 'dark' ? <MoonOutlined /> : theme === 'light' ? <SunOutlined /> : <DesktopOutlined />
  const nextTheme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'

  const navLinks = [
    { href: '/dashboard', label: t('Inicio', 'Home'), icon: <HomeOutlined /> },
    { href: '/exam', label: t('Examen', 'Exam'), icon: <FileTextOutlined /> },
    { href: '/flashcards', label: t('Tarjetas', 'Cards'), icon: <IdcardOutlined /> },
    { href: '/mistakes', label: t('Errores', 'Mistakes'), icon: <CloseCircleOutlined /> },
    { href: '/stats', label: t('Stats', 'Stats'), icon: <BarChartOutlined /> },
    { href: '/dashboard/bookmarks', label: t('Guardados', 'Saved'), icon: <StarOutlined /> },
  ]

  const bottomNavLinks = navLinks.slice(0, 5)

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <Link href="/dashboard" className="flex items-center gap-2 group">
            <span className="text-2xl transition-transform group-hover:scale-110 text-primary" role="img" aria-hidden="true">
              <SafetyCertificateOutlined />
            </span>
            <span className="font-bold text-xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
              Vialia
            </span>
            <span className="hidden sm:inline text-[10px] font-bold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-400 px-1.5 py-0.5 rounded-md">AI</span>
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    isActive
                      ? 'bg-primary/10 text-primary dark:text-blue-400'
                      : 'text-ink-light dark:text-slate-400 hover:text-ink dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="text-base">{link.icon}</span>
                  {link.label}
                </Link>
              )
            })}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setTheme(nextTheme)}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-lg flex items-center justify-center"
              title={t('Cambiar tema', 'Change theme')}
            >
              {themeIcon}
            </button>

            <button
              onClick={() => updateLanguage(lang === 'es' ? 'en' : 'es')}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold transition-colors"
            >
              <TranslationOutlined />
              <span className="text-ink dark:text-slate-200">{lang === 'es' ? 'ES' : 'EN'}</span>
            </button>

            {streak > 0 && (
              <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800/50">
                <FireOutlined className="text-orange-500" />
                <span className="text-sm font-bold text-orange-600 dark:text-orange-400">{streak}</span>
              </div>
            )}

            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shadow-md">
                  {user?.nickname?.[0]?.toUpperCase() || <UserOutlined />}
                </div>
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 glass rounded-2xl shadow-xl py-2 z-50 animate-scale-in origin-top-right">
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700/50 mb-1">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white font-black shrink-0 shadow-sm">
                        {user?.nickname?.[0]?.toUpperCase() || <UserOutlined />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-ink dark:text-white truncate">{user?.nickname}</p>
                        <p className="text-xs text-ink-light dark:text-slate-400 truncate">{user?.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${user?.isPremium ? 'bg-blue-100 dark:bg-blue-900/40 text-primary border-blue-200' : 'bg-slate-100 dark:bg-slate-800 text-ink-light border-slate-200'}`}>
                        {user?.isPremium ? '✨ Premium' : t('Gratis', 'Free')}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-50 dark:bg-amber-900/20 border border-amber-100 text-amber-600 dark:text-amber-400">
                        ⚡ {user?.gamification?.totalXP || 0} XP
                      </span>
                    </div>
                  </div>
                  
                  <div className="p-1 space-y-0.5">
                    <button
                      onClick={() => { updateLanguage(lang === 'es' ? 'en' : 'es'); setDropdownOpen(false) }}
                      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-ink-light dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
                    >
                      <TranslationOutlined />
                      {lang === 'es' ? 'Switch to English' : 'Cambiar a Español'}
                    </button>

                    <Link
                      href="/settings"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-ink-light dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <SettingOutlined /> {t('Ajustes', 'Settings')}
                    </Link>

                    {user?.role === 'admin' && (
                      <Link
                        href="/admin"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors font-medium"
                      >
                        <SafetyCertificateOutlined /> Admin Panel
                      </Link>
                    )}
                  </div>
                  
                  <div className="h-px bg-slate-100 dark:bg-slate-700/50 my-1" />
                  
                  <div className="p-1">
                    <button
                      onClick={() => { logout(); setDropdownOpen(false) }}
                      className="flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-danger hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left font-medium"
                    >
                      <LogoutOutlined /> {t('Cerrar sesión', 'Log out')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 pb-safe-area shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
        <div className="flex items-center justify-around h-16 px-2">
          {bottomNavLinks.map((link) => {
            const isActive = pathname === link.href || (link.href !== '/dashboard' && pathname?.startsWith(link.href))
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex flex-col items-center justify-center gap-1 w-full h-full transition-all duration-200 ${
                  isActive
                    ? 'text-primary dark:text-blue-400'
                    : 'text-ink-light dark:text-slate-400'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <div className="relative">
                  <span className={`text-xl transition-transform duration-200 ${isActive ? 'scale-110' : 'scale-100'}`} role="img" aria-hidden="true">
                    {link.icon}
                  </span>
                  {isActive && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-primary dark:bg-blue-400 border-2 border-white dark:border-slate-900 animate-fade-in" />
                  )}
                </div>
                <span className={`text-[10px] font-bold tracking-tight uppercase ${isActive ? 'opacity-100' : 'opacity-80'}`}>
                  {link.label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
