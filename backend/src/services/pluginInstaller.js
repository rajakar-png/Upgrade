import axios from "axios"
import path from "path"
import { pteroManage } from "./pteroManage.js"
import { env } from "../config/env.js"

/* ═══════════════════════════════════════════════════════════════════════════ *
 *  Plugin / Mod Installer — Modrinth + CurseForge                           *
 * ═══════════════════════════════════════════════════════════════════════════ */

// Security: restrict downloads to known CDN hosts to prevent SSRF
const ALLOWED_DOWNLOAD_HOSTS = new Set([
  "cdn.modrinth.com",
  "edge.forgecdn.net",
  "mediafilez.forgecdn.net",
  "media.forgecdn.net"
])

const MAX_DOWNLOAD_BYTES = 500 * 1024 * 1024 // 500 MB

/** Validate a download URL is from a trusted host and uses HTTPS */
function validateDownloadUrl(url) {
  const parsed = new URL(url)
  if (parsed.protocol !== "https:") {
    throw Object.assign(new Error("Only HTTPS download URLs are allowed"), { statusCode: 400 })
  }
  if (!ALLOWED_DOWNLOAD_HOSTS.has(parsed.hostname)) {
    throw Object.assign(new Error(`Untrusted download host: ${parsed.hostname}`), { statusCode: 400 })
  }
}

/** Sanitize a filename from an external API to prevent path traversal */
function sanitizeFilename(name) {
  if (!name || typeof name !== "string") {
    throw Object.assign(new Error("Missing filename"), { statusCode: 400 })
  }
  // Strip any path components — only keep the basename
  const safe = path.basename(name)
  if (!safe || safe.startsWith(".") || safe.includes("..")) {
    throw Object.assign(new Error("Invalid filename"), { statusCode: 400 })
  }
  return safe
}

const MODRINTH_API = "https://api.modrinth.com/v2"
const CURSEFORGE_API = "https://api.curseforge.com/v1"
const CF_GAME_MINECRAFT = 432
const CF_CLASS_PLUGINS = 5   // Bukkit Plugins
const CF_CLASS_MODS = 6      // Mods (Forge / Fabric / NeoForge / Quilt)
const CF_CLASS_MODPACKS = 4471 // Modpacks

// Supported Modrinth project types
const PROJECT_TYPES = {
  plugin: { facet: "project_type:plugin", dir: "plugins", loaders: ["paper", "spigot", "purpur", "bukkit", "folia"] },
  mod: { facet: "project_type:mod", dir: "mods", loaders: ["forge", "fabric", "neoforge", "quilt"] },
  datapack: { facet: "project_type:datapack", dir: "world/datapacks", loaders: ["datapack"] },
  shader: { facet: "project_type:shader", dir: "shaderpacks", loaders: ["iris", "optifine", "canvas"] },
  resourcepack: { facet: "project_type:resourcepack", dir: "resourcepacks", loaders: ["minecraft"] },
  modpack: { facet: "project_type:modpack", dir: ".", loaders: ["forge", "fabric", "neoforge", "quilt"] }
}

/** Helper: build CurseForge headers (requires API key) */
function cfHeaders() {
  return { "x-api-key": env.CURSEFORGE_API_KEY, Accept: "application/json" }
}

/** Check if CurseForge is available (API key configured) */
function hasCurseForge() {
  return Boolean(env.CURSEFORGE_API_KEY)
}

/* ── Modrinth ─────────────────────────────────────────────────────────────── */

async function searchModrinth(query, type = "plugin", limit = 15, offset = 0) {
  const projectType = PROJECT_TYPES[type] || PROJECT_TYPES.plugin
  const facets = [[projectType.facet]]
  const normalizedQuery = String(query || "").trim()
  const isTrending = normalizedQuery.length === 0

  const res = await axios.get(`${MODRINTH_API}/search`, {
    params: {
      query: isTrending ? "minecraft" : normalizedQuery,
      limit,
      offset,
      facets: JSON.stringify(facets),
      index: isTrending ? "downloads" : "relevance"
    },
    timeout: 10000
  })

  const hits = res.data.hits
    .map((p) => ({
    source: "modrinth",
    id: p.slug,
    slug: p.slug,
    project_id: p.project_id,
    title: p.title,
    description: p.description,
    downloads: p.downloads,
    icon_url: p.icon_url,
    categories: p.categories,
    author: p.author,
    latest_version: p.latest_version,
    date_created: p.date_created,
    date_modified: p.date_modified,
    project_type: p.project_type,
    type,
    client_side: p.client_side,
    server_side: p.server_side
  }))

  return { results: hits, total: res.data.total_hits || hits.length, offset, limit }
}

