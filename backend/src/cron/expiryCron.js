import cron from "node-cron"
import { query, getOne, runSync, transaction } from "../config/db.js"
import { addDays, getDurationDays } from "../utils/durations.js"
import { pterodactyl } from "../services/pterodactyl.js"

async function getPlan(planType, planId) {
  const table = planType === "coin" ? "plans_coin" : "plans_real"
  return await getOne(`SELECT * FROM ${table} WHERE id = ?`, [planId])
}

function getPrice(planType, plan) {
  return planType === "coin" ? plan.coin_price : plan.price
}

// Auto-renewal always uses renewal_price for coin plans
function getRenewalPrice(planType, plan) {
  if (planType === "coin") return plan.renewal_price ?? plan.coin_price
  return plan.price
}

function getBalanceField(planType) {
  return planType === "coin" ? "coins" : "balance"
}

export function getLimits(plan) {
  // Convert GB to MB for Pterodactyl (plan.ram and plan.storage are in GB)
  const memory = Math.round(plan.ram * 1024)   // GB to MB (supports fractional e.g. 0.5 GB = 512 MB)
  const disk = Math.round(plan.storage * 1024)  // GB to MB

  // Use the admin-configured swap value (in MB), defaulting to 0
  const swap = plan.swap || 0

  return {
    memory,
    swap,
    cpu: plan.cpu,                     // CPU cores (converted to % in pterodactyl service)
    disk,
    backups: plan.backup_count || 0,   // allowed Pterodactyl backups
    allocations: plan.extra_ports || 0 // extra port allocations
  }
}

async function processExpiring() {
  const now = new Date()
  const nowIso = now.toISOString()
  const expiring = await query(
    "SELECT * FROM servers WHERE status = 'active' AND expires_at <= ?",
    [nowIso]
  )

  for (const server of expiring) {
    const user = await getOne("SELECT id, coins, balance FROM users WHERE id = ?", [server.user_id])
    const plan = await getPlan(server.plan_type, server.plan_id)
    if (!user || !plan) continue

    const price = getRenewalPrice(server.plan_type, plan)
    const balanceField = getBalanceField(server.plan_type)

    if (user[balanceField] >= price) {
      // Atomic balance deduction + expiry extension inside a transaction
      // to prevent double-charging from concurrent cron ticks
      try {
        await transaction(({ getOne: txGetOne, runSync: txRun }) => {
          // Re-check balance inside the lock to prevent double-spend
          const freshUser = txGetOne("SELECT id, coins, balance FROM users WHERE id = ?", [server.user_id])
          if (!freshUser || freshUser[balanceField] < price) {
            throw new Error("INSUFFICIENT_BALANCE")
          }
          txRun(`UPDATE users SET ${balanceField} = ${balanceField} - ? WHERE id = ?`, [price, user.id])
          const baseDate = new Date(server.expires_at)
          const startDate = baseDate > now ? server.expires_at : nowIso
          const nextExpiry = addDays(startDate, getDurationDays(plan.duration_type, plan.duration_days))
          txRun("UPDATE servers SET expires_at = ? WHERE id = ? AND status = 'active'", [nextExpiry, server.id])
        })
        continue
      } catch (txErr) {
        if (txErr.message !== "INSUFFICIENT_BALANCE") {
          console.error(`[CRON] Transaction failed for server ${server.id}:`, txErr.message)
          continue
        }
        // Fall through to suspend if balance became insufficient
      }
    }

    try {
      await pterodactyl.suspendServer(server.pterodactyl_server_id)
    } catch (error) {
      console.error(error.message)
      continue
    }

    const grace = new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString()
    await runSync(
      "UPDATE servers SET status = 'suspended', suspended_at = ?, grace_expires_at = ? WHERE id = ? AND status = 'active'",
      [nowIso, grace, server.id]
    )
  }
}

async function processGraceExpired() {
  const nowIso = new Date().toISOString()
  const graceExpired = await query(
    "SELECT * FROM servers WHERE status = 'suspended' AND grace_expires_at <= ?",
    [nowIso]
  )

  for (const server of graceExpired) {
    try {
      await pterodactyl.deleteServer(server.pterodactyl_server_id)
    } catch (error) {
      console.error(error.message)
      continue
    }

    await runSync(
      "UPDATE servers SET status = 'deleted' WHERE id = ? AND status = 'suspended'",
      [server.id]
    )
  }
}

export function startExpiryCron() {
  cron.schedule("*/5 * * * *", async () => {
    try {
      await processExpiring()
      await processGraceExpired()
    } catch (err) {
      console.error("[CRON] Expiry cron fatal error:", err.message)
    }
  })
}
