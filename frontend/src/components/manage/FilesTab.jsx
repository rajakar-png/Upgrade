import { useState, useEffect } from "react"
import {
  Folder, File, ArrowLeft, Plus, Trash2, Pencil, Save,
  X, Loader2, ChevronRight, Home
} from "lucide-react"
import { api } from "../../services/api.js"

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function FilesTab({ serverId }) {
  const [path, setPath] = useState("/")
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Editor state
  const [editing, setEditing] = useState(null) // { name, content }
  const [editorContent, setEditorContent] = useState("")
  const [saving, setSaving] = useState(false)

  // New folder
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")

  // Delete confirmation
  const [deleting, setDeleting] = useState(null)

  const token = localStorage.getItem("token")

  const loadFiles = async (dir) => {
    setLoading(true)
    setError("")
    try {
      const data = await api.serverListFiles(token, serverId, dir)
      // Sort: folders first, then alphabetically
      data.sort((a, b) => {
        if (a.is_file !== b.is_file) return a.is_file ? 1 : -1
        return a.name.localeCompare(b.name)
      })
      setFiles(data)
      setPath(dir)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFiles("/")
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverId])

  const navigateTo = (dir) => {
    loadFiles(dir)
    setEditing(null)
  }

  const goUp = () => {
    if (path === "/") return
    const parts = path.replace(/\/$/, "").split("/").filter(Boolean)
    parts.pop()
    navigateTo("/" + parts.join("/") + (parts.length ? "/" : ""))
  }

  const openItem = async (item) => {
    if (!item.is_file) {
      const next = path.endsWith("/") ? path + item.name : path + "/" + item.name
      navigateTo(next)
      return
    }
    // Open text files for editing (limit to ~2 MB)
    if (item.size > 2 * 1024 * 1024) {
      setError("File too large to edit in browser")
      return
    }
    try {
      setLoading(true)
      const fpath = (path.endsWith("/") ? path : path + "/") + item.name
      const content = await api.serverGetFile(token, serverId, fpath)
      setEditing({ name: item.name, path: fpath })
      setEditorContent(content)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const saveFile = async () => {
    if (!editing) return
    setSaving(true)
    try {
      await api.serverWriteFile(token, serverId, editing.path, editorContent)
      setEditing(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const createFolder = async () => {
    if (!newFolderName.trim()) return
    try {
      await api.serverCreateFolder(token, serverId, path, newFolderName.trim())
      setShowNewFolder(false)
      setNewFolderName("")
      loadFiles(path)
    } catch (err) {
      setError(err.message)
    }
  }

  const deleteItem = async (name) => {
    try {
      await api.serverDeleteFiles(token, serverId, path, [name])
      setDeleting(null)
      loadFiles(path)
    } catch (err) {
      setError(err.message)
    }
  }

  // Breadcrumb parts
  const breadcrumbs = path.split("/").filter(Boolean)

  // ── Editor view ──────────────────────────────────────────────────────────
  if (editing) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <File className="h-4 w-4 text-slate-500" />
            <span className="font-mono text-xs">{editing.path}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setEditing(null)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700/40 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200"
            >
              <X className="h-3.5 w-3.5" /> Cancel
            </button>
            <button
              onClick={saveFile}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg border border-neon-400/40 bg-neon-500/15 px-3 py-1.5 text-xs font-semibold text-neon-200 hover:bg-neon-500/25 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save
            </button>
          </div>
        </div>
        <textarea
          value={editorContent}
          onChange={(e) => setEditorContent(e.target.value)}
          className="h-[450px] w-full rounded-lg border border-slate-700/40 bg-[#0c0c0c] p-3 font-mono text-xs leading-relaxed text-slate-300 placeholder:text-slate-600 focus:border-neon-500/50 focus:outline-none resize-none"
          spellCheck={false}
        />
      </div>
    )
  }

  // ── File browser view ────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-lg bg-red-900/20 border border-red-700/30 p-2 text-xs text-red-300">
          {error}
          <button onClick={() => setError("")} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {/* Breadcrumbs + actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 text-xs text-slate-400 overflow-x-auto">
          <button onClick={() => navigateTo("/")} className="hover:text-slate-200 shrink-0">
            <Home className="h-3.5 w-3.5" />
          </button>
          {breadcrumbs.map((part, i) => (
            <span key={i} className="flex items-center gap-1 shrink-0">
              <ChevronRight className="h-3 w-3 text-slate-600" />
              <button
                onClick={() => navigateTo("/" + breadcrumbs.slice(0, i + 1).join("/"))}
                className="hover:text-slate-200"
              >
                {part}
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          {path !== "/" && (
            <button onClick={goUp} className="flex items-center gap-1 rounded-lg border border-slate-700/40 px-2 py-1 text-xs text-slate-400 hover:text-slate-200">
              <ArrowLeft className="h-3 w-3" /> Up
            </button>
          )}
          <button
            onClick={() => { setShowNewFolder(true); setNewFolderName("") }}
            className="flex items-center gap-1 rounded-lg border border-neon-400/40 bg-neon-500/15 px-2 py-1 text-xs font-semibold text-neon-200 hover:bg-neon-500/25"
          >
            <Plus className="h-3 w-3" /> Folder
          </button>
        </div>
      </div>

      {/* New folder input */}
      {showNewFolder && (
        <div className="flex gap-2">
          <input
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Folder name"
            className="flex-1 rounded-lg border border-slate-700/40 bg-ink-950 px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:border-neon-500/50 focus:outline-none"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && createFolder()}
          />
          <button onClick={createFolder} className="rounded-lg bg-neon-500/15 px-3 py-1.5 text-xs font-semibold text-neon-200">Create</button>
          <button onClick={() => setShowNewFolder(false)} className="rounded-lg border border-slate-700/40 px-3 py-1.5 text-xs text-slate-400">Cancel</button>
        </div>
      )}

      {/* File listing */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
        </div>
      ) : files.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">Empty directory</p>
      ) : (
        <div className="divide-y divide-slate-800/40 rounded-lg border border-slate-800/40 overflow-hidden">
          {files.map((f) => (
            <div
              key={f.name}
              className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-slate-800/30 cursor-pointer group"
            >
              <button onClick={() => openItem(f)} className="flex flex-1 items-center gap-3 min-w-0 text-left">
                {f.is_file
                  ? <File className="h-4 w-4 shrink-0 text-slate-500" />
                  : <Folder className="h-4 w-4 shrink-0 text-neon-300/70" />
                }
                <span className="truncate text-slate-200">{f.name}</span>
              </button>
              <span className="text-xs text-slate-500 shrink-0">{f.is_file ? formatSize(f.size) : ""}</span>
              <button
                onClick={(e) => { e.stopPropagation(); setDeleting(f.name) }}
                className="opacity-0 group-hover:opacity-100 rounded p-1 text-slate-500 hover:text-red-300 transition"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="rounded-2xl border border-slate-700/40 bg-ink-950 p-6 max-w-sm w-full mx-4 space-y-4">
            <h3 className="text-sm font-semibold text-slate-100">Delete "{deleting}"?</h3>
            <p className="text-xs text-slate-400">This cannot be undone.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleting(null)} className="rounded-lg border border-slate-700/40 px-3 py-1.5 text-xs text-slate-400">Cancel</button>
              <button onClick={() => deleteItem(deleting)} className="rounded-lg bg-red-900/30 border border-red-700/40 px-3 py-1.5 text-xs font-semibold text-red-300">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
