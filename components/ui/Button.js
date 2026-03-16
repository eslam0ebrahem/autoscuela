'use client'

import { forwardRef } from 'react'

/**
 * Reusable Button Component
 *
 * Variants: primary, secondary, danger, ghost
 * Supports: loading state, disabled state, size variants, full width
 */
const Button = forwardRef(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      fullWidth = false,
      loading = false,
      disabled = false,
      type = 'button',
      onClick,
      className = '',
      'aria-label': ariaLabel,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading

    // Variant styles
    const variantStyles = {
      primary:
        'bg-primary text-white hover:bg-primary/90 active:scale-[0.98] shadow-lg shadow-primary/20',
      secondary:
        'bg-slate-200 dark:bg-slate-700 text-ink dark:text-white hover:bg-slate-300 dark:hover:bg-slate-600',
      danger: 'bg-red-500 text-white hover:bg-red-600 active:scale-[0.98]',
      ghost:
        'bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-ink dark:text-white border border-slate-200 dark:border-slate-700',
    }

    // Size styles
    const sizeStyles = {
      sm: 'px-3 py-2 text-sm rounded-lg',
      md: 'px-4 py-2.5 text-base rounded-xl',
      lg: 'px-6 py-3 text-lg rounded-2xl',
    }

    const baseStyles =
      'font-bold transition-all duration-200 inline-flex items-center justify-center gap-2'
    const disabledStyles = isDisabled ? 'opacity-50 cursor-not-allowed' : ''
    const widthStyles = fullWidth ? 'w-full' : ''

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        onClick={onClick}
        aria-label={ariaLabel}
        aria-busy={loading}
        className={`
        ${baseStyles}
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${disabledStyles}
        ${widthStyles}
        ${className}
      `}
        {...props}
      >
        {loading && (
          <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        )}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'

export default Button