async function getModrinthVersions(slug) {
  const res = await axios.get(`${MODRINTH_API}/project/${slug}/version`, { timeout: 10000 })
  return res.data.map((v) => ({
    id: v.id,
    version_number: v.version_number,
    version_type: v.version_type, // release, beta, alpha
    name: v.name,
    changelog: v.changelog,
    date_published: v.date_published,
    downloads: v.downloads,
    game_versions: v.game_versions,
    loaders: v.loaders,
    files: v.files.map((f) => ({
      url: f.url,
      filename: f.filename,
      primary: f.primary,
      size: f.size,
      file_type: f.file_type
    })),
    dependencies: v.dependencies
  }))
}

async function installFromModrinth(serverUuid, nodeId, slug, type = "plugin", versionId = null) {
  // 1. Fetch available versions
  const versionsRes = await axios.get(`${MODRINTH_API}/project/${slug}/version`, { timeout: 10000 })
  const versions = versionsRes.data
  if (!versions.length) {
    throw Object.assign(new Error("No versions found for this project"), { statusCode: 404 })
  }

  // If specific version requested, use it; otherwise pick best compatible
  let target
  if (versionId) {
    target = versions.find((v) => v.id === versionId)
    if (!target) {
      throw Object.assign(new Error("Specified version not found"), { statusCode: 404 })
    }
  } else {
    // Prefer compatible loaders based on type
    const projectType = PROJECT_TYPES[type] || PROJECT_TYPES.plugin
    const loaders = projectType.loaders
    target =
      versions.find((v) => v.loaders?.some((l) => loaders.includes(l.toLowerCase()))) ||
      versions[0]
  }

  // Find the primary file (support .jar and .zip for datapacks/resourcepacks)
  const primaryFile = (() => {
    // For modpacks, prefer server pack archives when available.
    if (type === "modpack") {
      return (
        target.files?.find((f) => /server/i.test(String(f.filename || "")) && String(f.filename || "").endsWith(".zip")) ||
        target.files?.find((f) => f.primary && String(f.filename || "").endsWith(".zip")) ||
        target.files?.find((f) => String(f.filename || "").endsWith(".zip"))
      )
    }

    return (
      target.files?.find((f) => f.primary) ||
      target.files?.find((f) => f.filename.endsWith(".jar") || f.filename.endsWith(".zip")) ||
      target.files?.[0]
    )
  })()

  if (!primaryFile) {
    throw Object.assign(new Error("No downloadable file found in this version"), { statusCode: 404 })
  }

  if (type === "modpack" && !String(primaryFile.filename || "").endsWith(".zip")) {
    throw Object.assign(new Error("No server-compatible modpack archive found for this version"), { statusCode: 400 })
  }

  // 2. Download the file (with SSRF protection and size limit)
  validateDownloadUrl(primaryFile.url)
  const downloadRes = await axios.get(primaryFile.url, {
    responseType: "arraybuffer",
    timeout: 120000,
    maxContentLength: MAX_DOWNLOAD_BYTES,
    maxBodyLength: MAX_DOWNLOAD_BYTES
  })

  // 3. Upload to correct directory based on project type
  const projectType = PROJECT_TYPES[type] || PROJECT_TYPES.plugin
  const dir = projectType.dir
  const safeFilename = sanitizeFilename(primaryFile.filename)
  
  // Create directory structure if needed
  const dirParts = dir.split("/").filter(Boolean)
  let currentPath = "/"
  for (const part of dirParts) {
    try { await pteroManage.createDirectory(serverUuid, nodeId, currentPath, part) } catch { /* exists */ }
    currentPath += part + "/"
  }

  await pteroManage.uploadFile(serverUuid, nodeId, `/${dir}/${safeFilename}`, Buffer.from(downloadRes.data))

  return {
    success: true,
    source: "modrinth",
    name: slug,
    filename: safeFilename,
    version: target.version_number,
    version_id: target.id,
    type
  }
}

/* ── CurseForge ───────────────────────────────────────────────────────────── */

