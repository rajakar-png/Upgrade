import { Router } from "express"
import { query } from "../config/db.js"
import { pterodactyl } from "../services/pterodactyl.js"
import { requireAuth } from "../middlewares/auth.js"

const router = Router()

router.get("/coin", async (req, res, next) => {
  try {
    const category = req.query.category // optional: "minecraft" or "bot"
    const plans = category
      ? await query("SELECT * FROM plans_coin WHERE category = ?", [category])
      : await query("SELECT * FROM plans_coin")
    res.json(plans)
  } catch (error) {
    next(error)
  }
})

router.get("/real", async (req, res, next) => {
  try {
    const category = req.query.category
    const plans = category
      ? await query("SELECT * FROM plans_real WHERE category = ?", [category])
      : await query("SELECT * FROM plans_real")
    res.json(plans)
  } catch (error) {
    next(error)
  }
})

router.get("/eggs", requireAuth, async (req, res, next) => {
  try {
    const category = req.query.category // "minecraft" or "bot"
    const eggs = await pterodactyl.getAvailableEggs()

    console.log(`[PLANS] Eggs fetched: ${eggs.length} total, category filter: ${category || "none"}`)
    if (category) {
      eggs.forEach(e => console.log(`  - [${e.nestName}] ${e.name}: ${(e.description || "").slice(0, 80)}`))
    }

    if (category) {
      // Filter eggs by nest/egg name heuristics
      // Bot keywords: match nest names like "Discord Bots", "Bot", "Python", "Node.js" etc.
      // MC keywords: match nest names like "Minecraft", egg names like "Paper", "Vanilla" etc.
      const botNestKeywords = ["bot", "discord", "python", "nodejs", "node.js", "generic", "voice server"]
      const botEggKeywords = ["discord.js", "discord.py", "py bot", "js bot", "aio", "jda", "red bot", "sinusbot", "ts3", "teamspeak"]
      const mcKeywords = ["minecraft", "paper", "spigot", "forge", "fabric", "vanilla", "bungeecord", "velocity", "purpur", "sponge", "waterfall", "bedrock"]

      let filtered
      if (category === "bot") {
        filtered = eggs.filter((egg) => {
          const nestLower = (egg.nestName || "").toLowerCase()
          const nameLower = (egg.name || "").toLowerCase()
          const descLower = (egg.description || "").toLowerCase()
          // First check: nest name matches bot nests
          const nestMatch = botNestKeywords.some(kw => nestLower.includes(kw))
          // Second check: egg name matches bot eggs
          const eggMatch = botEggKeywords.some(kw => nameLower.includes(kw) || descLower.includes(kw))
          // Exclude: if it's clearly a Minecraft egg, skip it even if nest matches
          const isMC = mcKeywords.some(kw => nameLower.includes(kw) || descLower.includes(kw))
          return (nestMatch || eggMatch) && !isMC
        })
      } else {
        filtered = eggs.filter((egg) => {
          const hay = `${egg.name} ${egg.nestName} ${egg.description}`.toLowerCase()
          return mcKeywords.some((kw) => hay.includes(kw))
        })
      }

      console.log(`[PLANS] Filtered to ${filtered.length} eggs for category: ${category}`)
      return res.json(filtered)
    }
    res.json(eggs)
  } catch (error) {
    next(error)
  }
})

export default router
