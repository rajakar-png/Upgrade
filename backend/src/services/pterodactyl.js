import axios from "axios"
import { env } from "../config/env.js"
import { clientApi } from "../config/ptero.js"
import { selectBestNode, getAvailableNodes } from "../utils/selectBestNode.js"

// Throw a descriptive error when backup operation is requested but no client key is set
function requireClientApi(operation) {
  if (!clientApi) {
    const err = new Error(
      `Backup ${operation} requires PTERODACTYL_CLIENT_KEY in .env. ` +
      `Generate a Client API key in Pterodactyl panel → Account → API Credentials.`
    )
    err.statusCode = 501
    throw err
  }
  return clientApi
}

const client = axios.create({
  baseURL: `${env.PTERODACTYL_URL.replace(/\/$/, "")}/api/application`,
  headers: {
    Authorization: `Bearer ${env.PTERODACTYL_API_KEY}`,
    Accept: "application/json",
    "Content-Type": "application/json"
  },
  timeout: 15000
})

function parseEnv() {
  try {
    return JSON.parse(env.PTERODACTYL_DEFAULT_ENV || "{}")
  } catch (error) {
    const err = new Error("Invalid PTERODACTYL_DEFAULT_ENV JSON")
    err.statusCode = 500
    throw err
  }
}

function handleError(error, action) {
  // Log full details for debugging — never expose to clients
  console.error(`[PTERODACTYL] ✗ ${action} failed:`, {
    message: error.message,
    status: error.response?.status,
    statusText: error.response?.statusText
  })
  
  // Generic message to the user — no internal details leaked
  const err = new Error("Server provisioning failed. Please try again or contact support.")
  err.statusCode = 502
  throw err
}

