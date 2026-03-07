'use client'
import { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('system')
  const [resolved, setResolved] = useState('light')

  useEffect(() => {
    // Load saved theme
    const saved = localStorage.getItem('autoscuela-theme') || 'system'
    setTheme(saved)
  }, [])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const updateResolved = () => {
      const isDark = theme === 'dark' || (theme === 'system' && mediaQuery.matches)
      setResolved(isDark ? 'dark' : 'light')
      document.documentElement.classList.toggle('dark', isDark)
    }

    updateResolved()
    mediaQuery.addEventListener('change', updateResolved)
    return () => mediaQuery.removeEventListener('change', updateResolved)
  }, [theme])

  const setThemeAndSave = (newTheme) => {
    setTheme(newTheme)
    localStorage.setItem('autoscuela-theme', newTheme)
  }

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme: setThemeAndSave }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
