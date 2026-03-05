import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import AdminNav from "../components/AdminNav.jsx"
import SectionHeader from "../components/SectionHeader.jsx"
import { api } from "../services/api.js"
import { ArrowLeft, Server, Coins, Wallet, Info } from "lucide-react"

export default function AdminLandingPlans() {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getAdminLandingPlans()
      .then(setPlans)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-dark-950">
      <AdminNav />
      <div className="max-w-7xl mx-auto p-6 space-y-6">

        <div className="flex items-center gap-4">
          <Link to="/admin" className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200">
            <ArrowLeft className="h-4 w-4" /> Back to Admin
          </Link>
        </div>

        <SectionHeader title="Landing Page Plans" subtitle="Plans are now auto-synced from your Coin & Real Money plans." />

        {/* Info banner */}
        <div className="flex items-start gap-3 rounded-2xl border border-primary-500/30 bg-primary-500/5 p-5">
          <Info className="h-5 w-5 text-primary-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-slate-300">
            <p className="font-semibold text-white mb-1">Plans are auto-synced</p>
            <p>Landing page plans are now automatically generated from your <strong>Coin Plans</strong> and <strong>Real Money Plans</strong>. 
              Manage them from the <Link to="/admin" className="text-primary-400 hover:text-primary-300 underline">Admin Panel → Plans</Link> section. 
              No separate landing plan management is needed.</p>
          </div>
        </div>

        {/* Read-only preview */}
        {loading ? (
          <p className="text-slate-400">Loading preview...</p>
        ) : plans.length === 0 ? (
          <div className="glass rounded-2xl border border-dashed border-dark-700/50 p-12 text-center">
            <Server className="mx-auto h-8 w-8 text-slate-600" />
            <p className="mt-3 text-slate-400">No plans found. Create Coin or Real Money plans from the Admin Panel.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {plans.map((plan) => (
              <div key={plan.id} className="glass relative rounded-2xl border border-dark-700/40 p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-100">{plan.name}</h3>
                      {plan.plan_type === "coin" && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-500/10 border border-primary-500/20 text-xs font-semibold text-primary-300">
                          <Coins className="h-3 w-3" /> Coins
                        </span>
                      )}
                      {plan.plan_type === "real" && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-500/10 border border-accent-500/20 text-xs font-semibold text-accent-300">
                          <Wallet className="h-3 w-3" /> Premium
                        </span>
                      )}
                    </div>
                    <p className="text-lg font-bold text-neon-200 mt-1">
                      {plan.plan_type === "coin"
                        ? (plan.price === 0 ? "FREE first buy" : `${plan.price} coins`)
                        : `₹${plan.price}`}
                      {plan.plan_type === "coin" && plan.renewal_price > 0 && (
                        <span className="text-sm font-normal text-slate-400"> → {plan.renewal_price} coins renewal</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs text-slate-400">
                  <div className="rounded-lg bg-ink-900/60 px-2 py-1.5 text-center">
                    <div className="font-semibold text-slate-200">{plan.ram} GB</div>
                    <div>RAM</div>
                  </div>
                  <div className="rounded-lg bg-ink-900/60 px-2 py-1.5 text-center">
                    <div className="font-semibold text-slate-200">{plan.cpu}</div>
                    <div>CPU</div>
                  </div>
                  <div className="rounded-lg bg-ink-900/60 px-2 py-1.5 text-center">
                    <div className="font-semibold text-slate-200">{plan.storage} GB</div>
                    <div>Storage</div>
                  </div>
                </div>

                {plan.features && plan.features.length > 0 && (
                  <ul className="space-y-1 text-xs text-slate-400">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <span className="h-1 w-1 rounded-full bg-neon-400/60" />{f}
                      </li>
                    ))}
                  </ul>
                )}

                <p className="text-xs text-slate-500 italic">Auto-synced • Read-only preview</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
