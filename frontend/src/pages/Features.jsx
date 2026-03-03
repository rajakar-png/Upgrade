import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { Zap, ShieldCheck, Coins, Server, Globe, Cpu, HardDrive, Clock, Lock, LifeBuoy, ArrowRight, Wifi, Shield, Rocket, Gift, Gem, Star } from "lucide-react"
import PublicNavbar from "../components/PublicNavbar.jsx"
import { api } from "../services/api.js"

const ICON_MAP = { Zap, ShieldCheck, Coins, Server, Globe, Cpu, HardDrive, Clock, Lock, LifeBuoy, Wifi, Shield, Rocket, Gift, Gem, Star }

const DEFAULTS = [
  { icon: "Zap", title: "Automated Renewal", description: "Servers renew automatically from your coin wallet. 12-hour grace period protects active sessions from unexpected expiry.", color: "text-amber-300" },
  { icon: "ShieldCheck", title: "Anti-Abuse Core", description: "IP-address coupon validation, per-user limits, account flagging, and rate-limited API endpoints protect the platform from misuse.", color: "text-aurora-300" },
  { icon: "Coins", title: "Coin Economy", description: "Earn coins passively through AFK sessions. Redeem vouchers for bonus coins. Use coins to purchase and renew servers.", color: "text-neon-300" },
  { icon: "Server", title: "Pterodactyl Integration", description: "Full server lifecycle management via the Pterodactyl Admin API. Provisioning, suspension, and deletion are handled automatically.", color: "text-ember-300" },
  { icon: "Globe", title: "Smart Node Selection", description: "Our backend automatically selects the best available Pterodactyl node based on resource availability at time of purchase.", color: "text-neon-400" },
  { icon: "Cpu", title: "Flexible Resources", description: "Choose plans ranging from starter to enterprise. Customizable RAM, CPU cores, and storage to fit any Minecraft use case.", color: "text-aurora-400" },
  { icon: "HardDrive", title: "NVMe Storage", description: "All servers run on NVMe SSD storage for ultra-fast world loading and minimal chunk lag, even on busy servers.", color: "text-slate-300" },
  { icon: "Clock", title: "Flexible Billing Cycles", description: "Weekly, monthly, or custom duration plans. One-time purchase plans also available for event servers.", color: "text-amber-400" },
  { icon: "Lock", title: "Secure Auth", description: "JWT-based authentication, bcrypt-hashed passwords, and no password hashes ever exposed in API responses.", color: "text-red-300" },
  { icon: "LifeBuoy", title: "Support Tickets", description: "Built-in ticket system with image attachment support, real-time status updates, and admin reply workflow.", color: "text-aurora-300" },
]

export default function Features() {
  const [features, setFeatures] = useState(DEFAULTS)

  useEffect(() => {
    api.getFrontpage()
      .then((data) => {
        const section = data?.features_page?.data
        if (Array.isArray(section) && section.length > 0) setFeatures(section)
      })
      .catch(() => {})
  }, [])

  return (
    <div className="min-h-screen bg-dark-950 text-slate-100 animate-fade-in">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <PublicNavbar />

        <section className="text-center mb-16 space-y-4">
          <p className="text-xs uppercase tracking-[0.5em] text-slate-500">Platform</p>
          <h1 className="text-4xl font-semibold text-slate-100 sm:text-5xl">
            Everything you need to<br />
            <span className="text-neon-200">run Minecraft infrastructure</span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-slate-400">
            AstraNodes is built from the ground up for Minecraft hosting. Every feature is designed to make provisioning, billing, and maintenance seamless.
          </p>
        </section>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, idx) => {
            const Icon = ICON_MAP[feature.icon] || Zap
            return (
              <div
                key={idx}
                className="glass rounded-2xl border border-slate-700/40 p-6 shadow-soft hover:-translate-y-0.5 transition-transform duration-200"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700/50 bg-ink-900/80 mb-4">
                  <Icon className={`h-5 w-5 ${feature.color}`} />
                </div>
                <h3 className="text-base font-semibold text-slate-100">{feature.title}</h3>
                <p className="mt-2 text-sm text-slate-400 leading-relaxed">{feature.description}</p>
              </div>
            )
          })}
        </div>

        <div className="mt-16 glass rounded-3xl border border-slate-700/40 p-10 text-center space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">Ready to get started?</h2>
          <p className="text-slate-400">Deploy your first Minecraft server in under 60 seconds.</p>
          <Link
            to="/register"
            className="button-3d inline-flex items-center gap-2 rounded-xl bg-neon-500/20 border border-neon-500/30 px-6 py-3 text-sm font-semibold text-neon-200 hover:bg-neon-500/30"
          >
            Create Account <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <footer className="mt-12 border-t border-slate-800/60 pt-6 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} AstraNodes. All rights reserved.
        </footer>
      </div>
    </div>
  )
}
