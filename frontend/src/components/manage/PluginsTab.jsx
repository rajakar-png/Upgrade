import { useState, useEffect } from "react"
import { Search, Download, Trash2, Package, Loader2, Blocks, Puzzle, Box, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react"
import { api } from "../../services/api.js"
import VersionModal from "./VersionModal.jsx"

const SOURCE_COLORS = {
  modrinth: "bg-green-900/30 text-green-300 border-green-700/40",
  curseforge: "bg-orange-900/30 text-orange-300 border-orange-700/40"
}

const PROJECT_TYPES = [
  { id: "plugin", label: "Plugins", icon: Puzzle, color: "neon" },
  { id: "mod", label: "Mods", icon: Blocks, color: "purple" },
  { id: "modpack", label: "Modpacks", icon: Box, color: "indigo" }
]

export default function PluginsTab({ serverId }) {
  const [search, setSearch] = useState("")
  const [results, setResults] = useState([])
  const [installedPlugins, setInstalledPlugins] = useState([])
  const [installedMods, setInstalledMods] = useState([])
  const [searching, setSearching] = useState(false)
  const [, setInstalling] = useState("")
  const [deleting, setDeleting] = useState("")
  const [loadingInstalled, setLoadingInstalled] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  // Filters
  const [type, setType] = useState("plugin")
  const [source, setSource] = useState("all")
  const [hasCF, setHasCF] = useState(false)

  // Version selection modal
  const [selectedProject, setSelectedProject] = useState(null)
  const [versionModalOpen, setVersionModalOpen] = useState(false)

  // Pagination
  const [page, setPage] = useState(0)
  const [totalResults, setTotalResults] = useState(0)
  const ITEMS_PER_PAGE = 15

  const token = localStorage.getItem("token")

  // Check which sources are available
  useEffect(() => {
    api.serverGetSources(token, serverId).then((s) => setHasCF(s.curseforge)).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverId])

  // Load installed plugins + mods
  const loadInstalled = async () => {
    setLoadingInstalled(true)
    try {
      const [plugins, mods] = await Promise.all([
        api.serverListPlugins(token, serverId, "plugin").catch(() => []),
        api.serverListPlugins(token, serverId, "mod").catch(() => [])
      ])
      setInstalledPlugins(plugins)
      setInstalledMods(mods)
    } finally {
      setLoadingInstalled(false)
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadInstalled() }, [serverId])

  // Load featured content on mount or when type/source/page changes
  const loadFeatured = async (pg = page) => {
    setSearching(true)
    setError("")
    try {
      const data = await api.serverSearchPlugins(token, serverId, "", { type, source, offset: pg * ITEMS_PER_PAGE, limit: ITEMS_PER_PAGE })
      setResults(data.results || [])
      setTotalResults(data.total || 0)
    } catch (_err) {
      // Silently fail for featured load
    } finally {
      setSearching(false)
    }
  }

  useEffect(() => {
    setPage(0)
    setTotalResults(0)
  }, [type, source])

  useEffect(() => {
    if (search.length >= 2) {
      doSearch(page)
    } else {
      loadFeatured(page)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverId, type, source, page])

  // Search
  const doSearch = async (pg = 0) => {
    if (search.length < 2) return
    setSearching(true)
    setError("")
    try {
      const data = await api.serverSearchPlugins(token, serverId, search, { type, source, offset: pg * ITEMS_PER_PAGE, limit: ITEMS_PER_PAGE })
      setResults(data.results || [])
      setTotalResults(data.total || 0)
    } catch (err) {
      setError(err.message)
    } finally {
      setSearching(false)
    }
  }

  const handleSearch = async (e) => {
    e?.preventDefault()
    if (search.length < 2) return
    setPage(0)
    doSearch(0)
  }

  // Open version selector
  const handleSelectProject = (item) => {
    if (item.source === "modrinth") {
      setSelectedProject(item)
      setVersionModalOpen(true)
    } else {
      // CurseForge: install directly (no version selection UI yet)
      handleQuickInstall(item)
    }
  }

  // Quick install (without version selection)
  const handleQuickInstall = async (item) => {
    const key = item.source + "-" + (item.slug || item.id)
    setInstalling(key)
    setError("")
    setSuccess("")
    try {
      const payload = {
        source: item.source,
        type: item.type || type,
        slug: item.slug,
        projectId: item._cfId,
        fileId: item._cfLatestFileId
      }
      const data = await api.serverInstallPlugin(token, serverId, payload)
      setSuccess(`Installed ${data.name} (${data.filename}). Restart server to load.`)
      loadInstalled()
      setTimeout(() => setSuccess(""), 6000)
    } catch (err) {
      setError(err.message)
    } finally {
      setInstalling("")
    }
  }

  // Handle install from version modal
  const handleInstallFromModal = (data) => {
    setSuccess(`Installed ${data.name} (${data.filename}). Restart server to load.`)
    loadInstalled()
    setTimeout(() => setSuccess(""), 6000)
  }

  // Delete
  const handleDelete = async (filename, delType) => {
    setDeleting(filename)
    setError("")
    try {
      await api.serverDeletePlugin(token, serverId, filename, delType)
      loadInstalled()
    } catch (err) {
      setError(err.message)
    } finally {
      setDeleting("")
    }
  }

  const installedList = type === "mod" ? installedMods : installedPlugins
  const currentTypeConfig = PROJECT_TYPES.find((t) => t.id === type)

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-900/20 border border-red-700/30 p-3 text-xs text-red-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg bg-green-900/20 border border-green-700/30 p-3 text-xs text-green-300 flex items-center gap-2">
          <Package className="w-4 h-4 shrink-0" />
          {success}
        </div>
      )}

      {/* Project Type Tabs */}
      <div>
        <h3 className="text-sm font-semibold text-slate-300 mb-3">Content Type</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {PROJECT_TYPES.map((pt) => {
            const Icon = pt.icon
            return (
              <button
                key={pt.id}
                onClick={() => setType(pt.id)}
                className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-all ${
                  type === pt.id
                    ? "border-neon-500/50 bg-neon-500/10 text-neon-200"
                    : "border-slate-700/40 bg-slate-900/20 text-slate-400 hover:border-slate-600 hover:text-slate-300"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium">{pt.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Source Filter */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-slate-400">Source:</span>
        <div className="flex rounded-lg border border-slate-700/40 overflow-hidden text-xs">
          <button
            onClick={() => setSource("all")}
            className={`px-3 py-1.5 font-semibold transition border-r border-slate-700/40 ${
              source === "all" ? "bg-neon-500/20 text-neon-200" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setSource("modrinth")}
            className={`px-3 py-1.5 font-semibold transition border-r border-slate-700/40 ${
              source === "modrinth" ? "bg-green-900/30 text-green-300" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Modrinth
          </button>
          <button
            onClick={() => setSource("curseforge")}
            disabled={!hasCF}
            className={`px-3 py-1.5 font-semibold transition ${
              source === "curseforge" ? "bg-orange-900/30 text-orange-300" : "text-slate-400 hover:text-slate-200"
            } ${!hasCF ? "opacity-40 cursor-not-allowed" : ""}`}
          >
            CurseForge
          </button>
        </div>
      </div>

      {/* Search */}
      <div>
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${currentTypeConfig?.label.toLowerCase() || "content"}...`}
              className="w-full rounded-lg border border-slate-700/40 bg-ink-950 py-2 pl-9 pr-4 text-sm text-slate-200 placeholder:text-slate-600 focus:border-neon-500/50 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={searching || search.length < 2}
            className="flex items-center gap-1.5 rounded-lg border border-neon-400/40 bg-neon-500/15 px-4 py-2 text-xs font-semibold text-neon-200 hover:bg-neon-500/25 disabled:opacity-50"
          >
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Search
          </button>
        </form>

        {/* Results */}
        {results.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-slate-200 mb-3">
              {search.length >= 2 ? "Search Results" : `Featured ${currentTypeConfig?.label}`}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((p) => {
                const key = p.source + "-" + (p.slug || p.id)
                const Icon = currentTypeConfig?.icon || Package
                return (
                  <div
                    key={key}
                    onClick={() => handleSelectProject(p)}
                    className="group cursor-pointer rounded-lg border border-slate-800/40 bg-slate-900/20 p-3 hover:border-slate-700/60 hover:bg-slate-900/40 transition-all"
                  >
                    <div className="flex gap-3">
                      {p.icon_url ? (
                        <img src={p.icon_url} alt="" className="h-12 w-12 rounded-md shrink-0 bg-slate-800" />
                      ) : (
                        <div className="h-12 w-12 rounded-md bg-slate-800 flex items-center justify-center shrink-0">
                          <Icon className="h-6 w-6 text-slate-600" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="text-sm font-semibold text-slate-200 truncate group-hover:text-neon-200 transition">{p.title}</p>
                          <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase border shrink-0 ${SOURCE_COLORS[p.source]}`}>
                            {p.source === "modrinth" ? "MR" : "CF"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2 mb-2">{p.description}</p>
                        <div className="flex items-center text-xs text-slate-600">
                          <Download className="h-3 w-3 mr-1" />
                          {(p.downloads || 0).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Pagination */}
            {totalResults > ITEMS_PER_PAGE && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  Showing {page * ITEMS_PER_PAGE + 1}–{Math.min((page + 1) * ITEMS_PER_PAGE, totalResults)} of {totalResults.toLocaleString()}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0 || searching}
                    className="flex items-center gap-1 rounded-lg border border-slate-700/40 bg-slate-900/30 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800/50 transition disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" /> Prev
                  </button>
                  <span className="text-xs text-slate-500 tabular-nums">
                    Page {page + 1} / {Math.ceil(totalResults / ITEMS_PER_PAGE)}
                  </span>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={(page + 1) * ITEMS_PER_PAGE >= totalResults || searching}
                    className="flex items-center gap-1 rounded-lg border border-slate-700/40 bg-slate-900/30 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800/50 transition disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Next <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Installed List */}
      {(type === "plugin" || type === "mod") && (
        <div>
          <h3 className="text-sm font-semibold text-slate-200 mb-3">
            Installed {type === "mod" ? "Mods" : "Plugins"}
          </h3>
          {loadingInstalled ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
            </div>
          ) : installedList.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              No {type === "mod" ? "mods" : "plugins"} installed yet.
            </p>
          ) : (
            <div className="divide-y divide-slate-800/40 rounded-lg border border-slate-800/40">
              {installedList.map((p) => (
                <div key={p.name} className="flex items-center justify-between px-4 py-3 group">
                  <div className="flex items-center gap-3 min-w-0">
                    <Package className="h-4 w-4 text-slate-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm text-slate-300 truncate">{p.name}</p>
                      <p className="text-xs text-slate-600">{(p.size / 1024).toFixed(0)} KB</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(p.name, type)}
                    disabled={!!deleting}
                    className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5 rounded px-3 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-900/20 transition"
                  >
                    {deleting === p.name ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Version Selection Modal */}
      <VersionModal
        isOpen={versionModalOpen}
        onClose={() => {
          setVersionModalOpen(false)
          setSelectedProject(null)
        }}
        project={selectedProject}
        serverId={serverId}
        onInstall={handleInstallFromModal}
      />
    </div>
  )
}
