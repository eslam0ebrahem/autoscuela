'use client'

import Link from 'next/link'

/**
 * NavLink Component
 *
 * Reusable navigation link with active state
 * Used in both desktop and mobile navigation
 */
export default function NavLink({
  href,
  icon,
  label,
  isActive,
  variant = 'desktop', // 'desktop', 'mobile', 'bottom'
  onClick,
}) {
  if (variant === 'mobile') {
    return (
      <Link
        href={href}
        onClick={onClick}
        className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${
          isActive
            ? 'bg-primary text-white shadow-md'
            : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-ink dark:text-white'
        }`}
        aria-current={isActive ? 'page' : undefined}
      >
        <span className="text-lg">{icon}</span>
        <span>{label}</span>
      </Link>
    )
  }

  if (variant === 'bottom') {
    return (
      <Link
        href={href}
        onClick={onClick}
        className="relative flex flex-col items-center justify-center gap-1 py-2 px-3 rounded-lg transition-all group min-w-[64px]"
        aria-current={isActive ? 'page' : undefined}
      >
        <span
          className={`text-xl transition-all ${
            isActive
              ? 'text-primary scale-110'
              : 'text-ink-light dark:text-slate-400 group-hover:text-primary group-hover:scale-105'
          }`}
        >
          {icon}
        </span>
        {isActive && (
          <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-t-full" />
        )}
        <span
          className={`text-[10px] font-bold transition-colors ${
            isActive
              ? 'text-primary'
              : 'text-ink-light dark:text-slate-400 group-hover:text-primary'
          }`}
        >
          {label}
        </span>
      </Link>
    )
  }

  // desktop variant
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
        isActive
          ? 'bg-primary text-white shadow-md'
          : 'text-ink-light dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-ink dark:hover:text-white'
      }`}
      aria-current={isActive ? 'page' : undefined}
      aria-label={label}
    >
      <span className="text-lg">{icon}</span>
      <span className="hidden lg:inline text-sm">{label}</span>
    </Link>
  )
}
