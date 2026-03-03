import { db } from '../src/config/db.js';

console.log('\n=== Fixing password_hash column ===\n');

try {
  // Check current schema
  const tableInfo = db.prepare("PRAGMA table_info(users)").all();
  console.log('Current users table schema:');
  tableInfo.forEach(col => {
    console.log(`  ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : 'NULL'} ${col.dflt_value ? `DEFAULT ${col.dflt_value}` : ''}`);
  });

  const passwordHashCol = tableInfo.find(col => col.name === 'password_hash');
  
  if (passwordHashCol && passwordHashCol.notnull === 1) {
    console.log('\n⚠ password_hash is NOT NULL, fixing...\n');
    
    // Disable foreign keys temporarily
    db.pragma('foreign_keys = OFF');
    const fkStatus = db.pragma('foreign_keys', { simple: true });
    console.log(`✓ Foreign keys disabled (status: ${fkStatus})`);
    
    // Begin transaction
    db.exec('BEGIN TRANSACTION;');
    
    // Create new table with nullable password_hash
    db.exec(`
      CREATE TABLE users_temp (
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
    console.log('✓ Created temporary table');
    
    // Copy all data
    db.exec(`
      INSERT INTO users_temp 
      SELECT id, email, password_hash, role, coins, balance, ip_address, 
             last_login_ip, pterodactyl_user_id, flagged, last_claim_time,
             oauth_provider, oauth_id, email_verified, verification_token, 
             verification_token_expires, created_at
      FROM users;
    `);
    console.log('✓ Copied all user data');
    
    // Drop old table
    db.exec('DROP TABLE users;');
    console.log('✓ Dropped old table');
    
    // Rename new table
    db.exec('ALTER TABLE users_temp RENAME TO users;');
    console.log('✓ Renamed temp table to users');
    
    // Commit transaction
    db.exec('COMMIT;');
    console.log('✓ Committed transaction');
    
    // Re-enable foreign keys
    db.pragma('foreign_keys = ON');
    const fkStatusAfter = db.pragma('foreign_keys', { simple: true });
    console.log(`✓ Re-enabled foreign keys (status: ${fkStatusAfter})`);
    
    console.log('\n✅ password_hash is now nullable!\n');
  } else if (passwordHashCol && passwordHashCol.notnull === 0) {
    console.log('\n✅ password_hash is already nullable, no changes needed.\n');
  } else {
    console.log('\n❌ password_hash column not found!\n');
    process.exit(1);
  }
  
  // Show final schema
  const finalSchema = db.prepare("PRAGMA table_info(users)").all();
  console.log('Final users table schema:');
  finalSchema.forEach(col => {
    console.log(`  ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : 'NULL'} ${col.dflt_value ? `DEFAULT ${col.dflt_value}` : ''}`);
  });
  
  console.log('\n✅ Migration complete!\n');
  process.exit(0);
} catch (error) {
  console.error('\n❌ Error:', error.message);
  try {
    db.exec('ROLLBACK;');
    db.pragma('foreign_keys = ON');
  } catch (e) {
    // Ignore rollback errors
  }
  process.exit(1);
}
