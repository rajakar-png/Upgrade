import { useState, useRef } from "react"
import { Upload, FileArchive, Check, Loader2, AlertTriangle, Trash2 } from "lucide-react"
import { api } from "../../services/api.js"

export default function BotUploadTab({ serverId, onDeployed }) {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState(null) // { success, message } | null
  const [error, setError] = useState("")
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef(null)

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) validateAndSet(dropped)
  }

  const handleSelect = (e) => {
    const selected = e.target.files[0]
    if (selected) validateAndSet(selected)
  }

  const validateAndSet = (f) => {
    setError("")
    setResult(null)
    const name = f.name.toLowerCase()
    const allowed = [".zip", ".tar.gz", ".tgz", ".tar"]
    if (!allowed.some((ext) => name.endsWith(ext))) {
      setError("Only .zip, .tar.gz, .tgz, or .tar files are accepted.")
      return
    }
    if (f.size > 100 * 1024 * 1024) {
      setError("File too large. Maximum 100 MB.")
      return
    }
    setFile(f)
  }

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    setError("")
    setResult(null)
    try {
      const token = localStorage.getItem("token")
      const data = await api.serverUploadBot(token, serverId, file)
      setResult(data)
      setFile(null)
      if (onDeployed) onDeployed()
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-white mb-1">Deploy your bot</h3>
        <p className="text-sm text-slate-400">
          Upload a ZIP archive containing your bot code. It will be extracted to the server root automatically.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 text-center cursor-pointer transition-all duration-200 ${
          dragOver
            ? "border-primary-500 bg-primary-500/10"
            : file
              ? "border-neon-500/40 bg-neon-500/5"
              : "border-dark-700/50 bg-dark-900/60 hover:border-primary-500/30 hover:bg-dark-900/80"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".zip,.tar.gz,.tgz,.tar"
          onChange={handleSelect}
          className="hidden"
        />

        {file ? (
          <>
            <FileArchive className="h-10 w-10 text-neon-400" />
            <div>
              <p className="text-sm font-semibold text-white">{file.name}</p>
              <p className="text-xs text-slate-400 mt-0.5">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setFile(null); setResult(null) }}
              className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 transition"
            >
              <Trash2 className="h-3 w-3" /> Remove
            </button>
          </>
        ) : (
          <>
            <Upload className="h-10 w-10 text-slate-500" />
            <div>
              <p className="text-sm font-semibold text-slate-300">Drop your bot ZIP here</p>
              <p className="text-xs text-slate-500 mt-0.5">or click to browse — .zip, .tar.gz up to 100 MB</p>
            </div>
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-900/20 border border-red-700/30 p-3 text-sm text-red-300">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Success */}
      {result?.success && (
        <div className="flex items-center gap-2 rounded-lg bg-green-900/20 border border-green-700/30 p-3 text-sm text-green-300">
          <Check className="h-4 w-4 flex-shrink-0" />
          {result.message || "Bot deployed! Go to the Console tab to start it."}
        </div>
      )}

      {/* Upload button */}
      <button
        onClick={handleUpload}
        disabled={!file || uploading}
        className="button-3d w-full px-6 py-3.5 bg-gradient-to-r from-neon-600 to-neon-500 hover:from-neon-500 hover:to-neon-400 text-white rounded-xl font-bold transition-all shadow-glow-neon hover:shadow-lg hover:shadow-neon-500/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:!shadow-none flex items-center justify-center gap-2"
      >
        {uploading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Uploading & extracting…
          </>
        ) : (
          <>
            <Upload className="h-4 w-4" />
            Upload & deploy bot
          </>
        )}
      </button>

      {/* Help text */}
      <div className="rounded-xl border border-dark-700/50 bg-dark-900/60 p-4 space-y-2">
        <h4 className="text-sm font-semibold text-slate-200">How bot deployment works</h4>
        <ol className="text-xs text-slate-400 space-y-1 list-decimal list-inside">
          <li>Create a ZIP with your bot files (index.js, package.json, etc.)</li>
          <li>Upload it here — files are extracted to the server root</li>
          <li>Go to the <b className="text-slate-300">Console</b> tab and start your bot</li>
          <li>Use the <b className="text-slate-300">Files</b> tab to edit configs, add .env, etc.</li>
        </ol>
      </div>
    </div>
  )
}
