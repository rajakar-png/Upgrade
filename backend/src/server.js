import http from "http"
import app from "./app.js"
import { env } from "./config/env.js"
import migrate from "./db/migrate.js"
import { migratePostgresUp } from "./db/postgresMigrations.js"
import { startExpiryCron } from "./cron/expiryCron.js"
import { initBackupCron } from "./cron/backupCron.js"
import { initSecurityCleanupCron } from "./cron/securityCleanupCron.js"
import { initSocket } from "./utils/socket.js"

async function startup() {
  try {
    if (env.NODE_ENV === "production" && env.DB_PROVIDER !== "postgres") {
      console.error("[Server] Production requires DB_PROVIDER=postgres")
      process.exit(1)
    }

    if (env.DB_PROVIDER === "sqlite") {
      console.log("[Server] Starting SQLite migration...")
      await migrate()
      console.log("[Server] Migration complete, starting server...")
    } else {
      console.log("[Server] DB_PROVIDER=postgres detected; running versioned PostgreSQL migrations...")
      await migratePostgresUp()
      console.log("[Server] PostgreSQL migrations complete, starting server...")
    }

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
      console.log(`[Server] ✓ Readiness endpoint: http://localhost:${env.PORT}/ready`)
    })

    // Graceful shutdown — stop accepting requests, let in-flight finish
    const shutdown = (signal) => {
      console.log(`[Server] ${signal} received — shutting down gracefully…`)
      httpServer.close(() => {
        console.log("[Server] ✓ HTTP server closed")
        // DB close is handled by db.js SIGTERM/SIGINT handler
        process.exit(0)
      })
      // Force exit after 10 seconds if connections won't drain
      setTimeout(() => {
        console.error("[Server] Forced exit after 10s timeout")
        process.exit(1)
      }, 10_000).unref()
    }
    process.on("SIGTERM", () => shutdown("SIGTERM"))
    process.on("SIGINT", () => shutdown("SIGINT"))

    console.log("[Server] Starting cron jobs...")
    startExpiryCron()
    initBackupCron()
    initSecurityCleanupCron()
    console.log("[Server] ✓ Cron jobs started")
  } catch (error) {
    console.error("[Server] ✗ Failed to start server:", error)
    process.exit(1)
  }
}

startup()
