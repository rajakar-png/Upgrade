/**
 * Admin frontpage management routes (all protected by requireAuth + requireAdmin)
 *
 * Frontpage content:
 *   GET    /api/admin/frontpage             — same as public, for admin prefill
 *   PUT    /api/admin/frontpage/:section    — upsert a section
 *
 * Landing plans:
 *   GET    /api/admin/landing-plans         — all plans (inc. inactive)
 *   POST   /api/admin/landing-plans         — create plan
 *   PUT    /api/admin/landing-plans/:id     — update plan
 *   DELETE /api/admin/landing-plans/:id     — delete plan
 *   PATCH  /api/admin/landing-plans/:id/toggle-active   — toggle active
 *   PATCH  /api/admin/landing-plans/:id/toggle-popular  — toggle popular
 */
import { Router } from "express"
import { z } from "zod"
import { validate } from "../middlewares/validate.js"
import { requireAuth, requireAdmin } from "../middlewares/auth.js"
import { query, getOne, runSync } from "../config/db.js"
import { getIO } from "../utils/socket.js"

const router = Router()
router.use(requireAuth, requireAdmin)

// ─── Helpers ─────────────────────────────────────────────────────────────────

function safeParseJSON(str, fallback) {
  try { return JSON.parse(str) } catch { return fallback }
}

function emitFrontpageUpdate(data) {
  try { getIO().emit("frontpage:update", data) } catch { /* socket may not be ready */ }
}

function emitPlansUpdate(plans) {
  try { getIO().emit("plans:update", plans) } catch { /* socket may not be ready */ }
}

async function getLandingPlans(adminView = false) {
  // Auto-synced from plans_coin + plans_real — no separate landing_plans table
  const coinPlans = await query("SELECT * FROM plans_coin ORDER BY coin_price ASC")
  const realPlans = await query("SELECT * FROM plans_real ORDER BY price ASC")

  const merged = []
  for (const p of coinPlans) {
    merged.push({
      id: `coin-${p.id}`,
      name: p.name,
      plan_type: "coin",
      category: p.category || "minecraft",
      price: p.initial_price ?? p.coin_price,
      renewal_price: p.renewal_price ?? p.coin_price,
      ram: p.ram,
      cpu: p.cpu,
      storage: p.storage,
      duration_days: p.duration_days,
      features: buildFeatures(p),
      popular: false,
      active: true
    })
  }
  for (const p of realPlans) {
    merged.push({
      id: `real-${p.id}`,
      name: p.name,
      plan_type: "real",
      category: p.category || "minecraft",
      price: p.price,
      renewal_price: p.price,
      ram: p.ram,
      cpu: p.cpu,
      storage: p.storage,
      duration_days: p.duration_days,
      features: buildFeatures(p),
      popular: false,
      active: true
    })
  }
  return merged
}

function buildFeatures(plan) {
  const features = []
  features.push(`${plan.ram} GB RAM`)
  features.push(`${plan.cpu} CPU Core${plan.cpu > 1 ? "s" : ""}`)
  features.push(`${plan.storage} GB Storage`)
  if (plan.backup_count > 0) features.push(`${plan.backup_count} Backup${plan.backup_count > 1 ? "s" : ""}`)
  if (plan.extra_ports > 0) features.push(`${plan.extra_ports} Extra Port${plan.extra_ports > 1 ? "s" : ""}`)
  features.push(`${plan.duration_days} Day${plan.duration_days > 1 ? "s" : ""} Duration`)
  return features
}

// ─── Frontpage sections ───────────────────────────────────────────────────────

// GET /api/admin/frontpage
router.get("/", async (req, res, next) => {
  try {
    const rows = await query("SELECT section_name, content_json, updated_at FROM site_content")
    const content = {}
    for (const row of rows) {
      content[row.section_name] = {
        data: safeParseJSON(row.content_json, {}),
        updatedAt: row.updated_at
      }
    }
    res.json(content)
  } catch (error) {
    next(error)
  }
})

// PUT /api/admin/frontpage/:section
const sectionSchema = z.object({
  params: z.object({
    section: z.enum(["hero", "features", "about", "stats", "footer", "features_page", "locations_page", "about_page", "knowledgebase_page", "status_page"])
  }),
  body: z.object({
    content: z.unknown().refine(
      (v) => JSON.stringify(v).length < 100_000,
      { message: "Content payload too large (max 100KB JSON)" }
    )
  })
})

router.put("/:section", validate(sectionSchema), async (req, res, next) => {
  try {
    const { section } = req.params
    const contentJson = JSON.stringify(req.body.content)

    const existing = await getOne("SELECT id FROM site_content WHERE section_name = ?", [section])

    if (existing) {
      await runSync(
        "UPDATE site_content SET content_json = ?, updated_at = datetime('now') WHERE section_name = ?",
        [contentJson, section]
      )
    } else {
      await runSync(
        "INSERT INTO site_content (section_name, content_json) VALUES (?, ?)",
        [section, contentJson]
      )
    }

    const updated = await getOne("SELECT section_name, content_json, updated_at FROM site_content WHERE section_name = ?", [section])
    const parsed = { data: safeParseJSON(updated.content_json, {}), updatedAt: updated.updated_at }

    emitFrontpageUpdate({ section, ...parsed })

    res.json({ success: true, section, data: parsed.data, updatedAt: parsed.updatedAt })
  } catch (error) {
    next(error)
  }
})

// ─── Landing plans (now auto-synced, read-only) ──────────────────────────────

// GET /api/admin/landing-plans — returns merged coin + real plans (read-only preview)
router.get("/landing-plans", async (req, res, next) => {
  try {
    res.json(await getLandingPlans(true))
  } catch (error) {
    next(error)
  }
})

// POST/PUT/DELETE/PATCH endpoints kept for backward compat but return info message
router.post("/landing-plans", (req, res) => {
  res.status(200).json({ message: "Landing plans are now auto-synced from Coin & Real plans. Manage plans from the Admin Panel plans section." })
})

router.put("/landing-plans/:id", (req, res) => {
  res.status(200).json({ message: "Landing plans are now auto-synced from Coin & Real plans. Manage plans from the Admin Panel plans section." })
})

router.delete("/landing-plans/:id", (req, res) => {
  res.status(200).json({ message: "Landing plans are now auto-synced from Coin & Real plans. Manage plans from the Admin Panel plans section." })
})

router.patch("/landing-plans/:id/toggle-active", (req, res) => {
  res.status(200).json({ message: "Landing plans are now auto-synced. Use the Admin Panel to manage plans." })
})

router.patch("/landing-plans/:id/toggle-popular", (req, res) => {
  res.status(200).json({ message: "Landing plans are now auto-synced. Use the Admin Panel to manage plans." })
})

export default router
