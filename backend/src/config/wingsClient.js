import axios from "axios"
import https from "https"
import jwt from "jsonwebtoken"
import { randomUUID } from "crypto"
import { appApi } from "./ptero.js"
import { env } from "./env.js"

/**
 * Wings Direct API Client
 *
 * Communicates with the Pterodactyl Wings daemon directly using the node's
 * daemon authentication token retrieved via the Application API.
 * This bypasses the Client API entirely — no per-user PTLC_ keys needed.
 *
 * Flow:
 *   Application API → GET /nodes/{id} + /nodes/{id}/configuration
 *     → extract FQDN, port, daemon token
 *     → talk to Wings at {scheme}://{fqdn}:{port}/api/servers/{uuid}/...
 */

// Only skip TLS verification if explicitly opted in via env var (self-signed Wings certs)
const httpsAgent = new https.Agent({ rejectUnauthorized: env.WINGS_ALLOW_SELF_SIGNED !== "true" })

// Cache: nodeId → { fqdn, scheme, port, token, cachedAt }
const nodeCache = new Map()
const CACHE_TTL = 10 * 60 * 1000 // 10 minutes

/**
 * Fetch and cache a Wings node's connection details + daemon token.
 */
export async function getNodeConfig(nodeId) {
  const cached = nodeCache.get(nodeId)
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) return cached

  const [nodeRes, configRes] = await Promise.all([
    appApi.get(`/nodes/${nodeId}`),
    appApi.get(`/nodes/${nodeId}/configuration`)
  ])

  const n = nodeRes.data.attributes
  const daemonConfig = configRes.data

  // The configuration endpoint returns the full Wings config.
  // The daemon auth token is at the top-level "token" field.
  const daemonToken = daemonConfig.token

  console.log("[Wings] Raw config keys:", Object.keys(daemonConfig))

  const config = {
    fqdn: n.fqdn,
    scheme: n.scheme,       // "https" or "http"
    port: n.daemon_listen,  // typically 8080
    token: daemonToken,
    cachedAt: Date.now()
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[Wings] Node ${nodeId} config cached: ${config.scheme}://${config.fqdn}:${config.port} (token: ${config.token ? "[REDACTED]" : "MISSING"})`)
  }

  nodeCache.set(nodeId, config)
  return config
}

/**
 * Make an HTTP request directly to Wings for a specific server.
 *
 * @param {number} nodeId       – Pterodactyl node ID
 * @param {string} serverUuid   – Full server UUID
 * @param {string} method       – HTTP method
 * @param {string} path         – Path appended after /api/servers/{uuid}
 * @param {object} [options]    – { data, params, contentType, headers, timeout, transformResponse }
 */
export async function wingsRequest(nodeId, serverUuid, method, path, options = {}) {
  const node = await getNodeConfig(nodeId)
  const url = `${node.scheme}://${node.fqdn}:${node.port}/api/servers/${serverUuid}${path}`

  return axios({
    method,
    url,
    headers: {
      Authorization: `Bearer ${node.token}`,
      Accept: "application/json",
      "Content-Type": options.contentType || "application/json",
      ...options.headers
    },
    data: options.data,
    params: options.params,
    timeout: options.timeout || 30000,
    transformResponse: options.transformResponse,
    httpsAgent: node.scheme === "https" ? httpsAgent : undefined
  })
}

/**
 * Generate a signed JWT + WebSocket URL for live console connections to Wings.
 *
 * Wings expects a JWT signed with the daemon token using HS256,
 * containing `server_uuid` and `permissions` claims.
 */
export async function createWingsToken(nodeId, serverUuid) {
  const node = await getNodeConfig(nodeId)
  const wsScheme = node.scheme === "https" ? "wss" : "ws"
  const panelUrl = env.PTERODACTYL_URL.replace(/\/$/, "")

  const token = jwt.sign(
    {
      server_uuid: serverUuid,
      permissions: ["*"],
      user_uuid: "00000000-0000-0000-0000-000000000000"
    },
    node.token,
    {
      algorithm: "HS256",
      expiresIn: "10m",
      issuer: panelUrl,
      jwtid: randomUUID()
    }
  )

  return {
    token,
    bearerToken: node.token,
    socket: `${wsScheme}://${node.fqdn}:${node.port}/api/servers/${serverUuid}/ws`
  }
}

/**
 * Invalidate cached config for a node (call on persistent auth failures).
 */
export function invalidateNodeCache(nodeId) {
  nodeCache.delete(nodeId)
}