async function searchCurseForge(query, type = "plugin", limit = 15, offset = 0) {
  if (!hasCurseForge()) return { results: [], total: 0, offset, limit }

  const classId = type === "mod"
    ? CF_CLASS_MODS
    : type === "modpack"
      ? CF_CLASS_MODPACKS
      : CF_CLASS_PLUGINS

  const res = await axios.get(`${CURSEFORGE_API}/mods/search`, {
    headers: cfHeaders(),
    params: {
      gameId: CF_GAME_MINECRAFT,
      classId,
      searchFilter: query,
      pageSize: limit,
      index: offset,
      sortField: 2, // Popularity
      sortOrder: "desc"
    },
    timeout: 10000
  })

  const items = (res.data?.data || [])
    .map((m) => ({
    source: "curseforge",
    id: String(m.id),
    slug: m.slug,
    title: m.name,
    description: m.summary,
    downloads: m.downloadCount,
    icon_url: m.logo?.thumbnailUrl || "",
    categories: m.categories?.map((c) => c.name) || [],
    type,
    // Needed for install
    _cfId: m.id,
    _cfLatestFileId: m.mainFileId || m.latestFiles?.[0]?.id,
    server_pack_available: (m.latestFiles || []).some((f) => f?.isServerPack || f?.serverPackFileId || /server/i.test(String(f?.fileName || "")))
  }))

  return { results: items, total: res.data?.pagination?.totalCount || items.length, offset, limit }
}

async function installFromCurseForge(serverUuid, nodeId, projectId, fileId, type = "plugin") {
  if (!hasCurseForge()) {
    throw Object.assign(new Error("CurseForge API key not configured"), { statusCode: 400 })
  }

  // 1. If no fileId provided, get latest file
  if (!fileId) {
    const filesRes = await axios.get(`${CURSEFORGE_API}/mods/${projectId}/files`, {
      headers: cfHeaders(),
      params: { pageSize: 10 },
      timeout: 10000
    })
    const files = filesRes.data?.data || []
    if (!files.length) {
      throw Object.assign(new Error("No files found for this project"), { statusCode: 404 })
    }
    fileId = files[0].id
  }

  // 2. Get download URL
  let fileRes = await axios.get(`${CURSEFORGE_API}/mods/${projectId}/files/${fileId}`, {
    headers: cfHeaders(),
    timeout: 10000
  })
  let fileData = fileRes.data?.data
  if (!fileData) {
    throw Object.assign(new Error("File not found"), { statusCode: 404 })
  }

  // For modpacks, install server pack file if available.
  if (type === "modpack") {
    if (fileData.serverPackFileId) {
      fileRes = await axios.get(`${CURSEFORGE_API}/mods/${projectId}/files/${fileData.serverPackFileId}`, {
        headers: cfHeaders(),
        timeout: 10000
      })
      fileData = fileRes.data?.data
    }

    if (!fileData?.isServerPack && !/server/i.test(String(fileData?.fileName || ""))) {
      throw Object.assign(new Error("Selected CurseForge file does not provide a server pack"), { statusCode: 400 })
    }
  }

  let downloadUrl = fileData.downloadUrl
  // Some mods don't expose downloadUrl — construct from CDN manually
  if (!downloadUrl) {
    const idStr = String(fileData.id)
    const part1 = idStr.substring(0, 4)
    const part2 = idStr.substring(4)
    downloadUrl = `https://edge.forgecdn.net/files/${part1}/${part2}/${fileData.fileName}`
  }

  // 3. Download (with SSRF protection and size limit)
  validateDownloadUrl(downloadUrl)
  const downloadRes = await axios.get(downloadUrl, {
    responseType: "arraybuffer",
    timeout: 120000,
    maxContentLength: MAX_DOWNLOAD_BYTES,
    maxBodyLength: MAX_DOWNLOAD_BYTES
  })

  // 4. Upload to correct directory (with filename sanitization)
  const dir = type === "mod" ? "mods" : type === "modpack" ? "modpacks" : "plugins"
  const safeFilename = sanitizeFilename(fileData.fileName)
  try { await pteroManage.createDirectory(serverUuid, nodeId, "/", dir) } catch { /* exists */ }

  await pteroManage.uploadFile(serverUuid, nodeId, `/${dir}/${safeFilename}`, Buffer.from(downloadRes.data))

  return {
    success: true,
    source: "curseforge",
    name: fileData.displayName || safeFilename,
    filename: safeFilename,
    version: fileData.displayName || String(fileData.id),
    type
  }
}

