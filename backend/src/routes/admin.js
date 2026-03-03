import { Router } from "express"
import { z } from "zod"
import { validate } from "../middlewares/validate.js"
import { requireAuth, requireAdmin } from "../middlewares/auth.js"
import { query, getOne, runSync, transaction } from "../config/db.js"
import { pterodactyl } from "../services/pterodactyl.js"
import { approveSubmission, rejectSubmission, deleteScreenshot } from "../services/utrService.js"

const router = Router()

router.use(requireAuth, requireAdmin)

const coinPlanSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    icon: z.string().optional().default("Package"),
    ram: z.number().int().positive(),
    cpu: z.number().int().positive(),
    storage: z.number().int().positive(),
    coin_price: z.number().int().positive(),
    duration_type: z.enum(["weekly", "monthly", "custom", "days", "lifetime"]),
    duration_days: z.number().int().positive(),
    limited_stock: z.boolean().default(false),
    stock_amount: z.number().int().positive().nullable().optional(),
    one_time_purchase: z.boolean().default(false),
    backup_count: z.number().int().min(0).default(0),
    extra_ports: z.number().int().min(0).default(0)
  })
})

const realPlanSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    icon: z.string().optional().default("Server"),
    ram: z.number().int().positive(),
    cpu: z.number().int().positive(),
    storage: z.number().int().positive(),
    price: z.number().positive(),
    duration_type: z.enum(["weekly", "monthly", "custom", "days", "lifetime"]),
    duration_days: z.number().int().positive(),
    limited_stock: z.boolean().default(false),
    stock_amount: z.number().int().positive().nullable().optional(),
    backup_count: z.number().int().min(0).default(0),
    extra_ports: z.number().int().min(0).default(0)
  })
})

const couponSchema = z.object({
  body: z.object({
    code: z.string().min(3),
    coin_reward: z.number().int().positive(),
    max_uses: z.number().int().positive(),
    per_user_limit: z.number().int().positive().default(1),
    expires_at: z.string().min(5),
    active: z.boolean().default(true)
  })
})

const coinSettingSchema = z.object({
  body: z.object({
    coins_per_minute: z.number().int().positive().max(1000)
  })
})

const flagSchema = z.object({
  body: z.object({
    flagged: z.boolean()
  })
})

const roleSchema = z.object({
  body: z.object({
    role: z.enum(['user', 'admin'])
  })
})

router.get("/users", async (req, res, next) => {
  try {
    const users = await query(
      "SELECT id, email, role, coins, balance, ip_address, last_login_ip, flagged, created_at FROM users ORDER BY created_at DESC"
    )
    res.json(users)
  } catch (error) {
    next(error)
  }
})

router.patch("/users/:id/flag", validate(flagSchema), async (req, res, next) => {
  try {
    const userId = Number(req.params.id)
    if (!userId || isNaN(userId)) return res.status(400).json({ error: "Invalid user ID" })
    await runSync(
      "UPDATE users SET flagged = ? WHERE id = ?",
      [req.body.flagged ? 1 : 0, userId]
    )
    res.json({ status: "ok" })
  } catch (error) {
    next(error)
  }
})

router.patch("/users/:id/role", validate(roleSchema), async (req, res, next) => {
  try {
    const userId = Number(req.params.id)
    
    // Prevent admins from demoting themselves
    if (userId === req.user.id && req.body.role !== 'admin') {
      return res.status(400).json({ message: "Cannot change your own role" })
    }
    
    const user = await getOne("SELECT id, email, role FROM users WHERE id = ?", [userId])
    if (!user) {
      return res.status(404).json({ error: "User not found" })
    }
    
    await runSync(
      "UPDATE users SET role = ? WHERE id = ?",
      [req.body.role, userId]
    )
    
    res.json({ 
      status: "ok", 
      message: `User ${user.email} role changed from ${user.role} to ${req.body.role}` 
    })
  } catch (error) {
    next(error)
  }
})

