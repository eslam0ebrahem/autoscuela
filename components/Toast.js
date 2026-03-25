'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'

const ToastContext = createContext(null)

// ── Individual Toast ──────────────────────────────────────
function ToastItem({ toast, dismiss }) {
  const [visible, setVisible] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const timerRef = useRef(null)

  // Animate in
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  // Auto-dismiss with hover pause
  useEffect(() => {
    if (isHovered) return
    timerRef.current = setTimeout(() => dismiss(toast.id), toast.duration)
    return () => clearTimeout(timerRef.current)
  }, [isHovered, toast.id, toast.duration, dismiss])

  const config = {
    success: {
      bar: 'bg-success',
      icon: '✓',
      ring: 'border-success/20 bg-success/8',
      iconBg: 'bg-success/15 text-success',
      text: 'text-base-content',
    },
    error: {
      bar: 'bg-error',
      icon: '✕',
      ring: 'border-error/20 bg-error/8',
      iconBg: 'bg-error/15 text-error',
      text: 'text-base-content',
    },
    warning: {
      bar: 'bg-warning',
      icon: '⚠',
      ring: 'border-warning/20 bg-warning/8',
      iconBg: 'bg-warning/15 text-warning',
      text: 'text-base-content',
    },
    info: {
      bar: 'bg-primary',
      icon: 'ℹ',
      ring: 'border-primary/20 bg-primary/8',
      iconBg: 'bg-primary/15 text-primary',
      text: 'text-base-content',
    },
  }

  const c = config[toast.type] || config.info

  return (
    <div
      role="alert"
      aria-live="assertive"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`w-full max-w-sm rounded-2xl border shadow-lg overflow-hidden
        transition-all duration-300 ease-out
        ${c.ring}
        ${visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'}`}
    >
      {/* Colour top bar */}
      <div className={`h-1 w-full ${c.bar}`} />

      <div className="flex items-start gap-3 px-4 py-3">
        {/* Icon */}
        <div
          className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center
          text-sm font-black ${c.iconBg}`}
        >
          {c.icon}
        </div>

        {/* Message */}
        <p className={`flex-1 min-w-0 text-sm font-medium leading-snug pt-1 ${c.text}`}>
          {toast.message}
        </p>

        {/* Dismiss */}
        <button
          onClick={() => dismiss(toast.id)}
          className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center
            text-base-content/30 hover:text-base-content/60 hover:bg-base-200
            transition-colors text-xs mt-0.5"
          aria-label="Cerrar"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

// ── Provider ──────────────────────────────────────────────
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev.slice(-4), { id, message, type, duration }])
  }, [])

  const toast = {
    showToast: addToast,
    success: (msg, dur) => addToast(msg, 'success', dur),
    error: (msg, dur) => addToast(msg, 'error', dur || 5000),
    warning: (msg, dur) => addToast(msg, 'warning', dur),
    info: (msg, dur) => addToast(msg, 'info', dur),
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}

      {/* ── Toast container ──
          Mobile: bottom-center, above bottom nav (bottom-20)
          Desktop: top-right (sm:top-4 sm:right-4) */}
      {toasts.length > 0 && (
        <div
          className="fixed z-[9999] flex flex-col gap-2 pointer-events-none
            bottom-20 left-4 right-4
            sm:bottom-auto sm:top-4 sm:left-auto sm:right-4 sm:w-80"
          aria-live="polite"
        >
          {toasts.map((t) => (
            <div key={t.id} className="pointer-events-auto">
              <ToastItem toast={t} dismiss={dismiss} />
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}
