import { env } from "./env.js"

export function isPostgresEnabled() {
  return env.DB_PROVIDER === "postgres"
}

// Convert SQLite-style placeholders (?) into PostgreSQL placeholders ($1, $2, ...)
export function toPgPlaceholders(sql) {
  let index = 0
  return sql.replace(/\?/g, () => {
    index += 1
    return `$${index}`
  })
}

export async function createPostgresPool() {
  if (!isPostgresEnabled()) {
    throw new Error("PostgreSQL is not enabled. Set DB_PROVIDER=postgres.")
  }

  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required when DB_PROVIDER=postgres")
  }

  const pg = await import("pg")
  const { Pool } = pg.default || pg

  return new Pool({
    connectionString: env.DATABASE_URL,
    ssl: env.DB_SSL ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
  })
}

export async function runPostgresHealthcheck() {
  const pool = await createPostgresPool()
  try {
    const result = await pool.query("SELECT 1 AS ok")
    return result.rows?.[0]?.ok === 1
  } finally {
    await pool.end()
  }
}
