'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { headers: { 'Cache-Control': 'no-cache' } })
      if (res.ok) {
        const data = await res.json()
        setUser(data.user)
      } else {
        setUser(null)
      }
    } catch (err) {
      console.error('Failed to fetch user session:', err)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchUser() }, [fetchUser])

  // Cross-tab logout sync
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'auth_sync_event' && e.newValue === 'logout') {
        setUser(null)
        if (pathname !== '/' && !pathname.startsWith('/auth')) {
          router.push('/auth/login')
        }
      }
    }
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [router, pathname])

  const login = async (email, password) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (res.ok) {
        setUser(data.user)
        localStorage.setItem('auth_sync_event', 'login-' + Date.now())
        return { success: true }
      }
      return { success: false, error: data.error || 'Login failed' }
    } catch (err) {
      console.error('Login error:', err)
      return { success: false, error: 'Hubo un problema de conexión. Inténtalo de nuevo.' }
    }
  }

  const register = async (email, password, nickname, language) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, nickname, language }),
      })
      const data = await res.json()
      if (res.ok) {
        setUser(data.user)
        localStorage.setItem('auth_sync_event', 'login-' + Date.now())
        return { success: true }
      }
      return { success: false, error: data.error || 'Registration failed' }
    } catch (err) {
      console.error('Registration error:', err)
      return { success: false, error: 'Hubo un problema de conexión. Inténtalo de nuevo.' }
    }
  }

  const logout = async () => {
    try {
      await fetch('/api/auth/me', { method: 'DELETE' })
    } catch (err) {
      console.error('Error during logout:', err)
    } finally {
      setUser(null)
      localStorage.setItem('auth_sync_event', 'logout')
      router.push('/')
    }
  }

  const updateLanguage = async (lang) => {
    setUser((prev) => prev ? { ...prev, preferences: { ...prev.preferences, language: lang } } : prev)
    try {
      const res = await fetch('/api/users/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: lang }),
      })
      if (!res.ok) console.error('Failed to save language preference')
    } catch (err) {
      console.error('Network error saving language preference:', err)
    }
  }

  const refreshUser = fetchUser

  const t = useCallback(
    (es, en) => (user?.preferences?.language === 'en' ? en : es),
    [user?.preferences?.language]
  )

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, register, updateLanguage, refreshUser, t }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
