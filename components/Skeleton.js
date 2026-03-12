// components/Skeletons.js (or whatever your filename is)

export function SkeletonCard({ className = '', ...props }) {
  return (
    <div 
      className={`card p-5 animate-pulse bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm ${className}`} 
      aria-hidden="true"
      {...props}
    >
      {/* Simulates a title */}
      <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded-md w-2/3 mb-5" />
      
      {/* Simulates paragraph text with varying widths */}
      <div className="space-y-3">
        <div className="h-3.5 bg-slate-100 dark:bg-slate-700/50 rounded-md w-full" />
        <div className="h-3.5 bg-slate-100 dark:bg-slate-700/50 rounded-md w-5/6" />
        <div className="h-3.5 bg-slate-100 dark:bg-slate-700/50 rounded-md w-4/6" />
      </div>
    </div>
  )
}

export function SkeletonStat({ className = '', ...props }) {
  return (
    <div 
      className={`card p-5 animate-pulse bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-center ${className}`} 
      aria-hidden="true"
      {...props}
    >
      {/* Simulates a small label */}
      <div className="h-3.5 bg-slate-200 dark:bg-slate-700 rounded-md w-1/2 mb-3" />
      {/* Simulates a large number/stat */}
      <div className="h-8 bg-slate-200 dark:bg-slate-600 rounded-lg w-2/3" />
    </div>
  )
}

export function SkeletonChart({ className = '', rows = 5, ...props }) {
  return (
    <div 
      className={`card p-6 animate-pulse bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm ${className}`} 
      aria-hidden="true"
      {...props}
    >
      {/* Simulates chart title */}
      <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded-md w-1/3 mb-6" />
      
      {/* Simulates bar chart rows */}
      <div className="space-y-4">
        {Array.from({ length: rows }).map((_, i) => {
          // Generate pseudo-random widths for the skeleton bars to make it look like a real chart
          const widthClass = ['w-full', 'w-4/5', 'w-3/4', 'w-2/3', 'w-1/2', 'w-5/6'][i % 6]
          
          return (
            <div key={i} className="flex items-center gap-4">
              {/* Simulates Y-axis label */}
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/6" />
              {/* Simulates Data Bar */}
              <div className="flex-1">
                <div className={`h-8 bg-slate-100 dark:bg-slate-700/50 rounded-lg ${widthClass}`} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function SkeletonGrid({ className = '', count = 3, cols = 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3', ...props }) {
  return (
    <div 
      className={`grid ${cols} gap-4 sm:gap-6 ${className}`} 
      aria-hidden="true"
      {...props}
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonStat key={i} />
      ))}
    </div>
  )
}