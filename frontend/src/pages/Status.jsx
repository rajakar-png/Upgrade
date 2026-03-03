import { useState, useEffect } from "react"
import { CheckCircle2, AlertCircle, AlertTriangle, Clock, RefreshCw } from "lucide-react"
import PublicNavbar from "../components/PublicNavbar.jsx"
import { api } from "../services/api.js"

const SERVICES = [
  { name: "Game Panel", status: "operational", desc: "Pterodactyl server management" },
  { name: "Node — Mumbai", status: "operational", desc: "IN1 bare-metal node" },
  { name: "Node — Singapore", status: "operational", desc: "SG1 bare-metal node" },
  { name: "Node — Frankfurt", status: "operational", desc: "EU1 bare-metal node" },
  { name: "API", status: "operational", desc: "AstraNodes backend API" },
  { name: "Billing System", status: "operational", desc: "Coin & plan management" },
  { name: "Support Portal", status: "operational", desc: "Ticket system" },
  { name: "Auth Service", status: "operational", desc: "Login & registration" }
]

const INCIDENTS = [
  // Static placeholder — replace with live data from API when available
]

const STATUS_CONFIG = {
  operational: {
    icon: CheckCircle2,
    text: "Operational",
    color: "text-aurora-300",
    border: "border-aurora-500/20",
    bg: "bg-aurora-500/10"
  },
  degraded: {
    icon: AlertTriangle,
    text: "Degraded",
    color: "text-amber-300",
    border: "border-amber-500/20",
    bg: "bg-amber-500/10"
  },
  outage: {
    icon: AlertCircle,
    text: "Outage",
    color: "text-red-300",
    border: "border-red-500/20",
    bg: "bg-red-500/10"
  },
  maintenance: {
    icon: Clock,
    text: "Maintenance",
    color: "text-neon-300",
    border: "border-neon-500/20",
    bg: "bg-neon-500/10"
  }
}

function ServiceRow({ service }) {
  const cfg = STATUS_CONFIG[service.status] || STATUS_CONFIG.operational
  const Icon = cfg.icon
  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-800/60 last:border-0">
      <div>
        <div className="text-sm font-medium text-slate-200">{service.name}</div>
        <div className="text-xs text-slate-500">{service.desc}</div>
      </div>
      <span className={`flex items-center gap-1.5 rounded-full border ${cfg.border} ${cfg.bg} px-2.5 py-0.5 text-xs font-medium ${cfg.color}`}>
        <Icon className="h-3 w-3" />
        {cfg.text}
      </span>
    </div>
  )
}


export default function Status() {
  const [services, setServices] = useState(SERVICES)
  const [globalMessage, setGlobalMessage] = useState("")

  useEffect(() => {
    api.getFrontpage()
      .then((data) => {
        const section = data?.status_page?.data
        if (section && Array.isArray(section.services) && section.services.length > 0) {
          setServices(section.services)
          setGlobalMessage(section.globalMessage || "")
        }
      })
      .catch(() => {})
  }, [])

  const allOperational = services.every((s) => s.status === "operational")

  return (
    <div className="min-h-screen bg-dark-950 text-slate-100 animate-fade-in">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <PublicNavbar />

        <section className="text-center mb-12 space-y-4">
          <p className="text-xs uppercase tracking-[0.5em] text-slate-500">System Status</p>
          <h1 className="text-4xl font-semibold text-slate-100 sm:text-5xl">Service Status</h1>
          {allOperational ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-aurora-500/30 bg-aurora-900/20 px-4 py-1.5 text-sm font-medium text-aurora-200">
              <span className="h-2 w-2 rounded-full bg-aurora-400 animate-pulse" />
              All systems operational
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-900/20 px-4 py-1.5 text-sm font-medium text-amber-200">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              Some systems affected
            </div>
          )}
          {globalMessage && (
            <p className="mt-3 text-sm text-slate-300 max-w-xl mx-auto">{globalMessage}</p>
          )}
        </section>

        <div className="glass rounded-2xl border border-slate-700/40 px-6 py-2 shadow-soft mb-6">
          {services.map((s) => (
            <ServiceRow key={s.name} service={s} />
          ))}
        </div>

        <div className="glass rounded-2xl border border-slate-700/40 p-6 shadow-soft mb-6">
          <h2 className="text-base font-semibold text-slate-200 mb-4">Incident History</h2>
          {INCIDENTS.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <CheckCircle2 className="h-4 w-4 text-aurora-400" />
              No incidents in the last 30 days.
            </div>
          ) : (
            <ul className="space-y-3">
              {INCIDENTS.map((incident, i) => (
                <li key={i} className="text-sm text-slate-300 border-b border-slate-800/40 pb-3 last:border-0">
                  <span className="font-medium">{incident.date}</span>
                  {" — "}{incident.message}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-end gap-1.5 text-xs text-slate-500">
          <RefreshCw className="h-3 w-3" />
          Page reflects live status. Refresh for latest data.
        </div>

        <footer className="mt-10 border-t border-slate-800/60 pt-6 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} AstraNodes. All rights reserved.
        </footer>
      </div>
    </div>
  )
}
