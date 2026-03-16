'use client'

/**
 * Reusable Spinner Component
 *
 * Sizes: sm, md, lg
 * Can include optional text message
 */
export default function Spinner({
  size = 'md',
  message,
  variant = 'default', // 'default' or 'inline'
}) {
  const sizeMap = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-16 h-16 border-4',
  }

  const spinnerContent = (
    <div
      className={`${sizeMap[size]} border-primary border-t-transparent rounded-full animate-spin`}
    />
  )

  if (variant === 'inline') {
    return spinnerContent
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      {spinnerContent}
      {message && <p className="text-ink-light dark:text-slate-400 text-sm">{message}</p>}
    </div>
  )
}
