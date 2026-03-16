'use client'

import { forwardRef } from 'react'

/**
 * Reusable Input Component
 *
 * Supports:
 * - Label with htmlFor
 * - Error state with aria-describedby
 * - Required field indicator
 * - Standard input types
 * - Full accessibility attributes
 */
const Input = forwardRef(({
  label,
  error,
  required = false,
  type = 'text',
  id,
  name,
  placeholder,
  value,
  onChange,
  onBlur,
  disabled = false,
  autoComplete,
  maxLength,
  minLength,
  pattern,
  className = '',
  helperText,
  ...props
}, ref) => {
  const errorId = error ? `${id}-error` : undefined
  const helperId = helperText ? `${id}-helper` : undefined
  const describedBy = [errorId, helperId].filter(Boolean).join(' ') || undefined

  return (
    <div className="space-y-1">
      {label && (
        <label
          htmlFor={id}
          className="text-[10px] font-black uppercase tracking-widest text-ink-light ml-1"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        name={name || id}
        type={type}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete={autoComplete}
        maxLength={maxLength}
        minLength={minLength}
        pattern={pattern}
        required={required}
        aria-describedby={describedBy}
        aria-invalid={error ? 'true' : 'false'}
        className={`w-full p-4 rounded-2xl bg-white dark:bg-slate-900 border-2 transition-all outline-none font-bold ${
          error
            ? 'border-red-500 dark:border-red-500 focus:border-red-600'
            : 'border-slate-100 dark:border-slate-800 focus:border-primary dark:focus:border-primary'
        } disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        {...props}
      />
      {error && (
        <p id={errorId} className="text-xs font-bold text-red-600 dark:text-red-400 ml-1">
          {error}
        </p>
      )}
      {helperText && !error && (
        <p id={helperId} className="text-xs text-ink-light dark:text-slate-400 ml-1">
          {helperText}
        </p>
      )}
    </div>
  )
})

Input.displayName = 'Input'

export default Input