router.delete("/users/:id", async (req, res, next) => {
  try {
    const userId = Number(req.params.id)
    if (userId === req.user.id) {
      return res.status(400).json({ message: "Cannot delete your own account" })
    }

    const user = await getOne("SELECT id, pterodactyl_user_id FROM users WHERE id = ?", [userId])
    if (!user) return res.status(404).json({ error: "User not found" })

    // ── 1. Delete all Pterodactyl servers owned by this user ─────────────
    const userServers = await query(
      "SELECT pterodactyl_server_id FROM servers WHERE user_id = ? AND pterodactyl_server_id IS NOT NULL",
      [userId]
    )
    for (const srv of userServers) {
      if (srv.pterodactyl_server_id) {
        try {
          await pterodactyl.deleteServer(srv.pterodactyl_server_id)
        } catch (err) {
          console.warn("[ADMIN] Pterodactyl server delete failed (continuing):", srv.pterodactyl_server_id, err.message)
        }
      }
    }

    // ── 2. Delete the Pterodactyl panel user account ──────────────────────
    if (user.pterodactyl_user_id) {
      try {
        await pterodactyl.deleteUser(user.pterodactyl_user_id)
      } catch (err) {
        console.warn("[ADMIN] Pterodactyl user delete failed (continuing):", user.pterodactyl_user_id, err.message)
      }
    }

    // ── 3. Cascade delete all site data atomically ─────────────────
    await transaction(({ runSync }) => {
      runSync("DELETE FROM ticket_messages WHERE ticket_id IN (SELECT id FROM tickets WHERE user_id = ?)", [userId])
      runSync("DELETE FROM tickets WHERE user_id = ?", [userId])
      runSync("DELETE FROM coupon_redemptions WHERE user_id = ?", [userId])
      runSync("DELETE FROM utr_submissions WHERE user_id = ?", [userId])
      runSync("DELETE FROM servers WHERE user_id = ?", [userId])
      runSync("DELETE FROM users WHERE id = ?", [userId])
    })

    res.json({ status: "ok" })
  } catch (error) {
    next(error)
  }
})

router.post("/plans/coin", validate(coinPlanSchema), async (req, res, next) => {
  try {
    const info = await runSync(
      "INSERT INTO plans_coin (name, icon, ram, cpu, storage, coin_price, duration_type, duration_days, limited_stock, stock_amount, one_time_purchase, backup_count, extra_ports) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        req.body.name,
        req.body.icon || "Package",
        req.body.ram,
        req.body.cpu,
        req.body.storage,
        req.body.coin_price,
        req.body.duration_type,
        req.body.duration_days,
        req.body.limited_stock ? 1 : 0,
        req.body.stock_amount || null,
        req.body.one_time_purchase ? 1 : 0,
        req.body.backup_count || 0,
        req.body.extra_ports || 0
      ]
    )
    console.log("[ADMIN] Coin plan created with ID:", info.lastID)
    res.status(201).json({ id: info.lastID })
  } catch (error) {
    console.error("[ADMIN] Error creating coin plan:", error.message)
    next(error)
  }
})

router.post("/plans/real", validate(realPlanSchema), async (req, res, next) => {
  try {
    const info = await runSync(
      "INSERT INTO plans_real (name, icon, ram, cpu, storage, price, duration_type, duration_days, limited_stock, stock_amount, backup_count, extra_ports) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        req.body.name,
        req.body.icon || "Server",
        req.body.ram,
        req.body.cpu,
        req.body.storage,
        req.body.price,
        req.body.duration_type,
        req.body.duration_days,
        req.body.limited_stock ? 1 : 0,
        req.body.stock_amount || null,
        req.body.backup_count || 0,
        req.body.extra_ports || 0
      ]
    )
    res.status(201).json({ id: info.lastID })
  } catch (error) {
    next(error)
  }
})

router.put("/plans/coin/:id", validate(coinPlanSchema), async (req, res, next) => {
  try {
    await runSync(
      "UPDATE plans_coin SET name = ?, icon = ?, ram = ?, cpu = ?, storage = ?, coin_price = ?, duration_type = ?, duration_days = ?, limited_stock = ?, stock_amount = ?, one_time_purchase = ?, backup_count = ?, extra_ports = ? WHERE id = ?",
      [
        req.body.name,
        req.body.icon || "Package",
        req.body.ram,
        req.body.cpu,
        req.body.storage,
        req.body.coin_price,
        req.body.duration_type,
        req.body.duration_days || null,
        req.body.limited_stock ? 1 : 0,
        req.body.stock_amount || null,
        req.body.one_time_purchase ? 1 : 0,
        req.body.backup_count || 0,
        req.body.extra_ports || 0,
        req.params.id
      ]
    )
    res.json({ status: "ok" })
  } catch (error) {
    next(error)
  }
})

