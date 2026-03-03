import { useState, useEffect, useRef } from "react"
import { Link, useLocation } from "react-router-dom"
import { io } from "socket.io-client"
import {
  Zap, ShieldCheck, Coins, Server, ArrowRight, Package, Sparkles,
  Star, Crown, Shield, Rocket, Gift, Gem, Trophy, Clock,
  Globe, Lock, Cpu, HardDrive, Wifi, LifeBuoy, Circle, Check, Menu, X
} from "lucide-react"
import Logo from "../components/Logo.jsx"
import { api } from "../services/api.js"

// ─── Icon map used for features ──────────────────────────────────────────────
const ICON_MAP = {
  Zap, ShieldCheck, Coins, Server, Package, Sparkles, Star, Crown,
  Shield, Rocket, Gift, Gem, Trophy, Clock, Globe, Lock, Cpu,
  HardDrive, Wifi, LifeBuoy, Circle, Check
}

function DynamicIcon({ name, className }) {
  const Icon = ICON_MAP[name] || Zap
  return <Icon className={className} />
}

// ─── Default fallback content (shown while loading) ─────────────────────────
const DEFAULTS = {
  hero: {
    title: "Powerful Minecraft hosting made simple",
    subtitle: "Deploy high-performance game servers in seconds with automatic renewals, flexible billing, and enterprise-grade security.",
    primaryButtonText: "Get Started Free",
    primaryButtonLink: "/register",
    secondaryButtonText: "View Plans",
    secondaryButtonLink: "/plans",
    backgroundImage: ""
  },
  features: [
    { title: "Auto-Renewal System", description: "Never worry about server downtime. Our intelligent renewal system keeps your servers running with a 12-hour grace period.", icon: "Zap" },
    { title: "Advanced Protection", description: "Enterprise-grade security with IP-based fraud detection, abuse prevention, and rate limiting built-in.", icon: "ShieldCheck" },
    { title: "Flexible Billing", description: "Pay with coins or balance. Earn coins through AFK time and track your spending in real-time.", icon: "Coins" },
    { title: "Full Server Control", description: "Complete server management powered by Pterodactyl Panel with secure API integration.", icon: "Server" }
  ],
  about: {
    heading: "Ready to scale your Minecraft network?",
    description: "Join thousands of server owners who trust us with their hosting needs."
  },
  stats: { activeServers: "500+", totalUsers: "1,200+", uptime: "99.9%" },
  footer: { text: `© ${new Date().getFullYear()} AstraNodes. All rights reserved.`, links: ["Privacy", "Terms", "Status"] }
}

// ─── Socket URL detection ────────────────────────────────────────────────────
function getSocketUrl() {
  if (import.meta.env.VITE_SOCKET_URL) return import.meta.env.VITE_SOCKET_URL
  if (window.location.hostname.includes("app.github.dev")) {
    return window.location.origin.replace("-5173.", "-4000.").replace(/\/api$/, "")
  }
  return "http://localhost:4000"
}

