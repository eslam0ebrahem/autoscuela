'use client'

import { useMemo } from 'react'
import {
  SunOutlined,
  MoonOutlined,
  DesktopOutlined,
} from '@ant-design/icons'

/**
 * ThemeToggle Component
 *
 * Reusable theme toggle button
 * Can be used in navbar or dropdown menus
 */
export default function ThemeToggle({
  theme,
  onThemeChange,
  variant = 'icon', // 'icon' or 'menu'
  t,
}) {
  const themeIcon = useMemo(() => {
    if (theme === 'dark') return <MoonOutlined />
    if (theme === 'light') return <SunOutlined />
    return <DesktopOutlined />
  }, [theme])

  const nextTheme = useMemo(() => {
    if (theme === 'light') return 'dark'
    if (theme === 'dark') return 'system'
    return 'light'
  }, [theme])

  const themeLabel = useMemo(() => {
    if (theme === 'light') return t('Claro', 'Light')
    if (theme === 'dark') return t('Oscuro', 'Dark')
    return t('Sistema', 'System')
  }, [theme, t])

  const handleToggle = () => onThemeChange?.(nextTheme)

  if (variant === 'menu') {
    return (
      <button
        onClick={handleToggle}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors group"
        aria-label={t('Cambiar tema', 'Change theme')}
      >
        {themeIcon}
        <span className="text-sm font-medium text-ink dark:text-white flex-1 text-left">
          {t('Tema', 'Theme')}
        </span>
        <span className="text-xs text-ink-light dark:text-slate-400">
          {themeLabel}
        </span>
      </button>
    )
  }

  // icon variant
  return (
    <button
      onClick={handleToggle}
      className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors group"
      title={t('Cambiar tema', 'Change theme')}
      aria-label={t('Cambiar tema', 'Change theme')}
    >
      <span className="text-lg text-ink dark:text-white group-hover:scale-110 transition-transform inline-block">
        {themeIcon}
      </span>
    </button>
  )
}
