import { Router } from "express"
import { z } from "zod"
import { validate } from "../middlewares/validate.js"
import { requireAuth } from "../middlewares/auth.js"
import { query, getOne, runSync, transaction } from "../config/db.js"
import { addDays, getDurationDays } from "../utils/durations.js"
import { getPlan, getPurchasePrice, getRenewalPrice, getBalanceField } from "../utils/planHelpers.js"
import { pterodactyl } from "../services/pterodactyl.js"
import { pteroManage } from "../services/pteroManage.js"
import { getLimits } from "../cron/expiryCron.js"
import { purchaseLimiter } from "../middlewares/rateLimit.js"
import { randomBytes } from "crypto"

const router = Router()
const DEFAULT_SERVERS_PAGE_SIZE = 10
const MAX_SERVERS_PAGE_SIZE = 50
const IDEMPOTENCY_KEY_HEADER = "idempotency-key"
const IDEMPOTENCY_CLEANUP_INTERVAL_MS = 5 * 60 * 1000
const PROCESSING_STALE_MINUTES = 15
const COMPLETED_RETENTION_DAYS = 7

let lastIdempotencyCleanupAt = 0

function formatSqlTimestamp(date) {
  return date.toISOString().slice(0, 19).replace("T", " ")
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length)
  let currentIndex = 0

  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (currentIndex < items.length) {
      const index = currentIndex
      currentIndex += 1
      results[index] = await mapper(items[index], index)
    }
  })

  await Promise.all(workers)
  return results
}

function getIdempotencyKey(req) {
  const key = req.headers[IDEMPOTENCY_KEY_HEADER]
  if (!key || typeof key !== "string") return null
  const trimmed = key.trim()
  if (!trimmed || trimmed.length > 128) return null
  return trimmed
}

function isUniqueViolation(error) {
  const message = String(error?.message || "")
  return message.includes("UNIQUE constraint failed") || error?.code === "23505"
}

async function reserveIdempotencyKey(userId, endpoint, key) {
  if (!key) return { mode: "disabled" }

  const now = Date.now()
  if (now - lastIdempotencyCleanupAt > IDEMPOTENCY_CLEANUP_INTERVAL_MS) {
    lastIdempotencyCleanupAt = now
    await cleanupStaleIdempotencyRows().catch((error) => {
      console.warn("[SERVERS] Idempotency cleanup skipped:", error.message)
    })
  }

  try {
    await runSync(
      "INSERT INTO idempotency_keys (user_id, endpoint, key, status, created_at, updated_at) VALUES (?, ?, ?, 'processing', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
      [userId, endpoint, key]
    )
    return { mode: "new" }
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error
    }

    const existing = await getOne(
      "SELECT status, status_code, response_json FROM idempotency_keys WHERE user_id = ? AND endpoint = ? AND key = ?",
      [userId, endpoint, key]
    )

    if (!existing) {
      return { mode: "in_progress" }
    }

    if (existing.status === "completed" && existing.response_json) {
      return {
        mode: "replay",
        statusCode: existing.status_code || 200,
        payload: JSON.parse(existing.response_json)
      }
    }

    return { mode: "in_progress" }
  }
}

async function cleanupStaleIdempotencyRows() {
  const processingBefore = formatSqlTimestamp(new Date(Date.now() - PROCESSING_STALE_MINUTES * 60 * 1000))
  const completedBefore = formatSqlTimestamp(new Date(Date.now() - COMPLETED_RETENTION_DAYS * 24 * 60 * 60 * 1000))

  const processingInfo = await runSync(
    `DELETE FROM idempotency_keys
     WHERE status = 'processing'
       AND created_at < ?`,
    [processingBefore]
  )

  const completedInfo = await runSync(
    `DELETE FROM idempotency_keys
     WHERE status = 'completed'
       AND created_at < ?`,
    [completedBefore]
  )

  const deleted = Number(processingInfo?.changes || 0) + Number(completedInfo?.changes || 0)
  if (deleted > 0) {
    console.log(`[SERVERS] Idempotency cleanup removed ${deleted} stale rows`)
  }
}

async function markIdempotencyCompleted(userId, endpoint, key, statusCode, payload) {
  if (!key) return
  await runSync(
    "UPDATE idempotency_keys SET status = 'completed', status_code = ?, response_json = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND endpoint = ? AND key = ?",
    [statusCode, JSON.stringify(payload), userId, endpoint, key]
  )
}

async function releaseIdempotencyReservation(userId, endpoint, key) {
  if (!key) return
  await runSync(
    "DELETE FROM idempotency_keys WHERE user_id = ? AND endpoint = ? AND key = ? AND status = 'processing'",
    [userId, endpoint, key]
  )
}

