import { useState, useEffect, useCallback, useRef } from "react"
import {
  Users, Loader2, Gavel, Shield, ShieldOff, UserX, UserCheck,
  RefreshCw, Crown, Swords, Gamepad2, Package, Send, Megaphone,
  ListPlus, ListMinus, MapPin, AlertCircle, Skull, ChevronDown
} from "lucide-react"
import { api } from "../../services/api.js"

/* ── Action definitions ───────────────────────────────────────────────────── */
const QUICK_ACTIONS = [
  { id: "kick",   label: "Kick",   icon: UserX,     cls: "text-orange-300 border-orange-700/40 bg-orange-900/15 hover:bg-orange-900/30", confirm: true },
  { id: "ban",    label: "Ban",    icon: Gavel,     cls: "text-red-300 border-red-700/40 bg-red-900/15 hover:bg-red-900/30", confirm: true },
  { id: "op",     label: "OP",     icon: Shield,    cls: "text-neon-200 border-neon-400/40 bg-neon-500/15 hover:bg-neon-500/25" },
  { id: "deop",   label: "De-OP",  icon: ShieldOff, cls: "text-slate-300 border-slate-700/40 hover:bg-slate-800/50" },
  { id: "kill_player", label: "Kill", icon: Skull,  cls: "text-red-300 border-red-700/40 bg-red-900/15 hover:bg-red-900/30" },
]

const EXTRA_ACTIONS = [
  { id: "pardon",          label: "Pardon / Unban",    icon: UserCheck,  hasArgs: false, placeholder: "" },
  { id: "whitelist_add",   label: "Whitelist Add",     icon: ListPlus,   hasArgs: false, placeholder: "" },
  { id: "whitelist_remove",label: "Whitelist Remove",  icon: ListMinus,  hasArgs: false, placeholder: "" },
  { id: "gamemode",        label: "Set Gamemode",      icon: Gamepad2,   hasArgs: true,  placeholder: "survival / creative / adventure / spectator" },
  { id: "tp",              label: "Teleport",          icon: MapPin,     hasArgs: true,  placeholder: "x y z  or  target player name" },
  { id: "give",            label: "Give Item",         icon: Package,    hasArgs: true,  placeholder: "minecraft:diamond 64" },
  { id: "say",             label: "Server Broadcast",  icon: Megaphone,  hasArgs: true,  placeholder: "Message to broadcast..." },
]

const SKIN_URL = (name) => `https://mc-heads.net/avatar/${name}/40`

