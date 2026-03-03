import { useState, useEffect } from "react"
import { Search, Download, Trash2, Package, Loader2, Blocks, Puzzle } from "lucide-react"
import { api } from "../../services/api.js"

const SOURCE_COLORS = {
  modrinth: "bg-green-900/30 text-green-300 border-green-700/40",
  curseforge: "bg-orange-900/30 text-orange-300 border-orange-700/40"
}

export default function PluginsTab({ serverId }) {
  const [search, setSearch] = useState("")
  const [results, setResults] = useState([])
  const [installedPlugins, setInstalledPlugins] = useState([])
  const [installedMods, setInstalledMods] = useState([])
  const [searching, setSearching] = useState(false)
  const [installing, setInstalling] = useState("")
  const [deleting, setDeleting] = useState("")
  const [loadingInstalled, setLoadingInstalled] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  // Filters
  const [type, setType] = useState("plugin") // "plugin" | "mod"
  const [source, setSource] = useState("all") // "all" | "modrinth" | "curseforge"
  const [hasCF, setHasCF] = useState(false)

  const token = localStorage.getItem("token")

  // Check which sources are available
  useEffect(() => {
    api.serverGetSources(token, serverId).then((s) => setHasCF(s.curseforge)).catch(() => {})
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

  useEffect(() => { loadInstalled() }, [serverId])

  // Load featured plugins/mods on mount or when type/source changes
  const loadFeatured = async () => {
    setSearching(true)
    setError("")
    try {
      // Use empty search to get popular/featured items
      const data = await api.serverSearchPlugins(token, serverId, "", { type, source })
      setResults(data)
    } catch (err) {
      // Silently fail for featured load, user can still search
    } finally {
      setSearching(false)
    }
  }

  // Load featured content on mount and when type/source changes
  useEffect(() => {
    loadFeatured()
  }, [serverId, type, source])

  // Search
  const handleSearch = async (e) => {
    e?.preventDefault()
    if (search.length < 2) return
    setSearching(true)
    setError("")
    try {
      const data = await api.serverSearchPlugins(token, serverId, search, { type, source })
      setResults(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setSearching(false)
    }
  }

  // Install
  const handleInstall = async (item) => {
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

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-900/20 border border-red-700/30 p-2 text-xs text-red-300">{error}</div>
      )}
      {success && (
        <div className="rounded-lg bg-green-900/20 border border-green-700/30 p-2 text-xs text-green-300">{success}</div>
      )}

      {/* ── Type & Source toggles ───────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Type toggle */}
        <div className="flex rounded-lg border border-slate-700/40 overflow-hidden text-xs">
          <button
            onClick={() => setType("plugin")}
            className={`flex items-center gap-1.5 px-3 py-1.5 font-semibold transition ${
              type === "plugin"
                ? "bg-neon-500/20 text-neon-200 border-r border-slate-700/40"
                : "text-slate-400 hover:text-slate-200 border-r border-slate-700/40"
            }`}
          >
            <Puzzle className="h-3.5 w-3.5" /> Plugins
          </button>
          <button
            onClick={() => setType("mod")}
            className={`flex items-center gap-1.5 px-3 py-1.5 font-semibold transition ${
              type === "mod"
                ? "bg-neon-500/20 text-neon-200"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Blocks className="h-3.5 w-3.5" /> Mods
          </button>
        </div>

        {/* Source toggle */}
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

      {/* ── Search ──────────────────────────────────────────────────────── */}
      <div>
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600" />
            <input
              id="plugin-search"
              name="q"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${type === "mod" ? "mods" : "plugins"} (e.g. ${type === "mod" ? "Sodium, OptiFine" : "EssentialsX, Vault"})…`}
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

        {results.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-slate-200 mb-2">
              {search.length >= 2 ? "Search Results" : `Featured ${type === "mod" ? "Mods" : "Plugins"}`}
            </h3>
            <div className="divide-y divide-slate-800/40 rounded-lg border border-slate-800/40 max-h-[340px] overflow-y-auto">
              {results.map((p) => {
                const key = p.source + "-" + (p.slug || p.id)
                return (
                  <div key={key} className="flex items-center gap-3 px-3 py-2.5">
                    {p.icon_url ? (
                      <img src={p.icon_url} alt="" className="h-8 w-8 rounded-md shrink-0 bg-slate-800" />
                    ) : (
                      <div className="h-8 w-8 rounded-md bg-slate-800 flex items-center justify-center shrink-0">
                        <Package className="h-4 w-4 text-slate-600" />
                      </div>
                    )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-200 truncate">{p.title}</p>
                      <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase border ${SOURCE_COLORS[p.source]}`}>
                        {p.source === "modrinth" ? "MR" : "CF"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 truncate">{p.description}</p>
                  </div>
                  <span className="text-xs text-slate-600 shrink-0">{(p.downloads || 0).toLocaleString()} DL</span>
                  <button
                    onClick={() => handleInstall(p)}
                    disabled={!!installing}
                    className="flex items-center gap-1 rounded-lg border border-green-700/40 bg-green-900/20 px-2.5 py-1 text-xs font-semibold text-green-300 hover:bg-green-900/30 disabled:opacity-50 shrink-0"
                  >
                    {installing === key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                    Install
                  </button>
                </div>
              )
            })}
            </div>
          </div>
        )}
      </div>

      {/* ── Installed list ──────────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-slate-200 mb-2">
          Installed {type === "mod" ? "Mods" : "Plugins"}
        </h3>
        {loadingInstalled ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
          </div>
        ) : installedList.length === 0 ? (
          <p className="py-4 text-center text-xs text-slate-500">
            No {type === "mod" ? "mods" : "plugins"} installed yet.
          </p>
        ) : (
          <div className="divide-y divide-slate-800/40 rounded-lg border border-slate-800/40">
            {installedList.map((p) => (
              <div key={p.name} className="flex items-center justify-between px-3 py-2 group">
                <div className="flex items-center gap-2 min-w-0">
                  <Package className="h-4 w-4 text-slate-500 shrink-0" />
                  <span className="text-sm text-slate-300 truncate">{p.name}</span>
                  <span className="text-xs text-slate-600">{(p.size / 1024).toFixed(0)} KB</span>
                </div>
                <button
                  onClick={() => handleDelete(p.name, type)}
                  disabled={!!deleting}
                  className="opacity-0 group-hover:opacity-100 flex items-center gap-1 rounded px-2 py-1 text-xs text-red-400 hover:text-red-300 transition"
                >
                  {deleting === p.name ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