router.put("/plans/real/:id", validate(realPlanSchema), async (req, res, next) => {
  try {
    await runSync(
      "UPDATE plans_real SET name = ?, icon = ?, ram = ?, cpu = ?, storage = ?, price = ?, duration_type = ?, duration_days = ?, limited_stock = ?, stock_amount = ?, backup_count = ?, extra_ports = ? WHERE id = ?",
      [
        req.body.name,
        req.body.icon || "Server",
        req.body.ram,
        req.body.cpu,
        req.body.storage,
        req.body.price,
        req.body.duration_type,
        req.body.duration_days || null,
        req.body.limited_stock ? 1 : 0,
        req.body.stock_amount || null,
        req.body.backup_count || 0,
        req.body.extra_ports || 0,
        req.params.id
      ]
    )
    res.json({ status: "ok" })
  } catch (error) {
    next(error)
  }
})

router.delete("/plans/coin/:id", async (req, res, next) => {
  try {
    const planId = Number(req.params.id)
    if (!planId || isNaN(planId)) return res.status(400).json({ error: "Invalid plan ID" })
    // Check for active servers using this plan
    const activeServer = await getOne(
      "SELECT id FROM servers WHERE plan_type = 'coin' AND plan_id = ? AND status IN ('active', 'suspended')",
      [planId]
    )
    if (activeServer) {
      return res.status(400).json({ error: "Cannot delete plan — active servers are using it" })
    }
    await runSync("DELETE FROM plans_coin WHERE id = ?", [planId])
    res.json({ status: "ok" })
  } catch (error) {
    next(error)
  }
})

router.delete("/plans/real/:id", async (req, res, next) => {
  try {
    const planId = Number(req.params.id)
    if (!planId || isNaN(planId)) return res.status(400).json({ error: "Invalid plan ID" })
    // Check for active servers using this plan
    const activeServer = await getOne(
      "SELECT id FROM servers WHERE plan_type = 'real' AND plan_id = ? AND status IN ('active', 'suspended')",
      [planId]
    )
    if (activeServer) {
      return res.status(400).json({ error: "Cannot delete plan — active servers are using it" })
    }
    await runSync("DELETE FROM plans_real WHERE id = ?", [planId])
    res.json({ status: "ok" })
  } catch (error) {
    next(error)
  }
})

router.get("/coupons", async (req, res, next) => {
  try {
    const coupons = await query(
      `SELECT c.*, COUNT(cr.id) AS times_used
       FROM coupons c
       LEFT JOIN coupon_redemptions cr ON cr.coupon_id = c.id
       GROUP BY c.id
       ORDER BY c.id DESC`
    )
    res.json(coupons)
  } catch (error) {
    next(error)
  }
})

router.post("/coupons", validate(couponSchema), async (req, res, next) => {
  try {
    const info = await runSync(
      "INSERT INTO coupons (code, coin_reward, max_uses, per_user_limit, expires_at, active) VALUES (?, ?, ?, ?, ?, ?)",
      [
        req.body.code.toUpperCase(),
        req.body.coin_reward,
        req.body.max_uses,
        req.body.per_user_limit,
        req.body.expires_at,
        req.body.active ? 1 : 0
      ]
    )
    res.status(201).json({ id: info.lastID })
  } catch (error) {
    next(error)
  }
})

router.put("/coupons/:id", validate(couponSchema), async (req, res, next) => {
  try {
    await runSync(
      "UPDATE coupons SET code = ?, coin_reward = ?, max_uses = ?, per_user_limit = ?, expires_at = ?, active = ? WHERE id = ?",
      [
        req.body.code.toUpperCase(),
        req.body.coin_reward,
        req.body.max_uses,
        req.body.per_user_limit,
        req.body.expires_at,
        req.body.active ? 1 : 0,
        req.params.id
      ]
    )
    res.json({ status: "ok" })
  } catch (error) {
    next(error)
  }
})

