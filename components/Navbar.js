'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from './AuthContext'
import { useTheme } from './ThemeProvider'

export default function Navbar() {
  const { user, logout, updateLanguage, t } = useAuth()
  const { theme, setTheme } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const pathname = usePathname()
  const dropdownRef = useRef(null)

  const lang = user?.preferences?.language || 'es'
  const streak = user?.gamification?.currentStreak || 0

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close dropdown on Escape
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setDropdownOpen(false)
        setMenuOpen(false)
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [])

  // Close mobile menu on navigation
  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  const navLinks = [
    { href: '/dashboard', label: t('Inicio', 'Home'), icon: '🏠' },
    { href: '/exam', label: t('Examen', 'Exam'), icon: '📝' },
    { href: '/flashcards', label: t('Tarjetas', 'Flashcards'), icon: '🃏' },
    { href: '/dashboard/bookmarks', label: t('Guardados', 'Bookmarks'), icon: '⭐' },
    { href: '/stats', label: t('Estadisticas', 'Stats'), icon: '📊' },
    { href: '/leaderboard', label: t('Ranking', 'Leaderboard'), icon: '🏆' },
    { href: '/badges', label: t('Logros', 'Badges'), icon: '🎖️' },
  ]

  const themeIcon = theme === 'dark' ? '🌙' : theme === 'light' ? '☀️' : '🖥️'
  const nextTheme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'

  return (
    <nav className="sticky top-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-100 dark:border-slate-800 shadow-sm" role="navigation" aria-label="Main navigation">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2 font-display font-bold text-xl" aria-label="Autoscuela Home">
            <span className="text-2xl" role="img" aria-hidden="true">🚗</span>
            <span className="text-gradient-blue">Autoscuela</span>
            <span className="text-[10px] font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded-md">v3</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${pathname === link.href
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-primary'
                    : 'text-ink-light hover:text-ink dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(nextTheme)}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-sm transition-colors"
              title={`Theme: ${theme}`}
              aria-label={`Switch theme, currently ${theme}`}
            >
              {themeIcon}
            </button>

            {/* Language Toggle */}
            <button
              onClick={() => updateLanguage(lang === 'es' ? 'en' : 'es')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm font-semibold transition-colors"
              title={lang === 'es' ? 'Switch to English' : 'Cambiar a Espanol'}
              aria-label={lang === 'es' ? 'Switch to English' : 'Cambiar a Espanol'}
            >
              <span>{lang === 'es' ? '🇪🇸' : '🇬🇧'}</span>
              <span className="text-ink dark:text-slate-200">{lang === 'es' ? 'ES' : 'EN'}</span>
            </button>

            {/* Streak */}
            {streak > 0 && (
              <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800" aria-label={`${streak} day streak`}>
                <span className="streak-flame text-lg" role="img" aria-hidden="true">🔥</span>
                <span className="text-sm font-bold text-orange-600 dark:text-orange-400">{streak}</span>
              </div>
            )}

            {/* User dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                aria-expanded={dropdownOpen}
                aria-haspopup="true"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center text-white text-sm font-bold">
                  {user?.nickname?.[0]?.toUpperCase() || '?'}
                </div>
                <span className="hidden sm:block text-sm font-medium text-ink dark:text-slate-200">{user?.nickname}</span>
                <svg className={`w-4 h-4 text-ink-light transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-slate-800 rounded-xl shadow-card-hover border border-slate-100 dark:border-slate-700 py-1 z-50 animate-scale-in" role="menu">
                  <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700">
                    <p className="text-xs text-ink-light truncate">{user?.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {user?.isPremium ? (
                        <span className="badge-pill bg-blue-100 dark:bg-blue-900/30 text-primary text-xs">Premium</span>
                      ) : (
                        <span className="badge-pill bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs">Free</span>
                      )}
                      <span className="text-xs text-ink-light">{user?.gamification?.totalXP || 0} XP</span>
                    </div>
                  </div>
                  <Link
                    href="/settings"
                    className="block px-4 py-2 text-sm text-ink dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                    onClick={() => setDropdownOpen(false)}
                    role="menuitem"
                  >
                    ⚙️ {t('Ajustes', 'Settings')}
                  </Link>
                  {user?.role === 'admin' && (
                    <Link
                      href="/admin"
                      className="block px-4 py-2 text-sm text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 font-medium"
                      onClick={() => setDropdownOpen(false)}
                      role="menuitem"
                    >
                      🛡️ Admin Panel
                    </Link>
                  )}
                  <button
                    onClick={() => { logout(); setDropdownOpen(false) }}
                    className="w-full text-left px-4 py-2 text-sm text-danger hover:bg-red-50 dark:hover:bg-red-900/20"
                    role="menuitem"
                  >
                    {t('Cerrar sesion', 'Log out')}
                  </button>
                </div>
              )}
            </div>

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
            >
              <svg className="w-5 h-5 text-ink dark:text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden pb-3 pt-1 border-t border-slate-100 dark:border-slate-800 animate-fade-in" role="menu">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg mx-1 ${pathname === link.href
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-primary'
                  : 'text-ink dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
                role="menuitem"
              >
                <span role="img" aria-hidden="true">{link.icon}</span>
                {link.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </nav>
  )
}
