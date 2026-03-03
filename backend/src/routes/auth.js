import { Router } from "express"
import { z } from "zod"
import { signToken } from "../utils/jwt.js"
import { requireAuth } from "../middlewares/auth.js"
import { fail } from "../utils/apiResponse.js"
import passport from "../config/passport.js"
import { env } from "../config/env.js"
import { hashPassword, verifyPassword } from "../utils/password.js"
import { getOne, runSync } from "../config/db.js"
import { validate } from "../middlewares/validate.js"

const router = Router()

// ============================================================================
// NOTE: Email/password authentication has been disabled. 
// Only OAuth (Google & Discord) authentication is allowed.
// The routes below are commented out but kept for reference.
// ============================================================================

/*
// Legacy email/password authentication code (DISABLED)
import { randomBytes } from "crypto"
import { authRateLimiter } from "../middlewares/rateLimit.js"
import { pterodactyl } from "../services/pterodactyl.js"
import { generateVerificationToken, getTokenExpiration, sendVerificationEmail } from "../utils/emailVerification.js"

// Allowed email domains for registration
const ALLOWED_EMAIL_DOMAINS = [
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'yahoo.com',
  'yahoo.co.uk',
  'yahoo.co.in',
  'icloud.com',
  'me.com'
];

const authSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8)
  })
})

// Email domain validator
function validateEmailDomain(email) {
  const domain = email.toLowerCase().split('@')[1];
  if (!domain) {
    return { valid: false, error: 'Invalid email format' };
  }
  
  if (!ALLOWED_EMAIL_DOMAINS.includes(domain)) {
    return { 
      valid: false, 
      error: `Only emails from trusted providers are allowed (${ALLOWED_EMAIL_DOMAINS.slice(0, 4).join(', ')}, etc.)` 
    };
  }
  
  return { valid: true };
}
*/

/*
// ============================================================================
// DISABLED: Email/Password Registration Endpoint
// ============================================================================

router.post("/register", authRateLimiter, validate(authSchema), async (req, res, next) => {
  try {
    const email = req.body.email.toLowerCase()
    const password = req.body.password

    // Validate email domain
    const domainValidation = validateEmailDomain(email);
    if (!domainValidation.valid) {
      return res.status(400).json({ error: domainValidation.error });
    }

    const exists = await getOne("SELECT id FROM users WHERE email = ?", [email])
    if (exists) {
      return res.status(409).json({ error: "Email already registered" })
    }

    // Sanitize username: strip non-alphanumeric chars, truncate, ensure non-empty
    const username = email.split("@")[0].replace(/[^a-zA-Z0-9-]/g, "").slice(0, 20) || `user${Date.now()}`
    // Generate a random password for Pterodactyl — never send the user's real
    // password to a third-party panel. If the panel is compromised, user
    // credentials remain safe.
    const pteroPassword = randomBytes(24).toString("base64url")
    let pteroId
    try {
      pteroId = await pterodactyl.createUser({
        email,
        username,
        firstName: username,
        lastName: "User",
        password: pteroPassword
      })
    } catch (pteroErr) {
      console.error("[AUTH] Pterodactyl user creation failed:", pteroErr.message)
      return res.status(502).json({ error: "Account provisioning failed. Please try again later." })
    }

    const hash = await hashPassword(password)
    const ip = req.ip

    // Generate email verification token
    const verificationToken = generateVerificationToken()
    const tokenExpires = getTokenExpiration()

    let info
    try {
      info = await runSync(
        "INSERT INTO users (email, password_hash, ip_address, last_login_ip, pterodactyl_user_id, verification_token, verification_token_expires) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [email, hash, ip, ip, pteroId, verificationToken, tokenExpires]
      )
    } catch (dbErr) {
      // Rollback: delete orphaned Pterodactyl user if DB insert fails
      try {
        await pterodactyl.deleteUser(pteroId)
      } catch (e) {
        // best-effort cleanup
      }
      throw dbErr
    }

    // Send verification email
    await sendVerificationEmail(email, verificationToken, username)

    res.status(201).json({ 
      message: "Registration successful! Please check your email to verify your account.",
      email: email,
      requiresVerification: true
    })
  } catch (error) {
    next(error)
  }
})
*/

/*
// ============================================================================
// DISABLED: Email/Password Login Endpoint
// ============================================================================

router.post("/login", authRateLimiter, validate(authSchema), async (req, res, next) => {
  try {
    const email = req.body.email.toLowerCase()
    const password = req.body.password

    const user = await getOne(
      "SELECT id, email, password_hash, role, coins, balance, flagged, pterodactyl_user_id, email_verified FROM users WHERE email = ?",
      [email]
    )
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" })
    }

    const ok = await verifyPassword(password, user.password_hash)
    if (!ok) {
      return res.status(401).json({ error: "Invalid credentials" })
    }

    // Check if email is verified
    if (!user.email_verified && !user.oauth_provider) {
      return res.status(403).json({ 
        error: "Please verify your email before logging in. Check your inbox for the verification link.",
        requiresVerification: true,
        email: email
      })
    }

    await runSync("UPDATE users SET last_login_ip = ? WHERE id = ?", [req.ip, user.id])

    const token = signToken(user)
    res.json({ token, user: { id: user.id, email: user.email, role: user.role } })
  } catch (error) {
    next(error)
  }
})
*/

