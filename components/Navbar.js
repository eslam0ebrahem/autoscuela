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

  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)
  const lang = user?.preferences?.language || 'es'
  const streak = user?.gamification?.currentStreak || 0

  // Click-outside for dropdown
  useEffect(() => {
    if (!dropdownOpen) return
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target))
        setDropdownOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [dropdownOpen])

  // Escape key
  useEffect(() => {
    if (!dropdownOpen) return
    const handleEscape = (e) => { if (e.key === 'Escape') setDropdownOpen(false) }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [dropdownOpen])

  // Close dropdown on route change
  useEffect(() => { setDropdownOpen(false) }, [pathname])

  const themeIcon   = theme === 'dark' ? '🌙' : theme === 'light' ? '☀️' : '🖥️'
  const nextTheme   = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'

  // All nav links — bottom nav shows first 5, rest in dropdown on desktop
  const navLinks = [
    { href: '/dashboard',           label: t('Inicio', 'Home'),         icon: '🏠' },
    { href: '/exam',                label: t('Examen', 'Exam'),         icon: '📝' },
    { href: '/flashcards',          label: t('Tarjetas', 'Cards'),      icon: '🃏' },
    { href: '/mistakes',            label: t('Errores', 'Mistakes'),    icon: '❌' },
    { href: '/stats',               label: t('Stats', 'Stats'),         icon: '📊' },
    { href: '/dashboard/bookmarks', label: t('Guardados', 'Saved'),     icon: '⭐' },
    { href: '/leaderboard',         label: t('Ranking', 'Ranking'),     icon: '🏆' },
    { href: '/badges',              label: t('Logros', 'Badges'),       icon: '🎖️' },
  ]

  const bottomNavLinks = navLinks.slice(0, 5)

  return (
    <>
      {/* ════════════════════════════════════════
          TOP BAR  (always visible)
      ════════════════════════════════════════ */}
      <header className="sticky top-0 z-40 w-full border-b border-base-200
        bg-base-100/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-3">

          {/* Logo */}
          <Link
            href="/dashboard"
            className="flex items-center gap-2 font-black text-base-content
              focus:outline-none focus:ring-2 focus:ring-primary rounded-lg"
          >
            <span className="text-xl" aria-hidden="true">🚗</span>
            <span className="hidden xs:inline tracking-tight text-base">Autoscuela</span>
            <span className="hidden sm:inline text-[10px] font-bold text-base-content/30
              bg-base-200 px-1.5 py-0.5 rounded-md">v4</span>
          </Link>

          {/* Desktop nav links (hidden on mobile — handled by bottom nav) */}
          <nav className="hidden lg:flex items-center gap-1" aria-label="Navegación principal">
            {navLinks.map((link) => {
              const isActive = pathname === link.href
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold
                    transition-all focus:outline-none focus:ring-2 focus:ring-primary
                    ${isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-base-content/60 hover:text-base-content hover:bg-base-200'}`}
                >
                  <span className="text-base" aria-hidden="true">{link.icon}</span>
                  {link.label}
                </Link>
              )
            })}
          </nav>

          {/* Right-side controls */}
          <div className="flex items-center gap-1.5 shrink-0">

            {/* Theme toggle */}
            <button
              onClick={() => setTheme(nextTheme)}
              className="w-9 h-9 rounded-xl flex items-center justify-center
                text-base hover:bg-base-200 transition-colors
                focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label={t('Cambiar tema', 'Toggle theme')}
              title={`Theme: ${theme}`}
            >
              {themeIcon}
            </button>

            {/* Language toggle */}
            <button
              onClick={() => updateLanguage(lang === 'es' ? 'en' : 'es')}
              className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-xl
                bg-base-200 hover:bg-base-300 text-xs font-black transition-colors
                focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label={lang === 'es' ? 'Switch to English' : 'Cambiar a Español'}
            >
              {lang === 'es' ? '🇪🇸' : '🇬🇧'}
              <span>{lang === 'es' ? 'ES' : 'EN'}</span>
            </button>

            {/* Streak badge */}
            {streak > 0 && (
              <div className="hidden sm:flex items-center gap-1 px-2.5 py-1.5
                rounded-xl bg-orange-100 dark:bg-orange-900/30 text-xs font-black text-orange-600
                dark:text-orange-400">
                🔥 <span>{streak}</span>
              </div>
            )}

            {/* User avatar + dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl
                  hover:bg-base-200 transition-colors
                  focus:outline-none focus:ring-2 focus:ring-primary"
                aria-expanded={dropdownOpen}
                aria-haspopup="menu"
                aria-label={t('Menú de usuario', 'User menu')}
              >
                {/* Avatar circle */}
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-purple-500
                  flex items-center justify-center text-white text-xs font-black shrink-0
                  shadow-sm">
                  {user?.nickname?.[0]?.toUpperCase() || '?'}
                </div>
                {/* Name — hidden on small screens */}
                <span className="hidden md:inline text-sm font-semibold text-base-content max-w-[80px] truncate">
                  {user?.nickname || t('Usuario', 'User')}
                </span>
                <span className={`hidden md:inline text-[10px] text-base-content/30
                  transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </button>

              {/* ── Dropdown ── */}
              {dropdownOpen && (
                <div
                  className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-base-200
                    bg-base-100 shadow-xl z-50 overflow-hidden"
                  role="menu"
                >
                  {/* User info header */}
                  <div className="px-4 py-3 bg-base-200/60 border-b border-base-200">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-purple-500
                        flex items-center justify-center text-white font-black shrink-0">
                        {user?.nickname?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-sm text-base-content truncate">
                          {user?.nickname}
                        </p>
                        <p className="text-xs text-base-content/50 truncate">{user?.email}</p>
                      </div>
                    </div>
                    {/* Badges row */}
                    <div className="flex items-center gap-2 mt-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border
                        ${user?.isPremium
                          ? 'bg-success/10 border-success/25 text-success'
                          : 'bg-base-300 border-base-300 text-base-content/50'}`}>
                        {user?.isPremium ? '✨ Premium' : t('Gratis', 'Free')}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black
                        bg-warning/10 border border-warning/25 text-warning">
                        ⚡ {user?.gamification?.totalXP || 0} XP
                      </span>
                    </div>
                  </div>

                  {/* Menu items */}
                  <div className="p-1.5 space-y-0.5">
                    {/* Language toggle (visible in dropdown on mobile too) */}
                    <button
                      onClick={() => { updateLanguage(lang === 'es' ? 'en' : 'es'); setDropdownOpen(false) }}
                      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl
                        text-sm text-base-content/70 hover:bg-base-200 transition-colors text-left"
                      role="menuitem"
                    >
                      <span>{lang === 'es' ? '🇬🇧' : '🇪🇸'}</span>
                      {lang === 'es' ? 'Switch to English' : 'Cambiar a Español'}
                    </button>

                    <Link
                      href="/settings"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl
                        text-sm text-base-content/70 hover:bg-base-200 transition-colors"
                      role="menuitem"
                    >
                      ⚙️ {t('Ajustes', 'Settings')}
                    </Link>

                    {user?.role === 'admin' && (
                      <Link
                        href="/admin"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl
                          text-sm text-primary hover:bg-primary/10 transition-colors"
                        role="menuitem"
                      >
                        🛡️ Admin Panel
                      </Link>
                    )}
                  </div>

                  {/* Logout */}
                  <div className="p-1.5 border-t border-base-200">
                    <button
                      onClick={() => { logout(); setDropdownOpen(false) }}
                      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl
                        text-sm text-error hover:bg-error/10 transition-colors text-left"
                      role="menuitem"
                    >
                      🚪 {t('Cerrar sesión', 'Log out')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ════════════════════════════════════════
          MOBILE BOTTOM NAV BAR
          (hidden on lg+ where top nav is shown)
      ════════════════════════════════════════ */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40
          bg-base-100/95 backdrop-blur-md border-t border-base-200
          safe-area-inset-bottom"
        aria-label="Navegación móvil"
      >
        <div className="flex items-stretch justify-around h-16">
          {bottomNavLinks.map((link) => {
            const isActive = pathname === link.href
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1
                  min-w-0 px-1 transition-all active:scale-95
                  ${isActive ? 'text-primary' : 'text-base-content/40 hover:text-base-content/70'}`}
                aria-current={isActive ? 'page' : undefined}
              >
                {/* Active indicator dot */}
                <div className="relative">
                  <span className="text-xl leading-none">{link.icon}</span>
                  {isActive && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full
                      bg-primary border-2 border-base-100" />
                  )}
                </div>
                <span className={`text-[10px] font-bold truncate max-w-full leading-tight
                  ${isActive ? 'text-primary' : 'text-base-content/40'}`}>
                  {link.label}
                </span>
              </Link>
            )
          })}
        </div>
        {/* iOS safe area spacer */}
        <div className="h-safe-area-inset-bottom" />
      </nav>
    </>
  )
}
