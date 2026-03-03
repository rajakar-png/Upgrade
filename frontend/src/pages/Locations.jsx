import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { MapPin, Zap, Shield, Wifi, ArrowRight } from "lucide-react"
import PublicNavbar from "../components/PublicNavbar.jsx"
import { api } from "../services/api.js"

const LOCATIONS = [
  {
    flag: "🇮🇳",
    city: "Mumbai",
    country: "India",
    latency: "~5 ms",
    status: "operational",
    features: ["NVMe SSD", "1 Gbps uplink", "DDoS Protection"]
  },
  {
    flag: "🇸🇬",
    city: "Singapore",
    country: "Singapore",
    latency: "~35 ms",
    status: "operational",
    features: ["NVMe SSD", "1 Gbps uplink", "DDoS Protection"]
  },
  {
    flag: "🇩🇪",
    city: "Frankfurt",
    country: "Germany",
    latency: "~120 ms",
    status: "operational",
    features: ["NVMe SSD", "10 Gbps uplink", "DDoS Protection"]
  },
  {
    flag: "🇺🇸",
    city: "New York",
    country: "United States",
    latency: "~180 ms",
    status: "coming-soon",
    features: ["NVMe SSD", "10 Gbps uplink", "DDoS Protection"]
  }
]

function StatusBadge({ status }) {
  if (status === "operational") {
    return (
      <span className="flex items-center gap-1.5 rounded-full border border-aurora-500/30 bg-aurora-900/30 px-2.5 py-0.5 text-xs font-medium text-aurora-200">
        <span className="h-1.5 w-1.5 rounded-full bg-aurora-400 animate-pulse" />
        Operational
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-900/30 px-2.5 py-0.5 text-xs font-medium text-amber-200">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
      Coming Soon
    </span>
  )
}

export default function Locations() {
  const [locations, setLocations] = useState(LOCATIONS)

  useEffect(() => {
    api.getFrontpage()
      .then((data) => {
        const section = data?.locations_page?.data
        if (Array.isArray(section) && section.length > 0) setLocations(section)
      })
      .catch(() => {})
  }, [])

  return (
    <div className="min-h-screen bg-dark-950 text-slate-100 animate-fade-in">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <PublicNavbar />

        <section className="text-center mb-16 space-y-4">
          <p className="text-xs uppercase tracking-[0.5em] text-slate-500">Infrastructure</p>
          <h1 className="text-4xl font-semibold text-slate-100 sm:text-5xl">
            Global server <span className="text-aurora-200">locations</span>
          </h1>
          <p className="mx-auto max-w-xl text-lg text-slate-400">
            Deploy your Minecraft server close to your players for the lowest possible latency.
          </p>
        </section>

        <div className="grid gap-6 sm:grid-cols-2">
          {locations.map((loc) => (
            <div
              key={loc.city}
              className={`glass rounded-2xl border p-6 shadow-soft transition-transform hover:-translate-y-0.5 ${
                loc.status === "coming-soon" ? "border-slate-800/60 opacity-70" : "border-slate-700/40"
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{loc.flag}</span>
                  <div>
                    <h3 className="text-base font-semibold text-slate-100">{loc.city}</h3>
                    <p className="text-xs text-slate-400">{loc.country}</p>
                  </div>
                </div>
                <StatusBadge status={loc.status} />
              </div>

              <div className="flex items-center gap-2 mb-4 text-sm text-slate-300">
                <Zap className="h-4 w-4 text-amber-300" />
                <span>Avg. latency from India: <strong className="text-amber-200">{loc.latency}</strong></span>
              </div>

              <ul className="space-y-1.5">
                {loc.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-400">
                    <span className="h-1 w-1 rounded-full bg-neon-400" />
                    {f}
                  </li>
                ))}
              </ul>

              {loc.status === "operational" && (
                <Link
                  to="/register"
                  className="button-3d mt-5 flex items-center justify-center gap-2 rounded-xl border border-slate-700/60 py-2 text-sm font-semibold text-slate-300 hover:border-neon-500/30 hover:text-neon-200"
                >
                  Deploy Here <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          ))}
        </div>

        <div className="mt-10 glass rounded-2xl border border-slate-700/40 p-6 text-sm text-slate-400 space-y-2">
          <div className="flex items-center gap-2 text-slate-300 font-semibold">
            <Shield className="h-4 w-4 text-neon-300" />
            All locations include DDoS protection
          </div>
          <p>Enterprise-grade DDoS mitigation is included with every plan at no additional cost. Attacks are filtered before reaching your server.</p>
        </div>

        <footer className="mt-12 border-t border-slate-800/60 pt-6 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} AstraNodes. All rights reserved.
        </footer>
      </div>
    </div>
  )
}
