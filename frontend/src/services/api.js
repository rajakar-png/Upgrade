// Smart API URL detection for development and Codespaces
function getApiUrl() {
  const viteEnv = (typeof import.meta !== "undefined" && import.meta.env) ? import.meta.env : {}

  // If explicitly set via .env, use that
  if (viteEnv.VITE_API_URL) {
    return viteEnv.VITE_API_URL
  }

  // In development on Codespaces, construct the backend URL from the frontend URL
  if (window.location.hostname.includes("app.github.dev")) {
    const baseUrl = window.location.origin.replace("-5173.", "-4000.")
    return `${baseUrl}/api`
  }

  // Default to localhost
  return "http://localhost:4000/api"
}

// Returns the backend origin (no /api suffix) — used to build full URLs for uploads
export function getBackendBaseUrl() {
  const viteEnv = (typeof import.meta !== "undefined" && import.meta.env) ? import.meta.env : {}

  if (viteEnv.VITE_API_URL) {
    // Strip trailing /api if present
    return viteEnv.VITE_API_URL.replace(/\/api$/, "")
  }
  if (window.location.hostname.includes("app.github.dev")) {
    return window.location.origin.replace("-5173.", "-4000.")
  }
  return "http://localhost:4000"
}

const API_URL = getApiUrl()
const ME_CACHE_TTL_MS = 15000
const BALANCE_CACHE_TTL_MS = 10000
const SERVERS_CACHE_TTL_MS = 6000
const DEFAULT_REQUEST_TIMEOUT_MS = 15000

let pendingGetMePromise = null
let cachedMeUser = null
let cachedMeAt = 0
const pendingBalancePromises = new Map()
const cachedBalances = new Map()
const pendingServersPromises = new Map()
const cachedServers = new Map()

const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504])

function emitDataSync(domains = []) {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent("astra:data-sync", {
    detail: { domains, at: Date.now() }
  }))
}

function createIdempotencyKey(prefix = "req") {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function createMergedSignal(externalSignal, timeoutMs) {
  const timeoutController = new AbortController()
  const mergedController = new AbortController()

  const onAbort = () => {
    if (!mergedController.signal.aborted) {
      mergedController.abort()
    }
  }

  if (externalSignal) {
    if (externalSignal.aborted) {
      mergedController.abort()
    } else {
      externalSignal.addEventListener("abort", onAbort, { once: true })
    }
  }

  timeoutController.signal.addEventListener("abort", onAbort, { once: true })
  const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs)

  return {
    signal: mergedController.signal,
    timeoutController,
    timeoutId,
    cleanup: () => {
      clearTimeout(timeoutId)
      if (externalSignal) {
        externalSignal.removeEventListener("abort", onAbort)
      }
      timeoutController.signal.removeEventListener("abort", onAbort)
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRetryableError(error) {
  if (!error) return false
  return error.name === "TimeoutError" || error instanceof TypeError
}

async function fetchWithTimeout(url, options = {}) {
  const { timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS, signal: externalSignal, ...rest } = options
  const merged = createMergedSignal(externalSignal, timeoutMs)

  try {
    return await fetch(url, {
      ...rest,
      signal: merged.signal
    })
  } catch (error) {
    if (merged.timeoutController.signal.aborted && !externalSignal?.aborted) {
      const timeoutError = new Error("Request timed out. Please try again.")
      timeoutError.name = "TimeoutError"
      throw timeoutError
    }
    throw error
  } finally {
    merged.cleanup()
  }
}

async function fetchWithRetry(url, options = {}, retryOptions = {}) {
  const attempts = retryOptions.attempts ?? 1
  const baseDelayMs = retryOptions.baseDelayMs ?? 500

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url, options)
      if (!RETRYABLE_STATUSES.has(response.status) || attempt === attempts) {
        return response
      }
    } catch (error) {
      if (!isRetryableError(error) || attempt === attempts) {
        throw error
      }
    }

    await sleep(baseDelayMs * (2 ** (attempt - 1)))
  }

  return fetchWithTimeout(url, options)
}

