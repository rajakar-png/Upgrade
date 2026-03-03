/**
 * selectBestNode.js
 *
 * Automatically selects the best Pterodactyl node for provisioning a new
 * server based on real-time resource availability from the Application API.
 *
 * Strategy: "most free memory first"
 *   Nodes are ranked by remaining memory headroom after accounting for
 *   overallocation policy. This naturally distributes load — the fullest
 *   nodes fill up last, and the most available node always wins.
 *
 * Algorithm:
 *   1. Fetch all nodes (paginated)
 *   2. For each node, compute effective memory/disk capacity including
 *      the Pterodactyl overallocation percentage
 *   3. Subtract already-allocated resources to get headroom
 *   4. Skip nodes below the required thresholds
 *   5. Fetch free allocations for remaining candidates
 *   6. Skip nodes with no free allocations
 *   7. Sort survivors by free memory descending → pick winner
 *   8. Return { nodeId, allocationId }
 *
 * Overallocation rules:
 *   overalloc = 0   → no overallocation; cap = limit
 *   overalloc = N   → N% over; cap = limit × (1 + N/100)
 *   overalloc = -1  → unlimited; cap = Infinity
 */

import axios from "axios"
import { env } from "../config/env.js"

// Reuse the same Axios client configuration as pterodactyl.js
const client = axios.create({
  baseURL: `${env.PTERODACTYL_URL.replace(/\/$/, "")}/api/application`,
  headers: {
    Authorization: `Bearer ${env.PTERODACTYL_API_KEY}`,
    Accept: "application/json",
    "Content-Type": "application/json"
  },
  timeout: 15000
})

// ─── Internal helpers ────────────────────────────────────────────────────────

/**
 * Fetch every node from the Pterodactyl panel, handling pagination.
 * @returns {Promise<object[]>} array of raw node attribute objects
 */
async function fetchAllNodes() {
  const nodes = []
  let page = 1

  while (true) {
    const res = await client.get("/nodes", {
      params: { per_page: 50, page }
    })
    const body = res.data

    for (const item of body.data ?? []) {
      nodes.push(item.attributes)
    }

    const pagination = body.meta?.pagination
    if (!pagination || page >= pagination.total_pages) break
    page++
  }

  console.log(`[NODE-SELECT] Loaded ${nodes.length} node(s) from panel`)
  return nodes
}

/**
 * Fetch all unassigned allocations for a given node, handling pagination.
 * @param {number} nodeId
 * @returns {Promise<object[]>} free allocation attribute objects
 */
async function fetchFreeAllocations(nodeId) {
  const free = []
  let page = 1

  while (true) {
    const res = await client.get(`/nodes/${nodeId}/allocations`, {
      params: { per_page: 100, page }
    })
    const body = res.data

    for (const item of body.data ?? []) {
      if (!item.attributes.assigned) {
        free.push(item.attributes)
      }
    }

    const pagination = body.meta?.pagination
    if (!pagination || page >= pagination.total_pages) break
    page++
  }

  return free
}

/**
 * Calculate the effective total capacity for a resource dimension,
 * respecting Pterodactyl's overallocation setting.
 *
 * @param {number} limit     configured hard limit in MB
 * @param {number} overalloc overallocation percentage (-1 | 0 | positive)
 * @returns {number}         effective capacity in MB (Infinity when unlimited)
 */
