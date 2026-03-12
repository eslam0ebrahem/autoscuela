'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  // 1. Fetch User Data
  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', {
        // Prevent caching so we always get fresh auth state
        headers: { 'Cache-Control': 'no-cache' } 
      })
      
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

  // Initial load
  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  // 2. Cross-Tab Synchronization (Security Feature)
  // If the user logs out in one tab, log them out in all tabs.
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'auth_sync_event' && e.newValue === 'logout') {
        setUser(null)
        // Only redirect if they are on a protected route
        if (pathname !== '/' && !pathname.startsWith('/auth')) {
          router.push('/auth/login')
        }
      }
    }
    
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [router, pathname])

  // 3. Authentication Methods
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
        // Notify other tabs
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
      console.error('Error during logout API call:', err)
    } finally {
      setUser(null)
      // Notify other tabs that the user logged out
      localStorage.setItem('auth_sync_event', 'logout')
      router.push('/')
    }
  }

  // 4. Preferences Methods
  const updateLanguage = async (lang) => {
    // Optimistic UI update for immediate response
    setUser((prev) => {
      if (!prev) return prev
      return { 
        ...prev, 
        preferences: { ...prev.preferences, language: lang } 
      }
    })

    try {
      const res = await fetch('/api/users/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: lang }),
      })
      
      if (!res.ok) {
        // If it fails, we could theoretically revert the optimistic update here,
        // but for language toggles, silent failure is usually acceptable.
        console.error('Failed to save language preference to server')
      }
    } catch (err) {
      console.error('Network error saving language preference:', err)
    }
  }

  // 5. Utility Methods
  const refreshUser = fetchUser

  // Translation Helper
  const t = useCallback((es, en) => {
    return user?.preferences?.language === 'en' ? en : es
  }, [user?.preferences?.language])

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        loading, 
        login, 
        register, 
        logout, 
        updateLanguage, 
        refreshUser, 
        t 
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// Custom Hook
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}