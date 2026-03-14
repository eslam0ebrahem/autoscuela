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
  TranslationOutlined,
  MenuOutlined,
  CloseOutlined,
  CrownOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'

// ---------------------------------------------------------------------------
// Enhanced Navbar Component
// ---------------------------------------------------------------------------
export default function Navbar() {
  const { user, logout, updateLanguage, t } = useAuth()
  const { theme, setTheme } = useTheme()
  const pathname = usePathname()

  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const dropdownRef = useRef(null)
  const mobileMenuRef = useRef(null)

  const lang = user?.preferences?.language || 'es'
  const streak = user?.gamification?.currentStreak || 0
  const isPremium = user?.subscription?.status === 'active' || user?.premiumOverride

  // ── Close dropdown on outside click ──────────────────────────────────
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

  // ── Close mobile menu on outside click ───────────────────────────────
  useEffect(() => {
    if (!mobileMenuOpen) return
    const handleClickOutside = (e) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target)) {
        setMobileMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [mobileMenuOpen])

  // ── Close on Escape key ──────────────────────────────────────────────
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

  // ── Close menus on route change ──────────────────────────────────────
  useEffect(() => {
    setDropdownOpen(false)
    setMobileMenuOpen(false)
  }, [pathname])

  // ── Theme cycling ────────────────────────────────────────────────────
  const themeIcon =
    theme === 'dark' ? (
      <MoonOutlined />
    ) : theme === 'light' ? (
      <SunOutlined />
    ) : (
      <DesktopOutlined />
    )

  const nextTheme =
    theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'

  const themeLabel =
    theme === 'light'
      ? t('Claro', 'Light')
      : theme === 'dark'
      ? t('Oscuro', 'Dark')
      : t('Sistema', 'System')

  // ── Navigation links ─────────────────────────────────────────────────
  const navLinks = [
    { href: '/dashboard', label: t('Inicio', 'Home'), icon: <HomeOutlined /> },
    { href: '/exam', label: t('Examen', 'Exam'), icon: <FileTextOutlined /> },
    { href: '/flashcards', label: t('Tarjetas', 'Cards'), icon: <IdcardOutlined /> },
    { href: '/mistakes', label: t('Errores', 'Mistakes'), icon: <CloseCircleOutlined /> },
    { href: '/stats', label: t('Stats', 'Stats'), icon: <BarChartOutlined /> },
    { href: '/dashboard/bookmarks', label: t('Guardados', 'Saved'), icon: <StarOutlined /> },
  ]

  const bottomNavLinks = navLinks.slice(0, 5)

  // ── Helper: Check if link is active ──────────────────────────────────
  const isLinkActive = (href) => {
    if (pathname === href) return true
    if (href !== '/dashboard' && pathname?.startsWith(href)) return true
    return false
  }

  // ── Handle logout ────────────────────────────────────────────────────
  const handleLogout = async () => {
    if (confirm(t('¿Cerrar sesión?', 'Sign out?'))) {
      await logout()
    }
  }

  return (
    <>
      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Desktop Navbar */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <nav className="hidden md:block fixed top-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* ── Logo ─────────────────────────────────────────────────── */}
            <Link
              href="/dashboard"
              className="flex items-center gap-2 font-black text-xl text-primary hover:text-primary/80 transition-colors"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-black text-sm">V</span>
              </div>
              <span className="hidden lg:inline">Vialia DGT</span>
            </Link>

            {/* ── Desktop Navigation Links ────────────────────────────── */}
            <div className="flex items-center gap-1">
              {navLinks.map((link) => {
                const isActive = isLinkActive(link.href)
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                      isActive
                        ? 'bg-primary text-white shadow-md'
                        : 'text-ink-light dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-ink dark:hover:text-white'
                    }`}
                  >
                    <span className="text-lg">{link.icon}</span>
                    <span className="hidden lg:inline text-sm">{link.label}</span>
                  </Link>
                )
              })}
            </div>

            {/* ── Right Section (Streak, Theme, Profile) ──────────────── */}
            <div className="flex items-center gap-3">
              {/* Streak Badge */}
              {streak > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-full shadow-md">
                  <FireOutlined className="text-sm animate-pulse" />
                  <span className="text-sm font-bold">{streak}</span>
                </div>
              )}

              {/* Theme Toggle */}
              <button
                onClick={() => setTheme(nextTheme)}
                className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors group"
                title={t('Cambiar tema', 'Change theme')}
              >
                <span className="text-lg text-ink dark:text-white group-hover:scale-110 transition-transform inline-block">
                  {themeIcon}
                </span>
              </button>

              {/* User Profile Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                    {user?.nickname?.[0]?.toUpperCase() || <UserOutlined />}
                  </div>
                  {isPremium && (
                    <CrownOutlined className="text-amber-500 text-xs" />
                  )}
                </button>

                {/* Dropdown Menu */}
                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-fadeIn">
                    {/* User Info */}
                    <div className="p-4 bg-gradient-to-br from-primary/10 to-indigo-600/10 dark:from-primary/20 dark:to-indigo-600/20 border-b border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center text-white font-bold">
                          {user?.nickname?.[0]?.toUpperCase() || <UserOutlined />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-ink dark:text-white truncate">
                            {user?.nickname || t('Usuario', 'User')}
                          </p>
                          <p className="text-xs text-ink-light dark:text-slate-400 truncate">
                            {user?.email}
                          </p>
                        </div>
                      </div>
                      {isPremium && (
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-full text-xs font-bold w-fit">
                          <CrownOutlined />
                          <span>{t('Premium', 'Premium')}</span>
                        </div>
                      )}
                    </div>

                    {/* Menu Items */}
                    <div className="p-2">
                      <Link
                        href="/settings"
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors group"
                      >
                        <SettingOutlined className="text-ink-light dark:text-slate-400 group-hover:text-primary" />
                        <span className="text-sm font-medium text-ink dark:text-white">
                          {t('Configuración', 'Settings')}
                        </span>
                      </Link>

                      {user?.role === 'admin' && (
                        <Link
                          href="/admin"
                          className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors group"
                        >
                          <SafetyCertificateOutlined className="text-ink-light dark:text-slate-400 group-hover:text-primary" />
                          <span className="text-sm font-medium text-ink dark:text-white">
                            {t('Panel Admin', 'Admin Panel')}
                          </span>
                        </Link>
                      )}

                      {/* Language Toggle */}
                      <button
                        onClick={() => updateLanguage(lang === 'es' ? 'en' : 'es')}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors group"
                      >
                        <TranslationOutlined className="text-ink-light dark:text-slate-400 group-hover:text-primary" />
                        <span className="text-sm font-medium text-ink dark:text-white flex-1 text-left">
                          {lang === 'es' ? 'English' : 'Español'}
                        </span>
                        <span className="text-xs text-ink-light dark:text-slate-400">
                          {lang === 'es' ? 'EN' : 'ES'}
                        </span>
                      </button>

                      {/* Theme Display */}
                      <button
                        onClick={() => setTheme(nextTheme)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors group"
                      >
                        {themeIcon}
                        <span className="text-sm font-medium text-ink dark:text-white flex-1 text-left">
                          {t('Tema', 'Theme')}
                        </span>
                        <span className="text-xs text-ink-light dark:text-slate-400">
                          {themeLabel}
                        </span>
                      </button>

                      <div className="my-2 border-t border-slate-200 dark:border-slate-700" />

                      {/* Logout */}
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors group"
                      >
                        <LogoutOutlined className="text-red-600 dark:text-red-400" />
                        <span className="text-sm font-medium text-red-600 dark:text-red-400">
                          {t('Cerrar sesión', 'Sign out')}
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Mobile Top Bar */}
      {/* ═══════════════════════════════════════════════════════════════ */}
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

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
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

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Mobile Menu Overlay */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {mobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div className="md:hidden fixed inset-0 bg-black/50 z-40 animate-fadeIn" />

          {/* Menu Panel */}
          <div
            ref={mobileMenuRef}
            className="md:hidden fixed top-14 right-0 bottom-0 w-80 max-w-[85vw] bg-white dark:bg-slate-900 z-50 shadow-2xl animate-slideInRight overflow-y-auto"
          >
            {/* User Info Section */}
            <div className="p-4 bg-gradient-to-br from-primary/10 to-indigo-600/10 dark:from-primary/20 dark:to-indigo-600/20 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center text-white font-bold">
                  {user?.nickname?.[0]?.toUpperCase() || <UserOutlined />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-ink dark:text-white truncate">
                    {user?.nickname || t('Usuario', 'User')}
                  </p>
                  <p className="text-xs text-ink-light dark:text-slate-400 truncate">
                    {user?.email}
                  </p>
                </div>
              </div>
              {isPremium && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-full text-xs font-bold w-fit">
                  <CrownOutlined />
                  <span>{t('Premium', 'Premium')}</span>
                </div>
              )}
            </div>

            {/* Navigation Links */}
            <div className="p-4 space-y-2">
              {navLinks.map((link) => {
                const isActive = isLinkActive(link.href)
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${
                      isActive
                        ? 'bg-primary text-white shadow-md'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-ink dark:text-white'
                    }`}
                  >
                    <span className="text-lg">{link.icon}</span>
                    <span>{link.label}</span>
                  </Link>
                )
              })}
            </div>

            <div className="mx-4 border-t border-slate-200 dark:border-slate-700" />

            {/* Quick Actions */}
            <div className="p-4 space-y-2">
              <Link
                href="/settings"
                className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <SettingOutlined className="text-lg text-ink-light dark:text-slate-400" />
                <span className="font-medium text-ink dark:text-white">
                  {t('Configuración', 'Settings')}
                </span>
              </Link>

              {user?.role === 'admin' && (
                <Link
                  href="/admin"
                  className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <SafetyCertificateOutlined className="text-lg text-ink-light dark:text-slate-400" />
                  <span className="font-medium text-ink dark:text-white">
                    {t('Panel Admin', 'Admin Panel')}
                  </span>
                </Link>
              )}

              <button
                onClick={() => updateLanguage(lang === 'es' ? 'en' : 'es')}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <TranslationOutlined className="text-lg text-ink-light dark:text-slate-400" />
                <span className="font-medium text-ink dark:text-white flex-1 text-left">
                  {t('Idioma', 'Language')}
                </span>
                <span className="text-sm text-ink-light dark:text-slate-400">
                  {lang === 'es' ? 'EN' : 'ES'}
                </span>
              </button>

              <button
                onClick={() => setTheme(nextTheme)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <span className="text-lg text-ink-light dark:text-slate-400">{themeIcon}</span>
                <span className="font-medium text-ink dark:text-white flex-1 text-left">
                  {t('Tema', 'Theme')}
                </span>
                <span className="text-sm text-ink-light dark:text-slate-400">
                  {themeLabel}
                </span>
              </button>

              <div className="pt-2">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <LogoutOutlined className="text-lg text-red-600 dark:text-red-400" />
                  <span className="font-medium text-red-600 dark:text-red-400">
                    {t('Cerrar sesión', 'Sign out')}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Mobile Bottom Navigation */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] safe-area-pb">
        <div className="flex items-center justify-around px-2 py-2">
          {bottomNavLinks.map((link) => {
            const isActive = isLinkActive(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                className="relative flex flex-col items-center justify-center gap-1 py-2 px-3 rounded-lg transition-all group min-w-[64px]"
              >
                <span
                  className={`text-xl transition-all ${
                    isActive
                      ? 'text-primary scale-110'
                      : 'text-ink-light dark:text-slate-400 group-hover:text-primary group-hover:scale-105'
                  }`}
                >
                  {link.icon}
                </span>
                {isActive && (
                  <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-t-full" />
                )}
                <span
                  className={`text-[10px] font-bold transition-colors ${
                    isActive
                      ? 'text-primary'
                      : 'text-ink-light dark:text-slate-400 group-hover:text-primary'
                  }`}
                >
                  {link.label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Spacer for Fixed Navbars */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="h-16 hidden md:block" /> {/* Desktop top spacer */}
      <div className="h-14 md:hidden" /> {/* Mobile top spacer */}
      <div className="h-[72px] md:hidden" /> {/* Mobile bottom spacer */}
    </>
  )
}
