export default function SectionHeader({ title, subtitle, icon: Icon, action }) {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2 border-b border-white/[0.06] relative">
      <div className="flex items-start gap-4">
        {Icon && (
          <div className="h-12 w-12 rounded-xl bg-dark-800/60 border border-white/10 flex items-center justify-center text-slate-400 shadow-lg">
            <Icon size={24} />
          </div>
        )}
        <div className="space-y-1">
          <h2 className="text-2xl font-black text-white tracking-tight uppercase flex items-center gap-2">
            {title}
            <span className="h-2 w-2 rounded-full bg-primary-500 shadow-glow-primary animate-pulse" />
          </h2>
          {subtitle && (
            <p className="text-sm font-medium text-slate-500 max-w-xl">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      
      {action && (
        <div className="flex-shrink-0">
          {action}
        </div>
      )}

      {/* Accent line */}
      <div className="absolute -bottom-[1px] left-0 w-24 h-[1px] bg-gradient-to-r from-primary-500 to-transparent" />
    </div>
  )
}