export const api = {
  // Auth
  getMe: async (options = {}) => {
    const token = localStorage.getItem("token")
    if (!token) return null

    const now = Date.now()
    if (cachedMeUser && now - cachedMeAt < ME_CACHE_TTL_MS) {
      return cachedMeUser
    }

    if (pendingGetMePromise) {
      return pendingGetMePromise
    }

    pendingGetMePromise = fetchWithTimeout(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: options.signal,
      timeoutMs: options.timeoutMs
    })
      .then(async (res) => {
        if (!res.ok) return null
        const user = await res.json()
        cachedMeUser = user
        cachedMeAt = Date.now()
        return user
      })
      .finally(() => {
        pendingGetMePromise = null
      })

    return pendingGetMePromise
  },

  register: async (email, password) => {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    })
    if (!res.ok) throw new Error((await res.json()).error || "Registration failed")
    return res.json()
  },

  login: async (email, password) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    })
    if (!res.ok) throw new Error((await res.json()).error || "Login failed")
    return res.json()
  },

  // Plans
  getCoinPlans: async (category) => {
    const url = category ? `${API_URL}/plans/coin?category=${category}` : `${API_URL}/plans/coin`
    const res = await fetch(url)
    if (!res.ok) throw new Error("Failed to fetch coin plans")
    return res.json()
  },

  getRealPlans: async (category) => {
    const url = category ? `${API_URL}/plans/real?category=${category}` : `${API_URL}/plans/real`
    const res = await fetch(url)
    if (!res.ok) throw new Error("Failed to fetch real plans")
    return res.json()
  },

  getAvailableEggs: async (token, category) => {
    const url = category ? `${API_URL}/plans/eggs?category=${category}` : `${API_URL}/plans/eggs`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error("Failed to fetch eggs")
    return res.json()
  },

  // Servers
  getAvailableNodes: async (token) => {
    const res = await fetch(`${API_URL}/servers/nodes`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) return []
    return res.json()
  },

  getUserServers: async (token, options = {}) => {
    const page = options.page || 1
    const limit = options.limit || 10
    const cacheKey = `${token}:${page}:${limit}`
    const now = Date.now()

    if (cachedServers.has(cacheKey) && !options.forceRefresh) {
      const cached = cachedServers.get(cacheKey)
      if (now - cached.at < SERVERS_CACHE_TTL_MS) {
        return cached.value
      }
    }

    if (pendingServersPromises.has(cacheKey) && !options.forceRefresh) {
      return pendingServersPromises.get(cacheKey)
    }

    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit)
    })

    const request = fetchWithRetry(`${API_URL}/servers?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: options.signal,
      timeoutMs: options.timeoutMs
    }, {
      attempts: 3,
      baseDelayMs: 450
    })

    pendingServersPromises.set(cacheKey, request)

    const res = await request.finally(() => pendingServersPromises.delete(cacheKey))
    if (!res.ok) throw new Error("Failed to fetch servers")
    const data = await res.json()
    cachedServers.set(cacheKey, { value: data, at: Date.now() })
    return data
  },

  purchaseServer: async (token, planType, planId, serverName, nodeId, locationName, software = "minecraft", eggId = null, category = "minecraft") => {
    const idempotencyKey = createIdempotencyKey("purchase")
    const res = await fetchWithRetry(`${API_URL}/servers/purchase`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "Idempotency-Key": idempotencyKey
      },
      body: JSON.stringify({
        plan_type: planType,
        plan_id: Number(planId),
        server_name: serverName,
        category: category,
        node_id: nodeId != null && nodeId !== "" ? Number(nodeId) : undefined,
        location: locationName || "",
        software: software,
        egg_id: eggId != null && eggId !== "" ? Number(eggId) : undefined
      })
    }, {
      attempts: 3,
      baseDelayMs: 600
    })
    if (!res.ok) throw new Error((await res.json()).error || "Purchase failed")
    cachedServers.clear()
    cachedBalances.clear()
    emitDataSync(["servers", "balance", "dashboard"])
    return res.json()
  },

  renewServer: async (token, serverId, options = {}) => {
    const idempotencyKey = options.idempotencyKey || createIdempotencyKey("renew")
    const res = await fetchWithRetry(`${API_URL}/servers/renew`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "Idempotency-Key": idempotencyKey
      },
      body: JSON.stringify({ server_id: Number(serverId) }),
      signal: options.signal,
      timeoutMs: options.timeoutMs
    }, {
      attempts: 3,
      baseDelayMs: 600
    })
    if (!res.ok) throw new Error((await res.json()).error || "Renewal failed")
    cachedServers.clear()
    cachedBalances.clear()
    emitDataSync(["servers", "balance", "dashboard"])
    return res.json()
  },

  // Coins
  getBalance: async (token, options = {}) => {
    const now = Date.now()

    if (cachedBalances.has(token) && !options.forceRefresh) {
      const cached = cachedBalances.get(token)
      if (now - cached.at < BALANCE_CACHE_TTL_MS) {
        return cached.value
      }
    }

    if (pendingBalancePromises.has(token) && !options.forceRefresh) {
      return pendingBalancePromises.get(token)
    }

    const request = fetchWithRetry(`${API_URL}/coins/balance`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: options.signal,
      timeoutMs: options.timeoutMs
    }, {
      attempts: 3,
      baseDelayMs: 400
    })

    pendingBalancePromises.set(token, request)

    const res = await request.finally(() => pendingBalancePromises.delete(token))
    if (!res.ok) throw new Error("Failed to fetch balance")
    const data = await res.json()
    cachedBalances.set(token, { value: data, at: Date.now() })
    return data
  },

  claimCoins: async (token, earnToken) => {
    const res = await fetch(`${API_URL}/coins/claim`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ earnToken })
    })
    if (!res.ok) {
      const data = await res.json()
      const err = new Error(data.error || "Claim failed")
      if (data.waitSeconds) err.waitSeconds = data.waitSeconds
      throw err
    }
    cachedBalances.delete(token)
    emitDataSync(["balance", "coins", "dashboard"])
    return res.json()
  },

  getEarnSession: async (token) => {
    const res = await fetch(`${API_URL}/coins/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      }
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || "Failed to start earn session")
    }
    return res.json()
  },

  // Coupons
  redeemCoupon: async (token, code) => {
    const res = await fetch(`${API_URL}/coupons/redeem`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ code })
    })
    if (!res.ok) throw new Error((await res.json()).error || "Coupon redeem failed")
    cachedBalances.delete(token)
    emitDataSync(["balance", "coupons", "dashboard"])
    return res.json()
  },

  getCouponHistory: async (token) => {
    const res = await fetch(`${API_URL}/coupons/history`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error("Failed to fetch coupon history")
    return res.json()
  },

  // Billing
  submitUTR: async (token, amount, utrNumber, screenshot) => {
    const formData = new FormData()
    formData.append("amount", amount)
    formData.append("utr_number", utrNumber)
    formData.append("screenshot", screenshot)

    const res = await fetch(`${API_URL}/billing/utr`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    })
    if (!res.ok) throw new Error((await res.json()).error || "UTR submission failed")
    emitDataSync(["billing", "admin"])
    return res.json()
  },

  getUTRSubmissions: async (token, options = {}) => {
    const res = await fetchWithTimeout(`${API_URL}/billing/utr`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: options.signal,
      timeoutMs: options.timeoutMs
    })
    if (!res.ok) throw new Error("Failed to fetch UTR submissions")
    return res.json()
  },

  // Admin
  getUsers: async (token) => {
    const res = await fetch(`${API_URL}/admin/users`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error("Failed to fetch users")
    return res.json()
  },

  flagUser: async (token, userId, flagged) => {
    const res = await fetch(`${API_URL}/admin/users/${userId}/flag`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ flagged })
    })
    if (!res.ok) throw new Error("Failed to flag user")
    return res.json()
  },

  changeUserRole: async (token, userId, role) => {
    const res = await fetch(`${API_URL}/admin/users/${userId}/role`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ role })
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.message || "Failed to change user role")
    }
    return res.json()
  },

  deleteUser: async (token, userId) => {
    const res = await fetch(`${API_URL}/admin/users/${userId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.message || "Failed to delete user")
    }
    return res.json()
  },

  getServers: async (token) => {
    const res = await fetch(`${API_URL}/admin/servers`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error("Failed to fetch servers")
    return res.json()
  },

  suspendServer: async (token, serverId) => {
    const res = await fetch(`${API_URL}/admin/servers/${serverId}/suspend`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error("Failed to suspend server")
    return res.json()
  },

  deleteServer: async (token, serverId) => {
    const res = await fetch(`${API_URL}/admin/servers/${serverId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error("Failed to delete server")
    return res.json()
  },

  getUTRSubmissionsAdmin: async (token, options = {}) => {
    const res = await fetchWithTimeout(`${API_URL}/admin/utr`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: options.signal,
      timeoutMs: options.timeoutMs
    })
    if (!res.ok) throw new Error("Failed to fetch UTR submissions")
    return res.json()
  },

  approveUTR: async (token, submissionId) => {
    const res = await fetch(`${API_URL}/admin/utr/${submissionId}/approve`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error("Failed to approve UTR")
    emitDataSync(["billing", "admin", "balance"])
    return res.json()
  },

  rejectUTR: async (token, submissionId) => {
    const res = await fetch(`${API_URL}/admin/utr/${submissionId}/reject`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error("Failed to reject UTR")
    emitDataSync(["billing", "admin"])
    return res.json()
  },

  // Admin: Plan Management
  createCoinPlan: async (token, planData) => {
    const res = await fetch(`${API_URL}/admin/plans/coin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(planData)
    })
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: "Unknown error" }))
      throw new Error(errorData.error || "Failed to create coin plan")
    }
    const data = await res.json()
    emitDataSync(["plans", "admin", "frontpage"])
    return data
  },

  createRealPlan: async (token, planData) => {
    const res = await fetch(`${API_URL}/admin/plans/real`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(planData)
    })
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: "Unknown error" }))
      throw new Error(errorData.error || "Failed to create real plan")
    }
    const data = await res.json()
    emitDataSync(["plans", "admin", "frontpage"])
    return data
  },

  updateCoinPlan: async (token, planId, planData) => {
    const res = await fetch(`${API_URL}/admin/plans/coin/${planId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(planData)
    })
    if (!res.ok) throw new Error("Failed to update coin plan")
    const data = await res.json()
    emitDataSync(["plans", "admin", "frontpage"])
    return data
  },

  updateRealPlan: async (token, planId, planData) => {
    const res = await fetch(`${API_URL}/admin/plans/real/${planId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(planData)
    })
    if (!res.ok) throw new Error("Failed to update real plan")
    const data = await res.json()
    emitDataSync(["plans", "admin", "frontpage"])
    return data
  },

  deleteCoinPlan: async (token, planId) => {
    const res = await fetch(`${API_URL}/admin/plans/coin/${planId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error("Failed to delete coin plan")
    const data = await res.json()
    emitDataSync(["plans", "admin", "frontpage"])
    return data
  },

  deleteRealPlan: async (token, planId) => {
    const res = await fetch(`${API_URL}/admin/plans/real/${planId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error("Failed to delete real plan")
    const data = await res.json()
    emitDataSync(["plans", "admin", "frontpage"])
    return data
  },

  // Coupons (admin)
  getCoupons: async (token) => {
    const res = await fetch(`${API_URL}/admin/coupons`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error("Failed to fetch coupons")
    return res.json()
  },

  createCoupon: async (token, data) => {
    const res = await fetch(`${API_URL}/admin/coupons`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(data)
    })
    if (!res.ok) throw new Error((await res.json()).error || "Failed to create coupon")
    const payload = await res.json()
    emitDataSync(["coupons", "admin"])
    return payload
  },

  updateCoupon: async (token, id, data) => {
    const res = await fetch(`${API_URL}/admin/coupons/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(data)
    })
    if (!res.ok) throw new Error((await res.json()).error || "Failed to update coupon")
    const payload = await res.json()
    emitDataSync(["coupons", "admin"])
    return payload
  },

  deleteCoupon: async (token, id) => {
    const res = await fetch(`${API_URL}/admin/coupons/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error("Failed to delete coupon")
    const payload = await res.json()
    emitDataSync(["coupons", "admin"])
    return payload
  },

  // Ads
  getCoinsPageAds: async () => {
    const res = await fetch(`${API_URL}/ads/coins`)
    if (!res.ok) throw new Error("Failed to fetch ads")
    return res.json()
  },

  // Payment settings (UPI)
  getPaymentSettings: async () => {
    const res = await fetch(`${API_URL}/settings/payment`)
    if (!res.ok) return { upiId: null, upiName: null }
    const json = await res.json()
    // API wraps data in { success, message, data: {...} }
    return json.data || json
  },

  // Tickets
  createTicket: async (token, data, imageFile) => {
    const formData = new FormData()
    formData.append("category", data.category)
    formData.append("subject", data.subject)
    formData.append("message", data.message)
    if (data.priority) formData.append("priority", data.priority)
    if (imageFile) formData.append("image", imageFile)

    const res = await fetch(`${API_URL}/tickets`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    })
    if (!res.ok) throw new Error((await res.json()).error || "Failed to create ticket")
    const payload = await res.json()
    emitDataSync(["tickets", "support"])
    return payload
  },

  getMyTickets: async (token, options = {}) => {
    const res = await fetchWithTimeout(`${API_URL}/tickets/my`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: options.signal,
      timeoutMs: options.timeoutMs
    })
    if (!res.ok) throw new Error("Failed to fetch tickets")
    return res.json()
  },

  getTicket: async (token, ticketId, options = {}) => {
    const res = await fetchWithTimeout(`${API_URL}/tickets/${ticketId}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: options.signal,
      timeoutMs: options.timeoutMs
    })
    if (!res.ok) throw new Error("Failed to fetch ticket")
    return res.json()
  },

  replyToTicket: async (token, ticketId, message, imageFile) => {
    const formData = new FormData()
    formData.append("message", message)
    if (imageFile) formData.append("image", imageFile)

    const res = await fetch(`${API_URL}/tickets/${ticketId}/reply`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    })
    if (!res.ok) throw new Error((await res.json()).error || "Failed to send reply")
    emitDataSync(["tickets", "support"])
    return res.json()
  },

  // Admin Tickets
  getAllTickets: async (token, status, options = {}) => {
    const url = status ? `${API_URL}/admin/tickets?status=${status}` : `${API_URL}/admin/tickets`
    const res = await fetchWithTimeout(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: options.signal,
      timeoutMs: options.timeoutMs
    })
    if (!res.ok) throw new Error("Failed to fetch tickets")
    return res.json()
  },

  getAdminTicket: async (token, ticketId, options = {}) => {
    const res = await fetchWithTimeout(`${API_URL}/admin/tickets/${ticketId}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: options.signal,
      timeoutMs: options.timeoutMs
    })
    if (!res.ok) throw new Error("Failed to fetch ticket")
    return res.json()
  },

  adminReplyToTicket: async (token, ticketId, message, imageFile) => {
    const formData = new FormData()
    formData.append("message", message)
    if (imageFile) formData.append("image", imageFile)

    const res = await fetch(`${API_URL}/admin/tickets/${ticketId}/reply`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    })
    if (!res.ok) throw new Error((await res.json()).error || "Failed to send reply")
    emitDataSync(["tickets", "support", "admin"])
    return res.json()
  },

  updateTicketStatus: async (token, ticketId, status) => {
    const res = await fetch(`${API_URL}/admin/tickets/${ticketId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ status })
    })
    if (!res.ok) throw new Error("Failed to update ticket status")
    emitDataSync(["tickets", "support", "admin"])
    return res.json()
  },

  deleteTicket: async (token, ticketId) => {
    const res = await fetch(`${API_URL}/admin/tickets/${ticketId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error("Failed to delete ticket")
    const payload = await res.json()
    emitDataSync(["tickets", "support", "admin"])
    return payload
  },

  // ─── Frontpage (public) ───────────────────────────────────────────────────

  getFrontpage: async () => {
    const res = await fetch(`${API_URL}/frontpage`)
    if (!res.ok) throw new Error("Failed to fetch frontpage content")
    return res.json()
  },

  getLandingPlans: async () => {
    const res = await fetch(`${API_URL}/frontpage/landing-plans`)
    if (!res.ok) throw new Error("Failed to fetch landing plans")
    return res.json()
  },

  getStats: async () => {
    const res = await fetch(`${API_URL}/stats`)
    if (!res.ok) throw new Error("Failed to fetch stats")
    return res.json()
  },

  // ─── Admin: Frontpage editor ──────────────────────────────────────────────

  getAdminFrontpage: async () => {
    const token = localStorage.getItem("token")
    const res = await fetch(`${API_URL}/admin/frontpage`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error("Failed to fetch frontpage content")
    return res.json()
  },

  updateFrontpageSection: async (section, content) => {
    const token = localStorage.getItem("token")
    const res = await fetch(`${API_URL}/admin/frontpage/${section}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ content })
    })
    if (!res.ok) throw new Error((await res.json()).error || "Failed to update section")
    const payload = await res.json()
    emitDataSync(["frontpage", "admin"])
    return payload
  },

  // ─── Admin: Landing Plans ─────────────────────────────────────────────────

  getAdminLandingPlans: async () => {
    const token = localStorage.getItem("token")
    const res = await fetch(`${API_URL}/admin/frontpage/landing-plans`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error("Failed to fetch landing plans")
    return res.json()
  },

  createLandingPlan: async (planData) => {
    const token = localStorage.getItem("token")
    const res = await fetch(`${API_URL}/admin/frontpage/landing-plans`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(planData)
    })
    if (!res.ok) throw new Error((await res.json()).error || "Failed to create plan")
    const data = await res.json()
    emitDataSync(["plans", "frontpage", "admin"])
    return data
  },

  updateLandingPlan: async (id, planData) => {
    const token = localStorage.getItem("token")
    const res = await fetch(`${API_URL}/admin/frontpage/landing-plans/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(planData)
    })
    if (!res.ok) throw new Error((await res.json()).error || "Failed to update plan")
    const data = await res.json()
    emitDataSync(["plans", "frontpage", "admin"])
    return data
  },

  deleteLandingPlan: async (id) => {
    const token = localStorage.getItem("token")
    const res = await fetch(`${API_URL}/admin/frontpage/landing-plans/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error((await res.json()).error || "Failed to delete plan")
    const data = await res.json()
    emitDataSync(["plans", "frontpage", "admin"])
    return data
  },

  toggleLandingPlanActive: async (id) => {
    const token = localStorage.getItem("token")
    const res = await fetch(`${API_URL}/admin/frontpage/landing-plans/${id}/toggle-active`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error("Failed to toggle plan status")
    const data = await res.json()
    emitDataSync(["plans", "frontpage", "admin"])
    return data
  },

  toggleLandingPlanPopular: async (id) => {
    const token = localStorage.getItem("token")
    const res = await fetch(`${API_URL}/admin/frontpage/landing-plans/${id}/toggle-popular`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error("Failed to toggle popular status")
    const data = await res.json()
    emitDataSync(["plans", "frontpage", "admin"])
    return data
  },

  // ─── Site Settings (public) ───────────────────────────────────────────────

  getSiteSettings: async () => {
    const res = await fetch(`${API_URL}/settings/site`)
    if (!res.ok) return null
    const json = await res.json()
    return json.data || json
  },

  // ─── Admin: Site Settings ─────────────────────────────────────────────────

  updateSiteSettings: async (payload) => {
    const token = localStorage.getItem("token")
    const res = await fetch(`${API_URL}/admin/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    })
    if (!res.ok) throw new Error((await res.json()).message || "Failed to update settings")
    const data = await res.json()
    emitDataSync(["site-settings", "admin", "frontpage"])
    return data
  },

  uploadBackgroundImage: async (file) => {
    const token = localStorage.getItem("token")
    const formData = new FormData()
    formData.append("background", file)

    const res = await fetch(`${API_URL}/admin/settings/background-image`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    })
    if (!res.ok) throw new Error((await res.json()).message || "Upload failed")
    const data = await res.json()
    emitDataSync(["site-settings", "admin", "frontpage"])
    return data
  },

  uploadFavicon: async (file) => {
    const token = localStorage.getItem("token")
    const formData = new FormData()
    formData.append("favicon", file)

    const res = await fetch(`${API_URL}/admin/settings/favicon`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    })
    if (!res.ok) throw new Error((await res.json()).message || "Upload failed")
    const data = await res.json()
    emitDataSync(["site-settings", "admin", "frontpage"])
    return data
  },

  uploadLogo: async (file) => {
    const token = localStorage.getItem("token")
    const formData = new FormData()
    formData.append("logo", file)

    const res = await fetch(`${API_URL}/admin/settings/logo`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    })
    if (!res.ok) throw new Error((await res.json()).message || "Upload failed")
    const data = await res.json()
    emitDataSync(["site-settings", "admin", "frontpage"])
    return data
  },

  // ─── Auth: Reset Password ─────────────────────────────────────────────────

  resetPassword: async (currentPassword, newPassword) => {
    const token = localStorage.getItem("token")
    const res = await fetch(`${API_URL}/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ currentPassword, newPassword })
    })
    if (!res.ok) throw new Error((await res.json()).message || "Password reset failed")
    return res.json()
  },

  // ─── Server Management ────────────────────────────────────────────────────

  getServerManage: async (token, serverId) => {
    const res = await fetch(`${API_URL}/servers/${serverId}/manage`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error((await res.json()).error || "Failed to load server")
    return res.json()
  },

  serverPower: async (token, serverId, signal) => {
    const res = await fetch(`${API_URL}/servers/${serverId}/power`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ signal })
    })
    if (!res.ok) throw new Error((await res.json()).error || "Power action failed")
    return res.json()
  },

  serverAcceptEula: async (token, serverId) => {
    const res = await fetch(`${API_URL}/servers/${serverId}/eula`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error((await res.json()).error || "Failed to accept EULA")
    return res.json()
  },

  serverSendCommand: async (token, serverId, command) => {
    const res = await fetch(`${API_URL}/servers/${serverId}/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ command })
    })
    if (!res.ok) throw new Error((await res.json()).error || "Command failed")
    return res.json()
  },

  // Files
  serverListFiles: async (token, serverId, path = "/") => {
    const res = await fetch(`${API_URL}/servers/${serverId}/files?path=${encodeURIComponent(path)}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error((await res.json()).error || "Failed to list files")
    return res.json()
  },

  serverGetFile: async (token, serverId, path) => {
    const res = await fetch(`${API_URL}/servers/${serverId}/file?path=${encodeURIComponent(path)}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error("Failed to read file")
    return res.text()
  },

  serverWriteFile: async (token, serverId, path, content) => {
    const res = await fetch(`${API_URL}/servers/${serverId}/file/write`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ path, content })
    })
    if (!res.ok) throw new Error((await res.json()).error || "Failed to save file")
    return res.json()
  },

  serverDeleteFiles: async (token, serverId, root, files) => {
    const res = await fetch(`${API_URL}/servers/${serverId}/file/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ root, files })
    })
    if (!res.ok) throw new Error((await res.json()).error || "Failed to delete")
    return res.json()
  },

  serverCreateFolder: async (token, serverId, root, name) => {
    const res = await fetch(`${API_URL}/servers/${serverId}/file/create-folder`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ root, name })
    })
    if (!res.ok) throw new Error((await res.json()).error || "Failed to create folder")
    return res.json()
  },

  // Bot ZIP upload + extract
  serverUploadBot: async (token, serverId, file, _onProgress) => {
    const formData = new FormData()
    formData.append("file", file)
    const res = await fetch(`${API_URL}/servers/${serverId}/bot/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    })
    if (!res.ok) throw new Error((await res.json()).error || "Bot upload failed")
    return res.json()
  },

  // Single file upload to a directory
  serverUploadFile: async (token, serverId, file, directory = "/") => {
    const formData = new FormData()
    formData.append("file", file)
    formData.append("directory", directory)
    const res = await fetch(`${API_URL}/servers/${serverId}/file/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    })
    if (!res.ok) throw new Error((await res.json()).error || "Upload failed")
    return res.json()
  },

  // Properties
  serverGetProperties: async (token, serverId) => {
    const res = await fetch(`${API_URL}/servers/${serverId}/properties`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error((await res.json()).error || "Failed to load properties")
    return res.json()
  },

  serverSaveProperties: async (token, serverId, content) => {
    const res = await fetch(`${API_URL}/servers/${serverId}/properties`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ content })
    })
    if (!res.ok) throw new Error((await res.json()).error || "Failed to save properties")
    return res.json()
  },

  // World
  serverWorldDelete: async (token, serverId, worldName) => {
    const res = await fetch(`${API_URL}/servers/${serverId}/world/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ world_name: worldName })
    })
    if (!res.ok) throw new Error((await res.json()).error || "Failed to delete world")
    return res.json()
  },

  serverWorldReset: async (token, serverId, worldName) => {
    const res = await fetch(`${API_URL}/servers/${serverId}/world/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ world_name: worldName })
    })
    if (!res.ok) throw new Error((await res.json()).error || "Failed to reset world")
    return res.json()
  },

  // Plugins & Mods
  serverGetSources: async (token, serverId) => {
    const res = await fetch(`${API_URL}/servers/${serverId}/plugins/sources`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) return { modrinth: true, curseforge: false }
    return res.json()
  },

  serverSearchPlugins: async (token, serverId, q, { type = "plugin", source = "all", offset = 0, limit = 15 } = {}) => {
    const params = new URLSearchParams({ q, type, source, offset: String(offset), limit: String(limit) })
    const res = await fetch(`${API_URL}/servers/${serverId}/plugins/search?${params}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error("Search failed")
    return res.json()
  },

  serverGetPluginVersions: async (token, serverId, slug) => {
    const res = await fetch(`${API_URL}/servers/${serverId}/plugins/${slug}/versions`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error("Failed to fetch versions")
    return res.json()
  },

  serverGetCurseForgeVersions: async (token, serverId, projectId) => {
    const res = await fetch(`${API_URL}/servers/${serverId}/plugins/curseforge/${projectId}/versions`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error("Failed to fetch versions")
    return res.json()
  },

  serverInstallPlugin: async (token, serverId, { source, slug, projectId, fileId, versionId, type }) => {
    const res = await fetch(`${API_URL}/servers/${serverId}/plugins/install`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ source, slug, projectId, fileId, versionId, type })
    })
    if (!res.ok) throw new Error((await res.json()).error || "Installation failed")
    return res.json()
  },

  serverListPlugins: async (token, serverId, type = "plugin") => {
    const res = await fetch(`${API_URL}/servers/${serverId}/plugins?type=${type}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error("Failed to list plugins")
    return res.json()
  },

  serverDeletePlugin: async (token, serverId, filename, type = "plugin") => {
    const res = await fetch(`${API_URL}/servers/${serverId}/plugins/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ filename, type })
    })
    if (!res.ok) throw new Error((await res.json()).error || "Failed to remove plugin")
    return res.json()
  },

  // Version
  serverChangeVersion: async (token, serverId, version) => {
    const res = await fetch(`${API_URL}/servers/${serverId}/version`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ version })
    })
    if (!res.ok) throw new Error((await res.json()).error || "Version change failed")
    return res.json()
  },

  // Settings
  serverGetSettings: async (token, serverId) => {
    const res = await fetch(`${API_URL}/servers/${serverId}/settings`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error((await res.json()).error || "Failed to load settings")
    return res.json()
  },

  serverUpdateStartupVar: async (token, serverId, key, value) => {
    const res = await fetch(`${API_URL}/servers/${serverId}/startup`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ key, value })
    })
    if (!res.ok) throw new Error((await res.json()).error || "Failed to update startup variable")
    return res.json()
  },

  // Players
  serverGetOnlinePlayers: async (token, serverId) => {
    const res = await fetch(`${API_URL}/servers/${serverId}/players/online`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error("Failed to get players")
    return res.json()
  },

  serverPlayerAction: async (token, serverId, action, player, args) => {
    const res = await fetch(`${API_URL}/servers/${serverId}/players`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, player, args })
    })
    if (!res.ok) throw new Error((await res.json()).error || "Action failed")
    return res.json()
  },

  // Backups
  serverListBackups: async (token, serverId) => {
    const res = await fetch(`${API_URL}/servers/${serverId}/backups`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error((await res.json()).error || "Failed to list backups")
    return res.json()
  },

  serverCreateBackup: async (token, serverId, name = null) => {
    const res = await fetch(`${API_URL}/servers/${serverId}/backups`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name })
    })
    if (!res.ok) throw new Error((await res.json()).error || "Failed to create backup")
    return res.json()
  },

  serverDeleteBackup: async (token, serverId, backupUuid) => {
    const res = await fetch(`${API_URL}/servers/${serverId}/backups/${backupUuid}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error((await res.json()).error || "Failed to delete backup")
    return res.json()
  },

  serverRestoreBackup: async (token, serverId, backupUuid) => {
    const res = await fetch(`${API_URL}/servers/${serverId}/backups/${backupUuid}/restore`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error((await res.json()).error || "Failed to restore backup")
    return res.json()
  },

  serverDownloadBackup: async (token, serverId, backupUuid) => {
    const res = await fetch(`${API_URL}/servers/${serverId}/backups/${backupUuid}/download`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error((await res.json()).error || "Failed to get download URL")
    const data = await res.json()
    return data.url
  }
}
export default api