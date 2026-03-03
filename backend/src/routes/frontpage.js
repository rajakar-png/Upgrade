/**
 * Public frontpage routes
 * GET /api/frontpage          — all site_content sections
 * GET /api/landing-plans      — active landing plans
 */
import { Router } from "express"
import { query, getOne } from "../config/db.js"

const router = Router()

// ─── GET /api/frontpage ──────────────────────────────────────────────────────
router.get("/", async (req, res, next) => {
  try {
    const rows = await query("SELECT section_name, content_json, updated_at FROM site_content")

    const content = {}
    for (const row of rows) {
      try {
        content[row.section_name] = {
          data: JSON.parse(row.content_json),
          updatedAt: row.updated_at
        }
      } catch {
        content[row.section_name] = { data: {}, updatedAt: row.updated_at }
      }
    }

    res.json(content)
  } catch (error) {
    next(error)
  }
})

// ─── GET /api/landing-plans ──────────────────────────────────────────────────
router.get("/landing-plans", async (req, res, next) => {
  try {
    const plans = await query(
      "SELECT * FROM landing_plans WHERE active = 1 ORDER BY popular DESC, price ASC"
    )

    const parsed = plans.map((p) => ({
      ...p,
      features: safeParseJSON(p.features, []),
      popular: Boolean(p.popular),
      active: Boolean(p.active)
    }))

    res.json(parsed)
  } catch (error) {
    next(error)
  }
})

function safeParseJSON(str, fallback) {
  try { return JSON.parse(str) } catch { return fallback }
}

export default router
