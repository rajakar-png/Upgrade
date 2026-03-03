import { useState, useEffect, useRef, useCallback } from "react"
import { io } from "socket.io-client"
import { getBackendBaseUrl } from "../../services/api.js"
import {
  Send, Wifi, WifiOff, Loader2, RefreshCw,
  Cpu, HardDrive, MemoryStick, Copy, Check, Globe
} from "lucide-react"

const MAX_LINES = 500

/* ── Tiny progress bar ─────────────────────────────────────────────────────── */
function MiniBar({ pct, color = "bg-neon-400" }) {
  const clamped = Math.min(100, Math.max(0, pct))
  const barColor = clamped > 90 ? "bg-red-500" : clamped > 70 ? "bg-yellow-400" : color
  return (
    <div className="mt-1.5 h-1 w-full rounded-full bg-slate-800/80 overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${clamped}%` }} />
    </div>
  )
}

export default function ConsoleTab({ serverId, serverInfo }) {
  const [lines, setLines] = useState([])
  const [command, setCommand] = useState("")
  const [status, setStatus] = useState("connecting") // connecting | connected | offline | error
  const [stats, setStats] = useState(null)
  const [error, setError] = useState("")
  const [connectKey, setConnectKey] = useState(0)
  const [copied, setCopied] = useState(false)
  const scrollRef = useRef(null)
  const socketRef = useRef(null)
  const inputRef = useRef(null)

  const srv = serverInfo?.server
  const limits = srv?.limits || {}
  const defaultAlloc = srv?.allocations?.find((a) => a.is_default) || srv?.allocations?.[0]

  // Resolve display IP
  const resolveDisplayIp = (alloc) => {
    if (!alloc) return null
    if (alloc.ip_alias) return alloc.ip_alias
    const ip = alloc.ip
    if (ip && ip !== "0.0.0.0" && !ip.startsWith("10.") && !ip.startsWith("172.") && !ip.startsWith("192.168.")) return ip
    return srv?.node_fqdn || ip || "N/A"
  }
  const displayAddress = defaultAlloc ? `${resolveDisplayIp(defaultAlloc)}:${defaultAlloc.port}` : null

  const copyIp = useCallback(() => {
    if (!displayAddress) return
    navigator.clipboard.writeText(displayAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [displayAddress])

  // Auto-scroll
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [])

  const reconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit("console:leave")
      socketRef.current.disconnect()
      socketRef.current = null
    }
    setLines([])
    setError("")
    setStats(null)
    setStatus("connecting")
    setConnectKey((k) => k + 1)
  }, [])

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) return

    const socket = io(getBackendBaseUrl(), {
      auth: { token },
      transports: ["polling", "websocket"],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      timeout: 10000
    })
    socketRef.current = socket

    let consoleReady = false

    socket.on("connect", () => {
      setStatus("connecting")
      setError("")
      socket.emit("console:join", { serverId: Number(serverId) })
    })

    socket.on("connect_error", (err) => {
      setError(`Connection failed: ${err.message}`)
      setStatus("error")
    })

    const connectTimeout = setTimeout(() => {
      if (!consoleReady) {
        setError("Console connection timed out. The server daemon may be unreachable.")
        setStatus("error")
      }
    }, 20000)

    socket.on("console:connected", () => {
      consoleReady = true
      clearTimeout(connectTimeout)
      setStatus("connected")
      setError("")
    })

    socket.on("console:output", ({ line }) => {
      setLines((prev) => {
        const next = [...prev, line]
        return next.length > MAX_LINES ? next.slice(-MAX_LINES) : next
      })
    })

    socket.on("console:status", ({ status: s }) => setStatus(s === "running" ? "connected" : "offline"))
    socket.on("console:stats", (s) => setStats(s))
    socket.on("console:error", ({ message }) => { setError(message); setStatus("error") })
    socket.on("console:disconnected", () => setStatus("offline"))
    socket.on("disconnect", () => setStatus("offline"))

    return () => {
      clearTimeout(connectTimeout)
      socket.emit("console:leave")
      socket.disconnect()
    }
  }, [serverId, connectKey])

  useEffect(() => { scrollToBottom() }, [lines, scrollToBottom])

  const sendCommand = (e) => {
    e.preventDefault()
    if (!command.trim() || !socketRef.current) return
    socketRef.current.emit("console:command", { command: command.trim() })
    setCommand("")
    inputRef.current?.focus()
  }

  // Live values from WebSocket stats (fall back to initial API data)
  const ramUsed = Math.round((stats?.memory_bytes || serverInfo?.resources?.resources?.memory_bytes || 0) / 1024 / 1024)
  const ramMax = limits.memory || 0
  const cpuUsed = stats?.cpu_absolute ?? serverInfo?.resources?.resources?.cpu_absolute ?? 0
  const diskUsed = Math.round((stats?.disk_bytes || serverInfo?.resources?.resources?.disk_bytes || 0) / 1024 / 1024)
  const diskMax = limits.disk || 0

  const statusDot = {
    connecting: "bg-yellow-400 animate-pulse",
    connected:  "bg-green-400",
    offline:    "bg-slate-600",
    error:      "bg-red-500"
  }

  return (
    <div className="space-y-4">
      {/* ── Stats cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        {/* Status */}
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/60 p-3">
          <div className="flex items-center gap-2 text-[11px] font-medium text-slate-500 uppercase tracking-wider">
            <span className={`h-2 w-2 rounded-full ${statusDot[status]}`} />
            Status
          </div>
          <p className="mt-1 text-sm font-bold text-slate-100 capitalize">{status}</p>
        </div>

        {/* RAM */}
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/60 p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 uppercase tracking-wider">
            <MemoryStick className="h-3 w-3" /> RAM
          </div>
          <p className="mt-1 text-sm font-bold text-slate-100">
            {ramUsed}<span className="text-slate-500 font-normal text-xs"> / {ramMax} MB</span>
          </p>
          {ramMax > 0 && <MiniBar pct={(ramUsed / ramMax) * 100} color="bg-violet-500" />}
        </div>

        {/* CPU */}
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/60 p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 uppercase tracking-wider">
            <Cpu className="h-3 w-3" /> CPU
          </div>
          <p className="mt-1 text-sm font-bold text-slate-100">
            {cpuUsed.toFixed(1)}<span className="text-slate-500 font-normal text-xs"> %</span>
          </p>
          <MiniBar pct={cpuUsed} color="bg-sky-500" />
        </div>

        {/* Disk */}
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/60 p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 uppercase tracking-wider">
            <HardDrive className="h-3 w-3" /> Disk
          </div>
          <p className="mt-1 text-sm font-bold text-slate-100">
            {diskUsed}<span className="text-slate-500 font-normal text-xs"> / {diskMax} MB</span>
          </p>
          {diskMax > 0 && <MiniBar pct={(diskUsed / diskMax) * 100} color="bg-emerald-500" />}
        </div>

        {/* IP Address */}
        {displayAddress && (
          <div
            className="rounded-xl border border-slate-800/60 bg-slate-900/60 p-3 cursor-pointer group hover:border-neon-500/30 transition col-span-2 sm:col-span-1"
            onClick={copyIp}
            title="Click to copy"
          >
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              <Globe className="h-3 w-3" /> Connect
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <p className="text-sm font-bold text-neon-300 font-mono truncate">{displayAddress}</p>
              {copied
                ? <Check className="h-3.5 w-3.5 text-green-400 shrink-0" />
                : <Copy className="h-3.5 w-3.5 text-slate-600 group-hover:text-slate-400 shrink-0 transition" />
              }
            </div>
          </div>
        )}
      </div>

      {/* ── Error banner ────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-red-950/40 border border-red-800/30 px-4 py-2.5 text-xs text-red-300">
          <span>{error}</span>
          <button
            onClick={reconnect}
            className="flex items-center gap-1.5 shrink-0 rounded-lg border border-red-700/40 bg-red-900/30 px-2.5 py-1 text-xs text-red-200 hover:bg-red-900/50 transition"
          >
            <RefreshCw className="h-3 w-3" /> Retry
          </button>
        </div>
      )}

      {/* ── Console output ──────────────────────────────────────────────── */}
      <div className="relative">
        {/* Connection overlay */}
        {status === "connecting" && lines.length === 0 && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-xl bg-[#0a0a0a]/90 backdrop-blur-sm">
            <Loader2 className="h-6 w-6 animate-spin text-neon-400 mb-2" />
            <p className="text-xs text-slate-500">Connecting to console…</p>
          </div>
        )}

        <div
          ref={scrollRef}
          className="h-[420px] overflow-y-auto rounded-xl bg-[#0a0a0a] border border-slate-800/50 p-4 font-mono text-[13px] leading-relaxed text-slate-300 scroll-smooth selection:bg-neon-500/20"
        >
          {lines.length === 0 && status === "connected" && (
            <p className="text-slate-600 italic">Waiting for console output…</p>
          )}
          {lines.length === 0 && status === "offline" && (
            <p className="text-slate-600 italic">Server is offline. Start it to see console output.</p>
          )}
          {lines.map((line, i) => (
            <div key={i} className="whitespace-pre-wrap break-all py-px hover:bg-white/[0.02] rounded">
              {line}
            </div>
          ))}
        </div>
      </div>

      {/* ── Command input ───────────────────────────────────────────────── */}
      <form onSubmit={sendCommand} className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 font-mono text-sm select-none">&gt;</span>
          <input
            ref={inputRef}
            id="console-command"
            name="command"
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder={status === "connected" ? "Type a command…" : "Connect to send commands"}
            disabled={status !== "connected" && status !== "offline"}
            autoComplete="off"
            className="w-full rounded-xl border border-slate-700/40 bg-[#0a0a0a] py-2.5 pl-8 pr-4 font-mono text-sm text-slate-200 placeholder:text-slate-600 focus:border-neon-500/50 focus:outline-none focus:ring-1 focus:ring-neon-500/20 disabled:opacity-50 transition"
          />
        </div>
        <button
          type="submit"
          disabled={!command.trim() || (status !== "connected" && status !== "offline")}
          className="rounded-xl border border-neon-400/40 bg-neon-500/15 px-4 py-2.5 text-sm font-semibold text-neon-200 transition hover:bg-neon-500/25 disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  )
}
