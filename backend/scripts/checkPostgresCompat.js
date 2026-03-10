import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Force backend .env values for this compatibility check so stale
// shell-exported DATABASE_URL/DB_PROVIDER values do not interfere.
dotenv.config({ path: path.join(__dirname, "../.env"), override: true })

const { runPostgresHealthcheck, isPostgresEnabled } = await import("../src/config/postgresCompat.js")

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isTransientConnectionError(error) {
  const msg = String(error?.message || "")
  return (
    msg.includes("ECONNRESET") ||
    msg.includes("ECONNREFUSED") ||
    msg.includes("the database system is starting up") ||
    msg.includes("timeout expired")
  )
}

async function main() {
  if (!isPostgresEnabled()) {
    console.log("[PG CHECK] Skipped: DB_PROVIDER is not set to postgres")
    process.exit(0)
  }

  const maxAttempts = 12
  const delayMs = 2000

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const ok = await runPostgresHealthcheck()
      if (!ok) {
        console.error("[PG CHECK] Failed: healthcheck query did not return expected result")
        process.exit(1)
      }

      console.log("[PG CHECK] Success: PostgreSQL connectivity is healthy")
      return
    } catch (error) {
      const lastAttempt = attempt === maxAttempts
      if (!isTransientConnectionError(error) || lastAttempt) {
        throw error
      }
      console.log(`[PG CHECK] Waiting for PostgreSQL readiness (${attempt}/${maxAttempts - 1})...`)
      await sleep(delayMs)
    }
  }

}

main().catch((error) => {
  if (String(error.message || "").includes("ENOTFOUND")) {
    console.error("[PG CHECK] Error:", error.message)
    console.error("[PG CHECK] Hint: check DATABASE_URL host. For local docker use localhost:5432.")
    process.exit(1)
  }

  if (String(error.message || "").includes("ECONNREFUSED")) {
    console.error("[PG CHECK] Error:", error.message)
    console.error("[PG CHECK] Hint: PostgreSQL is not running. Start docker-compose.postgres.yml first.")
    process.exit(1)
  }

  console.error("[PG CHECK] Error:", error.message)
  process.exit(1)
})
