import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, "../.env"), override: true })

const { migratePostgresDown } = await import("../src/db/postgresMigrations.js")

migratePostgresDown()
  .then(() => {
    console.log("[PG MIGRATE] Down complete")
  })
  .catch((error) => {
    console.error("[PG MIGRATE] Down failed:", error.message)
    process.exit(1)
  })
