'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('system')
  const [resolved, setResolved] = useState('light')
  
  // Track mount status to prevent SSR hydration mismatches
  const [mounted, setMounted] = useState(false)

  // 1. Initialization (Runs only on Client Mount)
  useEffect(() => {
    setMounted(true)
    try {
      const saved = localStorage.getItem('autoscuela-theme') || 'system'
      setTheme(saved)
    } catch (err) {
      console.warn('Failed to access localStorage:', err)
      setTheme('system')
    }
  }, [])

  // 2. Theme Application & System Preference Listener
  useEffect(() => {
    if (!mounted) return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const applyTheme = () => {
      const isSystemDark = mediaQuery.matches
      const isDark = theme === 'dark' || (theme === 'system' && isSystemDark)
      
      const resolvedTheme = isDark ? 'dark' : 'light'
      setResolved(resolvedTheme)

      const root = document.documentElement

      // Toggle Tailwind's dark class
      root.classList.toggle('dark', isDark)
      
      // Update browser-level color-scheme 
      // This instantly fixes native scrollbars and default HTML inputs to match the theme
      root.style.colorScheme = resolvedTheme
    }

    applyTheme()

    // Listen for OS-level theme changes (if user is on 'system' and changes their Mac/Windows theme)
    mediaQuery.addEventListener('change', applyTheme)
    return () => mediaQuery.removeEventListener('change', applyTheme)
  }, [theme, mounted])

  // 3. Persist Theme Safely
  const setThemeAndSave = useCallback((newTheme) => {
    setTheme(newTheme)
    try {
      localStorage.setItem('autoscuela-theme', newTheme)
    } catch (err) {
      console.warn('Failed to save theme to localStorage:', err)
    }
  }, [])

  return (
    <ThemeContext.Provider 
      value={{ 
        theme, 
        resolved, 
        mounted, 
        setTheme: setThemeAndSave 
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return ctx
}