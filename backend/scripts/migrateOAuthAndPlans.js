import { db } from '../src/config/db.js';

async function migrateOAuthAndPlans() {
  
  console.log('Starting OAuth and Plans migration...');
  
  try {
    // Add OAuth columns to users table
    console.log('Adding OAuth columns to users table...');
    try {
      db.exec(`ALTER TABLE users ADD COLUMN oauth_provider TEXT;`);
      console.log('✓ Added oauth_provider column');
    } catch (err) {
      if (!err.message.includes('duplicate column')) throw err;
      console.log('- oauth_provider column already exists');
    }
    
    try {
      db.exec(`ALTER TABLE users ADD COLUMN oauth_id TEXT;`);
      console.log('✓ Added oauth_id column');
    } catch (err) {
      if (!err.message.includes('duplicate column')) throw err;
      console.log('- oauth_id column already exists');
    }
    
    // Make password_hash nullable by creating new table and copying data
    console.log('Making password_hash nullable...');
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS users_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT,
          role TEXT NOT NULL DEFAULT 'user',
          coins INTEGER NOT NULL DEFAULT 0,
          balance REAL NOT NULL DEFAULT 0,
          ip_address TEXT,
          last_login_ip TEXT,
          pterodactyl_user_id INTEGER,
          flagged INTEGER NOT NULL DEFAULT 0,
          last_claim_time TEXT,
          oauth_provider TEXT,
          oauth_id TEXT,
          email_verified INTEGER NOT NULL DEFAULT 0,
          verification_token TEXT,
          verification_token_expires TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `);
      
      const hasData = db.prepare('SELECT COUNT(*) as count FROM users').get();
      if (hasData.count > 0) {
        db.exec(`
          INSERT INTO users_new 
          SELECT id, email, password_hash, role, coins, balance, ip_address, 
                 last_login_ip, pterodactyl_user_id, flagged, last_claim_time,
                 oauth_provider, oauth_id, 
                 COALESCE(email_verified, 0) as email_verified,
                 verification_token, verification_token_expires,
                 created_at
          FROM users;
        `);
        console.log('✓ Copied user data to new table');
      }
      
      db.exec('DROP TABLE users;');
      db.exec('ALTER TABLE users_new RENAME TO users;');
      console.log('✓ Password hash is now nullable');
    } catch (err) {
      console.log('- Password hash migration skipped or already done:', err.message);
    }
    
    // Add backup_count and extra_ports to plans_coin
    console.log('Adding backup_count and extra_ports to plans_coin...');
    try {
      db.exec(`ALTER TABLE plans_coin ADD COLUMN backup_count INTEGER NOT NULL DEFAULT 0;`);
      console.log('✓ Added backup_count to plans_coin');
    } catch (err) {
      if (!err.message.includes('duplicate column')) throw err;
      console.log('- backup_count column already exists in plans_coin');
    }
    
    try {
      db.exec(`ALTER TABLE plans_coin ADD COLUMN extra_ports INTEGER NOT NULL DEFAULT 0;`);
      console.log('✓ Added extra_ports to plans_coin');
    } catch (err) {
      if (!err.message.includes('duplicate column')) throw err;
      console.log('- extra_ports column already exists in plans_coin');
    }
    
    // Add backup_count and extra_ports to plans_real
    console.log('Adding backup_count and extra_ports to plans_real...');
    try {
      db.exec(`ALTER TABLE plans_real ADD COLUMN backup_count INTEGER NOT NULL DEFAULT 0;`);
      console.log('✓ Added backup_count to plans_real');
    } catch (err) {
      if (!err.message.includes('duplicate column')) throw err;
      console.log('- backup_count column already exists in plans_real');
    }
    
    try {
      db.exec(`ALTER TABLE plans_real ADD COLUMN extra_ports INTEGER NOT NULL DEFAULT 0;`);
      console.log('✓ Added extra_ports to plans_real');
    } catch (err) {
      if (!err.message.includes('duplicate column')) throw err;
      console.log('- extra_ports column already exists in plans_real');
    }
    
    // Add email verification columns to users
    console.log('Adding email verification columns to users...');
    try {
      db.exec(`ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;`);
      console.log('✓ Added email_verified to users');
    } catch (err) {
      if (!err.message.includes('duplicate column')) throw err;
      console.log('- email_verified column already exists');
    }
    
    try {
      db.exec(`ALTER TABLE users ADD COLUMN verification_token TEXT;`);
      console.log('✓ Added verification_token to users');
    } catch (err) {
      if (!err.message.includes('duplicate column')) throw err;
      console.log('- verification_token column already exists');
    }
    
    try {
      db.exec(`ALTER TABLE users ADD COLUMN verification_token_expires TEXT;`);
      console.log('✓ Added verification_token_expires to users');
    } catch (err) {
      if (!err.message.includes('duplicate column')) throw err;
      console.log('- verification_token_expires column already exists');
    }
    
    // Auto-verify OAuth users (they have verified emails from OAuth providers)
    console.log('Auto-verifying OAuth users...');
    db.exec(`UPDATE users SET email_verified = 1 WHERE oauth_provider IS NOT NULL;`);
    console.log('✓ OAuth users marked as verified');
    
    // Create backups tracking table
    console.log('Creating backups tracking table...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS server_backups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        server_id INTEGER NOT NULL,
        pterodactyl_backup_uuid TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
      );
    `);
    console.log('✓ Created server_backups table');
    
    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration
migrateOAuthAndPlans()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
