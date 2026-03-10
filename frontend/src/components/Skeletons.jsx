export function SkeletonCard({ className = "" }) {
  return (
    <div
      className={`animate-pulse rounded-2xl border border-dark-700/60 bg-ink-900/70 ${className}`}
    >
      <div className="space-y-4 p-6">
        <div className="h-4 w-3/4 rounded-lg bg-slate-800/80" />
        <div className="h-3 w-full rounded-lg bg-slate-800/60" />
        <div className="h-3 w-5/6 rounded-lg bg-slate-800/60" />
        <div className="mt-4 h-8 w-1/3 rounded-lg bg-slate-800/50" />
      </div>
    </div>
  )
}

export function SkeletonRow({ className = "" }) {
  return (
    <div className={`flex animate-pulse items-center gap-4 ${className}`}>
      <div className="h-10 w-10 shrink-0 rounded-xl bg-slate-800/60" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-2/3 rounded-lg bg-slate-800/70" />
        <div className="h-3 w-1/2 rounded-lg bg-slate-800/50" />
      </div>
    </div>
  )
}

export function SkeletonText({ lines = 3, className = "" }) {
  const widths = ["w-11/12", "w-3/4", "w-2/3", "w-5/6", "w-1/2"]

  return (
    <div className={`space-y-2 animate-pulse ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`h-3 rounded-lg bg-slate-800/60 ${widths[i % widths.length]}`}
        />
      ))}
    </div>
  )
}
