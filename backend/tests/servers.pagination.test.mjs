import test from "node:test"
import assert from "node:assert/strict"
import http from "http"
import fs from "fs"
import path from "path"

const testDbDir = path.resolve("./data/test")
const testDbPath = path.join(testDbDir, `astranodes-pagination-${process.pid}-${Date.now()}.sqlite`)
process.env.NODE_ENV = "test"
process.env.PORT = "0"
process.env.FRONTEND_URL = "http://localhost:5173"
process.env.JWT_SECRET = "12345678901234567890123456789012"
process.env.JWT_EXPIRES_IN = "7d"
process.env.DB_PROVIDER = "sqlite"
delete process.env.DATABASE_URL
delete process.env.DB_SSL
process.env.DB_PATH = testDbPath
process.env.RATE_LIMIT_WINDOW = "900000"
process.env.RATE_LIMIT_MAX = "10000"
process.env.PTERODACTYL_URL = "http://localhost:8080"
process.env.PTERODACTYL_API_KEY = "ptla_test"
process.env.PTERODACTYL_DEFAULT_EGG = "1"
process.env.PTERODACTYL_DEFAULT_DOCKER_IMAGE = "ghcr.io/pterodactyl/yolks:java_17"
process.env.PTERODACTYL_DEFAULT_STARTUP = "java -version"
process.env.SESSION_SECRET = "abcdefghijklmnopqrstuvwxyz123456"

if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath)
}

if (!fs.existsSync(testDbDir)) {
  fs.mkdirSync(testDbDir, { recursive: true })
}

const [{ default: app }, { default: migrate }, { runSync, getOne }, { signToken }] = await Promise.all([
  import("../src/app.js"),
  import("../src/db/migrate.js"),
  import("../src/config/db.js"),
  import("../src/utils/jwt.js")
])

await migrate()

let server
let baseUrl

test.before(async () => {
  server = http.createServer(app)
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  baseUrl = `http://127.0.0.1:${address.port}`
})

test.after(async () => {
  await new Promise((resolve) => server.close(resolve))
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath)
  }
})

test("GET /api/servers returns paginated shape", async () => {
  await runSync("DELETE FROM servers")
  await runSync("DELETE FROM plans_coin")
  await runSync("DELETE FROM users")

  const userInsert = await runSync(
    "INSERT INTO users (email, role, coins, balance) VALUES (?, 'user', 10000, 0)",
    ["pagination-user@example.com"]
  )
  const userId = userInsert.lastID

  const planInsert = await runSync(
    "INSERT INTO plans_coin (name, ram, cpu, storage, coin_price, duration_type, duration_days, category, initial_price, renewal_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ["Starter", 2, 100, 20, 100, "monthly", 30, "minecraft", 100, 100]
  )
  const planId = planInsert.lastID

  const plus30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  for (let i = 0; i < 25; i += 1) {
    await runSync(
      "INSERT INTO servers (user_id, name, plan_type, plan_id, pterodactyl_server_id, identifier, expires_at, status, location, software, category) VALUES (?, ?, 'coin', ?, NULL, ?, ?, 'suspended', '', 'minecraft', 'minecraft')",
      [userId, `srv-${i + 1}`, planId, `id-${i + 1}`, plus30Days]
    )
  }

  const token = signToken({ id: userId, role: "user" })
  const res = await fetch(`${baseUrl}/api/servers?page=2&limit=10`, {
    headers: { Authorization: `Bearer ${token}` }
  })

  assert.equal(res.status, 200)
  const body = await res.json()

  assert.ok(Array.isArray(body.servers))
  assert.equal(body.servers.length, 10)
  assert.equal(body.pagination.page, 2)
  assert.equal(body.pagination.limit, 10)
  assert.equal(body.pagination.total, 25)
  assert.equal(body.pagination.totalPages, 3)
})

test("POST /api/servers/renew replays idempotent request", async () => {
  await runSync("DELETE FROM servers")
  await runSync("DELETE FROM plans_coin")
  await runSync("DELETE FROM users")
  await runSync("DELETE FROM idempotency_keys")

  const userInsert = await runSync(
    "INSERT INTO users (email, role, coins, balance) VALUES (?, 'user', 1000, 0)",
    ["renew-idempotent@example.com"]
  )
  const userId = userInsert.lastID

  const planInsert = await runSync(
    "INSERT INTO plans_coin (name, ram, cpu, storage, coin_price, initial_price, renewal_price, duration_type, duration_days, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ["Renew Plan", 2, 100, 20, 150, 150, 100, "monthly", 30, "minecraft"]
  )
  const planId = planInsert.lastID

  const serverInsert = await runSync(
    "INSERT INTO servers (user_id, name, plan_type, plan_id, pterodactyl_server_id, identifier, expires_at, status, location, software, category) VALUES (?, ?, 'coin', ?, 42, 'abc123', ?, 'active', '', 'minecraft', 'minecraft')",
    [userId, "idempotent-server", planId, new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()]
  )

  const token = signToken({ id: userId, role: "user" })
  const idempotencyKey = "renew-test-key-1"

  const first = await fetch(`${baseUrl}/api/servers/renew`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey
    },
    body: JSON.stringify({ server_id: serverInsert.lastID })
  })
  assert.equal(first.status, 200)
  const firstBody = await first.json()

  const second = await fetch(`${baseUrl}/api/servers/renew`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey
    },
    body: JSON.stringify({ server_id: serverInsert.lastID })
  })
  assert.equal(second.status, 200)
  const secondBody = await second.json()

  assert.equal(secondBody.expires_at, firstBody.expires_at)

  const userAfter = await getOne("SELECT coins FROM users WHERE id = ?", [userId])
  assert.equal(userAfter.coins, 900)
})

test("GET /api/admin/idempotency/overview returns metrics", async () => {
  await runSync("DELETE FROM servers")
  await runSync("DELETE FROM coupon_redemptions")
  await runSync("DELETE FROM utr_submissions")
  await runSync("DELETE FROM tickets")
  await runSync("DELETE FROM ticket_messages")
  await runSync("DELETE FROM idempotency_keys")
  await runSync("DELETE FROM users")

  const adminInsert = await runSync(
    "INSERT INTO users (email, role, coins, balance) VALUES (?, 'admin', 0, 0)",
    ["admin-idempotency@example.com"]
  )

  const adminToken = signToken({ id: adminInsert.lastID, role: "admin" })

  await runSync(
    "INSERT INTO idempotency_keys (user_id, endpoint, key, status, status_code, response_json) VALUES (?, ?, ?, 'processing', NULL, NULL)",
    [adminInsert.lastID, "servers:purchase", "k-1"]
  )
  await runSync(
    "INSERT INTO idempotency_keys (user_id, endpoint, key, status, status_code, response_json) VALUES (?, ?, ?, 'completed', 200, '{}')",
    [adminInsert.lastID, "servers:renew", "k-2"]
  )

  const res = await fetch(`${baseUrl}/api/admin/idempotency/overview`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  })

  assert.equal(res.status, 200)
  const body = await res.json()
  assert.ok(Number.isFinite(Number(body.processing)))
  assert.ok(Number.isFinite(Number(body.completedLast24h)))
  assert.ok(Array.isArray(body.endpointBreakdown))
  for (const row of body.endpointBreakdown) {
    assert.equal(typeof row.endpoint, "string")
    assert.ok(Number.isFinite(Number(row.count)))
  }
})
