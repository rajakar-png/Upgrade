/**
 * Migration: Add icon column to plans tables
 * This migration adds the icon column to plans_coin and plans_real tables
 * for existing databases that don't have this column yet.
 */

import { query, runSync } from "../src/config/db.js"

async function migrate() {
  console.log("🔄 Starting migration: Add icon column to plans tables")

  try {
    // Check if icon column exists in plans_coin
    const coinColumns = await query("PRAGMA table_info(plans_coin)")
    const coinHasIcon = coinColumns.some((col) => col.name === "icon")

    if (!coinHasIcon) {
      console.log("Adding icon column to plans_coin table...")
      await runSync(
        "ALTER TABLE plans_coin ADD COLUMN icon TEXT DEFAULT 'Package'"
      )
      console.log("✅ Added icon column to plans_coin")
    } else {
      console.log("⏭️  plans_coin already has icon column, skipping")
    }

    // Check if icon column exists in plans_real
    const realColumns = await query("PRAGMA table_info(plans_real)")
    const realHasIcon = realColumns.some((col) => col.name === "icon")

    if (!realHasIcon) {
      console.log("Adding icon column to plans_real table...")
      await runSync(
        "ALTER TABLE plans_real ADD COLUMN icon TEXT DEFAULT 'Server'"
      )
      console.log("✅ Added icon column to plans_real")
    } else {
      console.log("⏭️  plans_real already has icon column, skipping")
    }

    console.log("✅ Migration completed successfully!")
    process.exit(0)
  } catch (error) {
    console.error("❌ Migration failed:", error)
    process.exit(1)
  }
}

migrate()
