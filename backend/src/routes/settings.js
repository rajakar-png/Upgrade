/**
 * Public settings endpoint — returns non-secret config needed by the frontend.
 * GET /api/settings/payment  → UPI ID, UPI name
 */
import { Router } from "express"
import { env } from "../config/env.js"
import { getOne } from "../config/db.js"
import { ok } from "../utils/apiResponse.js"

const router = Router()

router.get("/payment", (req, res) => {
  return ok(res, "Payment settings loaded", {
    upiId: env.UPI_ID && env.UPI_ID.trim() !== "" ? env.UPI_ID : null,
    upiName: env.UPI_NAME && env.UPI_NAME.trim() !== "" ? env.UPI_NAME : null
  })
})

router.get("/site", async (req, res, next) => {
  try {
    const row = await getOne("SELECT * FROM site_settings ORDER BY id ASC LIMIT 1")
    const data = row || {
      site_name: "AstraNodes",
      background_image: "",
      background_overlay_opacity: 0.45,
      favicon_path: "",
      hero_title: "Hosting crafted for Minecraft empires.",
      hero_subtitle: "Launch servers in seconds with premium infrastructure.",
      maintenance_mode: 0
    }

    return ok(res, "Site settings loaded", {
      siteName: data.site_name || "AstraNodes",
      backgroundImage: data.background_image || "",
      backgroundOverlayOpacity:
        typeof data.background_overlay_opacity === "number"
          ? data.background_overlay_opacity
          : Number(data.background_overlay_opacity || 0.45),
      faviconPath: data.favicon_path || "",
      logoPath: data.logo_path || "",
      heroTitle: data.hero_title || "",
      heroSubtitle: data.hero_subtitle || "",
      maintenanceMode: Boolean(data.maintenance_mode)
    })
  } catch (error) {
    next(error)
  }
})

export default router
