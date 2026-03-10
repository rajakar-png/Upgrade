import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, "../.env"), override: true })

const { migratePostgresUp } = await import("../src/db/postgresMigrations.js")

migratePostgresUp()
  .then(() => {
    console.log("[PG MIGRATE] Up complete")
  })
  .catch((error) => {
    console.error("[PG MIGRATE] Up failed:", error.message)
    process.exit(1)
  })
