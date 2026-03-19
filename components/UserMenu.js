'use client'

import Link from 'next/link'
import {
  SettingOutlined,
  SafetyCertificateOutlined,
  LogoutOutlined,
  TranslationOutlined,
  CrownOutlined,
  UserOutlined,
} from '@ant-design/icons'
import ThemeToggle from './ThemeToggle'

/**
 * UserMenu Component
 *
 * Dropdown menu content shown in user profile dropdown
 * Includes profile info, settings, admin link, language toggle, and logout
 */
export default function UserMenu({
  user,
  isPremium,
  onLogout,
  onLanguageToggle,
  lang,
  theme,
  onThemeChange,
  t,
}) {
  return (
    <div
      id="user-menu-dropdown"
      className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-fadeIn"
    >
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
          onClick={onLanguageToggle}
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

        {/* Theme Toggle */}
        <ThemeToggle theme={theme} onThemeChange={onThemeChange} variant="menu" t={t} />

        <div className="my-2 border-t border-slate-200 dark:border-slate-700" />

        {/* Logout */}
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors group"
        >
          <LogoutOutlined className="text-red-600 dark:text-red-400" />
          <span className="text-sm font-medium text-red-600 dark:text-red-400">
            {t('Cerrar sesión', 'Sign out')}
          </span>
        </button>
      </div>
    </div>
  )
}
