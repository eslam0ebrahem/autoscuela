'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from './AuthContext'
import { useTheme } from './ThemeProvider'
import { useFocusTrap } from '@/lib/useFocusTrap'
import {
  HomeOutlined,
  FileTextOutlined,
  CloseCircleOutlined,
  BarChartOutlined,
  StarOutlined,
  FireOutlined,
  UserOutlined,
  CrownOutlined,
  MenuOutlined,
  CloseOutlined,
  CalendarOutlined,
} from '@ant-design/icons'
import NavLink from './NavLink'
import ThemeToggle from './ThemeToggle'
import UserMenu from './UserMenu'
import NavMobileMenu from './NavMobileMenu'

/**
 * Enhanced Navbar Component
 *
 * Refactored to extract reusable subcomponents:
 * - NavLink for consistent navigation styling
 * - ThemeToggle for theme switching
 * - UserMenu for dropdown menu content
 * - NavMobileMenu for mobile overlay menu
 */
export default function Navbar() {
  const { user, logout, updateLanguage, t } = useAuth()
  const { theme, setTheme } = useTheme()
  const pathname = usePathname()

  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const dropdownRef = useRef(null)

  // 5.5: Add focus trap to mobile menu overlay
  const { ref: mobileMenuRef } = useFocusTrap(mobileMenuOpen)

  const lang = user?.preferences?.language || 'es'
  const streak = user?.gamification?.currentStreak || 0
  const isPremium = user?.subscription?.status === 'active' || user?.premiumOverride

  // Navigation links
  const navLinks = [
    { href: '/dashboard', label: t('Inicio', 'Home'), icon: <HomeOutlined /> },
    { href: '/exam', label: t('Examen', 'Exam'), icon: <FileTextOutlined /> },
    { href: '/study-plan', label: t('Plan', 'Plan'), icon: <CalendarOutlined /> },
    { href: '/mistakes', label: t('Errores', 'Mistakes'), icon: <CloseCircleOutlined /> },
    { href: '/stats', label: t('Stats', 'Stats'), icon: <BarChartOutlined /> },
    { href: '/dashboard/bookmarks', label: t('Guardados', 'Saved'), icon: <StarOutlined /> },
  ]

  const bottomNavLinks = navLinks.slice(0, 5)

  // Check if link is active
  const isLinkActive = useCallback(
    (href) => {
      if (pathname === href) return true
      if (href !== '/dashboard' && pathname?.startsWith(href)) return true
      return false
    },
    [pathname]
  )

  // Close dropdown on outside click
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

  // Close menus on route change
  useEffect(() => {
    setDropdownOpen(false)
    setMobileMenuOpen(false)
  }, [pathname])

  // Close menus on Escape key
  useEffect(() => {
    if (!dropdownOpen && !mobileMenuOpen) return
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setDropdownOpen(false)
        setMobileMenuOpen(false)
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [dropdownOpen, mobileMenuOpen])

  // Handlers
  const handleLogout = useCallback(async () => {
    if (confirm(t('¿Cerrar sesión?', 'Sign out?'))) {
      await logout()
    }
  }, [logout, t])

  const handleLanguageToggle = useCallback(() => {
    updateLanguage(lang === 'es' ? 'en' : 'es')
  }, [lang, updateLanguage])

  const handleThemeChange = useCallback(
    (newTheme) => {
      setTheme(newTheme)
    },
    [setTheme]
  )

  return (
    <>
      {/* ════════════════════════════════════════════════════════════════ */}
      {/* Desktop Navbar */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <nav className="hidden md:block fixed top-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link
              href="/dashboard"
              className="flex items-center gap-2 font-black text-xl text-primary hover:text-primary/80 transition-colors"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-black text-sm">V</span>
              </div>
              <span className="hidden lg:inline">Vialia DGT</span>
            </Link>

            {/* Desktop Navigation Links */}
            <div className="flex items-center gap-1">
              {navLinks.map((link) => (
                <NavLink
                  key={link.href}
                  href={link.href}
                  icon={link.icon}
                  label={link.label}
                  isActive={isLinkActive(link.href)}
                  variant="desktop"
                />
              ))}
            </div>

            {/* Right Section (Streak, Theme, Profile) */}
            <div className="flex items-center gap-3">
              {/* Streak Badge */}
              {streak > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-full shadow-md">
                  <FireOutlined className="text-sm animate-pulse" />
                  <span className="text-sm font-bold">{streak}</span>
                </div>
              )}

              {/* Theme Toggle */}
              <ThemeToggle theme={theme} onThemeChange={handleThemeChange} variant="icon" t={t} />

              {/* User Profile Dropdown */}
              <div className="relative" ref={dropdownRef}>
                {/* 5.2: Add aria-expanded to dropdown triggers and 5.4: Add aria-label to icon-only buttons */}
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  aria-expanded={dropdownOpen}
                  aria-haspopup="menu"
                  aria-controls="user-menu-dropdown"
                  aria-label={t('Menú de usuario', 'User menu')}
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                    {user?.nickname?.[0]?.toUpperCase() || <UserOutlined />}
                  </div>
                  {isPremium && <CrownOutlined className="text-amber-500 text-xs" />}
                </button>

                {/* Dropdown Menu */}
                {dropdownOpen && (
                  <UserMenu
                    user={user}
                    isPremium={isPremium}
                    onLogout={handleLogout}
                    onLanguageToggle={handleLanguageToggle}
                    lang={lang}
                    theme={theme}
                    onThemeChange={handleThemeChange}
                    t={t}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* Mobile Top Bar */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center justify-between h-14 px-4">
          {/* Logo */}
          <Link
            href="/dashboard"
            className="flex items-center gap-2 font-black text-lg text-primary"
          >
            <div className="w-7 h-7 bg-gradient-to-br from-primary to-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-black text-xs">V</span>
            </div>
            <span>Vialia</span>
          </Link>

          {/* Right Section */}
          <div className="flex items-center gap-2">
            {/* Streak Badge */}
            {streak > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-full">
                <FireOutlined className="text-xs" />
                <span className="text-xs font-bold">{streak}</span>
              </div>
            )}

            {/* Premium Badge */}
            {isPremium && (
              <div className="w-6 h-6 bg-gradient-to-br from-amber-500 to-orange-500 rounded-full flex items-center justify-center">
                <CrownOutlined className="text-white text-xs" />
              </div>
            )}

            {/* Mobile Menu Button - 5.2: aria-expanded, 5.4: aria-label */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-expanded={mobileMenuOpen}
              aria-label={
                mobileMenuOpen ? t('Cerrar menú', 'Close menu') : t('Abrir menú', 'Open menu')
              }
              aria-haspopup="menu"
              aria-controls="mobile-navigation"
            >
              {mobileMenuOpen ? (
                <CloseOutlined className="text-xl text-ink dark:text-white" />
              ) : (
                <MenuOutlined className="text-xl text-ink dark:text-white" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* Mobile Menu Overlay */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {mobileMenuOpen && (
        <div ref={mobileMenuRef}>
          <NavMobileMenu
            user={user}
            isPremium={isPremium}
            navLinks={navLinks}
            isLinkActive={isLinkActive}
            onLogout={handleLogout}
            onLanguageToggle={handleLanguageToggle}
            lang={lang}
            theme={theme}
            onThemeChange={handleThemeChange}
            t={t}
            onClose={() => setMobileMenuOpen(false)}
          />
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* Mobile Bottom Navigation */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] safe-area-pb">
        <div className="flex items-center justify-around px-2 py-2">
          {bottomNavLinks.map((link) => (
            <NavLink
              key={link.href}
              href={link.href}
              icon={link.icon}
              label={link.label}
              isActive={isLinkActive(link.href)}
              variant="bottom"
            />
          ))}
        </div>
      </nav>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* Spacer for Fixed Navbars */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <div className="h-16 hidden md:block" />
      <div className="h-14 md:hidden" />
      <div className="h-[72px] md:hidden" />
    </>
  )
}
