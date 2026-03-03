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
  const sql = adminView
    ? "SELECT * FROM landing_plans ORDER BY popular DESC, price ASC"
    : "SELECT * FROM landing_plans WHERE active = 1 ORDER BY popular DESC, price ASC"
  const rows = await query(sql)
  return rows.map((p) => ({
    ...p,
    features: safeParseJSON(p.features, []),
    popular: Boolean(p.popular),
    active: Boolean(p.active)
  }))
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

// ─── Landing plans ────────────────────────────────────────────────────────────

const planSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(80),
    price: z.number().nonnegative(),
    ram: z.number().int().positive(),
    cpu: z.number().int().positive(),
    storage: z.number().int().positive(),
    features: z.array(z.string()).default([]),
    popular: z.boolean().default(false),
    active: z.boolean().default(true)
  })
})

// GET /api/admin/landing-plans
router.get("/landing-plans", async (req, res, next) => {
  try {
    res.json(await getLandingPlans(true))
  } catch (error) {
    next(error)
  }
})

// POST /api/admin/landing-plans
router.post("/landing-plans", validate(planSchema), async (req, res, next) => {
  try {
    const { name, price, ram, cpu, storage, features, popular, active } = req.body
    const result = await runSync(
      `INSERT INTO landing_plans (name, price, ram, cpu, storage, features, popular, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, price, ram, cpu, storage, JSON.stringify(features), popular ? 1 : 0, active ? 1 : 0]
    )

    const plan = await getOne("SELECT * FROM landing_plans WHERE id = ?", [result.lastID])
    const parsed = { ...plan, features: safeParseJSON(plan.features, []), popular: Boolean(plan.popular), active: Boolean(plan.active) }

    emitPlansUpdate(await getLandingPlans(false))
    res.status(201).json(parsed)
  } catch (error) {
    next(error)
  }
})

// PUT /api/admin/landing-plans/:id
router.put("/landing-plans/:id", validate(planSchema), async (req, res, next) => {
  try {
    const { id } = req.params
    const { name, price, ram, cpu, storage, features, popular, active } = req.body

    const existing = await getOne("SELECT id FROM landing_plans WHERE id = ?", [id])
    if (!existing) return res.status(404).json({ error: "Plan not found" })

    await runSync(
      `UPDATE landing_plans SET name=?, price=?, ram=?, cpu=?, storage=?, features=?, popular=?, active=?, updated_at=datetime('now') WHERE id=?`,
      [name, price, ram, cpu, storage, JSON.stringify(features), popular ? 1 : 0, active ? 1 : 0, id]
    )

    const plan = await getOne("SELECT * FROM landing_plans WHERE id = ?", [id])
    const parsed = { ...plan, features: safeParseJSON(plan.features, []), popular: Boolean(plan.popular), active: Boolean(plan.active) }

    emitPlansUpdate(await getLandingPlans(false))
    res.json(parsed)
  } catch (error) {
    next(error)
  }
})

// DELETE /api/admin/landing-plans/:id
router.delete("/landing-plans/:id", async (req, res, next) => {
  try {
    const { id } = req.params
    const existing = await getOne("SELECT id FROM landing_plans WHERE id = ?", [id])
    if (!existing) return res.status(404).json({ error: "Plan not found" })

    await runSync("DELETE FROM landing_plans WHERE id = ?", [id])

    emitPlansUpdate(await getLandingPlans(false))
    res.json({ success: true })
  } catch (error) {
    next(error)
  }
})

// PATCH /api/admin/landing-plans/:id/toggle-active
router.patch("/landing-plans/:id/toggle-active", async (req, res, next) => {
  try {
    const { id } = req.params
    const plan = await getOne("SELECT id, active FROM landing_plans WHERE id = ?", [id])
    if (!plan) return res.status(404).json({ error: "Plan not found" })

    const newActive = plan.active ? 0 : 1
    await runSync("UPDATE landing_plans SET active=?, updated_at=datetime('now') WHERE id=?", [newActive, id])

    emitPlansUpdate(await getLandingPlans(false))
    res.json({ success: true, active: Boolean(newActive) })
  } catch (error) {
    next(error)
  }
})

// PATCH /api/admin/landing-plans/:id/toggle-popular
router.patch("/landing-plans/:id/toggle-popular", async (req, res, next) => {
  try {
    const { id } = req.params
    const plan = await getOne("SELECT id, popular FROM landing_plans WHERE id = ?", [id])
    if (!plan) return res.status(404).json({ error: "Plan not found" })

    const newPopular = plan.popular ? 0 : 1
    await runSync("UPDATE landing_plans SET popular=?, updated_at=datetime('now') WHERE id=?", [newPopular, id])

    emitPlansUpdate(await getLandingPlans(false))
    res.json({ success: true, popular: Boolean(newPopular) })
  } catch (error) {
    next(error)
  }
})

export default router
