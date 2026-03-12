'use client'

import { AuthProvider } from './AuthContext'
import { ThemeProvider } from './ThemeProvider'
import { ToastProvider } from './Toast'

export function Providers({ children }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          {children}
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
