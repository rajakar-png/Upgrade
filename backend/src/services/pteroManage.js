import { appApi } from "../config/ptero.js"
import { wingsRequest, createWingsToken } from "../config/wingsClient.js"
import { env } from "../config/env.js"
import WebSocket from "ws"
import path from "path"

/**
 * Sanitize a file/directory path to prevent path traversal attacks.
 * Rejects paths containing ".." or null bytes.
 * Wings has its own chroot sandbox, but this adds defense-in-depth.
 */
function sanitizePath(p) {
  if (!p || typeof p !== "string") return "/"
  if (p.includes("\0")) {
    throw Object.assign(new Error("Invalid path: null bytes not allowed"), { statusCode: 400 })
  }
  const normalized = path.posix.normalize(p)
  if (normalized.includes("..")) {
    throw Object.assign(new Error("Invalid path: directory traversal not allowed"), { statusCode: 400 })
  }
  return normalized.startsWith("/") ? normalized : "/" + normalized
}

function handleError(error, action) {
  console.error(`[PTERO-MANAGE] ${action} failed:`, {
    message: error.message,
    status: error.response?.status,
    statusText: error.response?.statusText
  })
  const err = new Error(`${action} failed. Please try again.`)
  err.statusCode = error.response?.status === 404 ? 404 : 502
  throw err
}

