'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('system')
  const [resolved, setResolved] = useState('light')
  const [mounted, setMounted] = useState(false)

  // Init from localStorage on mount
  useEffect(() => {
    setMounted(true)
    try {
      const saved = localStorage.getItem('autoscuela-theme') || 'system'
      setTheme(saved)
    } catch {
      setTheme('system')
    }
  }, [])

  // Apply theme class + colorScheme
  useEffect(() => {
    if (!mounted) return
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const applyTheme = () => {
      const isDark = theme === 'dark' || (theme === 'system' && mediaQuery.matches)
      const resolvedTheme = isDark ? 'dark' : 'light'
      setResolved(resolvedTheme)
      document.documentElement.classList.toggle('dark', isDark)
      document.documentElement.style.colorScheme = resolvedTheme
    }

    applyTheme()
    mediaQuery.addEventListener('change', applyTheme)
    return () => mediaQuery.removeEventListener('change', applyTheme)
  }, [theme, mounted])

  const setThemeAndSave = useCallback((newTheme) => {
    setTheme(newTheme)
    try {
      localStorage.setItem('autoscuela-theme', newTheme)
    } catch {
      console.warn('Failed to save theme to localStorage')
    }
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme: setThemeAndSave, mounted }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