export const pterodactyl = {
  async getAvailableAllocation(nodeId) {
    try {
      console.log("[PTERODACTYL] Fetching available allocations for node:", nodeId)
      
      const response = await client.get(`/nodes/${nodeId}/allocations`, {
        params: { per_page: 100 }
      })
      
      const allocations = response.data.data
      const available = allocations.find(a => !a.attributes.assigned)
      
      if (!available) {
        console.error("[PTERODACTYL] ✗ No available allocations found on node", nodeId)
        const err = new Error("No available allocations on the node. Please create more allocations in Pterodactyl panel.")
        err.statusCode = 500
        throw err
      }
      
      console.log("[PTERODACTYL] ✓ Found available allocation:", {
        id: available.attributes.id,
        ip: available.attributes.ip,
        port: available.attributes.port
      })
      
      return available.attributes.id
    } catch (error) {
      if (error.statusCode === 500) throw error
      handleError(error, "allocation fetch")
    }
  },

  async createUser({ email, username, firstName, lastName, password }) {
    try {
      console.log("[PTERODACTYL] Creating user:", { email, username })
      
      const response = await client.post("/users", {
        email,
        username,
        first_name: firstName,
        last_name: lastName,
        password,
        language: "en"
      })
      
      console.log("[PTERODACTYL] ✓ User created with ID:", response.data.attributes.id)
      return response.data.attributes.id
    } catch (error) {
      handleError(error, "user creation")
    }
  },

  async getUserByEmail(email) {
    try {
      console.log("[PTERODACTYL] Looking up user by email:", email)
      
      const response = await client.get("/users", {
        params: { 
          'filter[email]': email,
          per_page: 1
        }
      })
      
      if (response.data.data && response.data.data.length > 0) {
        const userId = response.data.data[0].attributes.id
        console.log("[PTERODACTYL] ✓ Found existing user with ID:", userId)
        return userId
      }
      
      console.log("[PTERODACTYL] No user found with email:", email)
      return null
    } catch (error) {
      console.log("[PTERODACTYL] ✗ Error looking up user:", error.message)
      return null
    }
  },

  async createServer({ name, userId, limits, nodeId: preferredNodeId = null, software = "papermc", eggId = null }) {
    try {
      // Dynamically select the best node based on real-time resource availability.
      // If the user picked a specific node (preferredNodeId), that node is used
      // directly (still verified for capacity + free allocations).
      const { nodeId, allocationId } = await selectBestNode(limits.memory, limits.disk, preferredNodeId)

      // Use provided eggId or fall back to default from env
      const selectedEggId = eggId || env.PTERODACTYL_DEFAULT_EGG

      console.log("[PTERODACTYL] Creating server:", {
        name,
        userId,
        limits,
        node: nodeId,
        egg: selectedEggId,
        allocation: allocationId,
        software
      })
      
      const payload = {
        name,
        user: userId,
        egg: selectedEggId,
        node: nodeId,
        allocation: {
          default: allocationId
        },
        docker_image: env.PTERODACTYL_DEFAULT_DOCKER_IMAGE,
        startup: env.PTERODACTYL_DEFAULT_STARTUP,
        environment: parseEnv(),
        limits: {
          memory: limits.memory,
          swap: 0,
          disk: limits.disk,
          io: 500,
          cpu: limits.cpu * 100
        },
        feature_limits: {
          databases: 0,
          allocations: limits.allocations || 0,
          backups: limits.backups || 0
        },
        start_on_completion: true
      }
      
      const response = await client.post("/servers", payload)
      
      console.log("[PTERODACTYL] ✓ Server created with ID:", response.data.attributes.id)
      return response.data.attributes.id
    } catch (error) {
      handleError(error, "server creation")
    }
  },

  async suspendServer(serverId) {
    try {
      await client.post(`/servers/${serverId}/suspend`)
    } catch (error) {
      handleError(error, "suspension")
    }
  },

  async unsuspendServer(serverId) {
    try {
      await client.post(`/servers/${serverId}/unsuspend`)
    } catch (error) {
      handleError(error, "unsuspend")
    }
  },

  async deleteServer(serverId) {
    try {
      await client.delete(`/servers/${serverId}`)
    } catch (error) {
      handleError(error, "delete")
    }
  },

  async deleteUser(pteroUserId) {
    try {
      await client.delete(`/users/${pteroUserId}`)
      console.log("[PTERODACTYL] ✓ Panel user deleted:", pteroUserId)
    } catch (error) {
      // 404 means user already gone from panel — not an error
      if (error.response?.status === 404) {
        console.log("[PTERODACTYL] Panel user already gone (404):", pteroUserId)
        return
      }
      handleError(error, "user deletion")
    }
  },

  async getServerDetails(serverId) {
    try {
      console.log("[PTERODACTYL] Fetching server details:", serverId)
      
      const response = await client.get(`/servers/${serverId}`, {
        params: { include: 'allocations' }
      })
      
      const server = response.data.attributes
      const allocations = response.data.attributes.relationships?.allocations?.data || []
      
      // Get primary allocation (IP and port)
      const primaryAllocation = allocations.find(a => a.attributes.is_default) || allocations[0]
      
      const details = {
        id: server.id,
        uuid: server.uuid,
        identifier: server.identifier,
        name: server.name,
        status: server.status,
        ip: primaryAllocation?.attributes.ip,
        port: primaryAllocation?.attributes.port,
        allocations: allocations.map(a => ({
          ip: a.attributes.ip,
          port: a.attributes.port,
          isDefault: a.attributes.is_default
        }))
      }
      
      console.log("[PTERODACTYL] ✓ Server details retrieved:", {
        id: details.id,
        identifier: details.identifier,
        ip: details.ip,
        port: details.port
      })
      
      return details
    } catch (error) {
      if (error.response?.status === 404) {
        console.log("[PTERODACTYL] Server not found:", serverId)
        return null
      }
      console.error("[PTERODACTYL] ✗ Failed to fetch server details:", error.message)
      return null
    }
  },

  async getAvailableEggs() {
    try {
      console.log("[PTERODACTYL] Fetching available eggs...")
      const nestsResponse = await client.get("/nests")
      const eggs = []
      
      for (const nest of nestsResponse.data.data) {
        try {
          const nestId = nest.attributes.id
          const eggsResponse = await client.get(`/nests/${nestId}/eggs`)
          
          for (const egg of eggsResponse.data.data) {
            const attr = egg.attributes
            eggs.push({
              id: attr.id,
              name: attr.name,
              description: attr.description || "",
              nestId: nestId,
              nestName: nest.attributes.name,
              author: attr.author,
              dockerImage: attr.docker_image
            })
          }
        } catch (err) {
          // Skip nests we can't access
          console.warn(`[PTERODACTYL] Could not fetch eggs for nest ${nest.attributes.id}:`, err.message)
        }
      }
      
      console.log(`[PTERODACTYL] ✓ Found ${eggs.length} available eggs`)
      return eggs
    } catch (error) {
      console.error("[PTERODACTYL] ✗ Failed to fetch eggs:", error.message)
      // Return empty array instead of throwing to avoid breaking the app
      return []
    }
  },

  // ── Backup Management (uses Client API — requires PTERODACTYL_CLIENT_KEY) ───
  // All methods take the server's short `identifier` (e.g. "1a2b3c4d"),
  // NOT the numeric application ID.

  async createBackup(identifier, name = 'manual-backup') {
    const api = requireClientApi('create')
    try {
      console.log(`[PTERODACTYL] Creating backup for server ${identifier}...`)
      const response = await api.post(`/servers/${identifier}/backups`, {
        name,
        is_locked: false
      })
      const backupUuid = response.data.attributes.uuid
      console.log(`[PTERODACTYL] ✓ Backup created: ${backupUuid}`)
      return backupUuid
    } catch (error) {
      if (error.statusCode === 501) throw error
      console.error(`[PTERODACTYL] ✗ Failed to create backup for ${identifier}:`, error.message)
      const err = new Error('Failed to create backup')
      err.statusCode = 502
      throw err
    }
  },

  async getBackups(identifier) {
    const api = requireClientApi('list')
    try {
      console.log(`[PTERODACTYL] Fetching backups for server ${identifier}...`)
      const response = await api.get(`/servers/${identifier}/backups`)
      const backups = (response.data.data || []).map(backup => ({
        uuid: backup.attributes.uuid,
        name: backup.attributes.name,
        bytes: backup.attributes.bytes,
        created_at: backup.attributes.created_at,
        completed_at: backup.attributes.completed_at,
        is_successful: backup.attributes.is_successful,
        is_locked: backup.attributes.is_locked
      }))
      console.log(`[PTERODACTYL] ✓ Found ${backups.length} backups`)
      return backups
    } catch (error) {
      if (error.statusCode === 501) throw error
      console.error(`[PTERODACTYL] ✗ Failed to fetch backups for ${identifier}:`, error.message)
      const err = new Error('Failed to fetch backups')
      err.statusCode = 502
      throw err
    }
  },

  async deleteBackup(identifier, backupUuid) {
    const api = requireClientApi('delete')
    try {
      console.log(`[PTERODACTYL] Deleting backup ${backupUuid} from server ${identifier}...`)
      await api.delete(`/servers/${identifier}/backups/${backupUuid}`)
      console.log(`[PTERODACTYL] ✓ Backup deleted: ${backupUuid}`)
    } catch (error) {
      if (error.statusCode === 501) throw error
      if (error.response?.status === 404) {
        console.log(`[PTERODACTYL] Backup already gone (404): ${backupUuid}`)
        return
      }
      console.error(`[PTERODACTYL] ✗ Failed to delete backup ${backupUuid}:`, error.message)
      const err = new Error('Failed to delete backup')
      err.statusCode = 502
      throw err
    }
  },

  async restoreBackup(identifier, backupUuid) {
    const api = requireClientApi('restore')
    try {
      console.log(`[PTERODACTYL] Restoring backup ${backupUuid} for server ${identifier}...`)
      await api.post(`/servers/${identifier}/backups/${backupUuid}/restore`, { truncate: false })
      console.log(`[PTERODACTYL] ✓ Backup restore initiated: ${backupUuid}`)
    } catch (error) {
      if (error.statusCode === 501) throw error
      console.error(`[PTERODACTYL] ✗ Failed to restore backup ${backupUuid}:`, error.message)
      const err = new Error('Failed to restore backup')
      err.statusCode = 502
      throw err
    }
  },

  async getBackupDownloadUrl(identifier, backupUuid) {
    const api = requireClientApi('download')
    try {
      console.log(`[PTERODACTYL] Getting download URL for backup ${backupUuid}...`)
      const response = await api.get(`/servers/${identifier}/backups/${backupUuid}/download`)
      const downloadUrl = response.data.attributes.url
      console.log(`[PTERODACTYL] ✓ Got download URL`)
      return downloadUrl
    } catch (error) {
      if (error.statusCode === 501) throw error
      console.error(`[PTERODACTYL] ✗ Failed to get download URL for backup ${backupUuid}:`, error.message)
      const err = new Error('Failed to get backup download URL')
      err.statusCode = 502
      throw err
    }
  },

  getAvailableNodes
}
