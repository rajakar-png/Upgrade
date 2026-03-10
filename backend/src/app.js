import express from "express"
import helmet from "helmet"
import morgan from "morgan"
import cors from "cors"
import session from "express-session"
import { fileURLToPath } from "url"
import { dirname, join } from "path"
import { env } from "./config/env.js"
import { rateLimiter } from "./middlewares/rateLimit.js"
import { errorHandler } from "./middlewares/errorHandler.js"
import { maintenanceGuard } from "./middlewares/maintenance.js"
import { requestContext, getRequestMetrics } from "./middlewares/requestContext.js"
import { query } from "./config/db.js"
import routes from "./routes/index.js"
import passport from "./config/passport.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()

// Trust exactly 1 proxy hop (nginx in production, Codespaces forwarder in dev).
// Using `true` is rejected by express-rate-limit as it allows IP spoofing.
app.set("trust proxy", 1)

// CORS Configuration
const isProd = env.NODE_ENV === "production"
if (!isProd) console.log(`[CORS INIT] NODE_ENV="${env.NODE_ENV}" FRONTEND_URL="${env.FRONTEND_URL}"`)

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true)

    // Always allow GitHub Codespaces origins
    if (origin.endsWith(".app.github.dev")) return callback(null, true)

    // Always allow in non-production or when FRONTEND_URL is localhost
    if (!isProd || env.FRONTEND_URL.includes("localhost")) return callback(null, true)

    // Production: check against FRONTEND_URL (support multiple comma-separated)
    const allowedOrigins = env.FRONTEND_URL.split(",").map((u) => u.trim())
    if (allowedOrigins.includes(origin)) return callback(null, true)

    console.warn(`[CORS] BLOCKED origin="${origin}"`)
    callback(new Error("CORS not allowed"))
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key", "idempotency-key"],
  exposedHeaders: ["Content-Length", "X-JSON-Response"],
  optionsSuccessStatus: 200,
  maxAge: 86400,
  preflightContinue: false
}

app.use(cors(corsOptions))

// Helmet configuration with Adsterra CSP support
app.use(helmet({
  contentSecurityPolicy: env.NODE_ENV === "development" ? false : {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "'unsafe-eval'",
        "blob:",
        "https://www.highperformanceformat.com",
        "https://*.highperformanceformat.com",
        "https://pl28770653.effectivegatecpm.com",
        "https://pl28771198.effectivegatecpm.com",
        "https://*.effectivegatecpm.com",
        "https://environmenttalentrabble.com",
        "https://preferencenail.com",
        "https://weirdopt.com",
        "https://static.cloudflareinsights.com",
        "https://challenges.cloudflare.com"
      ],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https:", "wss:", "ws:"],
      frameSrc: ["'self'", "https:", "https://*.adsterratools.com", "https://*.effectivegatecpm.com", "https://*.highperformanceformat.com"],
      workerSrc: ["'self'", "blob:"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  },
  crossOriginResourcePolicy: { policy: "cross-origin" },
  hsts: {
    maxAge: 31536000,  // 1 year
    includeSubDomains: true,
    preload: true
  },
  frameguard: {
    action: 'sameorigin'
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin'
  }
}))
app.use(requestContext)
app.use(express.json({ limit: "2mb" }))
morgan.token("request-id", (req) => req.requestId || "-")
app.use(morgan((tokens, req, res) => {
  return JSON.stringify({
    requestId: tokens["request-id"](req, res),
    method: tokens.method(req, res),
    path: tokens.url(req, res),
    status: Number(tokens.status(req, res) || 0),
    durationMs: Number(tokens["response-time"](req, res) || 0),
    contentLength: tokens.res(req, res, "content-length") || "0"
  })
}))
app.use(rateLimiter)

// Session configuration for OAuth
// In dev (Codespaces), frontend and backend are on different origins so we need
// SameSite=None + Secure for the session cookie to be sent on cross-origin fetch.
// In production, both are behind the same Nginx domain, so Lax is fine.
const isCrossOrigin = !isProd && env.FRONTEND_URL && !env.FRONTEND_URL.includes("localhost")
app.use(session({
  secret: env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProd || isCrossOrigin,
    httpOnly: true,
    sameSite: isCrossOrigin ? "none" : "lax",
    maxAge: 10 * 60 * 1000 // 10 minutes — sessions are only used for OAuth flow
  }
}))

// Initialize Passport
app.use(passport.initialize())
app.use(passport.session())

// Serve uploaded assets statically (favicons/backgrounds/tickets)
// Site assets (logo, favicon, background) are stored in backend/public/uploads/
const uploadsPath = join(__dirname, "../public/uploads")
app.use("/uploads", express.static(uploadsPath, {
  maxAge: "1h",
  setHeaders: (res) => {
    res.set("X-Content-Type-Options", "nosniff")
    res.set("Cache-Control", "public, max-age=3600")
  }
}))

// Also serve from the UPLOAD_DIR if configured (production may use a different path)
if (env.UPLOAD_DIR && env.UPLOAD_DIR !== "./uploads") {
  app.use("/uploads", express.static(env.UPLOAD_DIR, {
    maxAge: "1h",
    setHeaders: (res) => {
      res.set("X-Content-Type-Options", "nosniff")
      res.set("Cache-Control", "public, max-age=3600")
    }
  }))
  console.log("[Server] Also serving uploads from UPLOAD_DIR:", env.UPLOAD_DIR)
}
console.log("[Server] Serving static files from:", uploadsPath)

app.get("/health", async (req, res) => {
  try {
    const [{ user_count }] = await query("SELECT COUNT(*) AS user_count FROM users")
    const [{ server_count }] = await query("SELECT COUNT(*) AS server_count FROM servers WHERE status = 'active'")
    const [{ page_count, page_size }] = await query("PRAGMA page_count")
      .then(async ([pc]) => {
        const [ps] = await query("PRAGMA page_size")
        return [{ page_count: pc.page_count, page_size: ps.page_size }]
      })
    const dbSizeMB = ((page_count * page_size) / (1024 * 1024)).toFixed(2)
    res.json({
      status: "ok",
      service: "astranodes-api",
      uptime: Math.floor(process.uptime()),
      db: { users: user_count, activeServers: server_count, sizeMB: Number(dbSizeMB) }
    })
  } catch {
    res.json({ status: "ok", service: "astranodes-api" })
  }
})

app.get("/ready", async (req, res) => {
  try {
    await query("SELECT 1 AS db_ok")
    res.json({
      status: "ready",
      service: "astranodes-api",
      checks: {
        db: "ok"
      }
    })
  } catch (error) {
    res.status(503).json({
      status: "not_ready",
      service: "astranodes-api",
      checks: {
        db: "failed"
      }
    })
  }
})

app.get("/metrics", async (req, res) => {
  const requestMetrics = getRequestMetrics()
  res.json({
    status: "ok",
    uptimeSec: Math.floor(process.uptime()),
    memory: process.memoryUsage(),
    ...requestMetrics
  })
})

// Maintenance mode guard — must come after static file serving and health check,
// but before API routes. Admins bypass, public settings endpoint always allowed.
app.use(maintenanceGuard)

app.use("/api", routes)

app.use(errorHandler)

export default app
