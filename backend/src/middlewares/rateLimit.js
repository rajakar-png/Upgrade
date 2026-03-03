import rateLimit from "express-rate-limit"
import { env } from "../config/env.js"

export const rateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for preflight OPTIONS requests and health checks
  skip: (req) => req.method === "OPTIONS" || req.path === "/health"
})

// Strict rate limiter for auth endpoints (login, register)
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many authentication attempts. Please try again in 15 minutes." }
})

// Coin claim limiter: max 3 attempts per 70s per user (DB enforces 60s cooldown;
// this catches rapid retry spam and Postman abuse before DB queries run).
// keyGenerator uses req.user.id (set by requireAuth which runs before this).
export const coinsClaimLimiter = rateLimit({
  windowMs: 70 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `coins_claim_${req.user?.id ?? req.ip}`,
  message: { error: "Too many claim attempts. Wait before trying again." }
})

// Coin session limiter: max 10 session tokens per 70s per user.
// Higher than claim limit because the frontend pre-fetches tokens.
export const coinsSessionLimiter = rateLimit({
  windowMs: 70 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `coins_session_${req.user?.id ?? req.ip}`,
  message: { error: "Too many session requests. Slow down." }
})

// Purchase/renew limiter: max 5 per 60s per user.
// Prevents rapid-fire requests that could exploit race conditions.
export const purchaseLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `purchase_${req.user?.id ?? req.ip}`,
  message: { error: "Too many purchase requests. Please slow down." }
})
