'use client'

import Link from 'next/link'
import {
  SettingOutlined,
  SafetyCertificateOutlined,
  TranslationOutlined,
  LogoutOutlined,
  CrownOutlined,
  UserOutlined,
} from '@ant-design/icons'
import NavLink from './NavLink'
import ThemeToggle from './ThemeToggle'

/**
 * NavMobileMenu Component
 *
 * Overlay menu for mobile navigation
 * Includes user info, navigation links, settings, and logout
 */
export default function NavMobileMenu({
  user,
  isPremium,
  navLinks,
  isLinkActive,
  onLogout,
  onLanguageToggle,
  lang,
  theme,
  onThemeChange,
  t,
  onClose,
}) {
  return (
    <>
      {/* Backdrop */}
      <div className="md:hidden fixed inset-0 bg-black/50 z-40 animate-fadeIn" onClick={onClose} />

      {/* Menu Panel */}
      <div
        id="mobile-navigation"
        className="md:hidden fixed top-14 right-0 bottom-0 w-80 max-w-[85vw] bg-white dark:bg-slate-900 z-50 shadow-2xl animate-slideInRight overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-label={t('Menú de navegación', 'Navigation menu')}
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
              <p className="text-xs text-ink-light dark:text-slate-400 truncate">{user?.email}</p>
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
              <NavLink
                key={link.href}
                href={link.href}
                icon={link.icon}
                label={link.label}
                isActive={isActive}
                variant="mobile"
                onClick={onClose}
              />
            )
          })}
        </div>

        <div className="mx-4 border-t border-slate-200 dark:border-slate-700" />

        {/* Quick Actions */}
        <div className="p-4 space-y-2">
          <Link
            href="/settings"
            onClick={onClose}
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
              onClick={onClose}
              className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <SafetyCertificateOutlined className="text-lg text-ink-light dark:text-slate-400" />
              <span className="font-medium text-ink dark:text-white">
                {t('Panel Admin', 'Admin Panel')}
              </span>
            </Link>
          )}

          <button
            onClick={() => {
              onLanguageToggle()
              onClose()
            }}
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

          <div className="pt-2">
            <ThemeToggle theme={theme} onThemeChange={onThemeChange} variant="menu" t={t} />
          </div>

          <div className="pt-2">
            <button
              onClick={() => {
                onLogout()
                onClose()
              }}
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
  )
}
