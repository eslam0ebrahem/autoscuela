// Skeleton components — consistent with rounded-2xl design system

export function SkeletonCard({ className = '', lines = 2, ...props }) {
  return (
    <div
      className={`rounded-2xl border border-base-200 bg-base-100 p-4 space-y-3 ${className}`}
      aria-hidden="true"
      {...props}
    >
      <div className="h-3 w-2/3 rounded-full bg-base-200 animate-pulse" />
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`h-2.5 rounded-full bg-base-200 animate-pulse ${i === lines - 1 ? 'w-1/2' : 'w-full'}`}
        />
      ))}
    </div>
  )
}

export function SkeletonStat({ className = '', ...props }) {
  return (
    <div
      className={`rounded-2xl border border-base-200 bg-base-100 p-4 flex items-center gap-3 ${className}`}
      aria-hidden="true"
      {...props}
    >
      <div className="w-10 h-10 rounded-xl bg-base-200 animate-pulse shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-5 w-16 rounded-full bg-base-200 animate-pulse" />
        <div className="h-2.5 w-12 rounded-full bg-base-200 animate-pulse" />
      </div>
    </div>
  )
}

export function SkeletonStatsGrid({ count = 4, className = '', ...props }) {
  return (
    <div className={`grid grid-cols-2 gap-3 ${className}`} aria-hidden="true" {...props}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonStat key={i} />
      ))}
    </div>
  )
}

export function SkeletonList({ rows = 5, className = '', ...props }) {
  return (
    <div
      className={`rounded-2xl border border-base-200 bg-base-100 overflow-hidden divide-y divide-base-200 ${className}`}
      aria-hidden="true"
      {...props}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          <div className="w-10 h-10 rounded-xl bg-base-200 animate-pulse shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-3/4 rounded-full bg-base-200 animate-pulse" />
            <div className="h-2.5 w-1/2 rounded-full bg-base-200 animate-pulse" />
          </div>
          <div className="h-2.5 w-10 rounded-full bg-base-200 animate-pulse shrink-0" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonGrid({
  count = 6,
  cols = 'grid-cols-2 sm:grid-cols-3',
  className = '',
  ...props
}) {
  return (
    <div className={`grid ${cols} gap-3 ${className}`} aria-hidden="true" {...props}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-base-200 animate-pulse aspect-square" />
      ))}
    </div>
  )
}

export function SkeletonText({ lines = 3, className = '', ...props }) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true" {...props}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`h-3 rounded-full bg-base-200 animate-pulse
            ${i === lines - 1 ? 'w-2/3' : i % 2 === 0 ? 'w-full' : 'w-5/6'}`}
        />
      ))}
    </div>
  )
}
