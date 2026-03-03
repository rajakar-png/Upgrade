import { Router } from "express"
import { query } from "../config/db.js"
import { pterodactyl } from "../services/pterodactyl.js"
import { requireAuth } from "../middlewares/auth.js"

const router = Router()

router.get("/coin", async (req, res, next) => {
  try {
    const plans = await query("SELECT * FROM plans_coin")
    res.json(plans)
  } catch (error) {
    next(error)
  }
})

router.get("/real", async (req, res, next) => {
  try {
    const plans = await query("SELECT * FROM plans_real")
    res.json(plans)
  } catch (error) {
    next(error)
  }
})

router.get("/eggs", requireAuth, async (req, res, next) => {
  try {
    const eggs = await pterodactyl.getAvailableEggs()
    res.json(eggs)
  } catch (error) {
    next(error)
  }
})

export default router
