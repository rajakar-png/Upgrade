import { Router } from "express"
import { z } from "zod"
import multer from "multer"
import fs from "fs"
import crypto from "crypto"
import { validate } from "../middlewares/validate.js"
import { requireAuth } from "../middlewares/auth.js"
import { getOne, query, runSync } from "../config/db.js"
import { env } from "../config/env.js"
import { sendUtrToDiscord } from "../services/utrService.js"

const router = Router()

if (!fs.existsSync(env.UPLOAD_DIR)) {
  fs.mkdirSync(env.UPLOAD_DIR, { recursive: true })
}

// Strict allowlist — SVG is intentionally excluded (it can carry inline JS)
const ALLOWED_MIMETYPES = new Map([
  ["image/jpeg", ".jpg"],
  ["image/jpg",  ".jpg"],
  ["image/png",  ".png"],
  ["image/webp", ".webp"]
])

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, env.UPLOAD_DIR)
  },
  filename: (req, file, cb) => {
    // Derive extension from MIME type only — never trust originalname
    const ext = ALLOWED_MIMETYPES.get(file.mimetype.toLowerCase()) || ".jpg"
    const name = crypto.randomBytes(16).toString("hex")
    cb(null, `${name}${ext}`)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIMETYPES.has(file.mimetype.toLowerCase())) {
      return cb(new Error("Invalid file type. Only JPEG, PNG, and WebP are allowed."))
    }
    cb(null, true)
  }
})

const submitSchema = z.object({
  body: z.object({
    amount: z.coerce.number().positive(),
    utr_number: z.string().min(4)
  })
})

router.post(
  "/utr",
  requireAuth,
  upload.single("screenshot"),
  validate(submitSchema),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Screenshot required" })
      }

      const submission = {
        user_id: req.user.id,
        amount: req.body.amount,
        utr_number: req.body.utr_number,
        screenshot_path: req.file.path,
        status: "pending"
      }

      const info = await runSync(
        "INSERT INTO utr_submissions (user_id, amount, utr_number, screenshot_path, status) VALUES (?, ?, ?, ?, ?)",
        [
          submission.user_id,
          submission.amount,
          submission.utr_number,
          submission.screenshot_path,
          submission.status
        ]
      )

      const user = await getOne("SELECT email FROM users WHERE id = ?", [req.user.id])

      // Discord notification is best-effort — don't roll back the submission if webhook fails
      try {
        await sendUtrToDiscord({ user, submission })
      } catch (webhookErr) {
        console.warn("[BILLING] Discord webhook failed (submission kept):", webhookErr.message)
      }

      res.status(201).json({ id: info.lastID })
    } catch (error) {
      next(error)
    }
  }
)

router.get("/utr", requireAuth, async (req, res, next) => {
  try {
    const submissions = await query(
      "SELECT id, amount, utr_number, status, created_at FROM utr_submissions WHERE user_id = ? ORDER BY created_at DESC",
      [req.user.id]
    )
    res.json(submissions)
  } catch (error) {
    next(error)
  }
})

export default router
