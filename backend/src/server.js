import http from "http"
import app from "./app.js"
import { env } from "./config/env.js"
import migrate from "./db/migrate.js"
import { startExpiryCron } from "./cron/expiryCron.js"
import { initBackupCron } from "./cron/backupCron.js"
import { initSocket } from "./utils/socket.js"

async function startup() {
  try {
    console.log("[Server] Starting database migration...")
    await migrate()
    console.log("[Server] Migration complete, starting server...")

    const httpServer = http.createServer(app)

    // Socket.io origin checker — must call callback(err, allow)
    const allowedOrigins = (origin, callback) => {
      if (!origin) return callback(null, true)
      if (origin.endsWith(".app.github.dev")) return callback(null, true)
      if (env.NODE_ENV !== "production" || env.FRONTEND_URL.includes("localhost")) return callback(null, true)
      const ok = env.FRONTEND_URL.split(",").map((u) => u.trim()).includes(origin)
      callback(ok ? null : new Error("CORS not allowed"), ok)
    }

    initSocket(httpServer, allowedOrigins)

    httpServer.listen(env.PORT, "0.0.0.0", () => {
      console.log(`[Server] ✓ AstraNodes API listening on 0.0.0.0:${env.PORT}`)
      console.log(`[Server] ✓ Health endpoint: http://localhost:${env.PORT}/health`)
    })

    console.log("[Server] Starting cron jobs...")
    startExpiryCron()
    initBackupCron()
    console.log("[Server] ✓ Cron jobs started")
  } catch (error) {
    console.error("[Server] ✗ Failed to start server:", error)
    process.exit(1)
  }
}

startup()
