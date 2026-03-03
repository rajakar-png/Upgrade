import { Router } from "express"
import { z } from "zod"
import { validate } from "../middlewares/validate.js"
import { requireAuth } from "../middlewares/auth.js"
import { query } from "../config/db.js"
import { redeemCoupon } from "../services/couponService.js"

const router = Router()

const redeemSchema = z.object({
  body: z.object({
    code: z.string().min(3)
  })
})

router.post("/redeem", requireAuth, validate(redeemSchema), async (req, res, next) => {
  try {
    const reward = await redeemCoupon({
      code: req.body.code.toUpperCase(),
      userId: req.user.id,
      ipAddress: req.ip
    })
    res.json({ reward })
  } catch (error) {
    next(error)
  }
})

router.get("/history", requireAuth, async (req, res, next) => {
  try {
    const history = await query(
      "SELECT cr.*, c.code, c.coin_reward FROM coupon_redemptions cr JOIN coupons c ON c.id = cr.coupon_id WHERE cr.user_id = ? ORDER BY cr.redeemed_at DESC",
      [req.user.id]
    )
    res.json(history)
  } catch (error) {
    next(error)
  }
})

export default router
