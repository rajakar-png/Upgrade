import { Outlet, Link } from "react-router-dom"
import { ShieldCheck, Zap, Globe, Lock, ArrowUpRight } from "lucide-react"
import Logo from "../components/Logo.jsx"
import Card from "../components/ui/Card.jsx"
import ErrorBoundary from "../components/ErrorBoundary.jsx"

const highlights = [
  {
    icon: Zap,
    title: "Fast setup",
    description: "Launch your hosting stack in under a minute."
  },
  {
    icon: ShieldCheck,
    title: "Protected by default",
    description: "Built-in safety checks and abuse protection."
  },
  {
    icon: Globe,
    title: "Always connected",
    description: "Live updates keep your dashboard in sync."
  },
  {
    icon: Lock,
    title: "Secure sign-in",
    description: "Modern OAuth flow with reliable session handling."
  }
]

export default function AuthLayout() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-dark-950 text-slate-100">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_15%,rgba(99,102,241,0.18),transparent_38%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_80%,rgba(20,184,166,0.10),transparent_42%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.02),transparent_45%,rgba(255,255,255,0.02))]" />
      </div>

      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-8 lg:py-12">
        <header className="mb-10 flex items-center justify-between">
          <Link to="/" className="group inline-flex items-center gap-3">
            <Logo size="lg" />
            <span className="hidden text-sm font-semibold text-slate-300 transition-colors group-hover:text-white sm:block">
              AstraNodes Cloud
            </span>
          </Link>

          <Link
            to="/pricing"
            className="inline-flex items-center gap-1.5 rounded-xl border border-dark-700/60 bg-dark-800/55 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-dark-700/60"
          >
            View pricing
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </header>

        <div className="grid flex-1 items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="space-y-7">
            <div className="space-y-4">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary-500/25 bg-primary-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-primary-300">
                SaaS Control Center
              </span>
              <h1 className="max-w-xl text-4xl font-bold leading-tight text-white sm:text-5xl">
                Welcome to your hosting command dashboard.
              </h1>
              <p className="max-w-xl text-base leading-relaxed text-slate-400">
                Sign in to manage servers, monitor activity in real time, and keep billing under control from one clean workspace.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {highlights.map((item) => (
                <Card key={item.title} className="p-4">
                  <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-primary-500/20 bg-primary-500/10 text-primary-300">
                    <item.icon className="h-4 w-4" />
                  </div>
                  <h2 className="text-sm font-semibold text-white">{item.title}</h2>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">{item.description}</p>
                </Card>
              ))}
            </div>
          </section>

          <section className="relative">
            <div className="absolute -inset-2 rounded-3xl bg-gradient-to-r from-primary-500/20 via-accent-500/15 to-primary-500/20 blur-2xl" />
            <Card className="relative rounded-3xl p-7 sm:p-10">
              <ErrorBoundary>
                <Outlet />
              </ErrorBoundary>
            </Card>
          </section>
        </div>
      </div>
    </div>
  )
}
