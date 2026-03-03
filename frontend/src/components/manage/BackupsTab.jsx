import { useState, useEffect } from "react"
import { Package, Download, Trash2, Loader2, Archive, AlertCircle } from "lucide-react"
import { api } from "../../services/api.js"

export default function BackupsTab({ serverId }) {
  const [backups, setBackups] = useState([])
  const [backupLimit, setBackupLimit] = useState(0)
  const [backupUsed, setBackupUsed] = useState(0)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState("")
  const [restoring, setRestoring] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const token = localStorage.getItem("token")

  const loadBackups = async () => {
    setLoading(true)
    setError("")
    try {
      const data = await api.serverListBackups(token, serverId)
      setBackups(data.backups || [])
      setBackupLimit(data.limit || 0)
      setBackupUsed(data.used || 0)
    } catch (err) {
      setError(err.message || "Failed to load backups")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBackups()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverId])

  const handleCreate = async () => {
    setCreating(true)
    setError("")
    setSuccess("")
    try {
      await api.serverCreateBackup(token, serverId)
      setSuccess("Backup created successfully!")
      loadBackups()
      setTimeout(() => setSuccess(""), 5000)
    } catch (err) {
      setError(err.message || "Failed to create backup")
    } finally {
      setCreating(false)
    }
  }

  const handleRestore = async (backupUuid) => {
    if (!confirm("Are you sure you want to restore this backup? Current server data will be replaced.")) {
      return
    }
    setRestoring(backupUuid)
    setError("")
    setSuccess("")
    try {
      await api.serverRestoreBackup(token, serverId, backupUuid)
      setSuccess("Backup restoration started. Server will restart automatically.")
      setTimeout(() => setSuccess(""), 5000)
    } catch (err) {
      setError(err.message || "Failed to restore backup")
    } finally {
      setRestoring("")
    }
  }

  const handleDelete = async (backupUuid) => {
    if (!confirm("Are you sure you want to delete this backup?")) {
      return
    }
    setDeleting(backupUuid)
    setError("")
    try {
      await api.serverDeleteBackup(token, serverId, backupUuid)
      loadBackups()
    } catch (err) {
      setError(err.message || "Failed to delete backup")
    } finally {
      setDeleting("")
    }
  }

  const handleDownload = async (backupUuid) => {
    try {
      const url = await api.serverDownloadBackup(token, serverId, backupUuid)
      window.open(url, "_blank")
    } catch (err) {
      setError(err.message || "Failed to get download URL")
    }
  }

  const formatBytes = (bytes) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i]
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-900/20 border border-red-700/30 p-3 text-sm text-red-300 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg bg-green-900/20 border border-green-700/30 p-3 text-sm text-green-300">
          {success}
        </div>
      )}

      {/* ── Create Backup Button ───────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">
            Server Backups {backupLimit > 0 && (
              <span className="text-slate-500 font-normal">({backupUsed}/{backupLimit})</span>
            )}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {backupLimit === 0 
              ? "Your plan does not include backups. Please upgrade to enable backups."
              : "Create, restore, or download server backups"}
          </p>
        </div>
        <button
          onClick={handleCreate}
          disabled={creating || backupLimit === 0 || backupUsed >= backupLimit}
          className="flex items-center gap-1.5 rounded-lg border border-neon-400/40 bg-neon-500/15 px-4 py-2 text-xs font-semibold text-neon-200 hover:bg-neon-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
          title={backupUsed >= backupLimit ? "Backup limit reached. Delete old backups first." : "Create new backup"}
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
          Create Backup
        </button>
      </div>

      {/* ── Backups List ────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
        </div>
      ) : backups.length === 0 ? (
        <div className="rounded-xl border border-slate-800/40 bg-ink-950 p-12 text-center">
          <Archive className="h-10 w-10 text-slate-600 mx-auto mb-3" />
          <h4 className="text-sm font-semibold text-slate-300 mb-1">No backups yet</h4>
          <p className="text-xs text-slate-500">Create your first backup to protect your server data.</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-800/40 rounded-lg border border-slate-800/40">
          {backups.map((backup) => (
            <div key={backup.uuid} className="px-4 py-3 group hover:bg-ink-950/50 transition">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="p-2 rounded-lg bg-slate-800/40 flex-shrink-0">
                    <Package className="h-4 w-4 text-slate-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-slate-200 truncate">
                        {backup.name || "Unnamed Backup"}
                      </p>
                      {backup.is_successful === false && (
                        <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase border bg-red-900/30 text-red-300 border-red-700/40">
                          Failed
                        </span>
                      )}
                      {backup.is_successful && backup.completed_at && (
                        <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase border bg-green-900/30 text-green-300 border-green-700/40">
                          Complete
                        </span>
                      )}
                      {backup.is_successful === null && (
                        <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase border bg-yellow-900/30 text-yellow-300 border-yellow-700/40">
                          Processing
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      {backup.bytes && <span>{formatBytes(backup.bytes)}</span>}
                      {backup.created_at && <span>{formatDate(backup.created_at)}</span>}
                      {backup.checksum && (
                        <span className="font-mono text-[10px]">{backup.checksum.substring(0, 8)}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
                  <button
                    onClick={() => handleDownload(backup.uuid)}
                    className="flex items-center gap-1 rounded px-2 py-1 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 transition"
                    title="Download"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleRestore(backup.uuid)}
                    disabled={!!restoring || backup.is_successful === false}
                    className="flex items-center gap-1 rounded px-2 py-1 text-xs text-green-400 hover:text-green-300 hover:bg-green-900/20 transition disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Restore"
                  >
                    {restoring === backup.uuid ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Archive className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(backup.uuid)}
                    disabled={!!deleting}
                    className="flex items-center gap-1 rounded px-2 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-900/20 transition disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Delete"
                  >
                    {deleting === backup.uuid ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Info Notice ─────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-blue-700/30 bg-blue-900/15 px-4 py-3 text-xs text-blue-300">
        <strong>Note:</strong> Backups are stored on the server host. Large backups may take time to create.
        Restore operations will automatically restart your server.
      </div>
    </div>
  )
}