const purchaseSchema = z.object({
  body: z.object({
    plan_type: z.enum(["coin", "real"]),
    plan_id: z.coerce.number().int().positive(),
    server_name: z.string().min(3).max(60),
    category: z.enum(["minecraft", "bot"]).default("minecraft"),
    location: z.string().max(80).optional(),
    node_id: z.coerce.number().int().positive().optional(),
    software: z.string().max(100).optional().default("minecraft"),
    egg_id: z.coerce.number().int().positive().optional()
  })
})

const renewSchema = z.object({
  body: z.object({
    server_id: z.coerce.number().int().positive()
  })
})

// Return live available Pterodactyl nodes for location picker
router.get("/nodes", requireAuth, async (req, res, next) => {
  try {
    const nodes = await pterodactyl.getAvailableNodes()
    res.json(nodes)
  } catch (error) {
    next(error)
  }
})

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(String(req.query.page || "1"), 10) || 1)
    const limit = Math.min(
      MAX_SERVERS_PAGE_SIZE,
      Math.max(1, Number.parseInt(String(req.query.limit || DEFAULT_SERVERS_PAGE_SIZE), 10) || DEFAULT_SERVERS_PAGE_SIZE)
    )
    const offset = (page - 1) * limit

    const [{ total }] = await query(
      "SELECT COUNT(*) AS total FROM servers WHERE user_id = ? AND status != 'deleted'",
      [req.user.id]
    )

    // Only fetch servers that are not deleted
    const servers = await query(
      "SELECT * FROM servers WHERE user_id = ? AND status != 'deleted' ORDER BY created_at DESC LIMIT ? OFFSET ?",
      [req.user.id, limit, offset]
    )

    const enriched = await mapWithConcurrency(servers, 4, async (server) => {
        const plan = await getPlan(server.plan_type, server.plan_id)
        const renewalCost = plan ? getRenewalPrice(server.plan_type, plan) : 0
        
        // Fetch server details from Pterodactyl only for active servers with panel IDs.
        // This avoids unnecessary external calls for suspended/deleted lifecycle states.
        let pteroDetails = null
        if (server.pterodactyl_server_id && server.status === "active") {
          try {
            pteroDetails = await pteroManage.getServerDetails(server.pterodactyl_server_id)
          } catch (err) {
            if (err?.response?.status === 404) {
              console.warn(
                `[SERVERS] Panel server missing (404); marking local server ${server.id} as deleted`
              )
              await runSync(
                "UPDATE servers SET status = 'deleted' WHERE id = ? AND status != 'deleted'",
                [server.id]
              )
              return null
            }
            console.error(`[SERVERS] Failed to fetch Pterodactyl details for server ${server.id}:`, err.message)
          }
        }

        // Resolve display IP: prefer ip_alias, then node FQDN if allocation IP is unusable
        const defaultAlloc = pteroDetails?.allocations?.find(a => a.is_default) || pteroDetails?.allocations?.[0]
        let displayIp = defaultAlloc?.ip_alias || defaultAlloc?.ip || null
        if (displayIp && (displayIp === '0.0.0.0' || displayIp.startsWith('10.') || displayIp.startsWith('172.') || displayIp.startsWith('192.168.'))) {
          displayIp = pteroDetails?.node_fqdn || displayIp
        }

        return {
          ...server,
          plan: plan?.name || "Unknown Plan",
          // Add renewal cost fields for the frontend
          coin_cost: server.plan_type === "coin" ? renewalCost : undefined,
          real_cost: server.plan_type === "real" ? renewalCost : undefined,
          // Add connection details from Pterodactyl
          ip: displayIp,
          port: defaultAlloc?.port || null,
          server_identifier: pteroDetails?.identifier || server.identifier
        }
      })

    const visibleServers = enriched.filter(Boolean)
    const reconciledDeletedCount = enriched.length - visibleServers.length
    const adjustedTotal = Math.max(0, (Number(total) || 0) - reconciledDeletedCount)
    const totalPages = Math.max(1, Math.ceil(adjustedTotal / limit))

    res.json({
      servers: visibleServers,
      pagination: {
        page,
        limit,
        total: adjustedTotal,
        totalPages
      }
    })
  } catch (error) {
    next(error)
  }
})

