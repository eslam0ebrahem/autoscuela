'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from './AuthContext'

export default function Navbar() {
  const { user, logout, updateLanguage, t } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const pathname = usePathname()

  const lang = user?.preferences?.language || 'es'
  const streak = user?.gamification?.currentStreak || 0

  const navLinks = [
    { href: '/dashboard', label: t('Inicio', 'Home'), icon: '🏠' },
    { href: '/exam', label: t('Examen', 'Exam'), icon: '📝' },
    { href: '/flashcards', label: t('Tarjetas', 'Flashcards'), icon: '🃏' },
    { href: '/dashboard/bookmarks', label: t('Guardados', 'Bookmarks'), icon: '⭐' },
    { href: '/stats', label: t('Estadísticas', 'Stats'), icon: '📊' },
    { href: '/leaderboard', label: t('Ranking', 'Leaderboard'), icon: '🏆' },
    { href: '/badges', label: t('Logros', 'Badges'), icon: '🎖️' },
  ]

  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2 font-display font-bold text-xl">
            <span className="text-2xl">🚗</span>
            <span className="text-gradient-blue">Autoscuela</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${pathname === link.href
                    ? 'bg-blue-50 text-primary'
                    : 'text-ink-light hover:text-ink hover:bg-slate-50'
                  }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* Language Toggle */}
            <button
              onClick={() => updateLanguage(lang === 'es' ? 'en' : 'es')}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-sm font-semibold transition-colors"
              title={lang === 'es' ? 'Switch to English' : 'Cambiar a Español'}
            >
              <span>{lang === 'es' ? '🇪🇸' : '🇬🇧'}</span>
              <span className="text-ink">{lang === 'es' ? 'ES' : 'EN'}</span>
              <span className="text-slate-400">|</span>
              <span>{lang === 'es' ? '🇬🇧' : '🇪🇸'}</span>
            </button>

            {/* Streak */}
            {streak > 0 && (
              <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-orange-50 border border-orange-200">
                <span className="streak-flame text-lg">🔥</span>
                <span className="text-sm font-bold text-orange-600">{streak}</span>
              </div>
            )}

            {/* User dropdown */}
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-slate-50 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center text-white text-sm font-bold">
                  {user?.nickname?.[0]?.toUpperCase() || '?'}
                </div>
                <span className="hidden sm:block text-sm font-medium text-ink">{user?.nickname}</span>
                <svg className="w-4 h-4 text-ink-light" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {dropdownOpen && (
                <div
                  className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-card-hover border border-slate-100 py-1 z-50"
                  onMouseLeave={() => setDropdownOpen(false)}
                >
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-xs text-ink-light">{user?.email}</p>
                    {!user?.isPremium && (
                      <span className="badge-pill bg-amber-100 text-amber-700 text-xs mt-1">
                        Free
                      </span>
                    )}
                    {user?.isPremium && (
                      <span className="badge-pill bg-blue-100 text-primary text-xs mt-1">
                        ⭐ Premium
                      </span>
                    )}
                  </div>
                  {user?.role === 'admin' && (
                    <Link
                      href="/admin"
                      className="block px-4 py-2 text-sm text-purple-600 hover:bg-purple-50 font-medium"
                      onClick={() => setDropdownOpen(false)}
                    >
                      🛡️ Admin Panel
                    </Link>
                  )}
                  <button
                    onClick={() => { logout(); setDropdownOpen(false) }}
                    className="w-full text-left px-4 py-2 text-sm text-danger hover:bg-red-50"
                  >
                    {t('Cerrar sesión', 'Log out')}
                  </button>
                </div>
              )}
            </div>

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 rounded-lg hover:bg-slate-100"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
          <div className="md:hidden pb-3 pt-1 border-t border-slate-100 animate-fade-in">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg mx-1 ${pathname === link.href ? 'bg-blue-50 text-primary' : 'text-ink hover:bg-slate-50'
                  }`}
                onClick={() => setMenuOpen(false)}
              >
                <span>{link.icon}</span>
                {link.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </nav>
  )
}
