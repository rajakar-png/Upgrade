import { useState, useEffect } from "react"
import { X, Download, Loader2, Calendar, Package, AlertCircle } from "lucide-react"
import { api } from "../../services/api.js"

export default function VersionModal({ isOpen, onClose, project, serverId, onInstall }) {
  const [versions, setVersions] = useState([])
  const [loading, setLoading] = useState(false)
  const [installing, setInstalling] = useState(null)
  const [error, setError] = useState("")
  const token = localStorage.getItem("token")

  useEffect(() => {
    if (isOpen && project) {
      loadVersions()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, project])

  const loadVersions = async () => {
    setLoading(true)
    setError("")
    try {
      const data = await api.serverGetPluginVersions(token, serverId, project.slug)
      setVersions(data)
    } catch (err) {
      setError(err.message || "Failed to load versions")
    } finally {
      setLoading(false)
    }
  }

  const handleInstall = async (version) => {
    setInstalling(version.id)
    setError("")
    try {
      const payload = {
        source: project.source,
        type: project.type,
        slug: project.slug,
        versionId: version.id,
        projectId: project._cfId,
        fileId: project._cfLatestFileId
      }
      const data = await api.serverInstallPlugin(token, serverId, payload)
      onInstall?.(data)
      onClose()
    } catch (err) {
      setError(err.message || "Installation failed")
    } finally {
      setInstalling(null)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-ink-950 border border-slate-700/40 rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800/40">
          <div className="flex items-center gap-3">
            {project?.icon_url ? (
              <img src={project.icon_url} alt="" className="w-10 h-10 rounded-lg" />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
                <Package className="w-5 h-5 text-slate-500" />
              </div>
            )}
            <div>
              <h2 className="text-lg font-semibold text-slate-100">{project?.title}</h2>
              <p className="text-xs text-slate-500">Select version to install</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="mb-4 rounded-lg bg-red-900/20 border border-red-700/30 p-3 text-sm text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No versions available</p>
            </div>
          ) : (
            <div className="space-y-2">
              {versions.map((version) => (
                <div
                  key={version.id}
                  className="rounded-lg border border-slate-800/40 bg-slate-900/20 p-4 hover:border-slate-700/60 transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-slate-200">{version.name || version.version_number}</h3>
                        {version.version_type && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            version.version_type === "release"
                              ? "bg-green-900/30 text-green-300 border border-green-700/40"
                              : version.version_type === "beta"
                              ? "bg-yellow-900/30 text-yellow-300 border border-yellow-700/40"
                              : "bg-red-900/30 text-red-300 border border-red-700/40"
                          }`}>
                            {version.version_type}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(version.date_published).toLocaleDateString()}
                        </span>
                        {version.downloads > 0 && (
                          <span>{version.downloads.toLocaleString()} downloads</span>
                        )}
                      </div>
                      {version.game_versions?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {version.game_versions.slice(0, 5).map((gv) => (
                            <span key={gv} className="inline-flex px-1.5 py-0.5 rounded text-[10px] bg-slate-800/50 text-slate-400">
                              {gv}
                            </span>
                          ))}
                          {version.game_versions.length > 5 && (
                            <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] bg-slate-800/50 text-slate-400">
                              +{version.game_versions.length - 5} more
                            </span>
                          )}
                        </div>
                      )}
                      {version.loaders?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {version.loaders.map((loader) => (
                            <span key={loader} className="inline-flex px-1.5 py-0.5 rounded text-[10px] bg-neon-900/20 text-neon-300 border border-neon-700/30">
                              {loader}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleInstall(version)}
                      disabled={installing !== null}
                      className="flex items-center gap-1.5 rounded-lg border border-green-700/40 bg-green-900/20 px-3 py-2 text-xs font-semibold text-green-300 hover:bg-green-900/30 disabled:opacity-50 shrink-0"
                    >
                      {installing === version.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                      Install
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800/40 p-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-700/40 bg-slate-900/50 text-slate-300 hover:bg-slate-900 transition text-sm font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
