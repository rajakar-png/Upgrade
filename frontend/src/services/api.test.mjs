import test from "node:test"
import assert from "node:assert/strict"

test.afterEach(() => {
  delete global.fetch
  delete global.window
  delete global.localStorage
})

function createLocalStorageMock() {
  const store = new Map()
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear()
  }
}

async function importApiModule() {
  const moduleUrl = new URL(`./api.js?t=${Date.now()}-${Math.random()}`, import.meta.url)
  return import(moduleUrl.href)
}

test("getUserServers sends pagination params", async () => {
  global.window = { location: { hostname: "localhost", origin: "http://localhost:5173" } }
  global.localStorage = createLocalStorageMock()

  let capturedUrl = ""
  global.fetch = async (url) => {
    capturedUrl = String(url)
    return {
      ok: true,
      json: async () => ({ servers: [], pagination: { page: 3, limit: 25, total: 0, totalPages: 1 } })
    }
  }

  const { api } = await importApiModule()
  const payload = await api.getUserServers("token", { page: 3, limit: 25 })

  assert.equal(payload.pagination.page, 3)
  assert.match(capturedUrl, /page=3/)
  assert.match(capturedUrl, /limit=25/)
})

test("getBalance abort propagates AbortError", async () => {
  global.window = { location: { hostname: "localhost", origin: "http://localhost:5173" } }
  global.localStorage = createLocalStorageMock()

  global.fetch = (_url, options = {}) =>
    new Promise((_resolve, reject) => {
      const signal = options.signal
      if (signal?.aborted) {
        const err = new Error("Aborted")
        err.name = "AbortError"
        reject(err)
        return
      }

      signal?.addEventListener("abort", () => {
        const err = new Error("Aborted")
        err.name = "AbortError"
        reject(err)
      })
    })

  const { api } = await importApiModule()
  const controller = new AbortController()
  const requestPromise = api.getBalance("token", { signal: controller.signal, timeoutMs: 1000 })
  controller.abort()

  await assert.rejects(requestPromise, (error) => error?.name === "AbortError")
})

test("getBalance timeout throws TimeoutError", async () => {
  global.window = { location: { hostname: "localhost", origin: "http://localhost:5173" } }
  global.localStorage = createLocalStorageMock()

  global.fetch = (_url, options = {}) =>
    new Promise((_resolve, reject) => {
      const signal = options.signal
      if (signal?.aborted) {
        const err = new Error("Aborted")
        err.name = "AbortError"
        reject(err)
        return
      }

      signal?.addEventListener("abort", () => {
        const err = new Error("Aborted")
        err.name = "AbortError"
        reject(err)
      })
    })

  const { api } = await importApiModule()
  await assert.rejects(
    api.getBalance("token", { timeoutMs: 30 }),
    (error) => error?.name === "TimeoutError"
  )
})

test("renewServer sends Idempotency-Key header", async () => {
  global.window = { location: { hostname: "localhost", origin: "http://localhost:5173" } }
  global.localStorage = createLocalStorageMock()

  let headerValue = ""
  global.fetch = async (_url, options = {}) => {
    headerValue = options.headers?.["Idempotency-Key"] || ""
    return {
      ok: true,
      json: async () => ({ message: "Renewed", expires_at: "2026-04-01T00:00:00.000Z" })
    }
  }

  const { api } = await importApiModule()
  await api.renewServer("token", 123)

  assert.ok(headerValue.startsWith("renew-"))
})

test("renewServer uses provided idempotency key", async () => {
  global.window = { location: { hostname: "localhost", origin: "http://localhost:5173" } }
  global.localStorage = createLocalStorageMock()

  let headerValue = ""
  global.fetch = async (_url, options = {}) => {
    headerValue = options.headers?.["Idempotency-Key"] || ""
    return {
      ok: true,
      json: async () => ({ message: "Renewed", expires_at: "2026-04-01T00:00:00.000Z" })
    }
  }

  const { api } = await importApiModule()
  await api.renewServer("token", 123, { idempotencyKey: "custom-key-1" })

  assert.equal(headerValue, "custom-key-1")
})
