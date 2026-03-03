import { runSync, getOne } from "../src/config/db.js"
import { hashPassword } from "../src/utils/password.js"
import readline from "readline"

// Suppress database logs during admin creation
const originalLog = console.log
console.log = (...args) => {
  if (args[0] && typeof args[0] === 'string' && args[0].startsWith('[DB]')) {
    return // Skip DB logs
  }
  originalLog(...args)
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve)
  })
}

async function createAdmin() {
  try {
    // Wait for DB to initialize
    await new Promise(resolve => setTimeout(resolve, 1000))

    console.log = originalLog // Restore logging
    
    console.log("\n========================================")
    console.log("Create Admin User")
    console.log("========================================\n")

    const email = await question("Admin Email: ")
    const password = await question("Admin Password (min 8 chars): ")

    if (!email || !password) {
      console.error("❌ Email and password are required")
      process.exit(1)
    }

    if (password.length < 8) {
      console.error("❌ Password must be at least 8 characters")
      process.exit(1)
    }

    // Check if user already exists
    const existing = await getOne("SELECT id, role FROM users WHERE email = ?", [
      email.toLowerCase()
    ])

    if (existing) {
      if (existing.role === "admin") {
        console.log("\n⚠️  User already exists and is already an admin")
        process.exit(0)
      }

      // Promote existing user to admin
      const confirm = await question(
        "\n⚠️  User exists. Promote to admin? (yes/no): "
      )
      if (confirm.toLowerCase() !== "yes") {
        console.log("❌ Cancelled")
        process.exit(0)
      }

      await runSync("UPDATE users SET role = 'admin' WHERE email = ?", [
        email.toLowerCase()
      ])
      console.log("\n✅ User promoted to admin successfully!")
    } else {
      // Create new admin user
      const hash = await hashPassword(password)

      await runSync(
        `INSERT INTO users (email, password_hash, role, coins, balance, ip_address, last_login_ip) 
         VALUES (?, ?, 'admin', 0, 0, '127.0.0.1', '127.0.0.1')`,
        [email.toLowerCase(), hash]
      )

      console.log("\n✅ Admin user created successfully!")
    }

    console.log("\n========================================")
    console.log("Admin Credentials:")
    console.log(`  Email: ${email}`)
    console.log(`  Password: ${'*'.repeat(password.length)}`)
    console.log("========================================\n")
    console.log("You can now login at /login and access /admin panel\n")

    rl.close()
    process.exit(0)
  } catch (error) {
    console.error("\n❌ Error creating admin user:", error)
    rl.close()
    process.exit(1)
  }
}

createAdmin()
