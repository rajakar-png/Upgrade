import { useState, useEffect } from "react"
import { Save, Loader2, RefreshCw } from "lucide-react"
import { api } from "../../services/api.js"

export default function PropertiesTab({ serverId }) {
  const [raw, setRaw] = useState("")
  const [properties, setProperties] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const token = localStorage.getItem("token")

  const load = async () => {
    setLoading(true)
    setError("")
    try {
      const data = await api.serverGetProperties(token, serverId)
      setRaw(data.raw)
      setProperties(data.properties)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [serverId])

  const handleChange = (key, value) => {
    setProperties((prev) => ({ ...prev, [key]: value }))
    // Rebuild raw content with the updated value
    setRaw((prev) => {
      const lines = prev.split("\n")
      const updated = lines.map((line) => {
        const t = line.trim()
        if (!t || t.startsWith("#")) return line
        const eq = t.indexOf("=")
        if (eq > 0 && t.substring(0, eq).trim() === key) {
          return `${key}=${value}`
        }
        return line
      })
      return updated.join("\n")
    })
  }

  const save = async () => {
    setSaving(true)
    setError("")
    setSuccess("")
    try {
      await api.serverSaveProperties(token, serverId, raw)
      setSuccess("Properties saved. Restart the server for changes to take effect.")
      setTimeout(() => setSuccess(""), 4000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
      </div>
    )
  }

  const keys = Object.keys(properties)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">server.properties</h3>
        <div className="flex gap-2">
          <button onClick={load} className="flex items-center gap-1.5 rounded-lg border border-slate-700/40 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200">
            <RefreshCw className="h-3.5 w-3.5" /> Reload
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg border border-neon-400/40 bg-neon-500/15 px-3 py-1.5 text-xs font-semibold text-neon-200 hover:bg-neon-500/25 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-900/20 border border-red-700/30 p-2 text-xs text-red-300">{error}</div>
      )}
      {success && (
        <div className="rounded-lg bg-green-900/20 border border-green-700/30 p-2 text-xs text-green-300">{success}</div>
      )}

      {keys.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">
          server.properties not found or empty. Start the server first.
        </p>
      ) : (
        <div className="divide-y divide-slate-800/40 rounded-lg border border-slate-800/40 overflow-hidden max-h-[500px] overflow-y-auto">
          {keys.map((key) => (
            <div key={key} className="flex items-center gap-4 px-3 py-2">
              <label htmlFor={`prop-${key}`} className="w-1/3 text-xs font-mono text-slate-400 truncate shrink-0">
                {key}
              </label>
              <input
                id={`prop-${key}`}
                name={key}
                type="text"
                value={properties[key]}
                onChange={(e) => handleChange(key, e.target.value)}
                className="flex-1 rounded border border-slate-700/40 bg-ink-950 px-2 py-1 text-xs font-mono text-slate-200 focus:border-neon-500/50 focus:outline-none"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
