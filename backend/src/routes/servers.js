import { Router } from "express"
import { z } from "zod"
import { validate } from "../middlewares/validate.js"
import { requireAuth } from "../middlewares/auth.js"
import { query, getOne, runSync, transaction } from "../config/db.js"
import { addDays, getDurationDays } from "../utils/durations.js"
import { pterodactyl } from "../services/pterodactyl.js"
import { pteroManage } from "../services/pteroManage.js"
import { getLimits } from "../cron/expiryCron.js"
import { purchaseLimiter } from "../middlewares/rateLimit.js"
import { randomBytes } from "crypto"

const router = Router()

const purchaseSchema = z.object({
  body: z.object({
    plan_type: z.enum(["coin", "real"]),
    plan_id: z.number().int().positive(),
    server_name: z.string().min(3).max(60),
    location: z.string().max(80).optional(),
    node_id: z.number().int().positive().optional(),
    software: z.string().max(100).optional().default("minecraft"),
    egg_id: z.number().int().positive().optional()
  })
})

const renewSchema = z.object({
  body: z.object({
    server_id: z.number().int().positive()
  })
})

async function getPlan(planType, planId) {
  const table = planType === "coin" ? "plans_coin" : "plans_real"
  return await getOne(`SELECT * FROM ${table} WHERE id = ?`, [planId])
}

function getPrice(planType, plan) {
  return planType === "coin" ? plan.coin_price : plan.price
}

function getBalanceField(planType) {
  return planType === "coin" ? "coins" : "balance"
}

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
    // Only fetch servers that are not deleted
    const servers = await query(
      "SELECT * FROM servers WHERE user_id = ? AND status != 'deleted' ORDER BY created_at DESC",
      [req.user.id]
    )
    const enriched = await Promise.all(
      servers.map(async (server) => {
        const plan = await getPlan(server.plan_type, server.plan_id)
        const renewalCost = plan ? getPrice(server.plan_type, plan) : 0
        
        // Fetch server details from Pterodactyl to get IP, port, and node FQDN
        let pteroDetails = null
        if (server.pterodactyl_server_id) {
          try {
            pteroDetails = await pteroManage.getServerDetails(server.pterodactyl_server_id)
          } catch (err) {
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
    )
    res.json(enriched)
  } catch (error) {
    next(error)
  }
})

router.post("/purchase", requireAuth, purchaseLimiter, validate(purchaseSchema), async (req, res, next) => {
  try {
    const { plan_type: planType, plan_id: planId, server_name: serverName, location, node_id: nodeId, software = "minecraft", egg_id: eggId } = req.body

    // ── Atomic balance check + deduction inside a transaction ──────────
    // Uses BEGIN IMMEDIATE to serialize concurrent purchases per user,
    // preventing double-spend race conditions.
    const txResult = await transaction(({ getOne, runSync }) => {
      const user = getOne(
        "SELECT id, coins, balance, pterodactyl_user_id FROM users WHERE id = ?",
        [req.user.id]
      )
      if (!user) throw Object.assign(new Error("User not found"), { statusCode: 404 })

      const table = planType === "coin" ? "plans_coin" : "plans_real"
      const plan = getOne(`SELECT * FROM ${table} WHERE id = ?`, [planId])
      if (!plan) throw Object.assign(new Error("Plan not found"), { statusCode: 404 })

      if (plan.limited_stock && (!plan.stock_amount || plan.stock_amount <= 0)) {
        throw Object.assign(new Error("Plan out of stock"), { statusCode: 400 })
      }

      if (planType === "coin" && plan.one_time_purchase) {
        const existing = getOne(
          "SELECT id FROM servers WHERE user_id = ? AND plan_type = 'coin' AND plan_id = ? AND status != 'deleted'",
          [req.user.id, planId]
        )
        if (existing) throw Object.assign(new Error("You already have an active server with this one-time purchase plan."), { statusCode: 400 })
      }

      const price = getPrice(planType, plan)
      const balanceField = getBalanceField(planType)
      if (user[balanceField] < price) {
        throw Object.assign(new Error("Insufficient balance"), { statusCode: 400 })
      }

      // Deduct balance atomically
      runSync(`UPDATE users SET ${balanceField} = ${balanceField} - ? WHERE id = ?`, [price, req.user.id])

      if (plan.limited_stock) {
        runSync(`UPDATE ${table} SET stock_amount = stock_amount - 1 WHERE id = ?`, [planId])
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
        eggId: eggId || null
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
        const price = getPrice(planType, plan)
        await runSync(`UPDATE users SET ${balanceField} = ${balanceField} + ? WHERE id = ?`, [price, req.user.id])
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
    try {
      await runSync(
        "INSERT INTO servers (user_id, name, plan_type, plan_id, pterodactyl_server_id, identifier, expires_at, status, location, software, egg_id) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)",
        [req.user.id, serverName, planType, planId, pteroServerId, pteroIdentifier, expiresAt, location || "", software, eggId || null]
      )
    } catch (dbErr) {
      await pterodactyl.deleteServer(pteroServerId)
      throw dbErr
    }

    res.status(201).json({ message: "Server created", expires_at: expiresAt })
  } catch (error) {
    next(error)
  }
})

router.post("/renew", requireAuth, purchaseLimiter, validate(renewSchema), async (req, res, next) => {
  try {
    const now = new Date()

    // ── Atomic balance check + deduction inside a transaction ──────────
    const txResult = await transaction(({ getOne, runSync }) => {
      const server = getOne(
        "SELECT * FROM servers WHERE id = ? AND user_id = ?",
        [req.body.server_id, req.user.id]
      )
      if (!server) throw Object.assign(new Error("Server not found"), { statusCode: 404 })
      if (server.status === "deleted") throw Object.assign(new Error("Server deleted"), { statusCode: 400 })
      if (server.status === "suspended" && server.grace_expires_at && new Date(server.grace_expires_at) <= now) {
        throw Object.assign(new Error("Grace period expired"), { statusCode: 400 })
      }

      const table = server.plan_type === "coin" ? "plans_coin" : "plans_real"
      const plan = getOne(`SELECT * FROM ${table} WHERE id = ?`, [server.plan_id])
      const user = getOne("SELECT id, coins, balance, pterodactyl_user_id FROM users WHERE id = ?", [req.user.id])
      if (!plan || !user) throw Object.assign(new Error("Missing data"), { statusCode: 404 })

      const price = getPrice(server.plan_type, plan)
      const balanceField = getBalanceField(server.plan_type)
      if (user[balanceField] < price) throw Object.assign(new Error("Insufficient balance"), { statusCode: 400 })

      // Deduct balance atomically
      runSync(`UPDATE users SET ${balanceField} = ${balanceField} - ? WHERE id = ?`, [price, req.user.id])

      const durationDays = getDurationDays(plan.duration_type, plan.duration_days)
      const baseDate = new Date(server.expires_at)
      const base = baseDate > now ? server.expires_at : now.toISOString()
      const nextExpiry = addDays(base, durationDays)

      runSync(
        "UPDATE servers SET expires_at = ?, status = 'active', suspended_at = NULL, grace_expires_at = NULL WHERE id = ? AND status != 'deleted'",
        [nextExpiry, server.id]
      )

      return { server, nextExpiry }
    })

    // Unsuspend on Pterodactyl (external call, outside transaction)
    if (txResult.server.status === "suspended") {
      await pterodactyl.unsuspendServer(txResult.server.pterodactyl_server_id)
    }

    res.json({ message: "Renewed", expires_at: txResult.nextExpiry })
  } catch (error) {
    next(error)
  }
})

export default router
