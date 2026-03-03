import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import Topbar from "../components/Topbar.jsx"
import { api } from "../services/api.js"
import { useAppUI } from "../context/AppUIContext.jsx"
import { Server, Search, AlertCircle, Clock, Plus, ArrowRight, Copy, RefreshCw, Settings } from "lucide-react"

export default function MyServers() {
  const [servers, setServers] = useState([])
  const [loading, setLoading] = useState(true)
  const [renewing, setRenewing] = useState({})
  const [countdowns, setCountdowns] = useState({})
  const [searchQuery, setSearchQuery] = useState("")
  const navigate = useNavigate()
  const { showSuccess, showError } = useAppUI()

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) {
      navigate("/login")
      return
    }

    const loadServers = async () => {
      try {
        const data = await api.getUserServers(token)
        setServers(data || [])
      } catch (err) {
        showError(err.message || "Failed to load servers.")
      } finally {
        setLoading(false)
      }
    }

    loadServers()
  }, [navigate, showError])

  useEffect(() => {
    const interval = setInterval(() => {
      const newCountdowns = {}
      servers.forEach((server) => {
        if (server.expires_at) {
          const expiryTime = new Date(server.expires_at).getTime()
          const now = Date.now()
          const diff = expiryTime - now

          if (diff <= 0) {
            newCountdowns[server.id] = "Expired"
          } else {
            const days = Math.floor(diff / (1000 * 60 * 60 * 24))
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

            if (days > 0) {
              newCountdowns[server.id] = `${days}d ${hours}h`
            } else if (hours > 0) {
              newCountdowns[server.id] = `${hours}h ${minutes}m`
            } else {
              newCountdowns[server.id] = `${minutes}m`
            }
          }
        }

        if (server.grace_expires_at) {
          const graceTime = new Date(server.grace_expires_at).getTime()
          const now = Date.now()
          const diff = graceTime - now

          if (diff <= 0) {
            newCountdowns[`grace-${server.id}`] = "Grace expired"
          } else {
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
            newCountdowns[`grace-${server.id}`] = `${hours}h ${minutes}m`
          }
        }
      })
      setCountdowns(newCountdowns)
    }, 1000)

    return () => clearInterval(interval)
  }, [servers])

  const handleRenew = async (serverId) => {
    setRenewing((prev) => ({ ...prev, [serverId]: true }))

    try {
      const token = localStorage.getItem("token")
      await api.renewServer(token, serverId)
      showSuccess("Server renewed successfully.")

      const data = await api.getUserServers(token)
      setServers(data || [])
    } catch (err) {
      showError(err.message || "Failed to renew server.")
    } finally {
      setRenewing((prev) => ({ ...prev, [serverId]: false }))
    }
  }

  const filteredServers = servers.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.identifier?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-16 animate-fade-in">
      <Topbar />

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">My servers</h1>
          <p className="text-slate-400">Manage and monitor your active servers.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-400 w-5 h-5 transition-colors" />
            <input
              type="text"
              placeholder="Search servers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-72 bg-dark-800/80 backdrop-blur-sm border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500/50 transition-all"
            />
          </div>
          
          <button
            onClick={() => navigate("/plans")}
            className="glow-ring button-3d px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-400 hover:to-primary-500 text-white rounded-xl font-semibold flex items-center justify-center gap-2 shadow-glow-primary transition-all"
          >
            <Plus className="w-5 h-5" />
            Create server
          </button>
        </div>
      </div>

      {/* Servers List */}
      {filteredServers.length === 0 ? (
        <div className="bg-dark-800/60 backdrop-blur-sm rounded-2xl border border-white/10 p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center mx-auto mb-5">
            <Server className="w-8 h-8 text-primary-400" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">
            {searchQuery ? "No servers found" : "No servers yet"}
          </h3>
          <p className="text-slate-400 mb-8 max-w-sm mx-auto">
            {searchQuery
              ? "Try adjusting your search query."
              : "Create your first server to get started with hosting."}
          </p>
          {!searchQuery && (
            <button
              onClick={() => navigate("/plans")}
              className="glow-ring button-3d px-8 py-3 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-400 hover:to-primary-500 text-white rounded-xl font-semibold shadow-glow-primary transition-all inline-flex items-center gap-2"
            >
              Browse plans
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {filteredServers.map((server) => (
            <div
              key={server.id}
              className="card-3d group bg-dark-800/60 backdrop-blur-sm rounded-xl border border-white/10 p-6 space-y-4 relative overflow-hidden"
            >
              {/* Subtle glow on hover */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary-500/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

              <div className="flex items-start justify-between relative">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary-500/10 border border-primary-500/20 flex items-center justify-center flex-shrink-0">
                    <Server className="w-5 h-5 text-primary-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">{server.name}</h3>
                    <p className="text-sm text-slate-400">{server.plan}</p>
                  </div>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${
                    server.status === "active"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : server.status === "suspended"
                      ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
                      : "bg-slate-500/10 text-slate-400 border border-slate-500/20"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    server.status === "active" ? "bg-emerald-400" :
                    server.status === "suspended" ? "bg-yellow-400" : "bg-slate-400"
                  }`} />
                  {server.status.charAt(0).toUpperCase() + server.status.slice(1)}
                </span>
              </div>

              {server.status === "suspended" && (
                <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-3 flex items-start gap-2 relative">
                  <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="text-yellow-400 font-medium">Server suspended</p>
                    <p className="text-yellow-400/70">
                      Renew within {countdowns[`grace-${server.id}`] || "12h"} to avoid deletion.
                    </p>
                  </div>
                </div>
              )}

              {server.status === "deleted" && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400 relative">
                  Server deleted. Grace period expired.
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm relative">
                {server.ip && server.port && (
                  <div className="col-span-2">
                    <p className="text-slate-500 text-xs uppercase tracking-wider mb-1.5">Server Address</p>
                    <div className="flex items-center gap-2 bg-dark-900/80 px-3 py-2.5 rounded-lg border border-white/[0.06]">
                      <p className="font-mono font-medium text-primary-400">
                        {server.ip}:{server.port}
                      </p>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(`${server.ip}:${server.port}`)
                          showSuccess("Server address copied!")
                        }}
                        className="ml-auto p-1 text-slate-400 hover:text-primary-400 hover:bg-primary-500/10 rounded transition-all"
                        title="Copy to clipboard"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-slate-500 text-xs uppercase tracking-wider mb-1.5">Expires in</p>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-500" />
                    <p className={`font-medium ${
                      countdowns[server.id] === "Expired" ? "text-red-400" : "text-white"
                    }`}>
                      {countdowns[server.id] || "Loading..."}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-slate-500 text-xs uppercase tracking-wider mb-1.5">Plan type</p>
                  <p className="font-medium text-white">
                    {server.plan_type === "coin" ? "Coin plan" : "Real money"}
                  </p>
                </div>
                {server.plan_type === "coin" && (
                  <div>
                    <p className="text-slate-500 text-xs uppercase tracking-wider mb-1.5">Renewal cost</p>
                    <p className="font-semibold text-primary-400">
                      {server.coin_cost || 0} coins
                    </p>
                  </div>
                )}
                {server.plan_type === "real" && (
                  <div>
                    <p className="text-slate-500 text-xs uppercase tracking-wider mb-1.5">Renewal cost</p>
                    <p className="font-semibold text-primary-400">
                      ₹{server.real_cost || 0}
                    </p>
                  </div>
                )}
                {server.server_identifier && (
                  <div>
                    <p className="text-slate-500 text-xs uppercase tracking-wider mb-1.5">Identifier</p>
                    <p className="font-medium text-slate-300 font-mono text-xs">
                      {server.server_identifier}
                    </p>
                  </div>
                )}
              </div>

              {server.status !== "deleted" && (
                <div className="flex gap-3 pt-2 relative">
                  <button
                    onClick={() => handleRenew(server.id)}
                    disabled={renewing[server.id]}
                    className="button-3d flex-1 px-4 py-2.5 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-400 hover:to-primary-500 disabled:from-dark-700 disabled:to-dark-700 disabled:text-slate-500 text-white rounded-lg font-semibold transition-all disabled:cursor-not-allowed disabled:shadow-none shadow-glow-primary inline-flex items-center justify-center gap-2"
                  >
                    {renewing[server.id] ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Renewing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        Renew
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => navigate(`/servers/${server.id}/manage`)}
                    className="button-3d flex-1 px-4 py-2.5 bg-dark-700/80 hover:bg-dark-600/80 text-white rounded-lg font-semibold border border-white/10 hover:border-white/20 transition-all inline-flex items-center justify-center gap-2"
                  >
                    <Settings className="w-4 h-4" />
                    Manage
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
