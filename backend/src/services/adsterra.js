import axios from "axios"
import { env } from "../config/env.js"

const client = axios.create({
  baseURL: "https://api3.adsterratools.com",
  headers: {
    Accept: "application/json",
    "X-API-Key": env.ADSTERRA_API_TOKEN
  },
  timeout: 10000
})

export const adsterra = {
  /**
   * Get all placements for the domain using domain-specific endpoint
   */
  async getPlacements() {
    try {
      console.log("[ADSTERRA] Fetching placements for domain:", env.ADSTERRA_DOMAIN_ID)
      
      // Use domain-specific endpoint for better reliability
      const response = await client.get(`/publisher/domain/${env.ADSTERRA_DOMAIN_ID}/placements.json`)
      
      const placements = response.data.items || []
      
      // Log full data for each placement
      placements.forEach(p => {
        console.log(`[ADSTERRA] Placement ${p.id}:`, {
          title: p.title,
          alias: p.alias,
          width: p.width || "undefined",
          height: p.height || "undefined",
          direct_url: !!p.direct_url,
          key: p.key || null,
          format: p.format || null,
          script: p.script || null,
          allFields: Object.keys(p)
        })
      })
      
      console.log(`[ADSTERRA] ✓ Found ${placements.length} placements`)
      return placements
    } catch (error) {
      console.error("[ADSTERRA] ✗ Failed to fetch placements:", {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      })
      throw new Error("Failed to fetch Adsterra placements")
    }
  },

  /**
   * Get a specific placement by ID
   */
  async getPlacement(placementId) {
    try {
      const placements = await this.getPlacements()
      const placement = placements.find(p => p.id === Number(placementId))
      
      if (!placement) {
        throw new Error(`Placement ${placementId} not found`)
      }
      
      return placement
    } catch (error) {
      console.error("[ADSTERRA] ✗ Failed to get placement:", error.message)
      throw error
    }
  },

  /**
   * Get placements for the coins page
   * Supports both iframe-based (direct_url) and script-based placements
   */
  async getCoinsPagePlacements() {
    try {
      const placements = await this.getPlacements()
      
      const result = {
        nativeBanner: null,
        banner: null
      }
      
      // Find native banner with direct_url or script support
      if (env.ADSTERRA_NATIVE_BANNER_ID) {
        const placement = placements.find(p => p.id === Number(env.ADSTERRA_NATIVE_BANNER_ID))
        if (placement) {
          // Use hardcoded key/script from env if placement doesn't have one
          if (!placement.key && env.ADSTERRA_NATIVE_BANNER_KEY) {
            placement.key = env.ADSTERRA_NATIVE_BANNER_KEY
            console.log(`[ADSTERRA] Using hardcoded key for native banner ${placement.id}`)
          }
          if (!placement.script && env.ADSTERRA_NATIVE_BANNER_SCRIPT) {
            placement.script = env.ADSTERRA_NATIVE_BANNER_SCRIPT
            console.log(`[ADSTERRA] Using hardcoded script for native banner ${placement.id}`)
          }
          if (!placement.containerId && env.ADSTERRA_NATIVE_CONTAINER_ID) {
            placement.containerId = env.ADSTERRA_NATIVE_CONTAINER_ID
            console.log(`[ADSTERRA] Using container ID for native banner ${placement.id}`)
          }
          result.nativeBanner = placement
          const type = placement.direct_url ? "iframe" : "script"
          console.log(`[ADSTERRA] ✓ Native banner: ${placement.id} (${placement.title}) - ${type}`)
        } else {
          console.warn(`[ADSTERRA] Native banner placement ${env.ADSTERRA_NATIVE_BANNER_ID} not found`)
        }
      }
      
      // Find banner with direct_url or script support
      if (env.ADSTERRA_BANNER_ID) {
        const placement = placements.find(p => p.id === Number(env.ADSTERRA_BANNER_ID))
        if (placement) {
          // Use hardcoded key/script from env if placement doesn't have one
          if (!placement.key && env.ADSTERRA_BANNER_KEY) {
            placement.key = env.ADSTERRA_BANNER_KEY
            console.log(`[ADSTERRA] Using hardcoded key for banner ${placement.id}`)
          }
          if (!placement.script && env.ADSTERRA_BANNER_SCRIPT) {
            placement.script = env.ADSTERRA_BANNER_SCRIPT
            console.log(`[ADSTERRA] Using hardcoded script for banner ${placement.id}`)
          }
          result.banner = placement
          const type = placement.direct_url ? "iframe" : "script"
          console.log(`[ADSTERRA] ✓ Banner: ${placement.id} (${placement.title}) - ${type}`)
        } else {
          console.warn(`[ADSTERRA] Banner placement ${env.ADSTERRA_BANNER_ID} not found`)
        }
      }
      
      // If no placements configured, auto-detect
      if (!result.nativeBanner && !result.banner) {
        const native = placements.find(p => p.alias?.includes("Native") || p.title?.includes("Native") || p.alias?.includes("native"))
        const banner = placements.find(p => p.alias?.includes("Banner") || p.title?.includes("Banner") || p.alias?.includes("banner"))
        
        if (native) {
          result.nativeBanner = native
          console.log(`[ADSTERRA] ✓ Auto-detected native banner: ${native.id} (${native.title})`)
        }
        if (banner) {
          result.banner = banner
          console.log(`[ADSTERRA] ✓ Auto-detected banner: ${banner.id} (${banner.title})`)
        }
      }
      
      console.log("[ADSTERRA] Coins page placements ready", {
        nativeBanner: result.nativeBanner?.id || "none",
        banner: result.banner?.id || "none"
      })
      
      return result
    } catch (error) {
      console.error("[ADSTERRA] ✗ Failed to get coins page placements:", error.message)
      throw error
    }
  },

  /**
   * Validate configuration
   */
  async validateConfig() {
    try {
      console.log("[ADSTERRA] Validating configuration...")
      
      if (!env.ADSTERRA_API_TOKEN) {
        throw new Error("ADSTERRA_API_TOKEN not set")
      }
      
      if (!env.ADSTERRA_DOMAIN_ID) {
        throw new Error("ADSTERRA_DOMAIN_ID not set")
      }
      
      // Test API connection
      const placements = await this.getPlacements()
      
      console.log(`[ADSTERRA] ✓ Configuration valid. Found ${placements.length} placements`)
      return placements
    } catch (error) {
      console.error("[ADSTERRA] ✗ Configuration validation failed:", error.message)
      throw error
    }
  }
}
