import { useState, useEffect } from "react"
import { GitBranch, AlertTriangle, Loader2, Sparkles } from "lucide-react"
import { api } from "../../services/api.js"

const POPULAR_VERSIONS = [
  "1.21.4",
  "1.21.3",
  "1.21.1",
  "1.20.6",
  "1.20.4",
  "1.20.1",
  "1.19.4",
  "1.16.5",
  "1.12.2",
  "1.8.8"
]

export default function VersionTab({ serverId }) {
  const [version, setVersion] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [confirm, setConfirm] = useState(false)
  const [currentVersion, setCurrentVersion] = useState("")
  const [loadingCurrent, setLoadingCurrent] = useState(true)

  const token = localStorage.getItem("token")

  useEffect(() => {
    let mounted = true
    const loadCurrentVersion = async () => {
      setLoadingCurrent(true)
      try {
        const settings = await api.serverGetSettings(token, serverId)
        const startupVars = settings?.startup_variables || []
        const mcVersionVar = startupVars.find((v) => v?.env_variable === "MINECRAFT_VERSION")
        const resolved = mcVersionVar?.server_value || mcVersionVar?.default_value || ""
        if (mounted) {
          setCurrentVersion(resolved)
          if (!version && resolved) setVersion(resolved)
        }
      } catch {
        // Non-fatal: some eggs do not expose this startup variable.
      } finally {
        if (mounted) setLoadingCurrent(false)
      }
    }

    loadCurrentVersion()
    return () => { mounted = false }
  }, [serverId, token, version])

  const handleChange = async () => {
    setLoading(true)
    setError("")
    setSuccess("")
    setConfirm(false)
    try {
      const data = await api.serverChangeVersion(token, serverId, version)
      setSuccess(data.message || "Version change initiated.")
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="surface-card surface-elevated max-w-3xl space-y-6 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
        <h3 className="text-sm font-semibold text-slate-200 mb-1">Version Changer</h3>
        <p className="text-xs text-slate-500">
          Change the Minecraft server version. This will trigger a server reinstall.
        </p>
        </div>
        <div className="rounded-lg border border-primary-500/30 bg-primary-500/10 px-3 py-2 text-[11px] text-primary-200">
          {loadingCurrent ? "Detecting current version..." : `Current: ${currentVersion || "Not exposed by this egg"}`}
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-900/20 border border-red-700/30 p-2 text-xs text-red-300">{error}</div>
      )}
      {success && (
        <div className="rounded-lg bg-green-900/20 border border-green-700/30 p-2 text-xs text-green-300">{success}</div>
      )}

      <div>
        <label htmlFor="mc-version" className="block text-xs font-semibold text-slate-400 mb-1">
          Minecraft Version
        </label>
        <input
          id="mc-version"
          name="version"
          type="text"
          value={version}
          onChange={(e) => setVersion(e.target.value)}
          placeholder="e.g. 1.20.4"
          list="minecraft-version-presets"
          className="w-full rounded-lg border border-dark-700/40 bg-ink-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-neon-500/50 focus:outline-none"
        />
        <datalist id="minecraft-version-presets">
          {POPULAR_VERSIONS.map((v) => (
            <option key={v} value={v} />
          ))}
        </datalist>

        <div className="mt-3 flex flex-wrap gap-2">
          {POPULAR_VERSIONS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVersion(v)}
              className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold transition ${version === v ? "border-primary-500/50 bg-primary-500/20 text-primary-200" : "border-dark-700/50 bg-dark-900/40 text-slate-400 hover:border-dark-600/70 hover:text-slate-200"}`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-orange-700/30 bg-orange-900/10 p-3 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
        <p className="text-xs text-orange-300/80">
          Changing the version will reinstall the server. All server files including plugins may be affected. Back up important data first.
        </p>
      </div>

      <button
        onClick={() => setConfirm(true)}
        disabled={loading || !version.trim()}
        className="flex items-center gap-2 rounded-lg border border-neon-400/40 bg-neon-500/15 px-4 py-2 text-sm font-semibold text-neon-200 hover:bg-neon-500/25 disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><GitBranch className="h-4 w-4" /><Sparkles className="h-3.5 w-3.5" /></>}
        Change Version
      </button>

      {/* Confirmation modal */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="rounded-2xl border border-dark-700/40 bg-ink-950 p-6 max-w-sm w-full mx-4 space-y-4">
            <div className="flex items-center gap-2 text-orange-300">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="text-sm font-semibold">Confirm Version Change</h3>
            </div>
            <p className="text-xs text-slate-400">
              Change to version <b className="text-slate-200">{version}</b>? This will reinstall the server and may delete current files.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirm(false)} className="rounded-lg border border-dark-700/40 px-3 py-1.5 text-xs text-slate-400">
                Cancel
              </button>
              <button onClick={handleChange} className="rounded-lg bg-neon-500/15 border border-neon-400/40 px-3 py-1.5 text-xs font-semibold text-neon-200">
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
