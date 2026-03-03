/**
 * Public stats route
 * GET /api/stats  — returns real-time counts from the database
 */
import { Router } from "express"
import { getOne } from "../config/db.js"

const router = Router()

// ─── GET /api/stats ──────────────────────────────────────────────────────────
router.get("/", async (req, res, next) => {
  try {
    const [serversRow, usersRow] = await Promise.all([
      getOne("SELECT COUNT(*) AS count FROM servers WHERE status = 'active'"),
      getOne("SELECT COUNT(*) AS count FROM users")
    ])

    res.json({
      activeServers: serversRow?.count ?? 0,
      totalUsers: usersRow?.count ?? 0
    })
  } catch (error) {
    next(error)
  }
})

export default router
