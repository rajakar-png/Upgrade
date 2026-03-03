import { 
  Zap, Database, Cpu, HardDrive, 
  Check, Star, ArrowRight
} from "lucide-react"

export default function PlanCard({ plan, isSelected, onClick, icon: IconComponent }) {
  const isPopular = plan.name?.toLowerCase().includes("premium") || plan.coins >= 50
  
  return (
    <div 
      onClick={onClick}
      className={`relative cursor-pointer transition-all duration-300 h-full group ${
        isSelected ? "scale-[1.02]" : "hover:scale-[1.02]"
      }`}
    >
      {isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
          <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-primary-500 to-accent-500 text-white text-xs font-bold shadow-lg shadow-primary-500/25 animate-pulse-glow">
            <Star className="h-3 w-3" />
            Popular
          </div>
        </div>
      )}

      {/* Glow background on hover/select */}
      <div className={`absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-primary-500 to-accent-500 opacity-0 blur-md transition-opacity duration-300 ${
        isSelected ? "opacity-40" : "group-hover:opacity-20"
      }`} />

      <div className={`relative h-full rounded-2xl p-6 border transition-all duration-300 backdrop-blur-sm ${
        isSelected 
          ? "bg-dark-800/90 border-primary-500 shadow-lg shadow-primary-500/20" 
          : "bg-dark-800/70 border-white/10 hover:border-white/20 hover:shadow-card"
      }`}>
        
        {/* Plan Icon & Name */}
        <div className="mb-6">
          <div className={`inline-flex items-center justify-center h-12 w-12 rounded-xl mb-4 transition-all duration-300 ${
            isSelected 
              ? "bg-primary-500/20 text-primary-400 shadow-glow-primary" 
              : "bg-white/5 text-slate-400 group-hover:bg-primary-500/10 group-hover:text-primary-400"
          }`}>
            {IconComponent ? <IconComponent className="h-6 w-6" /> : <Zap className="h-6 w-6" />}
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">
            {plan.name}
          </h3>
          {plan.description && (
            <p className="text-sm text-slate-400 line-clamp-2 leading-relaxed">
              {plan.description}
            </p>
          )}
        </div>

        {/* Price */}
        <div className="mb-6 pb-6 border-b border-white/10">
          <div className="flex items-baseline gap-2">
            <span className={`text-4xl font-extrabold ${isSelected ? "text-gradient" : "text-white"}`}>
              {plan.real_cost > 0 ? `₹${plan.real_cost}` : (plan.coins ? `${plan.coins}` : "Free")}
            </span>
            {plan.coins > 0 && <span className="text-lg text-slate-400 font-medium">coins</span>}
          </div>
          {plan.duration && (
            <p className="text-sm text-slate-500 mt-1">per {plan.duration}</p>
          )}
        </div>

        {/* Specs */}
        <div className="space-y-3 mb-8">
          {[
            { icon: Cpu, label: "CPU", value: `${plan.cpu}%` },
            { icon: Database, label: "RAM", value: plan.ram || "0MB" },
            { icon: HardDrive, label: "Storage", value: plan.disk || plan.storage || "0MB" }
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-3 text-sm">
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-white/5">
                <Icon className="h-4 w-4 text-primary-400" />
              </div>
              <span className="text-slate-400">{label}</span>
              <span className="text-white font-semibold ml-auto">{value}</span>
            </div>
          ))}
        </div>

        {/* CTA Button with Glow */}
        <button
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          disabled={plan.status === "out_of_stock"}
          className={`glow-ring button-3d w-full rounded-xl px-4 py-3.5 text-sm font-bold transition-all duration-200 ${
            plan.status === "out_of_stock"
              ? "bg-slate-700/50 text-slate-500 cursor-not-allowed !shadow-none"
              : isSelected
              ? "bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-glow-primary hover:shadow-lg hover:shadow-primary-500/30"
              : "bg-primary-500/10 text-primary-400 border border-primary-500/30 hover:bg-primary-500/20 hover:border-primary-500/50"
          }`}
        >
          {plan.status === "out_of_stock" ? "Out of stock" : isSelected ? (
            <span className="flex items-center justify-center gap-2">
              <Check className="h-4 w-4" />
              Selected
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              Select plan
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </span>
          )}
        </button>
      </div>
    </div>
  )
}
