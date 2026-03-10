import cron from "node-cron"
import { runSync } from "../config/db.js"
import { env } from "../config/env.js"

function formatSqlTimestamp(date) {
  return date.toISOString().slice(0, 19).replace("T", " ")
}

async function runSecurityCleanup() {
  try {
    const auditBefore = formatSqlTimestamp(new Date(Date.now() - env.AUDIT_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000))
    const idempotencyBefore = formatSqlTimestamp(new Date(Date.now() - env.IDEMPOTENCY_RETENTION_DAYS * 24 * 60 * 60 * 1000))

    const auditInfo = await runSync(
      `DELETE FROM audit_log
       WHERE created_at < ?`,
      [auditBefore]
    )

    const idemInfo = await runSync(
      `DELETE FROM idempotency_keys
       WHERE created_at < ?`,
      [idempotencyBefore]
    )

    const deletedAudit = Number(auditInfo?.changes || 0)
    const deletedIdem = Number(idemInfo?.changes || 0)
    if (deletedAudit > 0 || deletedIdem > 0) {
      console.log(`[SECURITY CLEANUP] Removed ${deletedAudit} audit rows and ${deletedIdem} idempotency rows`)
    }
  } catch (error) {
    console.error("[SECURITY CLEANUP] Failed:", error.message)
  }
}

export function initSecurityCleanupCron() {
  cron.schedule("15 4 * * *", async () => {
    await runSecurityCleanup()
  })
  console.log("[SECURITY CLEANUP] Initialized (daily at 04:15)")
}
