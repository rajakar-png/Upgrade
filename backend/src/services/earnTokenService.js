/**
 * Earn Token Service
 *
 * Issues short-lived, one-time-use tokens that prove the user viewed ads
 * for at least MIN_VIEW_MS before claiming coins.
 *
 * Flow:
 *   1. Frontend calls POST /api/coins/session → gets earnToken
 *   2. Token becomes valid only after MIN_VIEW_MS (4 seconds)
 *   3. Frontend waits 5 seconds, then lets user click Claim
 *   4. POST /api/coins/claim { earnToken } → consumeEarnToken validates it
 *   5. Token is deleted after first use (one-time use)
 *
 * This forces even Postman/bot users to wait the minimum view delay
 * because the validAfter timestamp is set server-side at issue time.
 */

import { randomBytes } from "crypto"

// In-memory store: token → { userId, validAfter, expiresAt }
// Fine for single-process Node.js (SQLite-backed app). Tokens are short-lived.
const tokens = new Map()

const MIN_VIEW_MS  = 4_000   // 4 seconds minimum server-side ad view time
const TOKEN_TTL_MS = 90_000  // token expires 90s after issue — covers full 60s cooldown + buffer

// Purge stale tokens every 60 seconds to prevent memory growth
setInterval(() => {
  const now = Date.now()
  for (const [token, data] of tokens) {
    if (data.expiresAt < now) tokens.delete(token)
  }
}, 60_000)

/**
 * Generate a new earn token for a user.
 * @param {number} userId
 * @returns {string} hex token
 */
export function generateEarnToken(userId) {
  const token = randomBytes(32).toString("hex")
  const now = Date.now()
  tokens.set(token, {
    userId,
    validAfter: now + MIN_VIEW_MS,
    expiresAt:  now + TOKEN_TTL_MS
  })
  return token
}

/**
 * Validate and consume an earn token.
 * Tokens are deleted after first use — no replays.
 *
 * @param {string} token
 * @param {number} userId
 * @returns {{ valid: boolean, reason?: string }}
 */
export function consumeEarnToken(token, userId) {
  if (!token || typeof token !== "string") {
    return { valid: false, reason: "No earn token provided" }
  }

  const data = tokens.get(token)
  if (!data) {
    return { valid: false, reason: "Token not found or already used" }
  }

  if (data.userId !== userId) {
    return { valid: false, reason: "Token user mismatch" }
  }

  const now = Date.now()

  if (now < data.validAfter) {
    const waitMs = data.validAfter - now
    return { valid: false, reason: `Token not yet valid — wait ${Math.ceil(waitMs / 1000)}s more` }
  }

  if (now > data.expiresAt) {
    tokens.delete(token)
    return { valid: false, reason: "Token expired — please reload and try again" }
  }

  // One-time use: delete immediately on consumption
  tokens.delete(token)
  return { valid: true }
}

/** For monitoring: how many tokens are currently in-flight */
export function activeTokenCount() {
  return tokens.size
}
