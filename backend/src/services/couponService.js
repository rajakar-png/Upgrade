import { getOne, runSync, query, transaction } from "../config/db.js"

export async function redeemCoupon({ code, userId, ipAddress }) {
  const now = new Date().toISOString()

  // Entire coupon redemption is atomic — BEGIN IMMEDIATE serializes
  // concurrent attempts, preventing over-redemption beyond max_uses.
  return await transaction(({ getOne, runSync, query }) => {
    const coupon = getOne("SELECT * FROM coupons WHERE code = ?", [code])
    if (!coupon || !coupon.active) {
      throw Object.assign(new Error("Coupon is invalid"), { statusCode: 400 })
    }

    if (new Date(coupon.expires_at) <= new Date(now)) {
      throw Object.assign(new Error("Coupon is expired"), { statusCode: 400 })
    }

    const totalUsesRow = getOne(
      "SELECT COUNT(*) as count FROM coupon_redemptions WHERE coupon_id = ?",
      [coupon.id]
    )
    const totalUses = totalUsesRow?.count || 0

    if (totalUses >= coupon.max_uses) {
      throw Object.assign(new Error("Coupon max uses reached"), { statusCode: 400 })
    }

    const userUsesRow = getOne(
      "SELECT COUNT(*) as count FROM coupon_redemptions WHERE coupon_id = ? AND user_id = ?",
      [coupon.id, userId]
    )
    const userUses = userUsesRow?.count || 0

    if (userUses >= coupon.per_user_limit) {
      throw Object.assign(new Error("Coupon limit reached for this user"), { statusCode: 400 })
    }

    const ipUsers = query(
      "SELECT DISTINCT user_id FROM coupon_redemptions WHERE coupon_id = ? AND ip_address = ?",
      [coupon.id, ipAddress]
    )

    if (ipUsers.length > 0 && !ipUsers.find((row) => row.user_id === userId)) {
      const userIds = [userId, ...ipUsers.map((row) => row.user_id)]
      const placeholders = userIds.map(() => "?").join(",")
      runSync(
        `UPDATE users SET flagged = 1 WHERE id IN (${placeholders})`,
        userIds
      )
      throw Object.assign(new Error("Coupon already redeemed from this IP"), { statusCode: 400 })
    }

    const otherIpUsers = query(
      "SELECT DISTINCT user_id FROM coupon_redemptions WHERE ip_address = ?",
      [ipAddress]
    )

    if (otherIpUsers.length > 0 && !otherIpUsers.find((row) => row.user_id === userId)) {
      const userIds = [userId, ...otherIpUsers.map((row) => row.user_id)]
      const placeholders = userIds.map(() => "?").join(",")
      runSync(
        `UPDATE users SET flagged = 1 WHERE id IN (${placeholders})`,
        userIds
      )
    }

    runSync(
      "INSERT INTO coupon_redemptions (coupon_id, user_id, ip_address, redeemed_at) VALUES (?, ?, ?, ?)",
      [coupon.id, userId, ipAddress, now]
    )

    runSync(
      "UPDATE users SET coins = coins + ? WHERE id = ?",
      [coupon.coin_reward, userId]
    )

    return coupon.coin_reward
  })
}