export const pteroManage = {
  /* ── Application API helpers ────────────────────────────────────────────── */

  /** Get server details (id, uuid, node, limits, allocations, container …) */
  async getServerDetails(pteroServerId) {
    try {
      const res = await appApi.get(`/servers/${pteroServerId}?include=allocations`)
      const a = res.data.attributes

      // Fetch node FQDN so the frontend can show the real connection address
      let nodeFqdn = null
      try {
        const nodeRes = await appApi.get(`/nodes/${a.node}`)
        nodeFqdn = nodeRes.data.attributes.fqdn || null
      } catch {
        /* non-fatal */
      }

      return {
        id: a.id,
        identifier: a.identifier,
        uuid: a.uuid,
        name: a.name,
        description: a.description,
        status: a.status,
        suspended: a.suspended,
        limits: a.limits,
        feature_limits: a.feature_limits,
        node: a.node,
        node_fqdn: nodeFqdn,
        egg: a.egg,
        container: a.container,
        allocations:
          a.relationships?.allocations?.data?.map((al) => ({
            id: al.attributes.id,
            ip: al.attributes.ip,
            ip_alias: al.attributes.alias || null,
            port: al.attributes.port,
            is_default: al.attributes.is_default
          })) || []
      }
    } catch (error) {
      handleError(error, "Get server details")
    }
  },

  /** Reinstall server */
  async reinstallServer(pteroServerId) {
    try {
      await appApi.post(`/servers/${pteroServerId}/reinstall`)
      return { success: true }
    } catch (error) {
      handleError(error, "Reinstall server")
    }
  },

  /* ── Wings Direct API helpers ───────────────────────────────────────────── */
  /*   All methods below talk to Wings daemon directly using the node's       */
  /*   daemon token — no Client API (PTLC_) key required.                     */

  /** Get live resource usage */
  async getResources(serverUuid, nodeId) {
    try {
      const res = await wingsRequest(nodeId, serverUuid, "GET", "")
      const d = res.data
      // Transform Wings format → Client API format (frontend compatibility)
      return {
        current_state: d.state,
        is_suspended: d.is_suspended,
        resources: {
          memory_bytes: d.utilization?.memory_bytes ?? 0,
          cpu_absolute: d.utilization?.cpu_absolute ?? 0,
          disk_bytes: d.utilization?.disk_bytes ?? 0,
          network_rx_bytes: d.utilization?.network?.rx_bytes ?? 0,
          network_tx_bytes: d.utilization?.network?.tx_bytes ?? 0,
          uptime: d.utilization?.uptime ?? 0
        }
      }
    } catch (error) {
      handleError(error, "Get server resources")
    }
  },

  /** Send a console command */
  async sendCommand(serverUuid, nodeId, command) {
    try {
      await wingsRequest(nodeId, serverUuid, "POST", "/commands", {
        data: { commands: [command] }
      })
      return { success: true }
    } catch (error) {
      handleError(error, "Send command")
    }
  },

  /** Power actions: start | stop | restart | kill */
  async sendPowerAction(serverUuid, nodeId, signal) {
    try {
      await wingsRequest(nodeId, serverUuid, "POST", "/power", {
        data: { action: signal }
      })
      return { success: true }
    } catch (error) {
      handleError(error, "Power action")
    }
  },

  /** List files in a directory */
  async listFiles(serverUuid, nodeId, directory = "/") {
    try {
      const res = await wingsRequest(nodeId, serverUuid, "GET", "/files/list-directory", {
        params: { directory: sanitizePath(directory) }
      })
      // Wings returns a flat array; normalise field names
      return (res.data || []).map((f) => ({
        name: f.name,
        mode: f.mode,
        size: f.size,
        is_file: f.file,
        is_symlink: f.symlink,
        mimetype: f.mime,
        created_at: f.created,
        modified_at: f.modified
      }))
    } catch (error) {
      handleError(error, "List files")
    }
  },

  /** Read a file's text content */
  async getFileContents(serverUuid, nodeId, file) {
    try {
      const res = await wingsRequest(nodeId, serverUuid, "GET", "/files/contents", {
        params: { file: sanitizePath(file) },
        transformResponse: [(data) => data]
      })
      return res.data
    } catch (error) {
      handleError(error, "Get file contents")
    }
  },

  /** Write text content to a file */
  async writeFile(serverUuid, nodeId, file, content) {
    try {
      await wingsRequest(nodeId, serverUuid, "POST", "/files/write", {
        params: { file: sanitizePath(file) },
        data: content,
        contentType: "text/plain"
      })
      return { success: true }
    } catch (error) {
      handleError(error, "Write file")
    }
  },

  /** Delete files/folders */
  async deleteFiles(serverUuid, nodeId, root, files) {
    try {
      await wingsRequest(nodeId, serverUuid, "POST", "/files/delete", {
        data: { root: sanitizePath(root), files: files.map(f => sanitizePath(f)) }
      })
      return { success: true }
    } catch (error) {
      handleError(error, "Delete files")
    }
  },

  /** Create a directory */
  async createDirectory(serverUuid, nodeId, root, name) {
    try {
      await wingsRequest(nodeId, serverUuid, "POST", "/files/create-directory", {
        data: { name, path: sanitizePath(root) }
      })
      return { success: true }
    } catch (error) {
      handleError(error, "Create directory")
    }
  },

  /** Rename / move files */
  async renameFile(serverUuid, nodeId, root, files) {
    try {
      await wingsRequest(nodeId, serverUuid, "PUT", "/files/rename", {
        data: { root: sanitizePath(root), files }
      })
      return { success: true }
    } catch (error) {
      handleError(error, "Rename file")
    }
  },

  /** Upload binary content to a file on the server via Wings write endpoint */
  async uploadFile(serverUuid, nodeId, filePath, buffer) {
    try {
      await wingsRequest(nodeId, serverUuid, "POST", "/files/write", {
        params: { file: sanitizePath(filePath) },
        data: buffer,
        contentType: "application/octet-stream",
        timeout: 120000
      })
      return { success: true }
    } catch (error) {
      handleError(error, "Upload file")
    }
  },

  /* ── Startup variables (Application API) ─────────────────────────────── */
  /*   Startup vars live in the Pterodactyl DB, not on Wings, so we use    */
  /*   the Application API with the admin PTLA_ key.                       */

  /** Get startup variables */
  async getStartupVariables(pteroServerId) {
    try {
      const res = await appApi.get(`/servers/${pteroServerId}?include=variables`)
      const vars = res.data.attributes.relationships?.variables?.data || []
      return vars.map((v) => ({
        name: v.attributes.name,
        description: v.attributes.description,
        env_variable: v.attributes.env_variable,
        default_value: v.attributes.default_value,
        server_value: v.attributes.server_value,
        is_editable: v.attributes.is_editable,
        rules: v.attributes.rules
      }))
    } catch (error) {
      handleError(error, "Get startup variables")
    }
  },

  /** Update a single startup variable */
  async updateStartupVariable(pteroServerId, key, value) {
    try {
      // Fetch current config so we can do a full PATCH
      const res = await appApi.get(`/servers/${pteroServerId}?include=variables`)
      const attrs = res.data.attributes
      const vars = attrs.relationships?.variables?.data || []

      // Build environment map from current values
      const environment = {}
      for (const v of vars) {
        const k = v.attributes.env_variable
        environment[k] = v.attributes.server_value ?? v.attributes.default_value ?? ""
      }
      // Apply the update
      environment[key] = value

      await appApi.patch(`/servers/${pteroServerId}/startup`, {
        startup: attrs.container.startup_command,
        egg: attrs.egg,
        image: attrs.container.image,
        environment,
        skip_scripts: false
      })
      return { success: true }
    } catch (error) {
      handleError(error, "Update startup variable")
    }
  },

  /* ── Backup Management (Wings Direct API) ────────────────────────────── */
  /*   All backup methods talk directly to Wings daemon — no Client API     */
  /*   (PTLC_) key required.                                                */

  /** Create a backup on Wings */
  async createBackup(serverUuid, nodeId, backupUuid, ignoredFiles = "") {
    try {
      console.log(`[PTERO-MANAGE] Creating backup ${backupUuid} via Wings...`)
      await wingsRequest(nodeId, serverUuid, "POST", "/backup", {
        data: {
          adapter: "wings",
          uuid: backupUuid,
          ignore: ignoredFiles
        },
        timeout: 120000
      })
      console.log(`[PTERO-MANAGE] ✓ Backup created: ${backupUuid}`)
      return { success: true }
    } catch (error) {
      handleError(error, "Create backup")
    }
  },

  /** List backups stored on Wings for a server */
  async listBackups(serverUuid, nodeId) {
    try {
      const res = await wingsRequest(nodeId, serverUuid, "GET", "/backup")
      // Wings returns an array of backup objects
      return res.data || []
    } catch (error) {
      // 404 means no backups directory yet — that's OK
      if (error.response?.status === 404) return []
      handleError(error, "List backups")
    }
  },

  /** Delete a backup from Wings */
  async deleteBackup(serverUuid, nodeId, backupUuid) {
    try {
      console.log(`[PTERO-MANAGE] Deleting backup ${backupUuid} via Wings...`)
      await wingsRequest(nodeId, serverUuid, "DELETE", `/backup/${backupUuid}`)
      console.log(`[PTERO-MANAGE] ✓ Backup deleted: ${backupUuid}`)
      return { success: true }
    } catch (error) {
      if (error.response?.status === 404) {
        console.log(`[PTERO-MANAGE] Backup already gone (404): ${backupUuid}`)
        return { success: true }
      }
      handleError(error, "Delete backup")
    }
  },

  /** Restore a backup via Wings */
  async restoreBackup(serverUuid, nodeId, backupUuid) {
    try {
      console.log(`[PTERO-MANAGE] Restoring backup ${backupUuid} via Wings...`)
      await wingsRequest(nodeId, serverUuid, "POST", `/backup/${backupUuid}/restore`, {
        data: { adapter: "wings", truncate: false },
        timeout: 300000
      })
      console.log(`[PTERO-MANAGE] ✓ Backup restore initiated: ${backupUuid}`)
      return { success: true }
    } catch (error) {
      handleError(error, "Restore backup")
    }
  },

  /** Get download URL for a backup from Wings (uses a signed JWT) */
  async getBackupDownloadUrl(serverUuid, nodeId, backupUuid) {
    try {
      console.log(`[PTERO-MANAGE] Getting download URL for backup ${backupUuid}...`)
      const { getNodeConfig } = await import("../config/wingsClient.js")
      const { default: jwt } = await import("jsonwebtoken")
      const { randomUUID } = await import("crypto")

      const node = await getNodeConfig(nodeId)

      // Wings /download/backup expects a JWT signed with the daemon token
      const downloadToken = jwt.sign(
        {
          server_uuid: serverUuid,
          backup_uuid: backupUuid,
          unique_id: randomUUID()
        },
        node.token,
        { algorithm: "HS256", expiresIn: "15m" }
      )

      const url = `${node.scheme}://${node.fqdn}:${node.port}/download/backup?token=${downloadToken}`
      console.log(`[PTERO-MANAGE] ✓ Got download URL`)
      return url
    } catch (error) {
      handleError(error, "Get backup download URL")
    }
  },

  /**
   * Open a temporary Wings WebSocket, send a command, capture console output
   * lines for a short window, then close. Returns array of output lines.
   *
   * @param {string} serverUuid
   * @param {number} nodeId
   * @param {string} command - Console command to execute
   * @param {number} [timeoutMs=3000] - How long to capture output after sending
   * @returns {Promise<string[]>} Captured console output lines
   */
  async sendCommandAndCapture(serverUuid, nodeId, command, timeoutMs = 3000) {
    const creds = await createWingsToken(nodeId, serverUuid)

    return new Promise((resolve, reject) => {
      const lines = []
      let authed = false
      const ws = new WebSocket(creds.socket, {
        headers: {
          Authorization: `Bearer ${creds.bearerToken}`,
          Origin: env.PTERODACTYL_URL || ""
        },
        rejectUnauthorized: false,
        handshakeTimeout: 8000
      })

      const cleanup = () => {
        try { ws.close() } catch { /* */ }
      }

      const authTimeout = setTimeout(() => {
        cleanup()
        reject(new Error("Wings auth timeout"))
      }, 10000)

      ws.on("open", () => {
        ws.send(JSON.stringify({ event: "auth", args: [creds.token] }))
      })

      ws.on("message", (raw) => {
        try {
          const msg = JSON.parse(raw.toString())
          if (msg.event === "auth success") {
            authed = true
            clearTimeout(authTimeout)
            // Send the command once authenticated
            ws.send(JSON.stringify({ event: "send command", args: [command] }))
            // Capture output for the window, then resolve
            setTimeout(() => {
              cleanup()
              resolve(lines)
            }, timeoutMs)
          } else if (msg.event === "console output" && authed) {
            lines.push(msg.args?.[0] ?? "")
          } else if (msg.event === "jwt error") {
            clearTimeout(authTimeout)
            cleanup()
            reject(new Error("Wings JWT rejected"))
          }
        } catch { /* ignore */ }
      })

      ws.on("error", (err) => {
        clearTimeout(authTimeout)
        reject(err)
      })

      ws.on("close", () => {
        clearTimeout(authTimeout)
        // If already resolved by timeout, this is harmless
      })
    })
  }
}
