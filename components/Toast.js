'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'

const ToastContext = createContext(null)

// ==== SUB-COMPONENT: Individual Toast ====
// Extracted to give each toast its own lifecycle and timer management
function ToastItem({ toast, dismiss }) {
  const [isHovered, setIsHovered] = useState(false)
  const timerRef = useRef(null)

  // Manage auto-dismiss timer with pause-on-hover support
  useEffect(() => {
    if (!isHovered) {
      timerRef.current = setTimeout(() => {
        dismiss(toast.id)
      }, toast.duration)
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [isHovered, toast.id, toast.duration, dismiss])

  // Styling maps
  const typeStyles = {
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-700/50 dark:text-emerald-300',
    error: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/30 dark:border-red-700/50 dark:text-red-300',
    warning: 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/30 dark:border-amber-700/50 dark:text-amber-300',
    info: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/30 dark:border-blue-700/50 dark:text-blue-300'
  }

  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  }

  return (
    <div
      className={`toast-item animate-slide-up rounded-xl px-4 py-3 shadow-lg border flex items-start gap-3 pointer-events-auto transition-all duration-200 hover:shadow-xl ${typeStyles[toast.type]}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role={toast.type === 'error' ? 'alert' : 'status'}
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
    >
      <div className="text-lg flex-shrink-0 font-bold mt-0.5" aria-hidden="true">
        {icons[toast.type]}
      </div>
      
      <div className="flex-1 text-sm font-medium leading-relaxed pt-1">
        {toast.message}
      </div>
      
      <button
        type="button"
        onClick={() => dismiss(toast.id)}
        className="flex-shrink-0 p-1 rounded-lg opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-current"
        aria-label="Cerrar notificación / Close notification"
      >
        ✕
      </button>
    </div>
  )
}

// ==== MAIN PROVIDER ====
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID 
      ? crypto.randomUUID() 
      : Date.now().toString() + Math.random().toString()
      
    setToasts(prev => [...prev, { id, message, type, duration }])
  }, [])

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // Convenience methods
  const success = useCallback((msg, duration) => addToast(msg, 'success', duration), [addToast])
  const error = useCallback((msg, duration = 6000) => addToast(msg, 'error', duration), [addToast]) // Errors show longer by default
  const info = useCallback((msg, duration) => addToast(msg, 'info', duration), [addToast])
  const warning = useCallback((msg, duration) => addToast(msg, 'warning', duration), [addToast])

  return (
    <ToastContext.Provider value={{ addToast, success, error, info, warning }}>
      {children}
      
      {/* Toast Container 
        pointer-events-none ensures the container itself doesn't block clicks on the page,
        while pointer-events-auto on the ToastItem allows interaction with the toasts.
      */}
      <div 
        className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 z-[100] flex flex-col gap-3 sm:max-w-sm pointer-events-none" 
      >
        {toasts.map(toast => (
          <ToastItem 
            key={toast.id} 
            toast={toast} 
            dismiss={dismiss} 
          />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return ctx
}