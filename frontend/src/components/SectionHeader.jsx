import Card from "./ui/Card.jsx"

export default function SectionHeader({ title, subtitle, icon: Icon, action }) {
  return (
    <div className="relative flex flex-col justify-between gap-5 border-b border-dark-700/50 pb-3 md:flex-row md:items-end">
      <div className="flex items-start gap-3">
        {Icon && (
          <Card className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-300">
            <Icon size={24} />
          </Card>
        )}
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-white">
            {title}
            <span className="h-2 w-2 rounded-full bg-primary-500 shadow-glow-primary animate-pulse" />
          </h2>
          {subtitle && (
            <p className="max-w-xl text-sm text-slate-400">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      
      {action && <div className="shrink-0">{action}</div>}

      {/* Accent line */}
      <div className="absolute -bottom-[1px] left-0 h-[1px] w-24 bg-gradient-to-r from-primary-500 to-transparent" />
    </div>
  )
}
