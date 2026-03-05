import { useState, useEffect } from "react"
import { Loader2, Cpu, HardDrive, MemoryStick, Network, Save, Check, FileCode } from "lucide-react"
import { api } from "../../services/api.js"

function ResourceCard({ icon: Icon, label, value, max, unit }) {
  const pct = max ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="rounded-lg border border-dark-700/40 bg-ink-950/50 p-3 space-y-2">
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Icon className="h-4 w-4" />
        <span className="font-semibold">{label}</span>
      </div>
      <p className="text-lg font-bold text-slate-200">
        {value} <span className="text-xs font-normal text-slate-500">/ {max} {unit}</span>
      </p>
      {max > 0 && (
        <div className="h-1.5 rounded-full bg-slate-800">
          <div
            className={`h-full rounded-full transition-all ${pct > 80 ? "bg-red-500" : "bg-neon-500/60"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  )
}

export default function SettingsTab({ serverId, isBot = false }) {
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const token = localStorage.getItem("token")

  useEffect(() => {
    api.serverGetSettings(token, serverId)
      .then((data) => setSettings(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
      </div>
    )
  }

  if (error) {
    return <div className="rounded-lg bg-red-900/20 border border-red-700/30 p-3 text-xs text-red-300">{error}</div>
  }

  if (!settings) return null

  const res = settings.resources?.resources || {}
  const limits = settings.limits || {}

  // Resolve display IP: prefer ip_alias, then node_fqdn if allocation IP is unusable
  const resolveDisplayIp = (alloc) => {
    if (!alloc) return "N/A"
    if (alloc.ip_alias) return alloc.ip_alias
    const ip = alloc.ip
    if (ip && ip !== "0.0.0.0" && !ip.startsWith("10.") && !ip.startsWith("172.") && !ip.startsWith("192.168.")) return ip
    return settings.node_fqdn || ip || "N/A"
  }
  const defaultAlloc = settings.allocations?.[0]
  const displayAddress = defaultAlloc ? `${resolveDisplayIp(defaultAlloc)}:${defaultAlloc.port}` : "N/A"

  return (
    <div className="space-y-6">
      {/* ── Resource usage ──────────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-slate-200 mb-3">Resource Allocation</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <ResourceCard
            icon={MemoryStick}
            label="Memory"
            value={Math.round((res.memory_bytes || 0) / 1024 / 1024)}
            max={limits.memory || 0}
            unit="MB"
          />
          <ResourceCard
            icon={Cpu}
            label="CPU"
            value={(res.cpu_absolute || 0).toFixed(1)}
            max={limits.cpu || 100}
            unit="%"
          />
          <ResourceCard
            icon={HardDrive}
            label="Disk"
            value={Math.round((res.disk_bytes || 0) / 1024 / 1024)}
            max={limits.disk || 0}
            unit="MB"
          />
        </div>
      </div>

      {/* ── Server Info ─────────────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-slate-200 mb-3">Server Information</h3>
        <div className="rounded-lg border border-dark-700/40 divide-y divide-dark-700/40">
          {[
            ["Identifier", settings.identifier],
            ["Node", settings.node_fqdn || "—"],
            ["Status", settings.suspended ? "Suspended" : settings.resources?.current_state || "Unknown"],
            ...(!isBot ? [["Address", displayAddress]] : []),
            ["Memory Limit", `${limits.memory || 0} MB`],
            ["CPU Limit", `${(limits.cpu || 0) * 100}%`],
            ["Disk Limit", `${limits.disk || 0} MB`],
            ["Swap", `${limits.swap || 0} MB`],
            ["I/O Weight", limits.io || 500],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between px-3 py-2 text-xs">
              <span className="text-slate-500">{label}</span>
              <span className="font-semibold text-slate-300">{String(value)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Port Allocations (hidden for bot hosting) ──────────────────── */}
      {!isBot && settings.allocations?.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-200 mb-3">Port Allocations</h3>
          <div className="rounded-lg border border-dark-700/40 divide-y divide-dark-700/40">
            {settings.allocations.map((alloc, i) => {
              const allocIp = resolveDisplayIp(alloc)
              const addr = `${allocIp}:${alloc.port}`
              return (
                <div key={alloc.id || i} className="flex items-center justify-between px-3 py-2 text-xs">
                  <div className="flex items-center gap-2">
                    <Network className="h-3.5 w-3.5 text-slate-500" />
                    <span
                      className="font-mono text-slate-300 cursor-pointer hover:text-neon-300 transition"
                      title="Click to copy"
                      onClick={() => navigator.clipboard.writeText(addr)}
                    >
                      {addr}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {alloc.is_default && (
                      <span className="rounded-full bg-neon-500/20 text-neon-300 px-2 py-0.5 text-[10px] font-semibold">
                        Primary
                      </span>
                    )}
                    <span className="text-slate-600 font-mono">:{alloc.port}</span>
                  </div>
                </div>
              )
            })}
          </div>
          <p className="mt-1.5 text-[10px] text-slate-600">
            Your plan includes {settings.feature_limits?.allocations || 0} extra port(s). Primary port is always included.
          </p>
        </div>
      )}

      {/* ── Startup Variables ───────────────────────────────────────────── */}
      {settings.startup_variables?.length > 0 && (
        <StartupVariables
          serverId={serverId}
          variables={settings.startup_variables}
          isBot={isBot}
        />
      )}
    </div>
  )
}

// ── Main file env vars for common bot eggs ─────────────────────────────────
const MAIN_FILE_VARS = ["PY_FILE", "BOT_PY_FILE", "BOT_JS_FILE", "JS_FILE", "MAIN_FILE", "BOT_FILE", "JAR_FILE", "BOT_JAR"]

function StartupVariables({ serverId, variables, isBot }) {
  const [editValues, setEditValues] = useState({})
  const [saving, setSaving] = useState({})
  const [saved, setSaved] = useState({})

  // Initialize edit values
  useEffect(() => {
    const vals = {}
    for (const v of variables) {
      vals[v.env_variable] = v.server_value ?? v.default_value ?? ""
    }
    setEditValues(vals)
  }, [variables])

  const handleSave = async (envVar) => {
    setSaving(s => ({ ...s, [envVar]: true }))
    try {
      const token = localStorage.getItem("token")
      await api.serverUpdateStartupVar(token, serverId, envVar, editValues[envVar] || "")
      setSaved(s => ({ ...s, [envVar]: true }))
      setTimeout(() => setSaved(s => ({ ...s, [envVar]: false })), 2000)
    } catch {
      // Error handled by API
    } finally {
      setSaving(s => ({ ...s, [envVar]: false }))
    }
  }

  // Separate main file variable from others for bot servers
  const mainFileVar = isBot ? variables.find(v => MAIN_FILE_VARS.includes(v.env_variable)) : null
  const otherVars = mainFileVar ? variables.filter(v => v !== mainFileVar) : variables

  return (
    <div className="space-y-6">
      {/* Prominent main file selector for bots */}
      {isBot && mainFileVar && (
        <div>
          <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
            <FileCode className="h-4 w-4 text-neon-400" />
            Main File
          </h3>
          <div className="rounded-xl border border-neon-500/20 bg-neon-500/5 p-4 space-y-3">
            <p className="text-xs text-slate-400">
              Set the file your bot should run when started (e.g. <code className="text-neon-300">main.py</code>, <code className="text-neon-300">bot.py</code>, <code className="text-neon-300">index.js</code>).
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={editValues[mainFileVar.env_variable] ?? ""}
                onChange={(e) => setEditValues(v => ({ ...v, [mainFileVar.env_variable]: e.target.value }))}
                placeholder={mainFileVar.default_value || "main.py"}
                className="flex-1 rounded-lg border border-dark-700/50 bg-dark-900/80 px-3 py-2 text-sm text-white font-mono placeholder:text-slate-600 focus:border-neon-500/40 focus:outline-none focus:ring-1 focus:ring-neon-500/20"
              />
              <button
                onClick={() => handleSave(mainFileVar.env_variable)}
                disabled={saving[mainFileVar.env_variable]}
                className="flex items-center gap-1.5 rounded-lg border border-neon-500/30 bg-neon-500/10 px-4 py-2 text-xs font-semibold text-neon-300 hover:bg-neon-500/20 transition disabled:opacity-50"
              >
                {saving[mainFileVar.env_variable] ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : saved[mainFileVar.env_variable] ? (
                  <Check className="h-3.5 w-3.5 text-green-400" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                {saved[mainFileVar.env_variable] ? "Saved" : "Save"}
              </button>
            </div>
            <p className="text-[10px] text-slate-600">
              Variable: <code className="text-slate-500">{mainFileVar.env_variable}</code>
            </p>
          </div>
        </div>
      )}

      {/* Other startup variables */}
      {otherVars.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-200 mb-3">Startup Variables</h3>
          <div className="rounded-lg border border-dark-700/40 divide-y divide-dark-700/40 max-h-[400px] overflow-y-auto">
            {otherVars.map((v) => {
              const isEditable = isBot && v.is_editable !== false
              const current = editValues[v.env_variable] ?? ""
              const original = v.server_value ?? v.default_value ?? ""
              const changed = current !== original

              return (
                <div key={v.env_variable} className="px-3 py-2.5 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-slate-400">{v.env_variable}</span>
                    {!isEditable && (
                      <span className="text-slate-300 font-semibold">{original}</span>
                    )}
                  </div>
                  {isEditable && (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={current}
                        onChange={(e) => setEditValues(vals => ({ ...vals, [v.env_variable]: e.target.value }))}
                        placeholder={v.default_value || ""}
                        className="flex-1 rounded-md border border-dark-700/50 bg-dark-900/80 px-2.5 py-1.5 text-xs text-white font-mono placeholder:text-slate-600 focus:border-primary-500/40 focus:outline-none focus:ring-1 focus:ring-primary-500/20"
                      />
                      {changed && (
                        <button
                          onClick={() => handleSave(v.env_variable)}
                          disabled={saving[v.env_variable]}
                          className="flex items-center gap-1 rounded-md border border-primary-500/30 bg-primary-500/10 px-2.5 py-1 text-[10px] font-semibold text-primary-300 hover:bg-primary-500/20 transition disabled:opacity-50"
                        >
                          {saving[v.env_variable] ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : saved[v.env_variable] ? (
                            <Check className="h-3 w-3 text-green-400" />
                          ) : (
                            <Save className="h-3 w-3" />
                          )}
                        </button>
                      )}
                    </div>
                  )}
                  {v.description && (
                    <p className="text-[10px] text-slate-600">{v.description}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
