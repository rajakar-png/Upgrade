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
  allowedHeaders: ["Content-Type", "Authorization"],
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
        "https://pl28770653.effectivegatecpm.com",
        "https://pl28771198.effectivegatecpm.com",
        "https://environmenttalentrabble.com",
        "https://preferencenail.com",
        "https://weirdopt.com"
      ],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https:", "wss:", "ws:"],
      frameSrc: ["'self'", "https:"],
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
app.use(express.json({ limit: "2mb" }))
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"))
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
const uploadsPath = join(__dirname, "../public/uploads")
app.use("/uploads", express.static(uploadsPath, {
  maxAge: "1h",
  setHeaders: (res) => {
    res.set("X-Content-Type-Options", "nosniff")
    res.set("Cache-Control", "public, max-age=3600")
  }
}))
console.log("[Server] Serving static files from:", uploadsPath)

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "astranodes-api" })
})

app.use("/api", routes)

app.use(errorHandler)

export default app
