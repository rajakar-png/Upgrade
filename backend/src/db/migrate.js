import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { getOne, runSync } from "../config/db.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const sqlPath = path.join(__dirname, "init.sql")

const DEFAULT_SITE_CONTENT = [
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

export default async function migrate() {
  try {
    console.log("[Migration] Reading init.sql from:", sqlPath)
    const sql = fs.readFileSync(sqlPath, "utf-8")
    console.log("[Migration] Executing SQL statements...")

    // Execute all SQL statements
    const statements = sql.split(";")
    let executedCount = 0
    
    for (const stmt of statements) {
      if (stmt.trim()) {
        try {
          await runSync(stmt)
          executedCount++
        } catch (error) {
          console.warn("[Migration] Statement error (may be expected):", error.message)
        }
      }
    }
    
    console.log(`[Migration] Executed ${executedCount} SQL statements`)

    // Ensure coin_settings exists
    console.log("[Migration] Checking coin_settings...")
    const existing = await getOne("SELECT id FROM coin_settings WHERE id = 1 LIMIT 1").catch(
      () => null
    )

    if (!existing) {
      console.log("[Migration] Creating default coin_settings...")
      await runSync("INSERT INTO coin_settings (id, coins_per_minute) VALUES (1, 1)", [])
    } else {
      console.log("[Migration] coin_settings already exists")
    }

    // Add name column to servers if not present (fresh installs have it via init.sql)
    try {
      await runSync("ALTER TABLE servers ADD COLUMN name TEXT NOT NULL DEFAULT ''")
      console.log("[Migration] ✓ Added name column to servers")
    } catch {
      // Column already exists — safe to ignore
    }

    // Add location column to servers if not present
    try {
      await runSync("ALTER TABLE servers ADD COLUMN location TEXT DEFAULT ''")
      console.log("[Migration] ✓ Added location column to servers")
    } catch {
      // Column already exists — safe to ignore
    }

    // Add software column to servers if not present
    try {
      await runSync("ALTER TABLE servers ADD COLUMN software TEXT NOT NULL DEFAULT 'minecraft'")
      console.log("[Migration] ✓ Added software column to servers")
    } catch {
      // Column already exists — safe to ignore
    }

    // Add egg_id column to servers if not present
    try {
      await runSync("ALTER TABLE servers ADD COLUMN egg_id INTEGER")
      console.log("[Migration] ✓ Added egg_id column to servers")
    } catch {
      // Column already exists — safe to ignore
    }

    // ── Remove CHECK constraint from 'software' column ────────────────
    // The old software-selection.sql added:
    //   CHECK (software IN ('papermc', 'fabric', 'forge'))
    // Since software is now egg-based (dynamic), the constraint must go.
    // SQLite doesn't support ALTER COLUMN, so we recreate the table.
    try {
      const hasCheck = await getOne(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='servers'"
      )
      if (hasCheck?.sql && /CHECK\s*\(\s*software\s+IN\s*\(/i.test(hasCheck.sql)) {
        console.log("[Migration] Removing CHECK constraint on servers.software...")
        await runSync("PRAGMA foreign_keys = OFF")
        await runSync(`CREATE TABLE servers_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          name TEXT NOT NULL DEFAULT '',
          plan_type TEXT NOT NULL CHECK (plan_type IN ('coin', 'real')),
          plan_id INTEGER NOT NULL,
          pterodactyl_server_id INTEGER,
          identifier TEXT,
          expires_at TEXT NOT NULL,
          suspended_at TEXT,
          grace_expires_at TEXT,
          status TEXT NOT NULL CHECK (status IN ('active', 'suspended', 'deleted')),
          location TEXT NOT NULL DEFAULT '',
          software TEXT NOT NULL DEFAULT 'minecraft',
          egg_id INTEGER,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (user_id) REFERENCES users(id)
        )`)
        await runSync("INSERT INTO servers_new SELECT id, user_id, name, plan_type, plan_id, pterodactyl_server_id, identifier, expires_at, suspended_at, grace_expires_at, status, location, software, egg_id, created_at FROM servers")
        await runSync("DROP TABLE servers")
        await runSync("ALTER TABLE servers_new RENAME TO servers")
        await runSync("PRAGMA foreign_keys = ON")
        console.log("[Migration] ✓ Removed CHECK constraint on servers.software")
      }
    } catch (err) {
      console.warn("[Migration] Could not remove software CHECK constraint:", err.message)
      // Try to restore foreign keys even on error
      await runSync("PRAGMA foreign_keys = ON").catch(() => {})
    }

    // Add identifier column to servers (Pterodactyl 8-char short identifier)
    try {
      await runSync("ALTER TABLE servers ADD COLUMN identifier TEXT")
      console.log("[Migration] ✓ Added identifier column to servers")
    } catch {
      // Column already exists — safe to ignore
    }

    // Ensure server_backups table exists (added in upgrade)
    await runSync(`
      CREATE TABLE IF NOT EXISTS server_backups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        server_id INTEGER NOT NULL,
        pterodactyl_backup_uuid TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL DEFAULT 'backup',
        is_automatic INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (server_id) REFERENCES servers(id)
      )
    `).catch(() => {})
    await runSync("CREATE INDEX IF NOT EXISTS idx_server_backups_server ON server_backups(server_id)").catch(() => {})

    // Ensure 'name' column exists in server_backups (older schemas may be missing it)
    try {
      await runSync("ALTER TABLE server_backups ADD COLUMN name TEXT NOT NULL DEFAULT 'backup'")
      console.log("[Migration] ✓ Added name column to server_backups")
    } catch {
      // Column already exists — safe to ignore
    }

    console.log("[Migration] ✓ server_backups table ensured")

    // ── Coin plan dual pricing: initial_price (first purchase) + renewal_price ──
    try {
      await runSync("ALTER TABLE plans_coin ADD COLUMN initial_price INTEGER NOT NULL DEFAULT 0")
      console.log("[Migration] ✓ Added initial_price column to plans_coin")
    } catch {
      // Column already exists
    }
    try {
      await runSync("ALTER TABLE plans_coin ADD COLUMN renewal_price INTEGER NOT NULL DEFAULT 0")
      console.log("[Migration] ✓ Added renewal_price column to plans_coin")
    } catch {
      // Column already exists
    }
    // Back-fill: set renewal_price = coin_price for existing rows where renewal_price is 0
    try {
      await runSync("UPDATE plans_coin SET renewal_price = coin_price WHERE renewal_price = 0 AND coin_price > 0")
      await runSync("UPDATE plans_coin SET initial_price = coin_price WHERE initial_price = 0 AND coin_price > 0")
      console.log("[Migration] ✓ Back-filled initial_price & renewal_price from coin_price")
    } catch (e) {
      console.warn("[Migration] Back-fill warn:", e.message)
    }

    // Seed default site_content sections
    console.log("[Migration] Seeding default site_content...")
    for (const section of DEFAULT_SITE_CONTENT) {
      const exists = await getOne("SELECT id FROM site_content WHERE section_name = ?", [section.section_name]).catch(() => null)
      if (!exists) {
        await runSync(
          "INSERT INTO site_content (section_name, content_json) VALUES (?, ?)",
          [section.section_name, section.content_json]
        ).catch((e) => console.warn("[Migration] site_content seed warn:", e.message))
        console.log(`[Migration] ✓ Seeded site_content: ${section.section_name}`)
      }
    }

    // Seed default site_settings singleton row
    console.log("[Migration] Seeding default site_settings...")
    const existingSettings = await getOne("SELECT id FROM site_settings ORDER BY id ASC LIMIT 1").catch(() => null)
    if (!existingSettings) {
      await runSync(
        `INSERT INTO site_settings (
          site_name,
          background_image,
          background_overlay_opacity,
          favicon_path,
          logo_path,
          hero_title,
          hero_subtitle,
          maintenance_mode
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
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
      ).catch((e) => console.warn("[Migration] site_settings seed warn:", e.message))
      console.log("[Migration] ✓ Seeded site_settings")
    }

    // Add logo_path column to site_settings if not present
    try {
      await runSync("ALTER TABLE site_settings ADD COLUMN logo_path TEXT DEFAULT ''")
      console.log("[Migration] ✓ Added logo_path column to site_settings")
    } catch {
      // Column already exists — safe to ignore
    }

    // ── Tickets tables auto-creation ──────────────────────────────────────
    console.log("[Migration] Ensuring tickets tables...")
    const ticketsSqlPath = path.join(__dirname, "tickets.sql")
    if (fs.existsSync(ticketsSqlPath)) {
      const ticketsSql = fs.readFileSync(ticketsSqlPath, "utf-8")
      for (const stmt of ticketsSql.split(";")) {
        if (stmt.trim()) {
          await runSync(stmt).catch((e) => {
            // Ignore errors from CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS
            if (!e.message.includes("already exists")) {
              console.warn("[Migration] tickets.sql stmt warn:", e.message)
            }
          })
        }
      }
      console.log("[Migration] ✓ Tickets tables ensured")
    } else {
      console.warn("[Migration] tickets.sql not found, skipping")
    }

    // ── Tickets upgrade columns (priority, username, email, image) ───────
    try {
      await runSync("ALTER TABLE tickets ADD COLUMN priority TEXT DEFAULT 'Medium' CHECK(priority IN ('Low', 'Medium', 'High'))")
      console.log("[Migration] ✓ Added priority column to tickets")
    } catch { /* already exists */ }
    try {
      await runSync("ALTER TABLE tickets ADD COLUMN username TEXT")
      console.log("[Migration] ✓ Added username column to tickets")
    } catch { /* already exists */ }
    try {
      await runSync("ALTER TABLE tickets ADD COLUMN email TEXT")
      console.log("[Migration] ✓ Added email column to tickets")
    } catch { /* already exists */ }
    try {
      await runSync("ALTER TABLE ticket_messages ADD COLUMN image TEXT")
      console.log("[Migration] ✓ Added image column to ticket_messages")
    } catch { /* already exists */ }
    // Backfill missing username/email from users table
    try {
      await runSync(
        `UPDATE tickets SET username = (SELECT email FROM users WHERE users.id = tickets.user_id), email = (SELECT email FROM users WHERE users.id = tickets.user_id) WHERE username IS NULL`
      )
    } catch (e) {
      console.warn("[Migration] tickets backfill warn:", e.message)
    }
    await runSync("CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority)").catch(() => {})

    // ── Bot hosting category columns ────────────────────────────────────
    try {
      await runSync("ALTER TABLE plans_coin ADD COLUMN category TEXT NOT NULL DEFAULT 'minecraft'")
      console.log("[Migration] ✓ Added category column to plans_coin")
    } catch { /* already exists */ }
    try {
      await runSync("ALTER TABLE plans_real ADD COLUMN category TEXT NOT NULL DEFAULT 'minecraft'")
      console.log("[Migration] ✓ Added category column to plans_real")
    } catch { /* already exists */ }
    try {
      await runSync("ALTER TABLE servers ADD COLUMN category TEXT NOT NULL DEFAULT 'minecraft'")
      console.log("[Migration] ✓ Added category column to servers")
    } catch { /* already exists */ }

    // ── Swap column for virtual memory ───────────────────────────────────
    try {
      await runSync("ALTER TABLE plans_coin ADD COLUMN swap INTEGER NOT NULL DEFAULT 0")
      console.log("[Migration] ✓ Added swap column to plans_coin")
    } catch { /* already exists */ }
    try {
      await runSync("ALTER TABLE plans_real ADD COLUMN swap INTEGER NOT NULL DEFAULT 0")
      console.log("[Migration] ✓ Added swap column to plans_real")
    } catch { /* already exists */ }

    console.log("[Migration] ✓ Database migrated successfully")
  } catch (error) {
    console.error("[Migration] ✗ Critical error:", error)
    throw error
  }
}

// Self-invoke only when run directly (not when imported by server.js)
// __filename is already a resolved path (set above), so compare directly
if (process.argv[1] === __filename) {
  migrate().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