export default function Landing() {
  const [content, setContent] = useState(null)
  const [plans, setPlans] = useState([])
  const [loadingContent, setLoadingContent] = useState(true)
  const [loadingPlans, setLoadingPlans] = useState(true)
  const [liveStats, setLiveStats] = useState(null)
  const socketRef = useRef(null)
  const isLoggedIn = Boolean(localStorage.getItem("token"))
  const { pathname } = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  const NAV_LINKS = [
    { to: "/features", label: "Features" },
    { to: "/locations", label: "Locations" },
    { to: "/about", label: "About" },
    { to: "/status", label: "Status" },
    { to: "/knowledgebase", label: "Docs" },
    { to: "/contact", label: "Contact" },
  ]

  useEffect(() => {
    // Load initial data in parallel
    api.getFrontpage()
      .then(setContent)
      .catch(() => {})
      .finally(() => setLoadingContent(false))

    api.getLandingPlans()
      .then(setPlans)
      .catch(() => {})
      .finally(() => setLoadingPlans(false))

    api.getStats()
      .then(setLiveStats)
      .catch(() => {})

    // Real-time socket updates (polling first avoids WS race on strict-mode remount)
    const socket = io(getSocketUrl(), {
      transports: ["polling", "websocket"],
      reconnectionAttempts: 3,
      timeout: 5000
    })
    socketRef.current = socket

    socket.on("connect_error", () => {
      // Live updates unavailable — static content already loaded, no action needed
    })

    socket.on("frontpage:update", ({ section, data }) => {
      setContent((prev) => ({
        ...(prev || {}),
        [section]: { data }
      }))
    })

    socket.on("plans:update", (updatedPlans) => {
      setPlans(updatedPlans)
    })

    return () => socket.disconnect()
  }, [])

  // Resolve a section: use API content if available, else fallback defaults
  const resolve = (section) => {
    if (!content) return DEFAULTS[section]
    const s = content[section]
    return s?.data ?? s ?? DEFAULTS[section]
  }

  const hero = resolve("hero")
  const features = resolve("features")
  const about = resolve("about")
  const stats = resolve("stats")
  const footer = resolve("footer")

  return (
    <div className="min-h-screen bg-gradient-to-b from-dark-950 via-dark-900 to-dark-950">
      <div className="relative overflow-hidden">
        {hero.backgroundImage && (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-5 pointer-events-none"
            style={{ backgroundImage: `url(${hero.backgroundImage})` }}
          />
        )}
        
        <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-20 px-6 py-8">

          {/* ── Header ── */}
          <header className="sticky top-0 z-50 backdrop-blur-xl bg-dark-900/80 border-b border-white/5 -mx-6 px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <Logo size="lg" />
              <nav className="hidden md:flex items-center gap-1 text-sm">
                {NAV_LINKS.map(({ to, label }) => (
                  <Link
                    key={to}
                    to={to}
                    className={`px-4 py-2 rounded-lg transition-all font-medium ${
                      pathname === to
                        ? "text-white bg-white/10"
                        : "text-slate-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {label}
                  </Link>
                ))}
              </nav>
              <div className="hidden md:flex items-center gap-3 text-sm">
                {isLoggedIn ? (
                  <Link to="/dashboard" className="px-5 py-2.5 rounded-lg bg-primary-500 hover:bg-primary-600 text-white font-semibold transition-all">
                    Dashboard
                  </Link>
                ) : (
                  <>
                    <Link to="/login" className="px-4 py-2 text-slate-400 hover:text-white transition-colors font-medium">
                      Sign In
                    </Link>
                    <Link to={hero.primaryButtonLink || "/register"} className="px-5 py-2.5 rounded-lg bg-primary-500 hover:bg-primary-600 text-white font-semibold transition-all">
                      Get Started
                    </Link>
                  </>
                )}
              </div>
              <button
                onClick={() => setMobileOpen((o) => !o)}
                className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                aria-label="Toggle menu"
              >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
            {mobileOpen && (
              <div className="md:hidden mt-4 rounded-2xl border border-white/10 bg-dark-800/95 backdrop-blur-xl p-4 shadow-2xl">
                <nav className="flex flex-col gap-1 mb-4">
                  {NAV_LINKS.map(({ to, label }) => (
                    <Link
                      key={to}
                      to={to}
                      onClick={() => setMobileOpen(false)}
                      className={`px-4 py-3 rounded-xl text-sm transition-all font-medium ${
                        pathname === to
                          ? "bg-white/10 text-white"
                          : "text-slate-400 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      {label}
                    </Link>
                  ))}
                </nav>
                <div className="border-t border-white/10 pt-4 flex flex-col gap-2">
                  {isLoggedIn ? (
                    <Link to="/dashboard" onClick={() => setMobileOpen(false)} className="px-4 py-3 rounded-xl bg-primary-500 hover:bg-primary-600 text-center text-sm font-semibold text-white transition-all">
                      Dashboard
                    </Link>
                  ) : (
                    <>
                      <Link to="/login" onClick={() => setMobileOpen(false)} className="px-4 py-3 rounded-xl border border-white/10 text-center text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-all font-medium">
                        Sign In
                      </Link>
                      <Link to={hero.primaryButtonLink || "/register"} onClick={() => setMobileOpen(false)} className="px-4 py-3 rounded-xl bg-primary-500 hover:bg-primary-600 text-center text-sm font-semibold text-white transition-all">
                        Get Started
                      </Link>
                    </>
                  )}
                </div>
              </div>
            )}
          </header>

          {/* ── Hero ── */}
          <div className="grid items-center gap-12 lg:grid-cols-2 pt-12 lg:pt-20">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-500/10 border border-primary-500/20">
                <Sparkles className="h-4 w-4 text-primary-400" />
                <span className="text-sm font-medium text-primary-300">Trusted by 1,200+ server owners</span>
              </div>

              {loadingContent ? (
                <div className="space-y-4">
                  <div className="h-14 w-3/4 animate-pulse rounded-2xl bg-white/5" />
                  <div className="h-6 w-full animate-pulse rounded-xl bg-white/5" />
                  <div className="h-6 w-5/6 animate-pulse rounded-xl bg-white/5" />
                </div>
              ) : (
                <>
                  <h1 className="text-5xl lg:text-6xl font-bold text-white leading-tight">
                    {hero.title}
                  </h1>
                  <p className="text-xl text-slate-400 leading-relaxed max-w-2xl">
                    {hero.subtitle}
                  </p>
                </>
              )}

              <div className="flex flex-wrap gap-4">
                <Link
                  to={isLoggedIn ? "/dashboard" : (hero.primaryButtonLink || "/register")}
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-semibold text-lg transition-all hover:scale-105 active:scale-95 shadow-lg shadow-primary-500/25"
                >
                  {isLoggedIn ? "Go to Dashboard" : (hero.primaryButtonText || "Get Started Free")} 
                  <ArrowRight className="h-5 w-5" />
                </Link>
                <Link
                  to={hero.secondaryButtonLink || "/plans"}
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold text-lg transition-all"
                >
                  {hero.secondaryButtonText || "View Plans"}
                </Link>
              </div>

              {/* Stats row */}
              <div className="flex flex-wrap gap-8 pt-4">
                <div>
                  <p className="text-4xl font-bold text-white">{liveStats?.activeServers ?? stats.activeServers ?? "500+"}</p>
                  <p className="text-sm text-slate-400 mt-1">Active servers</p>
                </div>
                <div>
                  <p className="text-4xl font-bold text-white">{liveStats?.totalUsers ?? stats.totalUsers ?? "1,200+"}</p>
                  <p className="text-sm text-slate-400 mt-1">Happy users</p>
                </div>
                <div>
                  <p className="text-4xl font-bold text-white">{stats.uptime || "99.9%"}</p>
                  <p className="text-sm text-slate-400 mt-1">Uptime</p>
                </div>
              </div>
            </div>

            {/* Preview card */}
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-primary-500/20 to-accent-500/20 rounded-3xl blur-3xl" />
              <div className="relative rounded-3xl border border-white/10 bg-dark-800/50 backdrop-blur-xl p-8 shadow-2xl">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-400">Server Dashboard</span>
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                      <span className="text-xs text-slate-500">Live</span>
                    </div>
                  </div>
                  
                  <div className="space-y-4 rounded-2xl border border-white/10 bg-dark-900/80 p-6">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">Coin balance</span>
                      <Coins className="h-5 w-5 text-accent-400" />
                    </div>
                    <p className="text-5xl font-bold bg-gradient-to-r from-accent-400 to-primary-400 bg-clip-text text-transparent">
                      12,480
                    </p>
                    <div className="flex items-center justify-between text-sm pt-2 border-t border-white/5">
                      <span className="text-slate-400">Earning rate</span>
                      <span className="text-white font-medium">1 coin/min</span>
                    </div>
                  </div>
                  
                  <div className="grid gap-3">
                    {[
                      ["Active servers", liveStats?.activeServers ?? stats.activeServers ?? "—", Server],
                      ["Total users", liveStats?.totalUsers ?? stats.totalUsers ?? "—", Globe],
                      ["Network uptime", stats.uptime || "99.9%", Zap]
                    ].map(([label, val, Icon]) => (
                      <div key={label} className="flex items-center justify-between rounded-xl border border-white/5 bg-dark-900/60 px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <Icon className="h-4 w-4 text-slate-500" />
                          <span className="text-sm text-slate-400">{label}</span>
                        </div>
                        <span className="text-sm font-semibold text-white">{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Features ── */}
          <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {loadingContent
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-48 animate-pulse rounded-2xl bg-white/5" />
                ))
              : (Array.isArray(features) ? features : []).map((feature, i) => (
                  <div key={i} className="group rounded-2xl border border-white/10 bg-dark-800/50 backdrop-blur-sm p-6 hover:border-primary-500/30 hover:bg-dark-800/80 transition-all">
                    <div className="h-12 w-12 rounded-xl bg-primary-500/10 flex items-center justify-center mb-4 group-hover:bg-primary-500/20 transition-all">
                      <DynamicIcon name={feature.icon} className="h-6 w-6 text-primary-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                    <p className="text-sm text-slate-400 leading-relaxed">{feature.description}</p>
                  </div>
                ))}
          </section>

          {/* ── Landing Plans ── */}
          {(loadingPlans || plans.length > 0) && (
            <section className="space-y-12">
              <div className="text-center space-y-4">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-500/10 border border-primary-500/20 mx-auto">
                  <Package className="h-4 w-4 text-primary-400" />
                  <span className="text-sm font-semibold text-primary-300">Pricing</span>
                </div>
                <h2 className="text-4xl lg:text-5xl font-bold text-white">Choose your plan</h2>
                <p className="text-lg text-slate-400 max-w-xl mx-auto">Simple, transparent pricing. No hidden fees.</p>
              </div>

              {loadingPlans ? (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-80 animate-pulse rounded-3xl bg-white/5" />
                  ))}
                </div>
              ) : (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {plans.map((plan) => (
                    <div
                      key={plan.id}
                      className={`card-3d group relative rounded-3xl border p-8 backdrop-blur-sm transition-all duration-300 ${
                        plan.popular
                          ? "border-primary-500/50 bg-gradient-to-b from-primary-500/10 to-dark-800/50 shadow-lg shadow-primary-500/20"
                          : "border-white/10 bg-dark-800/50 hover:border-white/20"
                      }`}
                    >
                      {/* Glow on hover */}
                      <div className={`absolute -inset-0.5 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl -z-10 ${
                        plan.popular ? "bg-gradient-to-r from-primary-500/20 to-accent-500/20" : "bg-white/5"
                      }`} />
                      
                      {plan.popular && (
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                          <span className="flex items-center gap-1.5 rounded-full border border-primary-500/50 bg-gradient-to-r from-primary-500 to-primary-600 px-4 py-1.5 text-xs font-bold text-white shadow-lg shadow-primary-500/25 animate-pulse-glow">
                            <Star className="h-3.5 w-3.5 fill-white" /> Most Popular
                          </span>
                        </div>
                      )}
                      <div className="space-y-6">
                        <div>
                          <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                          <div className="flex items-baseline gap-2">
                            <span className={`text-4xl font-extrabold ${plan.popular ? "text-gradient" : "text-white"}`}>₹{plan.price}</span>
                            <span className="text-slate-500 font-medium">/month</span>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            ["RAM", `${plan.ram} GB`, Cpu], 
                            ["CPU", `${plan.cpu}`, HardDrive], 
                            ["Storage", `${plan.storage} GB`, Server]
                          ].map(([label, value, Icon]) => (
                            <div key={label} className="rounded-xl bg-dark-900/60 border border-white/5 px-3 py-3 text-center group-hover:border-white/10 transition-colors">
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
                                <Check className="h-4 w-4 flex-shrink-0 text-primary-400 mt-0.5" />
                                <span>{f}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        
                        <Link
                          to={isLoggedIn ? "/plans" : "/register"}
                          className={`glow-ring button-3d flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold transition-all duration-200 ${
                            plan.popular
                              ? "bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-glow-primary hover:shadow-lg hover:shadow-primary-500/30"
                              : "bg-white/5 hover:bg-white/10 border border-white/10 text-white hover:border-white/20"
                          }`}
                        >
                          {isLoggedIn ? "Select Plan" : "Get Started"} <ArrowRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ── About / CTA ── */}
          <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-primary-500/10 via-dark-800/50 to-accent-500/10 backdrop-blur-sm p-12 lg:p-16">
            <div className="absolute top-0 right-0 w-96 h-96 bg-primary-500/20 rounded-full blur-3xl -z-10 animate-bounce-slow" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent-500/20 rounded-full blur-3xl -z-10" />
            <div className="relative flex flex-col lg:flex-row items-center justify-between gap-8">
              <div className="text-center lg:text-left max-w-2xl">
                <h2 className="text-4xl lg:text-5xl font-bold text-white mb-4">{about.heading}</h2>
                <p className="text-lg text-slate-300">{about.description}</p>
              </div>
              <Link
                to={isLoggedIn ? "/dashboard" : "/register"}
                className="glow-ring button-3d flex-shrink-0 inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-white text-dark-900 hover:bg-slate-100 font-bold text-lg transition-all shadow-xl hover:shadow-2xl"
              >
                {isLoggedIn ? "Go to Dashboard" : "Start Building"} <ArrowRight className="h-5 w-5" />
              </Link>
            </div>
          </section>

          {/* ── Footer ── */}
          <footer className="border-t border-white/10 pt-12 pb-8 space-y-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <div className="col-span-2">
                <Logo size="lg" />
                <p className="mt-4 text-sm text-slate-400 max-w-xs">
                  High-performance Minecraft hosting with intelligent automation and enterprise security.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-white mb-4">Product</h4>
                <ul className="space-y-2 text-sm text-slate-400">
                  <li><Link to="/plans" className="hover:text-white transition-colors">Plans</Link></li>
                  <li><Link to="/features" className="hover:text-white transition-colors">Features</Link></li>
                  <li><Link to="/locations" className="hover:text-white transition-colors">Locations</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-white mb-4">Support</h4>
                <ul className="space-y-2 text-sm text-slate-400">
                  <li><Link to="/knowledgebase" className="hover:text-white transition-colors">Docs</Link></li>
                  <li><Link to="/contact" className="hover:text-white transition-colors">Contact</Link></li>
                  <li><Link to="/status" className="hover:text-white transition-colors">Status</Link></li>
                </ul>
              </div>
            </div>
            
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8 border-t border-white/10">
              <p className="text-sm text-slate-500">{footer.text}</p>
              <div className="flex items-center gap-6 text-sm text-slate-500">
                {(Array.isArray(footer.links) ? footer.links : ["Privacy", "Terms", "Status"]).map((link) => (
                  <Link key={link} to={`/${link.toLowerCase()}`} className="hover:text-white transition-colors">{link}</Link>
                ))}
              </div>
            </div>
          </footer>

        </div>
      </div>
    </div>
  )
}