function effectiveCapacity(limit, overalloc) {
  if (overalloc === -1) return Infinity
  const pct = Math.max(0, overalloc) // treat negative (other than -1) as 0
  return Math.floor(limit * (1 + pct / 100))
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Select the best available Pterodactyl node for a new server.
 *
 * Queries the live Application API — results are always fresh, never cached,
 * so concurrent provisioning picks different nodes correctly.
 *
 * @param {number} requiredMemory  RAM needed in MB  (e.g. 2048)
 * @param {number} requiredDisk    Disk needed in MB (e.g. 10240)
 *
 * @returns {Promise<{ nodeId: number, allocationId: number }>}
 *
 * @throws {Error} with statusCode 502 if the panel API is unreachable
 * @throws {Error} with statusCode 503 if no node has sufficient capacity
 */
export async function selectBestNode(requiredMemory, requiredDisk, preferredNodeId = null) {
  console.log(
    `[NODE-SELECT] Looking for node with ≥${requiredMemory} MB RAM, ≥${requiredDisk} MB disk` +
    (preferredNodeId ? ` (preferred nodeId=${preferredNodeId})` : "")
  )

  // ── 1. Fetch node list ──────────────────────────────────────────────────
  let nodes
  try {
    nodes = await fetchAllNodes()
  } catch (err) {
    console.error("[NODE-SELECT] ✗ Failed to fetch node list:", err.message)
    const e = new Error("Could not retrieve node list from Pterodactyl panel.")
    e.statusCode = 502
    throw e
  }

  if (nodes.length === 0) {
    const e = new Error("No nodes are configured in the Pterodactyl panel.")
    e.statusCode = 503
    throw e
  }

  // If the user picked a specific node, restrict to just that node
  if (preferredNodeId) {
    nodes = nodes.filter((n) => n.id === preferredNodeId)
    if (nodes.length === 0) {
      const e = new Error("The selected location is no longer available. Please choose another.")
      e.statusCode = 503
      throw e
    }
  }

  // ── 2. Filter and score each node ──────────────────────────────────────
  const candidates = []

  for (const node of nodes) {
    const capMem  = effectiveCapacity(node.memory, node.memory_overallocate ?? 0)
    const capDisk = effectiveCapacity(node.disk,   node.disk_overallocate   ?? 0)

    const usedMem  = node.allocated_resources?.memory ?? 0
    const usedDisk = node.allocated_resources?.disk   ?? 0

    const freeMem  = capMem  === Infinity ? Infinity : capMem  - usedMem
    const freeDisk = capDisk === Infinity ? Infinity : capDisk - usedDisk

    const logTag = `Node ${node.id} (${node.name})`
    console.log(
      `[NODE-SELECT] ${logTag}: freeMem=${freeMem === Infinity ? "∞" : freeMem + "MB"}` +
      ` freeDisk=${freeDisk === Infinity ? "∞" : freeDisk + "MB"}`
    )

    // ── Resource checks ──────────────────────────────────────────────────
    if (freeMem < requiredMemory) {
      console.log(`[NODE-SELECT] ${logTag} skipped — memory too low (${freeMem} < ${requiredMemory})`)
      continue
    }
    if (freeDisk < requiredDisk) {
      console.log(`[NODE-SELECT] ${logTag} skipped — disk too low (${freeDisk} < ${requiredDisk})`)
      continue
    }

    // ── Allocation check ──────────────────────────────────────────────────
    let freeAllocs
    try {
      freeAllocs = await fetchFreeAllocations(node.id)
    } catch (err) {
      // Don't abort the whole selection — just skip this node
      console.error(`[NODE-SELECT] ${logTag} skipped — could not fetch allocations: ${err.message}`)
      continue
    }

    if (freeAllocs.length === 0) {
      console.log(`[NODE-SELECT] ${logTag} skipped — no free allocations`)
      continue
    }

    console.log(`[NODE-SELECT] ${logTag} ✓ eligible (${freeAllocs.length} free allocation(s))`)
    candidates.push({
      nodeId:       node.id,
      nodeName:     node.name,
      freeMem,
      freeDisk,
      freeAllocCount: freeAllocs.length,
      // Always use the first free allocation; Pterodactyl orders them by port
      allocationId: freeAllocs[0].id
    })
  }

  // ── 3. Fail gracefully if nothing qualifies ───────────────────────────
  if (candidates.length === 0) {
    console.error("[NODE-SELECT] ✗ No eligible nodes found — all are full or have no free allocations")
    const e = new Error(
      "All nodes are currently full. Please try again later."
    )
    e.statusCode = 503
    throw e
  }

  // ── 4. Pick the node with the most free memory (Infinity-safe sort) ────
  candidates.sort((a, b) => {
    if (a.freeMem === Infinity && b.freeMem === Infinity) {
      // Both unlimited — prefer the one with more free allocations
      return b.freeAllocCount - a.freeAllocCount
    }
    if (a.freeMem === Infinity) return -1
    if (b.freeMem === Infinity) return 1
    return b.freeMem - a.freeMem
  })

  const best = candidates[0]
  console.log(
    `[NODE-SELECT] ✓ Winner: Node ${best.nodeId} (${best.nodeName})` +
    ` — freeMem=${best.freeMem === Infinity ? "∞" : best.freeMem + "MB"}` +
    ` allocationId=${best.allocationId}` +
    ` (${candidates.length} candidate(s) evaluated)`
  )

  return {
    nodeId:       best.nodeId,
    allocationId: best.allocationId
  }
}

/**
 * Return all eligible nodes (enough resources + free allocations) as a list
 * suitable for presenting location choices to the user on the frontend.
 *
 * @param {number} [requiredMemory=0]
 * @param {number} [requiredDisk=0]
 * @returns {Promise<Array<{ nodeId: number, name: string, freeMemMb: number, freeDiskMb: number, freeAllocCount: number }>>}
 */
export async function getAvailableNodes(requiredMemory = 0, requiredDisk = 0) {
  let nodes
  try {
    nodes = await fetchAllNodes()
  } catch {
    return []
  }

  const result = []

  for (const node of nodes) {
    const capMem  = effectiveCapacity(node.memory, node.memory_overallocate ?? 0)
    const capDisk = effectiveCapacity(node.disk,   node.disk_overallocate   ?? 0)

    const usedMem  = node.allocated_resources?.memory ?? 0
    const usedDisk = node.allocated_resources?.disk   ?? 0

    const freeMem  = capMem  === Infinity ? Infinity : capMem  - usedMem
    const freeDisk = capDisk === Infinity ? Infinity : capDisk - usedDisk

    if (freeMem < requiredMemory || freeDisk < requiredDisk) continue

    let freeAllocs = []
    try {
      freeAllocs = await fetchFreeAllocations(node.id)
    } catch {
      continue
    }

    if (freeAllocs.length === 0) continue

    result.push({
      nodeId:        node.id,
      name:          node.name,
      freeMemMb:     freeMem === Infinity ? null : freeMem,
      freeDiskMb:    freeDisk === Infinity ? null : freeDisk,
      freeAllocCount: freeAllocs.length
    })
  }

  return result
}
