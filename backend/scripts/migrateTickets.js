import { resolve } from "path"
import { readFileSync } from "fs"
import { fileURLToPath } from "url"
import { dirname } from "path"
import { db } from "../src/config/db.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const schemaPath = resolve(__dirname, "../src/db/tickets.sql")

console.log("[MIGRATE] Running ticket schema migration...")
console.log("[MIGRATE] Schema:", schemaPath)

try {
  const schema = readFileSync(schemaPath, "utf8")
  
  // Split and execute SQL statements
  const statements = schema
    .split(";")
    .map(s => s.trim())
    .filter(s => s.length > 0)
  
  for (const stmt of statements) {
    db.prepare(stmt).run()
  }
  
  console.log("[MIGRATE] ✓ Ticket tables created successfully")
  process.exit(0)
} catch (err) {
  console.error("[MIGRATE] ✗ Migration failed:", err.message)
  process.exit(1)
}
