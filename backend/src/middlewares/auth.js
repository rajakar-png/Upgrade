import { getOne } from "../config/db.js"
import { verifyToken } from "../utils/jwt.js"

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization
  if (!header) {
    return res.status(401).json({ error: "Missing authorization header" })
  }

  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Invalid authorization format" })
  }

  const token = header.slice(7)

  try {
    const payload = verifyToken(token)
    // Never load password_hash into req.user - select only safe columns
    const user = await getOne(
      "SELECT id, email, role, coins, balance, flagged, pterodactyl_user_id FROM users WHERE id = ?",
      [payload.sub]
    )

    if (!user) {
      return res.status(401).json({ error: "Invalid token" })
    }

    req.user = user
    next()
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" })
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" })
  }
  next()
}