async function getCurseForgeVersions(projectId, limit = 30) {
  if (!hasCurseForge()) {
    throw Object.assign(new Error("CurseForge API key not configured"), { statusCode: 400 })
  }

  const pageSize = Math.min(50, Math.max(1, Number(limit) || 30))
  const filesRes = await axios.get(`${CURSEFORGE_API}/mods/${projectId}/files`, {
    headers: cfHeaders(),
    params: { pageSize, index: 0 },
    timeout: 10000
  })

  const files = filesRes.data?.data || []
  return files.map((f) => ({
    id: String(f.id),
    file_id: f.id,
    version_number: f.displayName || String(f.id),
    version_type: f.releaseType === 1 ? "release" : f.releaseType === 2 ? "beta" : "alpha",
    name: f.displayName,
    file_name: f.fileName || "",
    is_server_pack: Boolean(f.isServerPack),
    server_pack_file_id: f.serverPackFileId || null,
    server_pack_available: Boolean(f.isServerPack || f.serverPackFileId || /server/i.test(String(f.fileName || ""))),
    changelog: "",
    date_published: f.fileDate,
    downloads: f.downloadCount || 0,
    game_versions: f.gameVersions || [],
    loaders: [],
    files: []
  }))
}

/* ── Unified API ──────────────────────────────────────────────────────────── */

export const pluginInstaller = {
  /** Check if CurseForge is available */
  hasCurseForge,

  /**
   * Search for plugins/mods/datapacks/etc across one or both sources.
   * @param {string} query
   * @param {object} opts - { type: "plugin"|"mod"|"datapack"|"shader"|"resourcepack"|"modpack", source: "modrinth"|"curseforge"|"all", limit }
   */
  async search(query, { type = "plugin", source = "all", limit = 15, offset = 0 } = {}) {
    const normalizedQuery = String(query || "").trim()

    // Cross-source pagination must happen after merge; otherwise each provider
    // paginates independently and the UI receives inconsistent pages.
    if (source === "all") {
      const combinedWindow = Math.min(100, offset + limit)
      const responses = await Promise.all([
        searchModrinth(normalizedQuery, type, combinedWindow, 0).catch(() => ({ results: [], total: 0 })),
        hasCurseForge() && ["plugin", "mod", "modpack"].includes(type)
          ? searchCurseForge(normalizedQuery || "minecraft", type, combinedWindow, 0).catch(() => ({ results: [], total: 0 }))
          : Promise.resolve({ results: [], total: 0 })
      ])

      const merged = responses
        .flatMap((r) => r.results)
        .sort((a, b) => Number(b.downloads || 0) - Number(a.downloads || 0))

      return {
        results: merged.slice(offset, offset + limit),
        total: responses.reduce((sum, r) => sum + Number(r.total || 0), 0),
        offset,
        limit
      }
    }

    const promises = []

    if (source === "modrinth") {
      promises.push(searchModrinth(normalizedQuery, type, limit, offset).catch(() => ({ results: [], total: 0 })))
    }
    // CurseForge only supports plugins and mods
    if (source === "curseforge" && hasCurseForge() && ["plugin", "mod", "modpack"].includes(type)) {
      promises.push(searchCurseForge(normalizedQuery || "minecraft", type, limit, offset).catch(() => ({ results: [], total: 0 })))
    }

    const responses = await Promise.all(promises)
    const results = responses.flatMap((r) => r.results)
    const total = responses.reduce((sum, r) => sum + Number(r.total || 0), 0)
    return { results, total, offset, limit }
  },

  /**
   * Get all versions for a Modrinth project.
   * @param {string} slug - Project slug or ID
   */
  async getVersions(slug) {
    return getModrinthVersions(slug)
  },

  async getCurseForgeVersions(projectId, limit = 30) {
    return getCurseForgeVersions(projectId, limit)
  },

  /**
   * Install a plugin/mod/datapack/etc from the specified source.
   * @param {string} serverUuid
   * @param {number} nodeId
   * @param {object} opts - { source, slug, projectId, fileId, versionId, type }
   */
  async install(serverUuid, nodeId, { source, slug, projectId, fileId, versionId, type = "plugin" }) {
    if (source === "curseforge") {
      return installFromCurseForge(serverUuid, nodeId, projectId, fileId, type)
    }
    // Default: modrinth
    return installFromModrinth(serverUuid, nodeId, slug, type, versionId)
  },

  // Keep backwards-compat aliases
  searchPlugins: (query, limit) => searchModrinth(query, "plugin", limit),
  installPlugin: (serverUuid, nodeId, slug) => installFromModrinth(serverUuid, nodeId, slug, "plugin")
}
