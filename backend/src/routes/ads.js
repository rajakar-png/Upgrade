import { Router } from "express"
import { adsterra } from "../services/adsterra.js"
import { requireAuth, requireAdmin } from "../middlewares/auth.js"
import { env } from "../config/env.js"

const router = Router()

// If Adsterra is not configured, return empty responses instead of crashing
const adsEnabled = Boolean(env.ADSTERRA_API_TOKEN && env.ADSTERRA_DOMAIN_ID && Number(env.ADSTERRA_DOMAIN_ID) > 0)

/**
 * GET /ads/coins
 * Get ad placements for the coins/AFK page
 * Returns native banner and banner placements
 * Supports both iframe-based (direct_url) and script-based ads
 */
router.get("/coins", async (req, res, next) => {
  if (!adsEnabled) return res.json({ nativeBanner: null, banner: null })
  try {
    const placements = await adsterra.getCoinsPagePlacements()
    
    const response = {
      nativeBanner: placements.nativeBanner ? {
        id: placements.nativeBanner.id,
        title: placements.nativeBanner.title,
        alias: placements.nativeBanner.alias,
        url: placements.nativeBanner.direct_url || null,
        key: placements.nativeBanner.key || null,
        script: placements.nativeBanner.script || null,
        containerId: placements.nativeBanner.containerId || null,
        format: placements.nativeBanner.format || null,
        width: placements.nativeBanner.width || 468,
        height: placements.nativeBanner.height || 60,
        type: placements.nativeBanner.direct_url ? "iframe" : "script"
      } : null,
      banner: placements.banner ? {
        id: placements.banner.id,
        title: placements.banner.title,
        alias: placements.banner.alias,
        url: placements.banner.direct_url || null,
        key: placements.banner.key || null,
        script: placements.banner.script || null,
        containerId: placements.banner.containerId || null,
        format: placements.banner.format || null,
        width: placements.banner.width || 336,
        height: placements.banner.height || 280,
        type: placements.banner.direct_url ? "iframe" : "script"
      } : null
    }
    
    console.log("[ADS] Returning coins ads:", {
      nativeBanner: response.nativeBanner ? `${response.nativeBanner.id} (${response.nativeBanner.title})` : null,
      banner: response.banner ? `${response.banner.id} (${response.banner.title})` : null
    })
    
    res.json(response)
  } catch (error) {
    console.error("[ADS] Failed to get coins ads:", error.message)
    res.status(500).json({ error: "Failed to load ads" })
  }
})

/**
 * GET /ads/test
 * Test Adsterra configuration
 * Admin only (for debugging)
 */
router.get("/test", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const placements = await adsterra.validateConfig()
    
    console.log("[ADS] Full placement data:", JSON.stringify(placements, null, 2))
    
    res.json({
      success: true,
      message: "Adsterra configuration is valid",
      totalPlacements: placements.length,
      placements: placements.map(p => ({
        id: p.id,
        title: p.title,
        alias: p.alias,
        key: p.key || null,
        format: p.format || null,
        width: p.width,
        height: p.height,
        direct_url: p.direct_url ? true : false,
        script: p.script || null,
        type: p.direct_url ? "iframe" : "script",
        allFields: Object.keys(p)
      }))
    })
  } catch (error) {
    console.error("[ADS] Configuration test failed:", error.message)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})


export default router
