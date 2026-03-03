import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import Topbar from "../components/Topbar.jsx"
import { api } from "../services/api.js"
import { Coins, Wallet, Server, Plus, ArrowRight, Sparkles } from "lucide-react"

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const [servers, setServers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const navigate = useNavigate()

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) {
      navigate("/login")
      return
    }

    loadData()
  }, [navigate])

  const loadData = async () => {
    try {
      const token = localStorage.getItem("token")
      const userData = JSON.parse(localStorage.getItem("user") || "{}")
      const balance = await api.getBalance(token)
      const userServers = await api.getUserServers(token)

      setUser({ ...userData, ...balance })
      setServers(userServers || [])
    } catch (err) {
      console.error(err)
      setError(err.message || "Failed to load dashboard data")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
          <p className="text-slate-400 text-sm">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  const userName = user?.username || "User"
  const activeServers = servers.filter((s) => s.status === "active").length

  return (
    <div className="space-y-8 pb-16">
      <Topbar />
      
      {/* Welcome Section */}
      <section className="relative rounded-2xl p-8 border border-white/10 bg-dark-800/60 backdrop-blur-sm overflow-hidden animate-fade-in">
        {/* Decorative gradient */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-primary-500/10 to-transparent rounded-full blur-3xl -z-10" />
        <div className="flex items-center gap-3 mb-2">
          <Sparkles className="h-5 w-5 text-primary-400" />
          <span className="text-xs font-semibold text-primary-400 uppercase tracking-wider">Dashboard</span>
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">
          Welcome back, <span className="text-gradient">{userName}</span>
        </h1>
        <p className="text-slate-400">
          Manage your servers, track your balance, and monitor your account.
        </p>
      </section>

      {/* Stats Cards */}
      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[
          {
            icon: Coins,
            label: "Coins",
            value: user?.coins?.toLocaleString() || "0",
            desc: "Available for purchases",
            color: "primary",
            gradient: "from-primary-500/10 to-primary-500/5"
          },
          {
            icon: Wallet,
            label: "Balance",
            value: `₹${(user?.balance || 0).toFixed(2)}`,
            desc: "Account balance",
            color: "accent",
            gradient: "from-accent-500/10 to-accent-500/5"
          },
          {
            icon: Server,
            label: "Active servers",
            value: activeServers,
            desc: "Currently running",
            color: "emerald",
            gradient: "from-emerald-500/10 to-emerald-500/5"
          }
        ].map(({ icon: Icon, label, value, desc, color, gradient }) => (
          <div key={label} className="card-3d group relative rounded-2xl p-6 border border-white/10 bg-dark-800/60 backdrop-blur-sm overflow-hidden">
            {/* Glow on hover */}
            <div className={`absolute -inset-0.5 rounded-2xl bg-gradient-to-r ${gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10 blur-xl`} />
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2.5 rounded-xl ${
                color === "primary" ? "bg-primary-500/10 text-primary-400" :
                color === "accent" ? "bg-accent-500/10 text-accent-400" :
                "bg-emerald-500/10 text-emerald-400"
              }`}>
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">{label}</h3>
            </div>
            <p className="text-3xl font-extrabold text-white mb-1">{value}</p>
            <p className="text-sm text-slate-500">{desc}</p>
          </div>
        ))}
      </section>

      {/* Quick Actions */}
      <section className="relative rounded-2xl p-8 border border-white/10 bg-dark-800/60 backdrop-blur-sm">
        <h2 className="text-xl font-bold text-white mb-5">Quick actions</h2>
        <div className="flex flex-wrap gap-4">
          <button
            onClick={() => navigate("/plans")}
            className="glow-ring button-3d px-6 py-3.5 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white rounded-xl font-bold transition-all shadow-glow-primary hover:shadow-lg hover:shadow-primary-500/30 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create server
          </button>
          <button
            onClick={() => navigate("/coins")}
            className="button-3d px-6 py-3.5 bg-dark-900/80 hover:bg-dark-700/80 text-slate-200 rounded-xl font-semibold border border-white/10 hover:border-white/20 transition-all flex items-center gap-2"
          >
            <Coins className="w-4 h-4 text-primary-400" />
            Add funds
          </button>
          <button
            onClick={() => navigate("/servers")}
            className="button-3d px-6 py-3.5 bg-dark-900/80 hover:bg-dark-700/80 text-slate-200 rounded-xl font-semibold border border-white/10 hover:border-white/20 transition-all flex items-center gap-2"
          >
            <Server className="w-4 h-4 text-accent-400" />
            View all servers
          </button>
        </div>
      </section>

      {/* Recent Servers */}
      <section className="space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Your servers</h2>
          {servers.length > 0 && (
            <button
              onClick={() => navigate("/servers")}
              className="text-primary-400 hover:text-primary-300 text-sm font-semibold transition-colors flex items-center gap-1"
            >
              View all
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {servers.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {servers.slice(0, 4).map((server) => (
              <div
                key={server.id}
                className="card-3d group relative rounded-2xl p-6 border border-white/10 bg-dark-800/60 backdrop-blur-sm cursor-pointer overflow-hidden"
                onClick={() => navigate(`/servers/${server.id}/manage`)}
              >
                <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-primary-500/5 to-accent-500/5 opacity-0 group-hover:opacity-100 transition-opacity -z-10 blur-xl" />
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white group-hover:text-primary-400 transition-colors">{server.name}</h3>
                    <p className="text-sm text-slate-500">{server.plan}</p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      server.status === "active"
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                        : server.status === "suspended"
                        ? "bg-yellow-500/15 text-yellow-400 border border-yellow-500/20"
                        : "bg-slate-500/15 text-slate-400 border border-slate-500/20"
                    }`}
                  >
                    {server.status === "active" && "● "}
                    {server.status.charAt(0).toUpperCase() + server.status.slice(1)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500 text-xs uppercase tracking-wider font-semibold mb-1">Plan</p>
                    <p className="text-white font-medium">{server.plan}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs uppercase tracking-wider font-semibold mb-1">Identifier</p>
                    <p className="text-white font-medium font-mono text-xs">{server.identifier || "N/A"}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-dark-800/60 backdrop-blur-sm p-12 text-center">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-white/5 mb-5">
              <Server className="w-8 h-8 text-slate-500" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">No servers yet</h3>
            <p className="text-slate-400 mb-6">Create your first server to get started.</p>
            <button
              onClick={() => navigate("/plans")}
              className="glow-ring button-3d px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl font-bold transition-all shadow-glow-primary"
            >
              Browse plans
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
