import { Router } from "express"
import { z } from "zod"
import { getOne, runSync } from "../config/db.js"
import { requireAuth, requireAdmin } from "../middlewares/auth.js"
import { validate } from "../middlewares/validate.js"
import { ok, fail } from "../utils/apiResponse.js"
import { uploadSiteAsset, siteAssetUploadErrorHandler } from "../middleware/uploadSiteAssets.js"

const router = Router()
router.use(requireAuth, requireAdmin)

const settingsSchema = z.object({
  body: z.object({
    siteName: z.string().min(2).max(100).optional(),
    heroTitle: z.string().max(180).optional(),
    heroSubtitle: z.string().max(600).optional(),
    backgroundOverlayOpacity: z.number().min(0).max(1).optional(),
    maintenanceMode: z.boolean().optional()
  })
})

// Track whether the migration has already run in this process
let _migrationDone = false

async function ensureSettingsRow() {
  // Add logo_path column if not present (once per process lifetime)
  if (!_migrationDone) {
    try {
      await runSync("ALTER TABLE site_settings ADD COLUMN logo_path TEXT DEFAULT ''")
    } catch { /* column already exists */ }
    _migrationDone = true
  }

  const existing = await getOne("SELECT id FROM site_settings ORDER BY id ASC LIMIT 1")
  if (existing) return existing.id

  // Use INSERT OR IGNORE to prevent race condition with concurrent requests
  const created = await runSync(
    `INSERT OR IGNORE INTO site_settings (
      site_name,
      background_image,
      background_overlay_opacity,
      favicon_path,
      logo_path,
      hero_title,
      hero_subtitle,
      maintenance_mode
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)` ,
    [
      "AstraNodes",
      "",
      0.45,
      "",
      "",
      "Hosting crafted for Minecraft empires.",
      "Launch servers in seconds with premium infrastructure.",
      0
    ]
  )

  return created.lastID
}

router.put("/", validate(settingsSchema), async (req, res, next) => {
  try {
    const id = await ensureSettingsRow()
    const {
      siteName,
      heroTitle,
      heroSubtitle,
      backgroundOverlayOpacity,
      maintenanceMode
    } = req.body

    const current = await getOne("SELECT * FROM site_settings WHERE id = ?", [id])

    await runSync(
      `UPDATE site_settings
       SET site_name = ?,
           hero_title = ?,
           hero_subtitle = ?,
           background_overlay_opacity = ?,
           maintenance_mode = ?
       WHERE id = ?`,
      [
        siteName ?? current.site_name,
        heroTitle ?? current.hero_title,
        heroSubtitle ?? current.hero_subtitle,
        backgroundOverlayOpacity ?? current.background_overlay_opacity,
        maintenanceMode === undefined ? current.maintenance_mode : maintenanceMode ? 1 : 0,
        id
      ]
    )

    return ok(res, "Site settings updated")
  } catch (error) {
    next(error)
  }
})

router.post(
  "/background-image",
  (req, res, next) => {
    req.uploadKind = "background"
    next()
  },
  uploadSiteAsset.single("background"),
  siteAssetUploadErrorHandler,
  async (req, res, next) => {
    try {
      if (!req.file) return fail(res, "Background image file is required", 400)

      const id = await ensureSettingsRow()
      const path = `/uploads/${req.file.filename}`
      await runSync("UPDATE site_settings SET background_image = ? WHERE id = ?", [path, id])

      return ok(res, "Background image updated", { backgroundImage: path })
    } catch (error) {
      next(error)
    }
  }
)

router.post(
  "/favicon",
  (req, res, next) => {
    req.uploadKind = "favicon"
    next()
  },
  uploadSiteAsset.single("favicon"),
  siteAssetUploadErrorHandler,
  async (req, res, next) => {
    try {
      if (!req.file) return fail(res, "Favicon file is required", 400)

      const ext = req.file.filename.split(".").pop()?.toLowerCase()
      if (!["ico", "png", "svg"].includes(ext || "")) {
        return fail(res, "Favicon must be .ico, .png, or .svg", 400)
      }

      const id = await ensureSettingsRow()
      const path = `/uploads/${req.file.filename}`
      await runSync("UPDATE site_settings SET favicon_path = ? WHERE id = ?", [path, id])

      return ok(res, "Favicon updated", { faviconPath: path, version: Date.now() })
    } catch (error) {
      next(error)
    }
  }
)

router.post(
  "/logo",
  (req, res, next) => {
    req.uploadKind = "logo"
    next()
  },
  uploadSiteAsset.single("logo"),
  siteAssetUploadErrorHandler,
  async (req, res, next) => {
    try {
      if (!req.file) return fail(res, "Logo file is required", 400)

      const id = await ensureSettingsRow()
      const path = `/uploads/${req.file.filename}`
      await runSync("UPDATE site_settings SET logo_path = ? WHERE id = ?", [path, id])

      return ok(res, "Logo updated", { logoPath: path, version: Date.now() })
    } catch (error) {
      next(error)
    }
  }
)

export default router