export default function PlayersTab({ serverId }) {
  const [onlineData, setOnlineData] = useState({ online: 0, max: 0, players: [] })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [actionLoading, setActionLoading] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  // Selected player for actions
  const [selectedPlayer, setSelectedPlayer] = useState(null)

  // Extra action panel
  const [manualPlayer, setManualPlayer] = useState("")
  const [selectedAction, setSelectedAction] = useState(null)
  const [actionArgs, setActionArgs] = useState("")
  const [showActions, setShowActions] = useState(false)

  const token = localStorage.getItem("token")
  const refreshTimerRef = useRef(null)

  const fetchPlayers = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError("")
    try {
      const data = await api.serverGetOnlinePlayers(token, serverId)
      setOnlineData(data)
    } catch (err) {
      if (!silent) setError(err.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [token, serverId])

  // Auto-refresh every 15s
  useEffect(() => {
    fetchPlayers()
    refreshTimerRef.current = setInterval(() => fetchPlayers(true), 15000)
    return () => clearInterval(refreshTimerRef.current)
  }, [fetchPlayers])

  const handleQuickAction = async (action, playerName) => {
    if (QUICK_ACTIONS.find(a => a.id === action)?.confirm) {
      if (!window.confirm(`Are you sure you want to ${action} ${playerName}?`)) return
    }
    const key = `${action}-${playerName}`
    setActionLoading(key)
    setError("")
    setSuccess("")
    try {
      await api.serverPlayerAction(token, serverId, action, playerName)
      setSuccess(`${action.replace("_", " ")} → ${playerName}`)
      setTimeout(() => setSuccess(""), 4000)
      // Refresh player list after kick/ban
      if (["kick", "ban", "kill_player"].includes(action)) {
        setTimeout(() => fetchPlayers(true), 2000)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading("")
    }
  }

  const handleExtraAction = async () => {
    if (!selectedAction) return
    const playerName = manualPlayer.trim()
    if (!playerName) { setError("Enter a player name."); return }

    setActionLoading(selectedAction.id)
    setError("")
    setSuccess("")
    try {
      await api.serverPlayerAction(token, serverId, selectedAction.id, playerName, actionArgs.trim() || undefined)
      setSuccess(`${selectedAction.label} → ${playerName}`)
      setManualPlayer("")
      setActionArgs("")
      setTimeout(() => setSuccess(""), 4000)
      setTimeout(() => fetchPlayers(true), 2000)
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading("")
    }
  }

  const { online, max, players, offline } = onlineData

  return (
    <div className="space-y-6">
      {/* ── Header with count + refresh ────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-neon-500/10 border border-neon-400/20">
            <Users className="h-5 w-5 text-neon-300" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">Live Players</h3>
            <p className="text-xs text-slate-500">
              {offline
                ? "Server offline"
                : <>
                    <span className="text-neon-300 font-semibold">{online}</span>
                    <span> / {max} online</span>
                  </>
              }
            </p>
          </div>
        </div>
        <button
          onClick={() => fetchPlayers(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700/40 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* ── Alerts ─────────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-red-950/30 border border-red-800/30 px-4 py-2.5 text-xs text-red-300">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl bg-green-950/30 border border-green-800/30 px-4 py-2.5 text-xs text-green-300">
          ✓ {success}
        </div>
      )}

      {/* ── Loading ────────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
        </div>
      )}

      {/* ── Online Players Grid ────────────────────────────────────────── */}
      {!loading && !offline && players.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {players.map((name) => {
            const isSelected = selectedPlayer === name
            return (
              <div
                key={name}
                onClick={() => setSelectedPlayer(isSelected ? null : name)}
                className={`group rounded-xl border p-3 cursor-pointer transition-all ${
                  isSelected
                    ? "border-neon-500/40 bg-neon-500/5 ring-1 ring-neon-500/20"
                    : "border-slate-800/50 bg-slate-900/40 hover:border-slate-700/60 hover:bg-slate-900/60"
                }`}
              >
                <div className="flex items-center gap-3">
                  <img
                    src={SKIN_URL(name)}
                    alt={name}
                    className="h-10 w-10 rounded-lg bg-slate-800 shrink-0"
                    onError={(e) => { e.target.style.display = "none" }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-100 truncate">{name}</p>
                    <p className="text-[11px] text-slate-600">Online</p>
                  </div>
                  <div className={`h-2.5 w-2.5 rounded-full bg-green-400 shrink-0 ${isSelected ? "" : "animate-pulse"}`} />
                </div>

                {/* Quick actions — shown when selected */}
                {isSelected && (
                  <div className="mt-3 pt-3 border-t border-slate-800/40 flex flex-wrap gap-1.5">
                    {QUICK_ACTIONS.map((a) => {
                      const Icon = a.icon
                      const key = `${a.id}-${name}`
                      const isLoading = actionLoading === key
                      return (
                        <button
                          key={a.id}
                          onClick={(e) => { e.stopPropagation(); handleQuickAction(a.id, name) }}
                          disabled={!!actionLoading}
                          className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition disabled:opacity-40 ${a.cls}`}
                        >
                          {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Icon className="h-3 w-3" />}
                          {a.label}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── No players ─────────────────────────────────────────────────── */}
      {!loading && !offline && players.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="h-14 w-14 rounded-2xl bg-slate-800/50 flex items-center justify-center mb-3">
            <Users className="h-7 w-7 text-slate-600" />
          </div>
          <p className="text-sm font-semibold text-slate-400">No players online</p>
          <p className="text-xs text-slate-600 mt-1">Players will appear here in real-time when they join.</p>
        </div>
      )}

      {/* ── Offline state ──────────────────────────────────────────────── */}
      {!loading && offline && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="h-14 w-14 rounded-2xl bg-slate-800/50 flex items-center justify-center mb-3">
            <Users className="h-7 w-7 text-slate-700" />
          </div>
          <p className="text-sm font-semibold text-slate-500">Server is offline</p>
          <p className="text-xs text-slate-600 mt-1">Start the server to see live players.</p>
        </div>
      )}

      {/* ── Advanced Actions Panel ─────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-800/50 bg-slate-900/30 overflow-hidden">
        <button
          onClick={() => setShowActions(!showActions)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-300 hover:bg-slate-800/30 transition"
        >
          <span className="flex items-center gap-2">
            <Swords className="h-4 w-4 text-slate-500" />
            Advanced Actions
          </span>
          <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${showActions ? "rotate-180" : ""}`} />
        </button>

        {showActions && (
          <div className="border-t border-slate-800/40 p-4 space-y-4">
            {/* Target player */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Target Player</label>
              <input
                type="text"
                value={manualPlayer}
                onChange={(e) => setManualPlayer(e.target.value)}
                placeholder="Enter player name (online or offline)"
                autoComplete="off"
                className="w-full rounded-lg border border-slate-700/40 bg-ink-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-neon-500/50 focus:outline-none"
              />
              {/* Quick fill from online players */}
              {players.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {players.map((name) => (
                    <button
                      key={name}
                      onClick={() => setManualPlayer(name)}
                      className={`flex items-center gap-1 rounded px-2 py-0.5 text-[11px] border transition ${
                        manualPlayer === name
                          ? "border-neon-400/40 bg-neon-500/10 text-neon-200"
                          : "border-slate-700/30 text-slate-500 hover:text-slate-300 hover:bg-slate-800/30"
                      }`}
                    >
                      <img src={SKIN_URL(name)} alt="" className="h-3 w-3 rounded-sm" />
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Action selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Action</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
                {EXTRA_ACTIONS.map((a) => {
                  const Icon = a.icon
                  const active = selectedAction?.id === a.id
                  return (
                    <button
                      key={a.id}
                      onClick={() => { setSelectedAction(active ? null : a); setActionArgs("") }}
                      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium transition ${
                        active
                          ? "border-neon-400/40 bg-neon-500/10 text-neon-200"
                          : "border-slate-700/40 text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      {a.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Args input (if action needs it) */}
            {selectedAction?.hasArgs && (
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Arguments</label>
                <input
                  type="text"
                  value={actionArgs}
                  onChange={(e) => setActionArgs(e.target.value)}
                  placeholder={selectedAction.placeholder}
                  autoComplete="off"
                  className="w-full rounded-lg border border-slate-700/40 bg-ink-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-neon-500/50 focus:outline-none"
                />
              </div>
            )}

            {/* Execute */}
            <button
              onClick={handleExtraAction}
              disabled={!selectedAction || !manualPlayer.trim() || !!actionLoading}
              className="flex items-center gap-2 rounded-lg border border-neon-400/40 bg-neon-500/15 px-4 py-2 text-sm font-semibold text-neon-200 hover:bg-neon-500/25 transition disabled:opacity-40"
            >
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Execute {selectedAction?.label || "Action"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
