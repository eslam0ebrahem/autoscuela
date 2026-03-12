'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from './AuthContext'
import { useTheme } from './ThemeProvider'

export default function Navbar() {
  const { user, logout, updateLanguage, t } = useAuth()
  const { theme, setTheme } = useTheme()
  const pathname = usePathname()
  
  const [menuOpen, setMenuOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  const lang = user?.preferences?.language || 'es'
  const streak = user?.gamification?.currentStreak || 0

  // Optimize: Only attach click-outside listener when dropdown is open
  useEffect(() => {
    if (!dropdownOpen) return

    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [dropdownOpen])

  // Optimize: Only attach Escape key listener when either menu is open
  useEffect(() => {
    if (!dropdownOpen && !menuOpen) return

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setDropdownOpen(false)
        setMenuOpen(false)
      }
    }
    
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [dropdownOpen, menuOpen])

  // Close mobile menu automatically on route change
  useEffect(() => {
    setMenuOpen(false)
    setDropdownOpen(false)
  }, [pathname])

  const navLinks = [
    { href: '/dashboard', label: t('Inicio', 'Home'), icon: '🏠' },
    { href: '/exam', label: t('Examen', 'Exam'), icon: '📝' },
    { href: '/flashcards', label: t('Tarjetas', 'Flashcards'), icon: '🃏' },
    { href: '/dashboard/bookmarks', label: t('Guardados', 'Bookmarks'), icon: '⭐' },
    { href: '/mistakes', label: t('Errores', 'Mistakes'), icon: '❌' },
    { href: '/stats', label: t('Estadísticas', 'Stats'), icon: '📊' },
    { href: '/leaderboard', label: t('Ranking', 'Leaderboard'), icon: '🏆' },
    { href: '/badges', label: t('Logros', 'Badges'), icon: '🎖️' },
  ]

  // Theme toggle logic
  const themeIcon = theme === 'dark' ? '🌙' : theme === 'light' ? '☀️' : '🖥️'
  const nextTheme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'

  return (
    <nav className="sticky top-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-100 dark:border-slate-800 shadow-sm transition-colors" role="navigation" aria-label="Main navigation">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2 font-display font-bold text-xl focus:outline-none focus:ring-2 focus:ring-primary rounded-lg" aria-label={t('Ir al inicio', 'Go to home')}>
            <span className="text-2xl" role="img" aria-hidden="true">🚗</span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-primary dark:from-blue-400 dark:to-blue-600">
              Autoscuela
            </span>
            <span className="text-[10px] font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded-md font-semibold">v4</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-900/40 text-primary dark:text-blue-400'
                      : 'text-ink-light dark:text-slate-400 hover:text-ink dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {link.label}
                </Link>
              )
            })}
          </div>

          {/* Right side Tools */}
          <div className="flex items-center gap-2">
            
            {/* Theme Toggle */}
            <button
              type="button"
              onClick={() => setTheme(nextTheme)}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
              title={t(`Tema: ${theme}`, `Theme: ${theme}`)}
              aria-label={t('Cambiar tema', 'Toggle theme')}
            >
              <span className="text-lg">{themeIcon}</span>
            </button>

            {/* Language Toggle */}
            <button
              type="button"
              onClick={() => updateLanguage(lang === 'es' ? 'en' : 'es')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
              title={lang === 'es' ? 'Switch to English' : 'Cambiar a Español'}
              aria-label={lang === 'es' ? 'Switch to English' : 'Cambiar a Español'}
            >
              <span aria-hidden="true">{lang === 'es' ? '🇪🇸' : '🇬🇧'}</span>
              <span className="text-ink dark:text-slate-200">{lang === 'es' ? 'ES' : 'EN'}</span>
            </button>

            {/* Streak */}
            {streak > 0 && (
              <div 
                className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800" 
                title={t(`${streak} días de racha`, `${streak} day streak`)}
              >
                <span className="streak-flame text-lg" role="img" aria-label="Racha">🔥</span>
                <span className="text-sm font-bold text-orange-600 dark:text-orange-400">{streak}</span>
              </div>
            )}

            {/* User Dropdown */}
            <div className="relative ml-1" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                aria-expanded={dropdownOpen}
                aria-haspopup="menu"
                aria-label={t('Menú de usuario', 'User menu')}
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                  {user?.nickname?.[0]?.toUpperCase() || '?'}
                </div>
                <span className="hidden md:block text-sm font-medium text-ink dark:text-slate-200 max-w-[100px] truncate">
                  {user?.nickname || t('Usuario', 'User')}
                </span>
                <svg className={`hidden sm:block w-4 h-4 text-ink-light transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {dropdownOpen && (
                <div 
                  className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 py-2 z-50 animate-scale-in transform origin-top-right" 
                  role="menu"
                  aria-orientation="vertical"
                >
                  <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700 mb-1">
                    <p className="text-sm font-medium text-ink dark:text-white truncate">{user?.nickname}</p>
                    <p className="text-xs text-ink-light dark:text-slate-400 truncate mt-0.5">{user?.email}</p>
                    <div className="flex items-center justify-between mt-3">
                      {user?.isPremium ? (
                        <span className="badge-pill bg-blue-100 dark:bg-blue-900/40 text-primary dark:text-blue-400 text-xs px-2 py-0.5 rounded-full font-semibold">Premium</span>
                      ) : (
                        <span className="badge-pill bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs px-2 py-0.5 rounded-full font-semibold">Gratis</span>
                      )}
                      <span className="text-xs font-bold text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
                        {user?.gamification?.totalXP || 0} XP
                      </span>
                    </div>
                  </div>
                  
                  <Link
                    href="/settings"
                    className="flex items-center gap-2 px-4 py-2 text-sm text-ink dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    onClick={() => setDropdownOpen(false)}
                    role="menuitem"
                  >
                    <span aria-hidden="true">⚙️</span> {t('Ajustes', 'Settings')}
                  </Link>
                  
                  {user?.role === 'admin' && (
                    <Link
                      href="/admin"
                      className="flex items-center gap-2 px-4 py-2 text-sm text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 font-medium transition-colors"
                      onClick={() => setDropdownOpen(false)}
                      role="menuitem"
                    >
                      <span aria-hidden="true">🛡️</span> Admin Panel
                    </Link>
                  )}
                  
                  <div className="h-px bg-slate-100 dark:bg-slate-700 my-1" role="separator" />
                  
                  <button
                    type="button"
                    onClick={() => { logout(); setDropdownOpen(false) }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-danger hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left"
                    role="menuitem"
                  >
                    <span aria-hidden="true">🚪</span> {t('Cerrar sesión', 'Log out')}
                  </button>
                </div>
              )}
            </div>

            {/* Mobile Menu Toggle */}
            <button
              type="button"
              className="md:hidden p-2 ml-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-ink dark:text-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label={menuOpen ? t('Cerrar menú', 'Close menu') : t('Abrir menú', 'Open menu')}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={menuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'}
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Menu Drawer */}
        {menuOpen && (
          <div 
            id="mobile-menu"
            className="md:hidden pb-4 pt-2 border-t border-slate-100 dark:border-slate-800 animate-fade-in" 
            role="menu"
          >
            <div className="space-y-1">
              {navLinks.map((link) => {
                const isActive = pathname === link.href
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-colors ${
                      isActive
                        ? 'bg-blue-50 dark:bg-blue-900/40 text-primary dark:text-blue-400'
                        : 'text-ink dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                    role="menuitem"
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <span className="text-lg" role="img" aria-hidden="true">{link.icon}</span>
                    {link.label}
                  </Link>
                )
              })}
            </div>
            
            {/* Mobile Streak (Shown here since it's hidden in the top bar on very small screens) */}
            {streak > 0 && (
              <div className="sm:hidden mt-4 mx-4 px-4 py-3 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-100 dark:border-orange-800/50 flex items-center justify-between">
                <span className="text-sm font-semibold text-orange-700 dark:text-orange-400">{t('Racha actual', 'Current Streak')}</span>
                <div className="flex items-center gap-1">
                  <span className="streak-flame" aria-hidden="true">🔥</span>
                  <span className="font-bold text-orange-600 dark:text-orange-400">{streak} {t('días', 'days')}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}