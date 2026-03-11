export function SkeletonCard() {
  return (
    <div className="card p-4 animate-pulse">
      <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-4" />
      <div className="space-y-2">
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded" />
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-5/6" />
      </div>
    </div>
  )
}

export function SkeletonStat() {
  return (
    <div className="card p-4 animate-pulse">
      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3 mb-3" />
      <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
    </div>
  )
}

export function SkeletonChart() {
  return (
    <div className="card p-6 animate-pulse">
      <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-4" />
      <div className="space-y-3">
        {Array(5)
          .fill(0)
          .map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/6" />
              <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded flex-1" />
            </div>
          ))}
      </div>
    </div>
  )
}

export function SkeletonGrid() {
  return (
    <div className="grid grid-cols-3 gap-4">
      {Array(3)
        .fill(0)
        .map((_, i) => (
          <SkeletonStat key={i} />
        ))}
    </div>
  )
}
