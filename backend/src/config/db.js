import Database from "better-sqlite3"
import fs from "fs"
import path from "path"
import { env } from "./env.js"
import { createPostgresPool, isPostgresEnabled, toPgPlaceholders } from "./postgresCompat.js"

const provider = isPostgresEnabled() ? "postgres" : "sqlite"
let sqliteDb = null
let pgPool = null

console.log(`[DB] Initializing provider: ${provider}`)

if (provider === "sqlite") {
  console.log("[DB] Initializing database at:", env.DB_PATH)
  const dbDir = path.dirname(env.DB_PATH)
  if (!fs.existsSync(dbDir)) {
    console.log("[DB] Creating database directory:", dbDir)
    fs.mkdirSync(dbDir, { recursive: true })
  }

  sqliteDb = new Database(env.DB_PATH)
  sqliteDb.pragma("busy_timeout = 10000")
  sqliteDb.pragma("journal_mode = WAL")
  sqliteDb.pragma("foreign_keys = ON")
  sqliteDb.pragma("secure_delete = ON")
  sqliteDb.pragma("cache_size = -65536")
  sqliteDb.pragma("mmap_size = 268435456")
  sqliteDb.pragma("temp_store = MEMORY")
  sqliteDb.pragma("synchronous = NORMAL")
  sqliteDb.pragma("wal_autocheckpoint = 1000")
  console.log("[DB] ✓ SQLite connection ready with WAL + tuning")
}

function stripTrailingSemicolon(sql) {
  return sql.trim().replace(/;$/, "")
}

async function getPgPool() {
  if (provider !== "postgres") return null
  if (!pgPool) {
    pgPool = await createPostgresPool()
    console.log("[DB] ✓ PostgreSQL pool created")
  }
  return pgPool
}

async function runPgStatement(clientOrPool, sql, params = []) {
  const pgSql = toPgPlaceholders(sql)
  return clientOrPool.query(pgSql, params)
}

async function runPgMutation(clientOrPool, sql, params = []) {
  const normalizedSql = stripTrailingSemicolon(sql)
  const isInsert = /^\s*insert\s+/i.test(normalizedSql)
  const hasReturning = /\breturning\b/i.test(normalizedSql)

  if (isInsert && !hasReturning) {
    try {
      const result = await runPgStatement(clientOrPool, `${normalizedSql} RETURNING id`, params)
      return {
        lastID: result.rows?.[0]?.id ?? null,
        changes: result.rowCount || 0
      }
    } catch {
      // Fallback for tables without an `id` column.
    }
  }

  const result = await runPgStatement(clientOrPool, normalizedSql, params)
  return {
    lastID: result.rows?.[0]?.id ?? null,
    changes: result.rowCount || 0
  }
}

export async function query(sql, params = []) {
  if (provider === "sqlite") {
    return sqliteDb.prepare(sql).all(params) || []
  }

  const pool = await getPgPool()
  const result = await runPgStatement(pool, sql, params)
  return result.rows || []
}

export async function getOne(sql, params = []) {
  if (provider === "sqlite") {
    return sqliteDb.prepare(sql).get(params) || null
  }

  const pool = await getPgPool()
  const result = await runPgStatement(pool, sql, params)
  return result.rows?.[0] || null
}

export async function runSync(sql, params = []) {
  if (provider === "sqlite") {
    const info = sqliteDb.prepare(sql).run(params)
    return { lastID: info.lastInsertRowid, changes: info.changes }
  }

  const pool = await getPgPool()
  return runPgMutation(pool, sql, params)
}

export async function transaction(fn) {
  if (provider === "sqlite") {
    sqliteDb.exec("BEGIN IMMEDIATE")
    const txHelpers = {
      query: async (sql, params = []) => sqliteDb.prepare(sql).all(params) || [],
      getOne: async (sql, params = []) => sqliteDb.prepare(sql).get(params) || null,
      runSync: async (sql, params = []) => {
        const info = sqliteDb.prepare(sql).run(params)
        return { lastID: info.lastInsertRowid, changes: info.changes }
      }
    }

    try {
      const result = await fn(txHelpers)
      sqliteDb.exec("COMMIT")
      return result
    } catch (error) {
      sqliteDb.exec("ROLLBACK")
      throw error
    }
  }

  const pool = await getPgPool()
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    const txHelpers = {
      query: async (sql, params = []) => {
        const result = await runPgStatement(client, sql, params)
        return result.rows || []
      },
      getOne: async (sql, params = []) => {
        const result = await runPgStatement(client, sql, params)
        return result.rows?.[0] || null
      },
      runSync: async (sql, params = []) => runPgMutation(client, sql, params)
    }

    const result = await fn(txHelpers)
    await client.query("COMMIT")
    return result
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

async function closeDb() {
  try {
    if (provider === "sqlite") {
      sqliteDb.pragma("wal_checkpoint(TRUNCATE)")
      sqliteDb.close()
      console.log("[DB] ✓ SQLite closed gracefully")
      return
    }

    if (pgPool) {
      await pgPool.end()
      console.log("[DB] ✓ PostgreSQL pool closed gracefully")
    }
  } catch (error) {
    console.error("[DB] Error during shutdown:", error.message)
  }
}

process.on("SIGTERM", () => {
  closeDb().finally(() => process.exit(0))
})
process.on("SIGINT", () => {
  closeDb().finally(() => process.exit(0))
})

export const db = provider === "sqlite"
  ? sqliteDb
  : {
      pragma: () => {},
      provider
    }

export { provider as dbProvider }
