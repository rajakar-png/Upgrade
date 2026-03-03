import { useState } from "react"
import { GitBranch, AlertTriangle, Loader2 } from "lucide-react"
import { api } from "../../services/api.js"

export default function VersionTab({ serverId }) {
  const [version, setVersion] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [confirm, setConfirm] = useState(false)

  const token = localStorage.getItem("token")

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
    <div className="space-y-6 max-w-lg">
      <div>
        <h3 className="text-sm font-semibold text-slate-200 mb-1">Version Changer</h3>
        <p className="text-xs text-slate-500">
          Change the Minecraft server version. This will trigger a server reinstall.
        </p>
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
          className="w-full rounded-lg border border-slate-700/40 bg-ink-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-neon-500/50 focus:outline-none"
        />
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
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitBranch className="h-4 w-4" />}
        Change Version
      </button>

      {/* Confirmation modal */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="rounded-2xl border border-slate-700/40 bg-ink-950 p-6 max-w-sm w-full mx-4 space-y-4">
            <div className="flex items-center gap-2 text-orange-300">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="text-sm font-semibold">Confirm Version Change</h3>
            </div>
            <p className="text-xs text-slate-400">
              Change to version <b className="text-slate-200">{version}</b>? This will reinstall the server and may delete current files.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirm(false)} className="rounded-lg border border-slate-700/40 px-3 py-1.5 text-xs text-slate-400">
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
