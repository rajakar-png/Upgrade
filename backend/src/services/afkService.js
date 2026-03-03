import { getOne, runSync, transaction } from "../config/db.js"

/**
 * Claim AFK coins for a user.
 *
 * Security note: adblock detection is NOT done here — it is enforced by the
 * earn token system (earnTokenService.js). By the time this function is called,
 * the route handler has already validated the earn token, meaning the user
 * demonstrably waited the minimum view duration server-side.
 *
 * This function only handles:
 *   - 60-second cooldown enforcement (DB-level, inside transaction)
 *   - Parameterized coin increment (no SQL injection possible)
 */
export async function claimAfkCoins({ userId }) {
  const settings = await getOne("SELECT coins_per_minute FROM coin_settings WHERE id = 1")
  const reward = Math.max(1, settings?.coins_per_minute ?? 1)

  // Use transaction with BEGIN IMMEDIATE to prevent concurrent double-claims
  return await transaction(({ getOne: txGetOne, runSync: txRun }) => {
    const now = new Date()
    const user = txGetOne("SELECT last_claim_time FROM users WHERE id = ?", [userId])

    if (user?.last_claim_time) {
      const last = new Date(user.last_claim_time)
      const diffSeconds = Math.floor((now.getTime() - last.getTime()) / 1000)
      if (diffSeconds < 60) {
        const err = new Error("Claim cooldown")
        err.statusCode = 429
        err.waitSeconds = 60 - diffSeconds
        throw err
      }
    }

    txRun(
      "UPDATE users SET coins = coins + ?, last_claim_time = ? WHERE id = ?",
      [reward, now.toISOString(), userId]
    )

    return reward
  })
}