// ============================================================================
// Password Reset (for users who set passwords manually)
// ============================================================================
const resetPasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(8),
    newPassword: z.string().min(8)
  })
})

router.post("/reset-password", requireAuth, validate(resetPasswordSchema), async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body
    if (currentPassword === newPassword) {
      return fail(res, "New password must be different from current password", 400)
    }

    const user = await getOne("SELECT id, password_hash, oauth_provider FROM users WHERE id = ?", [req.user.id])
    if (!user) return fail(res, "User not found", 404)

    // OAuth-only users have no password
    if (user.oauth_provider || !user.password_hash) {
      return fail(res, "Password reset is not available for OAuth accounts", 400)
    }

    const validCurrent = await verifyPassword(currentPassword, user.password_hash)
    if (!validCurrent) return fail(res, "Current password is incorrect", 401)

    const newHash = await hashPassword(newPassword)
    await runSync("UPDATE users SET password_hash = ? WHERE id = ?", [newHash, req.user.id])

    return res.json({ message: "Password reset successfully" })
  } catch (error) {
    next(error)
  }
})

/*
// ============================================================================
// DISABLED: Email Verification Endpoints
// ============================================================================

// Email Verification
router.get("/verify-email", async (req, res, next) => {
  try {
    const { token } = req.query

    if (!token) {
      return res.status(400).json({ error: "Verification token is required" })
    }

    const user = await getOne(
      "SELECT id, email, email_verified, verification_token, verification_token_expires FROM users WHERE verification_token = ?",
      [token]
    )

    if (!user) {
      return res.status(404).json({ error: "Invalid verification token" })
    }

    if (user.email_verified) {
      return res.status(400).json({ error: "Email already verified" })
    }

    // Check if token is expired
    if (new Date(user.verification_token_expires) < new Date()) {
      return res.status(400).json({ 
        error: "Verification token has expired. Please request a new one.",
        expired: true 
      })
    }

    // Verify the email
    await runSync(
      "UPDATE users SET email_verified = 1, verification_token = NULL, verification_token_expires = NULL WHERE id = ?",
      [user.id]
    )

    res.json({ 
      message: "Email verified successfully! You can now log in.",
      verified: true 
    })
  } catch (error) {
    next(error)
  }
})

// Resend Verification Email
router.post("/resend-verification", authRateLimiter, async (req, res, next) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({ error: "Email is required" })
    }

    const user = await getOne(
      "SELECT id, email, email_verified, verification_token FROM users WHERE email = ?",
      [email.toLowerCase()]
    )

    if (!user) {
      // Don't reveal if email exists for security
      return res.json({ message: "If the email exists, a verification link has been sent." })
    }

    if (user.email_verified) {
      return res.status(400).json({ error: "Email is already verified" })
    }

    // Generate new token
    const verificationToken = generateVerificationToken()
    const tokenExpires = getTokenExpiration()

    await runSync(
      "UPDATE users SET verification_token = ?, verification_token_expires = ? WHERE id = ?",
      [verificationToken, tokenExpires, user.id]
    )

    // Send verification email
    const username = user.email.split('@')[0]
    await sendVerificationEmail(user.email, verificationToken, username)

    res.json({ message: "Verification email sent. Please check your inbox." })
  } catch (error) {
    next(error)
  }
})
*/

// ============================================================================
// GET /me — return the authenticated user's profile
// ============================================================================
router.get("/me", requireAuth, async (req, res) => {
  return res.json({
    id: req.user.id,
    email: req.user.email,
    role: req.user.role,
    coins: req.user.coins,
    balance: req.user.balance
  })
})

// ============================================================================
// OAuth Routes (Google & Discord) - ACTIVE
// ============================================================================

// OAuth Routes
if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
  router.get('/google', passport.authenticate('google', { 
    scope: ['profile', 'email']
  }));

  router.get('/google/callback', 
    passport.authenticate('google', { failureRedirect: `${env.FRONTEND_URL}/login?error=oauth_failed` }),
    (req, res) => {
      const token = signToken(req.user);
      // Store token briefly in session and redirect — avoids leaking JWT in URL
      req.session.oauthToken = token;
      res.redirect(`${env.FRONTEND_URL}/auth/callback?code=session`);
    }
  );
}

if (env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET) {
  router.get('/discord', passport.authenticate('discord'));

  router.get('/discord/callback',
    passport.authenticate('discord', { failureRedirect: `${env.FRONTEND_URL}/login?error=oauth_failed` }),
    (req, res) => {
      const token = signToken(req.user);
      req.session.oauthToken = token;
      res.redirect(`${env.FRONTEND_URL}/auth/callback?code=session`);
    }
  );
}

// Exchange session-stored token for JWT (avoids token in URL/Referer header)
// POST prevents CSRF and caching risks inherent to GET endpoints that return tokens
router.post('/exchange-token', (req, res) => {
  const token = req.session?.oauthToken;
  if (!token) {
    return res.status(401).json({ error: 'No pending authentication' });
  }
  // Clear the session token after single use
  delete req.session.oauthToken;
  req.session.save();
  res.json({ token });
});

export default router
