import { db } from '../src/config/db.js';
import { query, getOne } from '../src/config/db.js';

console.log('\n═══════════════════════════════════════');
console.log('  OAuth Setup Diagnostic Tool');
console.log('═══════════════════════════════════════\n');

try {
  // 1. Check users table schema
  console.log('📋 Checking users table schema...\n');
  const tableInfo = db.prepare("PRAGMA table_info(users)").all();
  
  const requiredColumns = [
    'oauth_provider',
    'oauth_id', 
    'email_verified',
    'verification_token',
    'verification_token_expires'
  ];
  
  const passwordHashCol = tableInfo.find(col => col.name === 'password_hash');
  const missingColumns = requiredColumns.filter(
    col => !tableInfo.find(c => c.name === col)
  );
  
  console.log('Column Status:');
  requiredColumns.forEach(col => {
    const exists = tableInfo.find(c => c.name === col);
    console.log(`  ${exists ? '✅' : '❌'} ${col} ${exists ? '' : '(MISSING)'}`);
  });
  
  if (passwordHashCol) {
    const nullable = passwordHashCol.notnull === 0;
    console.log(`  ${nullable ? '✅' : '❌'} password_hash ${nullable ? '(nullable)' : '(NOT NULL - PROBLEM!)'}`);
  } else {
    console.log('  ❌ password_hash (MISSING)');
  }
  
  console.log('');
  
  // 2. Check if OAuth environment variables are set
  console.log('🔐 Checking OAuth configuration...\n');
  
  const envVars = {
    'GOOGLE_CLIENT_ID': process.env.GOOGLE_CLIENT_ID,
    'GOOGLE_CLIENT_SECRET': process.env.GOOGLE_CLIENT_SECRET,
    'DISCORD_CLIENT_ID': process.env.DISCORD_CLIENT_ID,
    'DISCORD_CLIENT_SECRET': process.env.DISCORD_CLIENT_SECRET,
    'OAUTH_CALLBACK_URL': process.env.OAUTH_CALLBACK_URL,
    'SESSION_SECRET': process.env.SESSION_SECRET
  };
  
  Object.entries(envVars).forEach(([key, value]) => {
    const set = value && value.length > 0 && !value.includes('your_');
    console.log(`  ${set ? '✅' : '❌'} ${key} ${set ? '(set)' : '(NOT SET)'}`);
  });
  
  console.log('');
  
  // 3. Check if any OAuth users exist
  console.log('👥 Checking existing users...\n');
  
  const users = await query('SELECT id, email, role, oauth_provider, oauth_id, email_verified FROM users');
  
  if (users.length === 0) {
    console.log('  ⚠️  No users found in database\n');
    console.log('  Next steps:');
    console.log('    1. Login via Google or Discord OAuth at your application URL');
    console.log('    2. Check the backend logs for any errors during OAuth');
    console.log('    3. Run this script again to verify user was created\n');
  } else {
    console.log(`  Found ${users.length} user(s):\n`);
    users.forEach(user => {
      console.log(`  • ${user.email}`);
      console.log(`    ID: ${user.id} | Role: ${user.role}`);
      console.log(`    OAuth: ${user.oauth_provider || 'none'} | Verified: ${user.email_verified ? 'yes' : 'no'}`);
      console.log('');
    });
    
    const admins = users.filter(u => u.role === 'admin');
    const oauthUsers = users.filter(u => u.oauth_provider);
    
    console.log('📊 Summary:');
    console.log(`  Total users: ${users.length}`);
    console.log(`  Admin users: ${admins.length}`);
    console.log(`  OAuth users: ${oauthUsers.length}\n`);
    
    if (admins.length === 0) {
      console.log('⚠️  No admin users found!\n');
      console.log('To promote a user to admin, run:');
      console.log(`  node scripts/setAdmin.js ${users[0].email}\n`);
    }
  }
  
  // 4. Final recommendations
  console.log('═══════════════════════════════════════');
  console.log('💡 Recommendations:\n');
  
  if (missingColumns.length > 0) {
    console.log('❌ CRITICAL: OAuth columns are missing!');
    console.log('   Run: npm run migrate-oauth\n');
  }
  
  if (passwordHashCol && passwordHashCol.notnull === 1) {
    console.log('❌ CRITICAL: password_hash is NOT NULL!');
    console.log('   Run: node scripts/fixPasswordHash.js\n');
  }
  
  const missingEnv = Object.entries(envVars).filter(([k, v]) => !v || v.length === 0 || v.includes('your_'));
  if (missingEnv.length > 0) {
    console.log('⚠️  WARNING: Some OAuth environment variables are not set');
    console.log('   Missing: ' + missingEnv.map(([k]) => k).join(', '));
    console.log('   Update your .env file with proper OAuth credentials\n');
  }
  
  if (missingColumns.length === 0 && passwordHashCol?.notnull === 0 && missingEnv.length === 0) {
    if (users.length === 0) {
      console.log('✅ OAuth setup is complete!');
      console.log('   Login via OAuth to create your first user\n');
    } else if (admins.length === 0) {
      console.log('✅ OAuth is working!');
      console.log(`   Promote your account: npm run set-admin ${users[0].email}\n`);
    } else {
      console.log('✅ Everything looks good!\n');
    }
  }
  
  console.log('═══════════════════════════════════════\n');
  
  process.exit(0);
} catch (error) {
  console.error('\n❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
}
