import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, "../.env"), override: false })

const baseUrl = process.env.SMOKE_BASE_URL || `http://127.0.0.1:${process.env.PORT || "4000"}`
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 5000)

async function fetchJsonWithTimeout(url, timeout) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    let response
    try {
      response = await fetch(url, { signal: controller.signal })
    } catch (error) {
      const reason = error?.name === "AbortError"
        ? `request timed out after ${timeout}ms`
        : "could not connect"
      throw new Error(`${reason}. Ensure backend service is running and reachable at ${baseUrl}`)
    }
    let body = null
    try {
      body = await response.json()
    } catch {
      body = null
    }
    return { response, body }
  } finally {
    clearTimeout(timer)
  }
}

async function checkEndpoint(pathname, expectedStatus) {
  const url = `${baseUrl}${pathname}`
  const { response, body } = await fetchJsonWithTimeout(url, timeoutMs)
  if (response.status !== expectedStatus) {
    const details = body ? JSON.stringify(body) : "no response body"
    throw new Error(`${pathname} expected ${expectedStatus}, got ${response.status}. ${details}`)
  }
  return body
}

async function main() {
  console.log(`[SMOKE] Base URL: ${baseUrl}`)

  const health = await checkEndpoint("/health", 200)
  console.log(`[SMOKE] /health OK (${health?.status || "unknown"})`)

  const ready = await checkEndpoint("/ready", 200)
  console.log(`[SMOKE] /ready OK (${ready?.status || "unknown"})`)

  console.log("[SMOKE] Staging smoke checks passed")
}

main().catch((error) => {
  console.error("[SMOKE] Failed:", error.message)
  process.exit(1)
})
