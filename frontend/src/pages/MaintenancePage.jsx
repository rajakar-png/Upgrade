import { Construction, ArrowLeft, RefreshCw } from "lucide-react"

export default function MaintenancePage() {
  return (
    <div className="min-h-screen bg-dark-950 text-slate-100 flex items-center justify-center p-6">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(245,158,11,0.06),transparent_60%)]" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-amber-500/5 blur-[150px] rounded-full" />
      </div>

      <div className="relative z-10 max-w-lg w-full text-center space-y-8 animate-fade-in">
        {/* Icon */}
        <div className="mx-auto h-20 w-20 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <Construction className="h-10 w-10 text-amber-400" />
        </div>

        {/* Heading */}
        <div className="space-y-3">
          <h1 className="text-4xl font-black text-white uppercase tracking-tight">
            Under Maintenance
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed">
            We're performing scheduled maintenance to improve your experience.
            <br />
            We'll be back online shortly.
          </p>
        </div>

        {/* Status card */}
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 backdrop-blur-sm p-6 space-y-4">
          <div className="flex items-center justify-center gap-3">
            <div className="h-2.5 w-2.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-sm font-bold text-amber-300 uppercase tracking-widest">
              Maintenance in Progress
            </span>
          </div>
          <p className="text-xs text-slate-500">
            All services are temporarily unavailable. Admin users can still access the dashboard.
          </p>
        </div>

        {/* Action */}
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 rounded-xl border border-dark-700/60 bg-dark-900/80 px-6 py-3 text-sm font-semibold text-slate-300 hover:bg-dark-800 hover:border-dark-600 transition-all"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh Page
        </button>
      </div>
    </div>
  )
}
