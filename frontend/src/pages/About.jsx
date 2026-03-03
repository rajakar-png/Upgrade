import { Link } from "react-router-dom"
import { useState, useEffect } from "react"
import { Users, Cpu, Globe, Zap, ShieldCheck, HeartHandshake } from "lucide-react"
import PublicNavbar from "../components/PublicNavbar.jsx"
import { api } from "../services/api.js"

const STAT_ICONS = [Cpu, Globe, Zap, Users]
const STAT_COLORS = ["text-neon-300", "text-aurora-300", "text-amber-300", "text-neon-300"]
const VALUE_ICONS = [ShieldCheck, Zap, HeartHandshake]
const VALUE_COLORS = ["text-neon-300", "text-amber-300", "text-aurora-300"]
const VALUE_BGS = ["bg-neon-500/10", "bg-amber-500/10", "bg-aurora-500/10"]

const DEFAULT_DATA = {
  heading: "Built by players, <span>for players</span>",
  subheading: "AstraNodes was founded with one mission: deliver premium Minecraft hosting that is fast, reliable, and within reach of every community — from small friend groups to large public networks.",
  stats: [
    { label: "Servers Active", value: "1,000+" },
    { label: "Countries Served", value: "20+" },
    { label: "Uptime", value: "99.9%" },
    { label: "Satisfied Players", value: "50k+" }
  ],
  storyTitle: "How it started",
  storyText: "AstraNodes started as a small passion project — a group of developers who were tired of expensive, unreliable hosting and slow support tickets. We pooled resources, built our own infrastructure, and opened it to the community.",
  storyText2: "Today we run dedicated bare-metal servers across multiple regions with a fully automated provisioning stack powered by Pterodactyl. Servers go live in seconds, not hours.",
  storyText3: "Our earn-coins system and free tier make it possible for anyone to run a server — even without a credit card. We believe every player deserves quality hosting.",
  values: [
    { title: "Security First", description: "Enterprise DDoS protection, sandboxed containers, and 24/7 threat monitoring keep your server safe." },
    { title: "Blazing Performance", description: "NVMe SSD storage, high-clock CPUs, and optimised JVM flags ensure minimal TPS drops even under load." },
    { title: "Community Driven", description: "We listen to our players and community members. Every major feature ships based on real user feedback." }
  ]
}

export default function About() {
  const [data, setData] = useState(DEFAULT_DATA)

  useEffect(() => {
    api.getFrontpage()
      .then((res) => {
        const section = res?.about_page?.data
        if (section && typeof section === "object") setData({ ...DEFAULT_DATA, ...section })
      })
      .catch(() => {})
  }, [])

  return (
    <div className="min-h-screen bg-dark-950 text-slate-100 animate-fade-in">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <PublicNavbar />

        <section className="text-center mb-16 space-y-4">
          <p className="text-xs uppercase tracking-[0.5em] text-slate-500">Our Story</p>
          <h1 className="text-4xl font-semibold text-slate-100 sm:text-5xl">
            {(data.heading || DEFAULT_DATA.heading).split('<span>').map((part, i) => 
              i === 0 ? part : <span key={i} className="text-aurora-200">{part.replace('</span>', '')}</span>
            )}
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-slate-400">
            {data.subheading}
          </p>
        </section>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-16">
          {(data.stats || DEFAULT_DATA.stats).map(({ label, value }, i) => {
            const Icon = STAT_ICONS[i % STAT_ICONS.length]
            const col = STAT_COLORS[i % STAT_COLORS.length]
            return (
              <div key={label} className="glass rounded-2xl border border-slate-700/40 p-5 text-center shadow-soft">
                <Icon className={`mx-auto mb-2 h-5 w-5 ${col}`} />
                <div className="text-2xl font-bold text-slate-100">{value}</div>
                <div className="text-xs text-slate-400 mt-1">{label}</div>
              </div>
            )
          })}
        </div>

        <section className="mb-16 glass rounded-2xl border border-slate-700/40 p-8 shadow-soft text-slate-300 leading-relaxed space-y-4">
          <h2 className="text-xl font-semibold text-slate-100">{data.storyTitle}</h2>
          <p>{data.storyText}</p>
          <p>{data.storyText2}</p>
          {data.storyText3 && <p>{data.storyText3}</p>}
        </section>

        <section className="mb-16">
          <h2 className="mb-6 text-xl font-semibold text-slate-100 text-center">Our values</h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {(data.values || DEFAULT_DATA.values).map(({ title, description }, i) => {
              const Icon = VALUE_ICONS[i % VALUE_ICONS.length]
              return (
                <div key={title} className="glass rounded-2xl border border-slate-700/40 p-6 shadow-soft">
                  <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl ${VALUE_BGS[i % VALUE_BGS.length]}`}>
                    <Icon className={`h-5 w-5 ${VALUE_COLORS[i % VALUE_COLORS.length]}`} />
                  </div>
                  <h3 className="mb-1.5 font-semibold text-slate-100">{title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{description}</p>
                </div>
              )
            })}
          </div>
        </section>

        <div className="text-center glass rounded-2xl border border-slate-700/40 p-10 shadow-soft space-y-4">
          <h2 className="text-2xl font-semibold text-slate-100">Ready to join us?</h2>
          <p className="text-slate-400">Start your free server in under 60 seconds.</p>
          <Link
            to="/register"
            className="button-3d inline-flex items-center gap-2 rounded-xl bg-neon-500/20 border border-neon-500/30 px-6 py-3 font-semibold text-neon-200 hover:bg-neon-500/30 transition-colors"
          >
            Create Free Account
          </Link>
        </div>

        <footer className="mt-12 border-t border-slate-800/60 pt-6 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} AstraNodes. All rights reserved.
        </footer>
      </div>
    </div>
  )
}
