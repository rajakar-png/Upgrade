import { db } from '../src/config/db.js';
import { getOne, runSync } from '../src/config/db.js';

const email = process.argv[2];

if (!email) {
  console.error('\n❌ Usage: node scripts/setAdmin.js <email>\n');
  console.log('Example: node scripts/setAdmin.js admin@example.com\n');
  process.exit(1);
}

async function setAdmin() {
  try {
    console.log(`\n🔍 Looking up user: ${email}\n`);
    
    const user = await getOne(
      'SELECT id, email, role FROM users WHERE email = ?',
      [email.toLowerCase()]
    );
    
    if (!user) {
      console.error(`❌ User not found: ${email}\n`);
      process.exit(1);
    }
    
    if (user.role === 'admin') {
      console.log(`✅ ${email} is already an admin!\n`);
      process.exit(0);
    }
    
    await runSync(
      'UPDATE users SET role = ? WHERE id = ?',
      ['admin', user.id]
    );
    
    console.log(`✅ Successfully promoted ${email} to admin!\n`);
    console.log(`User Details:`);
    console.log(`  ID: ${user.id}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Old Role: ${user.role}`);
    console.log(`  New Role: admin\n`);
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message, '\n');
    process.exit(1);
  }
}

setAdmin();