router.delete("/coupons/:id", async (req, res, next) => {
  try {
    const couponId = Number(req.params.id)
    if (!couponId || isNaN(couponId)) return res.status(400).json({ error: "Invalid coupon ID" })
    await runSync("DELETE FROM coupons WHERE id = ?", [couponId])
    res.json({ status: "ok" })
  } catch (error) {
    next(error)
  }
})

router.get("/servers", async (req, res, next) => {
  try {
    const servers = await query(
      "SELECT s.*, u.email FROM servers s JOIN users u ON u.id = s.user_id ORDER BY s.created_at DESC"
    )
    res.json(servers)
  } catch (error) {
    next(error)
  }
})

router.get("/servers/expiring", async (req, res, next) => {
  try {
    const soon = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const servers = await query(
      "SELECT * FROM servers WHERE status = 'active' AND expires_at <= ?",
      [soon]
    )
    res.json(servers)
  } catch (error) {
    next(error)
  }
})

router.get("/servers/suspended", async (req, res, next) => {
  try {
    const servers = await query("SELECT * FROM servers WHERE status = 'suspended'")
    res.json(servers)
  } catch (error) {
    next(error)
  }
})

router.post("/servers/:id/suspend", async (req, res, next) => {
  try {
    const serverId = Number(req.params.id)
    if (!serverId || isNaN(serverId)) return res.status(400).json({ error: "Invalid server ID" })
    const server = await getOne("SELECT * FROM servers WHERE id = ?", [serverId])
    if (!server) {
      return res.status(404).json({ error: "Server not found" })
    }

    await pterodactyl.suspendServer(server.pterodactyl_server_id)
    await runSync(
      "UPDATE servers SET status = 'suspended', suspended_at = ? WHERE id = ?",
      [new Date().toISOString(), server.id]
    )

    res.json({ status: "suspended" })
  } catch (error) {
    next(error)
  }
})

router.delete("/servers/:id", async (req, res, next) => {
  try {
    const serverId = Number(req.params.id)
    if (!serverId || isNaN(serverId)) return res.status(400).json({ error: "Invalid server ID" })
    const server = await getOne("SELECT * FROM servers WHERE id = ?", [serverId])
    if (!server) {
      return res.status(404).json({ error: "Server not found" })
    }

    await pterodactyl.deleteServer(server.pterodactyl_server_id)
    await runSync("UPDATE servers SET status = 'deleted' WHERE id = ?", [server.id])

    res.json({ status: "deleted" })
  } catch (error) {
    next(error)
  }
})

router.patch("/coin-settings", validate(coinSettingSchema), async (req, res, next) => {
  try {
    await runSync(
      "UPDATE coin_settings SET coins_per_minute = ? WHERE id = 1",
      [req.body.coins_per_minute]
    )
    res.json({ status: "ok" })
  } catch (error) {
    next(error)
  }
})

router.get("/utr", async (req, res, next) => {
  try {
    const submissions = await query(
      "SELECT u.email, ut.* FROM utr_submissions ut JOIN users u ON u.id = ut.user_id ORDER BY ut.created_at DESC"
    )
    res.json(submissions)
  } catch (error) {
    next(error)
  }
})

router.patch("/utr/:id/approve", async (req, res, next) => {
  try {
    const utrId = Number(req.params.id)
    if (!utrId || isNaN(utrId)) return res.status(400).json({ error: "Invalid UTR ID" })
    const submission = await approveSubmission(utrId)
    await deleteScreenshot(submission.screenshot_path)
    res.json({ status: "approved" })
  } catch (error) {
    next(error)
  }
})

router.patch("/utr/:id/reject", async (req, res, next) => {
  try {
    const utrId = Number(req.params.id)
    if (!utrId || isNaN(utrId)) return res.status(400).json({ error: "Invalid UTR ID" })
    const submission = await rejectSubmission(utrId)
    await deleteScreenshot(submission.screenshot_path)
    res.json({ status: "rejected" })
  } catch (error) {
    next(error)
  }
})

export default router
