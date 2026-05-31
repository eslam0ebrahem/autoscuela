'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
const AuthContext = createContext(null)

// ---------------------------------------------------------------------------
// Provider Component
// ---------------------------------------------------------------------------
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  // ── Fetch current user session ─────────────────────────────────────────
  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Cache-Control': 'no-cache' },
        credentials: 'same-origin',
      })

      if (res.ok) {
        const data = await res.json()
        setUser(data.user)
      } else {
        setUser(null)
      }
    } catch (err) {
      console.error('[auth] Failed to fetch user session:', err)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial user fetch
  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  // ── Cross-tab auth sync ────────────────────────────────────────────────
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'auth_sync_event') {
        const [event, timestamp] = (e.newValue || '').split('|')

        // Prevent re-processing the same sync event from this tab
        const lastProcessedSync = localStorage.getItem('last_processed_sync')
        if (timestamp && timestamp === lastProcessedSync) return
        if (timestamp) localStorage.setItem('last_processed_sync', timestamp)

        if (event === 'logout') {
          setUser(null)
          // Redirect to login if on protected page
          if (pathname !== '/' && !pathname.startsWith('/auth')) {
            router.push('/auth/login')
          }
        } else if (event === 'login') {
          // Another tab logged in, refresh user
          fetchUser()
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [router, pathname, fetchUser])

  // ── Refresh token periodically ────────────────────────────────────────
  // Set up a timer to refresh token every 6 hours (now that tokens last longer)
  useEffect(() => {
    if (!user) return

    const refreshInterval = setInterval(
      async () => {
        try {
          const res = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Requested-With': 'XMLHttpRequest', // CSRF header
            },
            credentials: 'same-origin',
          })

          if (res.ok) {
            const data = await res.json()
            setUser(data.user)
          } else if (res.status === 401) {
            // Refresh token expired, user needs to log in again
            setUser(null)
          }
        } catch (err) {
          console.error('[auth] Token refresh failed:', err)
          // Continue - will refresh again on next interval
        }
      },
      12 * 60 * 1000
    ) // 12 minutes — refresh before 15-minute access token expires

    return () => clearInterval(refreshInterval)
  }, [user])

  // ── Login ──────────────────────────────────────────────────────────────
  const login = useCallback(async (email, password, rememberMe = true) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest', // CSRF header
        },
        body: JSON.stringify({ email, password, rememberMe }),
        credentials: 'same-origin',
      })

      let data = {}
      try {
        data = await res.json()
      } catch {
        // Server returned non-JSON (e.g., HTML error page)
      }

      if (res.ok) {
        setUser(data.user)
        const timestamp = Date.now().toString()
        localStorage.setItem('last_processed_sync', timestamp)
        localStorage.setItem('auth_sync_event', `login|${timestamp}`)
        return { success: true }
      }

      // Return specific error message from server
      return { success: false, error: data.error || 'Login failed' }
    } catch (err) {
      console.error('[auth] Login error:', err)
      return {
        success: false,
        error: 'Connection problem. Please try again.',
      }
    }
  }, [])

  // ── Register ───────────────────────────────────────────────────────────
  const register = useCallback(async (email, password, nickname, language = 'es') => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest', // CSRF header
        },
        body: JSON.stringify({ email, password, nickname, language }),
        credentials: 'same-origin',
      })

      let data = {}
      try {
        data = await res.json()
      } catch {
        // Server returned non-JSON (e.g., HTML error page)
      }

      if (res.ok) {
        setUser(data.user)
        const timestamp = Date.now().toString()
        localStorage.setItem('last_processed_sync', timestamp)
        localStorage.setItem('auth_sync_event', `login|${timestamp}`)
        return { success: true }
      }

      return { success: false, error: data.error || 'Registration failed' }
    } catch (err) {
      console.error('[auth] Registration error:', err)
      return {
        success: false,
        error: 'Connection problem. Please try again.',
      }
    }
  }, [])

  // ── Logout ─────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/me', {
        method: 'DELETE',
        headers: {
          'X-Requested-With': 'XMLHttpRequest', // CSRF header
        },
        credentials: 'same-origin',
      })
    } catch (err) {
      console.error('[auth] Error during logout:', err)
    } finally {
      setUser(null)
      const timestamp = Date.now().toString()
      localStorage.setItem('last_processed_sync', timestamp)
      localStorage.setItem('auth_sync_event', `logout|${timestamp}`)
      router.push('/')
    }
  }, [router])

  // ── Update language preference ─────────────────────────────────────────
  const updateLanguage = useCallback(
    async (lang) => {
      // Optimistic update
      setUser((prev) =>
        prev ? { ...prev, preferences: { ...prev.preferences, language: lang } } : prev
      )

      try {
        const res = await fetch('/api/users/preferences', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest', // CSRF header
          },
          body: JSON.stringify({ language: lang }),
          credentials: 'same-origin',
        })

        if (!res.ok) {
          console.error('[auth] Failed to save language preference')
          // Revert on error
          await fetchUser()
        }
      } catch (err) {
        console.error('[auth] Network error saving language preference:', err)
        // Revert on error
        await fetchUser()
      }
    },
    [fetchUser]
  )

  // ── Refresh user data ──────────────────────────────────────────────────
  const refreshUser = useCallback(() => {
    return fetchUser()
  }, [fetchUser])

  // ── Translation helper ─────────────────────────────────────────────────
  const t = useCallback(
    (es, en) => (user?.preferences?.language === 'en' ? en : es),
    [user?.preferences?.language]
  )

  // ── Context value ──────────────────────────────────────────────────────
  const value = {
    user,
    loading,
    login,
    register,
    logout,
    updateLanguage,
    refreshUser,
    t,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