router.post("/purchase", requireAuth, purchaseLimiter, validate(purchaseSchema), async (req, res, next) => {
  const idempotencyKey = getIdempotencyKey(req)
  let reservedIdempotency = false

  try {
    const idempotency = await reserveIdempotencyKey(req.user.id, "servers:purchase", idempotencyKey)
    if (idempotency.mode === "replay") {
      return res.status(idempotency.statusCode).json(idempotency.payload)
    }
    if (idempotency.mode === "in_progress") {
      return res.status(409).json({ error: "Duplicate request is already processing." })
    }
    reservedIdempotency = idempotency.mode === "new"

    const { plan_type: planType, plan_id: planId, server_name: serverName, category = "minecraft", location, node_id: nodeId, software = "minecraft", egg_id: eggId } = req.body

    // ── Atomic balance check + deduction inside a transaction ──────────
    // Uses BEGIN IMMEDIATE to serialize concurrent purchases per user,
    // preventing double-spend race conditions.
    const txResult = await transaction(async ({ getOne, runSync }) => {
      const user = await getOne(
        "SELECT id, coins, balance, pterodactyl_user_id FROM users WHERE id = ?",
        [req.user.id]
      )
      if (!user) throw Object.assign(new Error("User not found"), { statusCode: 404 })

      const table = planType === "coin" ? "plans_coin" : "plans_real"
      const plan = await getOne(`SELECT * FROM ${table} WHERE id = ?`, [planId])
      if (!plan) throw Object.assign(new Error("Plan not found"), { statusCode: 404 })

      if (plan.limited_stock && (!plan.stock_amount || plan.stock_amount <= 0)) {
        throw Object.assign(new Error("Plan out of stock"), { statusCode: 400 })
      }

      if (planType === "coin" && plan.one_time_purchase) {
        const existing = await getOne(
          "SELECT id FROM servers WHERE user_id = ? AND plan_type = 'coin' AND plan_id = ? AND status != 'deleted'",
          [req.user.id, planId]
        )
        if (existing) throw Object.assign(new Error("You already have an active server with this one-time purchase plan."), { statusCode: 400 })
      }

      const price = getPurchasePrice(planType, plan)
      const balanceField = getBalanceField(planType)
      console.log(`[SERVERS] Purchase check: user=${req.user.id}, planType=${planType}, planId=${planId}, category=${category}, price=${price}, balanceField=${balanceField}, balance=${user[balanceField]}, initial_price=${plan.initial_price}, coin_price=${plan.coin_price}`)
      if (price > 0 && user[balanceField] < price) {
        throw Object.assign(new Error(`Insufficient balance (need ${price}, have ${user[balanceField]})`), { statusCode: 400 })
      }

      // Deduct balance atomically (skip if price is 0 = free first purchase)
      if (price > 0) {
        await runSync(`UPDATE users SET ${balanceField} = ${balanceField} - ? WHERE id = ?`, [price, req.user.id])
      }

      if (plan.limited_stock) {
        await runSync(`UPDATE ${table} SET stock_amount = stock_amount - 1 WHERE id = ?`, [planId])
      }

      return { user, plan }
    })

    const { user, plan } = txResult
    const durationDays = getDurationDays(plan.duration_type, plan.duration_days)
    const expiresAt = addDays(null, durationDays)

    // ── Lazy Pterodactyl user provisioning ────────────────────────────
    // If the user was created via OAuth while Pterodactyl was unavailable,
    // their pterodactyl_user_id will be null. Provision it now before
    // creating the server.
    let pteroUserId = user.pterodactyl_user_id
    if (!pteroUserId) {
      const email = req.user.email
      const username = email.split('@')[0].replace(/[^a-zA-Z0-9-]/g, '').slice(0, 20) || `user${Date.now()}`
      const pteroPassword = randomBytes(24).toString('base64url')

      // Check if user already exists in Pterodactyl (e.g. created manually)
      pteroUserId = await pterodactyl.getUserByEmail(email)

      if (!pteroUserId) {
        pteroUserId = await pterodactyl.createUser({
          email,
          username,
          firstName: username,
          lastName: 'User',
          password: pteroPassword,
        })
      }

      // Persist so future purchases skip this step
      await runSync('UPDATE users SET pterodactyl_user_id = ? WHERE id = ?', [pteroUserId, req.user.id])
    }

    // ── Create Pterodactyl server (external call, outside transaction) ─
    let pteroServerId
    let pteroIdentifier = null
    try {
      pteroServerId = await pterodactyl.createServer({
        name: serverName,
        userId: pteroUserId,
        limits: getLimits(plan),
        nodeId: nodeId || null,
        software: software,
        eggId: eggId || null,
        category: category
      })
      // Fetch the short identifier needed for Client API (backups, etc.)
      try {
        const details = await pterodactyl.getServerDetails(pteroServerId)
        pteroIdentifier = details?.identifier || null
      } catch {
        // non-fatal — identifier can be fetched later
      }
    } catch (pteroErr) {
      // Refund the balance if Pterodactyl fails — wrap in try/catch so refund errors are logged
      try {
        const balanceField = getBalanceField(planType)
        const price = getPurchasePrice(planType, plan)
        if (price > 0) {
          await runSync(`UPDATE users SET ${balanceField} = ${balanceField} + ? WHERE id = ?`, [price, req.user.id])
        }
        if (plan.limited_stock) {
          const table = planType === "coin" ? "plans_coin" : "plans_real"
          await runSync(`UPDATE ${table} SET stock_amount = stock_amount + 1 WHERE id = ?`, [planId])
        }
      } catch (refundErr) {
        console.error("[SERVERS] CRITICAL: Refund failed after Pterodactyl error. User:", req.user.id, "Error:", refundErr.message)
      }
      throw pteroErr
    }

    // ── Record the server in DB ───────────────────────────────────────
    let serverId
    try {
      const insertResult = await runSync(
        "INSERT INTO servers (user_id, name, plan_type, plan_id, pterodactyl_server_id, identifier, expires_at, status, location, software, category, egg_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, CURRENT_TIMESTAMP)",
        [req.user.id, serverName, planType, planId, pteroServerId, pteroIdentifier, expiresAt, location || "", software, category, eggId || null]
      )
      serverId = insertResult.lastID
    } catch (dbErr) {
      await pterodactyl.deleteServer(pteroServerId)
      throw dbErr
    }

    const responsePayload = { message: "Server created", server_id: serverId, category, expires_at: expiresAt }
    if (reservedIdempotency) {
      await markIdempotencyCompleted(req.user.id, "servers:purchase", idempotencyKey, 201, responsePayload)
    }

    console.log(`[SERVERS] ✓ Server created: id=${serverId}, category=${category}, user=${req.user.id}, plan=${planType}/${planId}`)
    res.status(201).json(responsePayload)
  } catch (error) {
    if (reservedIdempotency) {
      await releaseIdempotencyReservation(req.user.id, "servers:purchase", idempotencyKey).catch(() => {})
    }
    next(error)
  }
})

