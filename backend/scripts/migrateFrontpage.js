/**
 * Migration: Add site_content and landing_plans tables
 * Run: npm run migrate-frontpage
 */
import { runSync, getOne } from "../src/config/db.js"

const defaultSections = [
  {
    section_name: "hero",
    content_json: JSON.stringify({
      title: "Hosting crafted for Minecraft empires.",
      subtitle: "Launch servers in seconds, keep renewals automatic, and protect revenue with enterprise-grade abuse prevention. Built on Pterodactyl with a modern finance engine.",
      primaryButtonText: "Launch Dashboard",
      primaryButtonLink: "/register",
      secondaryButtonText: "View Plans",
      secondaryButtonLink: "/plans",
      backgroundImage: ""
    })
  },
  {
    section_name: "features",
    content_json: JSON.stringify([
      { title: "Automated Renewal", description: "Coins or balance renewals execute automatically with 12h grace protection.", icon: "Zap" },
      { title: "Anti-Abuse Core", description: "IP-based coupon protection, flagging, and rate-limited endpoints.", icon: "ShieldCheck" },
      { title: "Coin Economy", description: "AFK earning, coin plans, and live usage insights in one dashboard.", icon: "Coins" },
      { title: "Pterodactyl Ready", description: "Server lifecycle actions handled securely via Admin API.", icon: "Server" }
    ])
  },
  {
    section_name: "about",
    content_json: JSON.stringify({
      heading: "Ready for production-grade hosting?",
      description: "Spin up a secure dashboard and keep every server in compliance."
    })
  },
  {
    section_name: "stats",
    content_json: JSON.stringify({
      activeServers: "500+",
      totalUsers: "1,200+",
      uptime: "99.9%"
    })
  },
  {
    section_name: "footer",
    content_json: JSON.stringify({
      text: "© 2026 AstraNodes. All rights reserved.",
      links: ["Privacy", "Terms", "Status"]
    })
  }
]

async function migrate() {
  console.log("[Migrate Frontpage] Creating tables...")

  await runSync(`
    CREATE TABLE IF NOT EXISTS site_content (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      section_name TEXT NOT NULL UNIQUE,
      content_json TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  await runSync(`
    CREATE TABLE IF NOT EXISTS landing_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0,
      ram INTEGER NOT NULL DEFAULT 1,
      cpu INTEGER NOT NULL DEFAULT 1,
      storage INTEGER NOT NULL DEFAULT 10,
      features TEXT NOT NULL DEFAULT '[]',
      popular INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  await runSync(`CREATE INDEX IF NOT EXISTS idx_landing_plans_active ON landing_plans(active)`)

  console.log("[Migrate Frontpage] Seeding default site_content...")
  for (const section of defaultSections) {
    const existing = await getOne("SELECT id FROM site_content WHERE section_name = ?", [section.section_name])
    if (!existing) {
      await runSync(
        "INSERT INTO site_content (section_name, content_json) VALUES (?, ?)",
        [section.section_name, section.content_json]
      )
      console.log(`[Migrate Frontpage] ✓ Seeded: ${section.section_name}`)
    } else {
      console.log(`[Migrate Frontpage] Skipped (exists): ${section.section_name}`)
    }
  }

  console.log("[Migrate Frontpage] ✓ Done.")
  process.exit(0)
}

migrate().catch((err) => {
  console.error("[Migrate Frontpage] ✗", err)
  process.exit(1)
})
