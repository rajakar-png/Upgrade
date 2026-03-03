import { Router } from "express"
import { z } from "zod"
import { validate } from "../middlewares/validate.js"
import { requireAuth } from "../middlewares/auth.js"
import { coinsClaimLimiter, coinsSessionLimiter } from "../middlewares/rateLimit.js"
import { getOne } from "../config/db.js"
import { claimAfkCoins } from "../services/afkService.js"
import { generateEarnToken, consumeEarnToken } from "../services/earnTokenService.js"

const router = Router()

const claimSchema = z.object({
  body: z.object({
    earnToken: z.string().min(64).max(64)
  })
})

// ─── GET /api/coins/balance ──────────────────────────────────────────────────
router.get("/balance", requireAuth, async (req, res, next) => {
  try {
    const user = await getOne(
      "SELECT coins, balance, last_claim_time FROM users WHERE id = ?",
      [req.user.id]
    )
    res.json(user)
  } catch (error) {
    next(error)
  }
})

// ─── POST /api/coins/session ─────────────────────────────────────────────────
// Issues a short-lived earn token. The token becomes valid after MIN_VIEW_MS (4s)
// server-side, so bots that call session+claim in rapid succession will be rejected.
router.post(
  "/session",
  requireAuth,
  coinsSessionLimiter,
  async (req, res) => {
    // Reject flagged users immediately
    if (req.user.flagged) {
      return res.status(403).json({ error: "Account flagged. Contact support." })
    }

    const token = generateEarnToken(req.user.id)
    const ip = req.ip || req.headers["x-forwarded-for"] || "unknown"
    console.log(`[Coins] Session token issued for user=${req.user.id} ip=${ip}`)

    res.json({ earnToken: token })
  }
)

// ─── POST /api/coins/claim ───────────────────────────────────────────────────
// Requires a valid earn token issued by /session. Earn tokens are:
// - One-time use (deleted after consumption)
// - Time-locked (invalid for first 4s after issue)
// - User-bound (token rejects if claimed by different user ID)
// - Short-lived (expire 40s after issue)
router.post(
  "/claim",
  requireAuth,
  coinsClaimLimiter,
  validate(claimSchema),
  async (req, res, next) => {
    const ip = req.ip || req.headers["x-forwarded-for"] || "unknown"

    try {
      // Reject flagged users
      if (req.user.flagged) {
        console.warn(`[Coins][SUSPICIOUS] Flagged user attempted claim user=${req.user.id} ip=${ip}`)
        return res.status(403).json({ error: "Account flagged. Contact support." })
      }

      // Validate the earn token
      const result = consumeEarnToken(req.body.earnToken, req.user.id)
      if (!result.valid) {
        console.warn(`[Coins][REJECT] Token invalid user=${req.user.id} ip=${ip} reason="${result.reason}"`)
        return res.status(400).json({ error: result.reason })
      }

      // Process the coin claim (handles cooldown check + DB update)
      const earned = await claimAfkCoins({ userId: req.user.id })
      console.log(`[Coins] Claim success user=${req.user.id} earned=${earned} ip=${ip}`)

      res.json({ earned })
    } catch (error) {
      if (error.waitSeconds) {
        console.log(`[Coins] Cooldown hit user=${req.user.id} waitSeconds=${error.waitSeconds} ip=${ip}`)
        return res.status(429).json({ error: "Cooldown active", waitSeconds: error.waitSeconds })
      }
      next(error)
    }
  }
)

export default router
