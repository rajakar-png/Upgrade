import { resolve } from "path"
import { readFileSync } from "fs"
import { fileURLToPath } from "url"
import { dirname } from "path"
import { db } from "../src/config/db.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const schemaPath = resolve(__dirname, "../src/db/tickets-upgrade.sql")

console.log("[UPGRADE] Running ticket system upgrade migration...")
console.log("[UPGRADE] Schema:", schemaPath)

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
  
  console.log("[UPGRADE] ✓ Ticket system upgraded successfully!")
  console.log("[UPGRADE] New features:")
  console.log("  - Priority levels (Low/Medium/High)")
  console.log("  - Image uploads in messages")
  console.log("  - Username and email cached in tickets")
  
  process.exit(0)
} catch (err) {
  console.error("[UPGRADE] ✗ Migration failed:", err.message)
  console.error("[UPGRADE] This is normal if columns already exist")
  process.exit(1)
}
