/**
 * Migration: Update duration_type constraints to support "days" and "lifetime"
 * This migration recreates the plans tables to allow new duration types.
 * 
 * SQLite doesn't support ALTER COLUMN or DROP CONSTRAINT, so we need to:
 * 1. Create temporary tables with new schema
 * 2. Copy data from old tables
 * 3. Drop old tables
 * 4. Rename temporary tables
 */

import { query, runSync } from "../src/config/db.js"

async function migrate() {
  console.log("🔄 Starting migration: Update duration_type constraints")

  try {
    // Check if migration is needed by trying to insert a row with "days"
    console.log("Checking if migration is needed...")
    
    try {
      await runSync(
        "INSERT INTO plans_coin (name, ram, cpu, storage, coin_price, duration_type, duration_days) VALUES (?, ?, ?, ?, ?, ?, ?)",
        ["__test__", 1, 1, 1, 1, "days", 1]
      )
      
      // If successful, delete the test row and skip migration
      await runSync("DELETE FROM plans_coin WHERE name = '__test__'")
      console.log("⏭️  Migration not needed - duration types already support 'days' and 'lifetime'")
      process.exit(0)
    } catch (err) {
      if (!err.message.includes("CHECK constraint failed")) {
        throw err
      }
      console.log("Migration needed - proceeding with table recreation...")
    }

    // Begin migration
    console.log("Creating temporary tables with new constraints...")

    // Create temp table for plans_coin
    await runSync(`
      CREATE TABLE plans_coin_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        icon TEXT DEFAULT 'Package',
        ram INTEGER NOT NULL,
        cpu INTEGER NOT NULL,
        storage INTEGER NOT NULL,
        coin_price INTEGER NOT NULL,
        duration_type TEXT NOT NULL CHECK (duration_type IN ('weekly', 'monthly', 'custom', 'days', 'lifetime')),
        duration_days INTEGER NOT NULL DEFAULT 30,
        limited_stock INTEGER NOT NULL DEFAULT 0,
        stock_amount INTEGER,
        one_time_purchase INTEGER NOT NULL DEFAULT 0
      )
    `)

    // Create temp table for plans_real
    await runSync(`
      CREATE TABLE plans_real_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        icon TEXT DEFAULT 'Server',
        ram INTEGER NOT NULL,
        cpu INTEGER NOT NULL,
        storage INTEGER NOT NULL,
        price REAL NOT NULL,
        duration_type TEXT NOT NULL CHECK (duration_type IN ('weekly', 'monthly', 'custom', 'days', 'lifetime')),
        duration_days INTEGER NOT NULL DEFAULT 30,
        limited_stock INTEGER NOT NULL DEFAULT 0,
        stock_amount INTEGER
      )
    `)

    console.log("Copying data from old tables...")

    // Copy data from old tables
    await runSync(`
      INSERT INTO plans_coin_new (id, name, icon, ram, cpu, storage, coin_price, duration_type, duration_days, limited_stock, stock_amount, one_time_purchase)
      SELECT id, name, 
             COALESCE(icon, 'Package'), 
             ram, cpu, storage, coin_price, duration_type, 
             COALESCE(duration_days, 30), 
             limited_stock, stock_amount, 
             COALESCE(one_time_purchase, 0)
      FROM plans_coin
    `)

    await runSync(`
      INSERT INTO plans_real_new (id, name, icon, ram, cpu, storage, price, duration_type, duration_days, limited_stock, stock_amount)
      SELECT id, name, 
             COALESCE(icon, 'Server'),
             ram, cpu, storage, price, duration_type, 
             COALESCE(duration_days, 30), 
             limited_stock, stock_amount
      FROM plans_real
    `)

    console.log("Dropping old tables...")

    // Drop old tables
    await runSync("DROP TABLE plans_coin")
    await runSync("DROP TABLE plans_real")

    console.log("Renaming new tables...")

    // Rename new tables
    await runSync("ALTER TABLE plans_coin_new RENAME TO plans_coin")
    await runSync("ALTER TABLE plans_real_new RENAME TO plans_real")

    console.log("✅ Migration completed successfully!")
    console.log("   - Duration types now support: weekly, monthly, custom, days, lifetime")
    console.log("   - duration_days is now required (defaults to 30)")
    
    process.exit(0)
  } catch (error) {
    console.error("❌ Migration failed:", error)
    console.error("\nIf tables are in an inconsistent state, restore from backup or:")
    console.error("1. Drop _new tables if they exist")
    console.error("2. Run migration again")
    process.exit(1)
  }
}

migrate()
