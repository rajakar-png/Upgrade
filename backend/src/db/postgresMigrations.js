import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { createPostgresPool, isPostgresEnabled } from "../config/postgresCompat.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const migrationsDir = path.join(__dirname, "migrations")

function parseMigrationFilename(filename) {
  const match = filename.match(/^(\d+)_.*\.(up|down)\.sql$/)
  if (!match) return null
  return { version: Number(match[1]), direction: match[2], filename }
}

function readMigrations() {
  const files = fs.readdirSync(migrationsDir)
  const parsed = files.map(parseMigrationFilename).filter(Boolean)

  const grouped = new Map()
  for (const item of parsed) {
    const entry = grouped.get(item.version) || { version: item.version, up: null, down: null }
    entry[item.direction] = item.filename
    grouped.set(item.version, entry)
  }

  return [...grouped.values()]
    .filter((m) => m.up && m.down)
    .sort((a, b) => a.version - b.version)
}

async function ensureMigrationTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version BIGINT PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}

export async function migratePostgresUp() {
  if (!isPostgresEnabled()) {
    throw new Error("Postgres migrations require DB_PROVIDER=postgres")
  }

  const migrations = readMigrations()
  const pool = await createPostgresPool()
  const client = await pool.connect()

  try {
    await ensureMigrationTable(client)

    const existingRows = await client.query("SELECT version FROM schema_migrations")
    const applied = new Set(existingRows.rows.map((row) => Number(row.version)))

    for (const migration of migrations) {
      if (applied.has(migration.version)) continue

      const upSql = fs.readFileSync(path.join(migrationsDir, migration.up), "utf-8")
      await client.query("BEGIN")
      try {
        await client.query(upSql)
        await client.query(
          "INSERT INTO schema_migrations (version, name) VALUES ($1, $2)",
          [migration.version, migration.up]
        )
        await client.query("COMMIT")
        console.log(`[PG MIGRATE] Applied ${migration.up}`)
      } catch (error) {
        await client.query("ROLLBACK")
        throw error
      }
    }
  } finally {
    client.release()
    await pool.end()
  }
}

export async function migratePostgresDown() {
  if (!isPostgresEnabled()) {
    throw new Error("Postgres migrations require DB_PROVIDER=postgres")
  }

  const migrations = readMigrations()
  const byVersion = new Map(migrations.map((m) => [m.version, m]))

  const pool = await createPostgresPool()
  const client = await pool.connect()

  try {
    await ensureMigrationTable(client)

    const latestApplied = await client.query(
      "SELECT version, name FROM schema_migrations ORDER BY version DESC LIMIT 1"
    )

    if (!latestApplied.rows.length) {
      console.log("[PG MIGRATE] No applied migrations to roll back")
      return
    }

    const version = Number(latestApplied.rows[0].version)
    const migration = byVersion.get(version)
    if (!migration) {
      throw new Error(`Missing down migration file for version ${version}`)
    }

    const downSql = fs.readFileSync(path.join(migrationsDir, migration.down), "utf-8")

    await client.query("BEGIN")
    try {
      await client.query(downSql)
      await client.query("DELETE FROM schema_migrations WHERE version = $1", [version])
      await client.query("COMMIT")
      console.log(`[PG MIGRATE] Rolled back ${migration.down}`)
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    }
  } finally {
    client.release()
    await pool.end()
  }
}