router.post("/renew", requireAuth, purchaseLimiter, validate(renewSchema), async (req, res, next) => {
  const idempotencyKey = getIdempotencyKey(req)
  let reservedIdempotency = false

  try {
    const idempotency = await reserveIdempotencyKey(req.user.id, "servers:renew", idempotencyKey)
    if (idempotency.mode === "replay") {
      return res.status(idempotency.statusCode).json(idempotency.payload)
    }
    if (idempotency.mode === "in_progress") {
      return res.status(409).json({ error: "Duplicate request is already processing." })
    }
    reservedIdempotency = idempotency.mode === "new"

    const now = new Date()

    // ── Atomic balance check + deduction inside a transaction ──────────
    const txResult = await transaction(async ({ getOne, runSync }) => {
      const server = await getOne(
        "SELECT * FROM servers WHERE id = ? AND user_id = ?",
        [req.body.server_id, req.user.id]
      )
      if (!server) throw Object.assign(new Error("Server not found"), { statusCode: 404 })
      if (server.status === "deleted") throw Object.assign(new Error("Server deleted"), { statusCode: 400 })
      if (server.status === "suspended" && server.grace_expires_at && new Date(server.grace_expires_at) <= now) {
        throw Object.assign(new Error("Grace period expired"), { statusCode: 400 })
      }

      const table = server.plan_type === "coin" ? "plans_coin" : "plans_real"
      const plan = await getOne(`SELECT * FROM ${table} WHERE id = ?`, [server.plan_id])
      const user = await getOne("SELECT id, coins, balance, pterodactyl_user_id FROM users WHERE id = ?", [req.user.id])
      if (!plan || !user) throw Object.assign(new Error("Missing data"), { statusCode: 404 })

      const price = getRenewalPrice(server.plan_type, plan)
      const balanceField = getBalanceField(server.plan_type)
      if (user[balanceField] < price) throw Object.assign(new Error("Insufficient balance"), { statusCode: 400 })

      // Deduct balance atomically
      await runSync(`UPDATE users SET ${balanceField} = ${balanceField} - ? WHERE id = ?`, [price, req.user.id])

      const durationDays = getDurationDays(plan.duration_type, plan.duration_days)
      const baseDate = new Date(server.expires_at)
      const base = baseDate > now ? server.expires_at : now.toISOString()
      const nextExpiry = addDays(base, durationDays)

      await runSync(
        "UPDATE servers SET expires_at = ?, status = 'active', suspended_at = NULL, grace_expires_at = NULL WHERE id = ? AND status != 'deleted'",
        [nextExpiry, server.id]
      )

      return { server, nextExpiry }
    })

    // Unsuspend on Pterodactyl (external call, outside transaction)
    if (txResult.server.status === "suspended") {
      await pterodactyl.unsuspendServer(txResult.server.pterodactyl_server_id)
    }

    const responsePayload = { message: "Renewed", expires_at: txResult.nextExpiry }
    if (reservedIdempotency) {
      await markIdempotencyCompleted(req.user.id, "servers:renew", idempotencyKey, 200, responsePayload)
    }

    res.json(responsePayload)
  } catch (error) {
    if (reservedIdempotency) {
      await releaseIdempotencyReservation(req.user.id, "servers:renew", idempotencyKey).catch(() => {})
    }
    next(error)
  }
})

export default router
