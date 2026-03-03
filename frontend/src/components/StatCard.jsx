export default function StatCard({ label, value, hint, icon: Icon }) {
  return (
    <div className="card-3d rounded-xl border border-white/10 bg-dark-800/60 backdrop-blur-sm p-6">
      <div className="flex items-center gap-3 mb-4">
        {Icon && (
          <div className="h-10 w-10 rounded-lg bg-primary-500/10 border border-primary-500/20 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary-400" />
          </div>
        )}
        <p className="text-sm text-slate-400">{label}</p>
      </div>
      <p className="text-3xl font-bold text-white">{value}</p>
      {hint && <p className="mt-2 text-sm text-slate-400">{hint}</p>}
    </div>
  )
}
