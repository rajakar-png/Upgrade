import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import {
  ArrowRight, Check, Cpu, HardDrive, Server, Star, Package,
  Bot, Pickaxe, Loader2
} from "lucide-react"
import PublicNavbar from "../components/PublicNavbar.jsx"
import { api } from "../services/api.js"

export default function Pricing() {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState("minecraft")
  const isLoggedIn = Boolean(localStorage.getItem("token"))

  useEffect(() => {
    api.getLandingPlans()
      .then(setPlans)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = plans.filter((p) => (p.category || "minecraft") === category)

  return (
    <div className="min-h-screen bg-dark-950">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <PublicNavbar />

        {/* Hero */}
        <div className="text-center space-y-6 pt-8 pb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-dark-800/60 border border-dark-700/50 mx-auto">
            <Package className="h-3.5 w-3.5 text-primary-400" />
            <span className="text-xs font-semibold tracking-wide text-slate-300 uppercase">Pricing</span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold text-white">Choose your plan</h1>
          <p className="text-lg text-slate-400 max-w-xl mx-auto">
            Simple, transparent pricing. No hidden fees. Pick the hosting that fits you best.
          </p>

          {/* Category toggle */}
          <div className="flex justify-center pt-2">
            <div className="flex gap-1 rounded-xl border border-dark-700/50 bg-dark-800/50 p-1">
              <button
                onClick={() => setCategory("minecraft")}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  category === "minecraft"
                    ? "bg-primary-500/20 text-primary-300 border border-primary-500/30 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Pickaxe className="h-4 w-4" />
                Minecraft Hosting
              </button>
              <button
                onClick={() => setCategory("bot")}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  category === "bot"
                    ? "bg-neon-500/20 text-neon-300 border border-neon-500/30 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Bot className="h-4 w-4" />
                Bot Hosting
              </button>
            </div>
          </div>
        </div>

        {/* Plans grid */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 text-primary-400 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-dark-800/60 border border-dark-700/50 mb-4">
              {category === "bot" ? <Bot className="h-8 w-8 text-slate-500" /> : <Server className="h-8 w-8 text-slate-500" />}
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No plans yet</h3>
            <p className="text-slate-400">
              {category === "bot" ? "Bot hosting" : "Minecraft"} plans will appear here once added by the admin.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 pb-20">
            {filtered.map((plan, idx) => (
              <div
                key={plan.id}
                className={`card-3d group relative rounded-3xl border p-8 backdrop-blur-sm transition-all duration-300 ${
                  idx === 1 && filtered.length >= 3
                    ? category === "bot"
                      ? "border-neon-500/30 bg-gradient-to-b from-neon-500/[0.06] to-transparent shadow-lg shadow-neon-500/10"
                      : "border-primary-500/30 bg-gradient-to-b from-primary-500/[0.06] to-transparent shadow-lg shadow-primary-500/10"
                    : "border-dark-700/50 bg-dark-800/40 hover:border-dark-600/60"
                }`}
              >
                {/* Glow on hover */}
                <div className="absolute -inset-0.5 rounded-3xl bg-gradient-to-r from-primary-500 to-accent-500 opacity-0 group-hover:opacity-20 blur-md transition-opacity duration-300 -z-10" />

                {idx === 1 && filtered.length >= 3 && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className={`flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-bold text-white shadow-lg ${
                      category === "bot"
                        ? "border-neon-500/50 bg-gradient-to-r from-neon-500 to-neon-600 shadow-neon-500/25"
                        : "border-primary-500/50 bg-gradient-to-r from-primary-500 to-primary-600 shadow-primary-500/25"
                    } animate-pulse-glow`}>
                      <Star className="h-3.5 w-3.5 fill-white" /> Most Popular
                    </span>
                  </div>
                )}

                <div className="space-y-6">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-2xl font-bold text-white">{plan.name}</h3>
                      {plan.plan_type === "coin" && (
                        <span className="px-2 py-0.5 rounded-full bg-primary-500/10 border border-primary-500/20 text-xs font-semibold text-primary-300">Coins</span>
                      )}
                      {plan.plan_type === "real" && (
                        <span className="px-2 py-0.5 rounded-full bg-accent-500/10 border border-accent-500/20 text-xs font-semibold text-accent-300">Premium</span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-2">
                      {plan.plan_type === "coin" ? (
                        plan.price === 0 ? (
                          <>
                            <span className="text-4xl font-extrabold text-green-400">FREE</span>
                            <span className="text-slate-500 font-medium">then {plan.renewal_price} coins/{plan.duration_days}d</span>
                          </>
                        ) : (
                          <>
                            <span className="text-4xl font-extrabold text-white">{plan.price}</span>
                            <span className="text-slate-500 font-medium">coins / {plan.duration_days} days</span>
                          </>
                        )
                      ) : (
                        <>
                          <span className="text-4xl font-extrabold text-white">₹{plan.price}</span>
                          <span className="text-slate-500 font-medium">/ {plan.duration_days} days</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {[
                      ["RAM", `${plan.ram} GB`, Cpu],
                      ["CPU", `${plan.cpu}`, HardDrive],
                      ["Storage", `${plan.storage} GB`, Server]
                    ].map(([label, value, Icon]) => (
                      <div key={label} className="rounded-xl bg-black/30 border border-dark-700/40 px-3 py-3 text-center group-hover:border-dark-600/60 transition-colors">
                        <Icon className="h-4 w-4 text-slate-500 mx-auto mb-1" />
                        <p className="text-sm font-bold text-white">{value}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>

                  {Array.isArray(plan.features) && plan.features.length > 0 && (
                    <ul className="space-y-2.5 pt-2">
                      {plan.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm text-slate-300">
                          <Check className={`h-4 w-4 flex-shrink-0 mt-0.5 ${category === "bot" ? "text-neon-400" : "text-primary-400"}`} />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <Link
                    to={isLoggedIn ? "/plans" : "/register"}
                    className={`glow-ring button-3d flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold transition-all duration-200 ${
                      idx === 1 && filtered.length >= 3
                        ? category === "bot"
                          ? "bg-neon-500 hover:bg-neon-400 text-white shadow-lg shadow-neon-500/20"
                          : "bg-primary-500 hover:bg-primary-400 text-white shadow-lg shadow-primary-500/20"
                        : "bg-dark-800/60 hover:bg-dark-700/60 border border-dark-700/50 text-white hover:border-dark-600/60"
                    }`}
                  >
                    {isLoggedIn ? "Select Plan" : "Get Started"} <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
