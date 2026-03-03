import { useState } from "react"
import { Globe, Trash2, RotateCcw, AlertTriangle, Loader2 } from "lucide-react"
import { api } from "../../services/api.js"

export default function WorldTab({ serverId }) {
  const [worldName, setWorldName] = useState("world")
  const [loading, setLoading] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [confirm, setConfirm] = useState(null) // "delete" | "reset"

  const token = localStorage.getItem("token")

  const handleDelete = async () => {
    setLoading("delete")
    setError("")
    setSuccess("")
    setConfirm(null)
    try {
      const data = await api.serverWorldDelete(token, serverId, worldName)
      setSuccess(`Deleted world folders: ${data.deleted?.join(", ") || "none found"}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading("")
    }
  }

  const handleReset = async () => {
    setLoading("reset")
    setError("")
    setSuccess("")
    setConfirm(null)
    try {
      const data = await api.serverWorldReset(token, serverId, worldName)
      setSuccess(data.message || "World reset initiated.")
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading("")
    }
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h3 className="text-sm font-semibold text-slate-200 mb-1">World Manager</h3>
        <p className="text-xs text-slate-500">Delete or reset your Minecraft world. This cannot be undone.</p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-900/20 border border-red-700/30 p-2 text-xs text-red-300">{error}</div>
      )}
      {success && (
        <div className="rounded-lg bg-green-900/20 border border-green-700/30 p-2 text-xs text-green-300">{success}</div>
      )}

      <div>
        <label htmlFor="world-name" className="block text-xs font-semibold text-slate-400 mb-1">
          World Name
        </label>
        <input
          id="world-name"
          name="world_name"
          type="text"
          value={worldName}
          onChange={(e) => setWorldName(e.target.value)}
          className="w-full rounded-lg border border-slate-700/40 bg-ink-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-neon-500/50 focus:outline-none"
          placeholder="world"
        />
        <p className="mt-1 text-xs text-slate-600">
          Also deletes {worldName}_nether and {worldName}_the_end.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => setConfirm("delete")}
          disabled={!!loading || !worldName.trim()}
          className="flex items-center gap-2 rounded-lg border border-red-700/40 bg-red-900/20 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-900/30 disabled:opacity-50"
        >
          {loading === "delete" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          Delete World
        </button>
        <button
          onClick={() => setConfirm("reset")}
          disabled={!!loading || !worldName.trim()}
          className="flex items-center gap-2 rounded-lg border border-orange-700/40 bg-orange-900/20 px-4 py-2 text-sm font-semibold text-orange-300 hover:bg-orange-900/30 disabled:opacity-50"
        >
          {loading === "reset" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
          Reset World
        </button>
      </div>

      {/* Confirmation modal */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="rounded-2xl border border-slate-700/40 bg-ink-950 p-6 max-w-sm w-full mx-4 space-y-4">
            <div className="flex items-center gap-2 text-orange-300">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="text-sm font-semibold">
                {confirm === "delete" ? "Delete World?" : "Reset World?"}
              </h3>
            </div>
            <p className="text-xs text-slate-400">
              {confirm === "delete"
                ? `This will permanently delete "${worldName}" and its nether/end dimensions. The server must be stopped first.`
                : `This will stop the server, delete "${worldName}" and all dimensions, then restart. A new world will generate automatically.`}
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirm(null)} className="rounded-lg border border-slate-700/40 px-3 py-1.5 text-xs text-slate-400">
                Cancel
              </button>
              <button
                onClick={confirm === "delete" ? handleDelete : handleReset}
                className="rounded-lg bg-red-900/30 border border-red-700/40 px-3 py-1.5 text-xs font-semibold text-red-300"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
