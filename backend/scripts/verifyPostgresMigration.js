import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"
import Database from "better-sqlite3"
import pg from "pg"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, "../.env"), override: true })

const { Pool } = pg

const SQLITE_PATH = process.env.DB_PATH || "./data/astranodes.sqlite"
const DATABASE_URL = process.env.DATABASE_URL
const DB_SSL = process.env.DB_SSL === "true"

if (!DATABASE_URL) {
  console.error("[VERIFY PG] DATABASE_URL is required")
  process.exit(1)
}

const tables = [
  "users",
  "plans_coin",
  "plans_real",
  "servers",
  "coin_settings",
  "coupons",
  "coupon_redemptions",
  "utr_submissions",
  "site_content",
  "landing_plans",
  "site_settings",
  "plans",
  "features",
  "vouchers",
  "announcements",
  "tickets",
  "ticket_messages",
  "server_backups",
  "audit_log",
  "idempotency_keys"
]

function sqliteTableExists(db, table) {
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table)
  return Boolean(row)
}

async function pgTableExists(client, table) {
  const result = await client.query(
    "SELECT to_regclass($1) IS NOT NULL AS exists",
    [`public.${table}`]
  )
  return Boolean(result.rows?.[0]?.exists)
}

async function countPg(client, table) {
  const result = await client.query(`SELECT COUNT(*)::bigint AS count FROM ${table}`)
  return Number(result.rows[0].count)
}

function countSqlite(db, table) {
  if (!sqliteTableExists(db, table)) {
    return 0
  }
  const row = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get()
  return Number(row.count)
}

async function main() {
  const sqliteDb = new Database(SQLITE_PATH, { readonly: true })
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DB_SSL ? { rejectUnauthorized: false } : false,
    max: 5
  })

  const client = await pool.connect()
  let failed = false

  try {
    console.log("[VERIFY PG] Comparing table row counts...")
    for (const table of tables) {
      const sqliteCount = countSqlite(sqliteDb, table)
      const existsInPg = await pgTableExists(client, table)
      if (!existsInPg) {
        failed = true
        console.error(`[VERIFY PG] ✗ ${table}: missing in postgres`) 
        continue
      }
      const pgCount = await countPg(client, table)
      if (sqliteCount !== pgCount) {
        failed = true
        console.error(`[VERIFY PG] ✗ ${table}: sqlite=${sqliteCount} postgres=${pgCount}`)
      } else {
        console.log(`[VERIFY PG] ✓ ${table}: ${sqliteCount}`)
      }
    }

    const sqliteUsers = sqliteDb.prepare("SELECT COALESCE(SUM(coins), 0) AS coins, COALESCE(SUM(balance), 0) AS balance FROM users").get()
    const pgUsers = (await client.query("SELECT COALESCE(SUM(coins), 0) AS coins, COALESCE(SUM(balance), 0) AS balance FROM users")).rows[0]

    if (Number(sqliteUsers.coins) !== Number(pgUsers.coins)) {
      failed = true
      console.error(`[VERIFY PG] ✗ users coins sum mismatch: sqlite=${sqliteUsers.coins} postgres=${pgUsers.coins}`)
    } else {
      console.log(`[VERIFY PG] ✓ users coins sum=${sqliteUsers.coins}`)
    }

    if (Number(sqliteUsers.balance) !== Number(pgUsers.balance)) {
      failed = true
      console.error(`[VERIFY PG] ✗ users balance sum mismatch: sqlite=${sqliteUsers.balance} postgres=${pgUsers.balance}`)
    } else {
      console.log(`[VERIFY PG] ✓ users balance sum=${sqliteUsers.balance}`)
    }

    const sqliteActive = sqliteDb.prepare("SELECT COUNT(*) AS count FROM servers WHERE status = 'active'").get().count
    const pgActive = (await client.query("SELECT COUNT(*)::bigint AS count FROM servers WHERE status = 'active'"))
      .rows[0].count

    if (Number(sqliteActive) !== Number(pgActive)) {
      failed = true
      console.error(`[VERIFY PG] ✗ active server count mismatch: sqlite=${sqliteActive} postgres=${pgActive}`)
    } else {
      console.log(`[VERIFY PG] ✓ active server count=${sqliteActive}`)
    }

    if (failed) {
      console.error("[VERIFY PG] Verification failed")
      process.exitCode = 1
      return
    }

    console.log("[VERIFY PG] Verification successful")
  } finally {
    sqliteDb.close()
    client.release()
    await pool.end()
  }
}

main().catch((error) => {
  if (String(error.message || "").includes("relation \"users\" does not exist")) {
    console.error("[VERIFY PG] Error: postgres schema not initialized. Run: npm run migrate-to-postgres")
    process.exit(1)
  }
  console.error("[VERIFY PG] Error:", error.message)
  process.exit(1)
})
