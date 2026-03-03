// Smart API URL detection for development and Codespaces
function getApiUrl() {
  // If explicitly set via .env, use that
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
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
  if (import.meta.env.VITE_API_URL) {
    // Strip trailing /api if present
    return import.meta.env.VITE_API_URL.replace(/\/api$/, "")
  }
  if (window.location.hostname.includes("app.github.dev")) {
    return window.location.origin.replace("-5173.", "-4000.")
  }
  return "http://localhost:4000"
}

const API_URL = getApiUrl()

export const api = {
  // Auth
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
  getCoinPlans: async () => {
    const res = await fetch(`${API_URL}/plans/coin`)
    if (!res.ok) throw new Error("Failed to fetch coin plans")
    return res.json()
  },

  getRealPlans: async () => {
    const res = await fetch(`${API_URL}/plans/real`)
    if (!res.ok) throw new Error("Failed to fetch real plans")
    return res.json()
  },

  getAvailableEggs: async (token) => {
    const res = await fetch(`${API_URL}/plans/eggs`, {
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

  getUserServers: async (token) => {
    const res = await fetch(`${API_URL}/servers`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error("Failed to fetch servers")
    return res.json()
  },

  purchaseServer: async (token, planType, planId, serverName, nodeId, locationName, software = "minecraft", eggId = null) => {
    const res = await fetch(`${API_URL}/servers/purchase`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        plan_type: planType,
        plan_id: planId,
        server_name: serverName,
        node_id: nodeId || undefined,
        location: locationName || "",
        software: software,
        egg_id: eggId || undefined
      })
    })
    if (!res.ok) throw new Error((await res.json()).error || "Purchase failed")
    return res.json()
  },

  renewServer: async (token, serverId) => {
    const res = await fetch(`${API_URL}/servers/renew`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ server_id: serverId })
    })
    if (!res.ok) throw new Error((await res.json()).error || "Renewal failed")
    return res.json()
  },

  // Coins
  getBalance: async (token) => {
    const res = await fetch(`${API_URL}/coins/balance`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error("Failed to fetch balance")
    return res.json()
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
    return res.json()
  },

  getUTRSubmissions: async (token) => {
    const res = await fetch(`${API_URL}/billing/utr`, {
      headers: { Authorization: `Bearer ${token}` }
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

  getUTRSubmissionsAdmin: async (token) => {
    const res = await fetch(`${API_URL}/admin/utr`, {
      headers: { Authorization: `Bearer ${token}` }
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
    return res.json()
  },

  rejectUTR: async (token, submissionId) => {
    const res = await fetch(`${API_URL}/admin/utr/${submissionId}/reject`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error("Failed to reject UTR")
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
    return res.json()
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
    return res.json()
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
    return res.json()
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
    return res.json()
  },

  deleteCoinPlan: async (token, planId) => {
    const res = await fetch(`${API_URL}/admin/plans/coin/${planId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error("Failed to delete coin plan")
    return res.json()
  },

  deleteRealPlan: async (token, planId) => {
    const res = await fetch(`${API_URL}/admin/plans/real/${planId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error("Failed to delete real plan")
    return res.json()
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
    return res.json()
  },

  updateCoupon: async (token, id, data) => {
    const res = await fetch(`${API_URL}/admin/coupons/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(data)
    })
    if (!res.ok) throw new Error((await res.json()).error || "Failed to update coupon")
    return res.json()
  },

  deleteCoupon: async (token, id) => {
    const res = await fetch(`${API_URL}/admin/coupons/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error("Failed to delete coupon")
    return res.json()
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
    return res.json()
  },

  getMyTickets: async (token) => {
    const res = await fetch(`${API_URL}/tickets/my`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error("Failed to fetch tickets")
    return res.json()
  },

  getTicket: async (token, ticketId) => {
    const res = await fetch(`${API_URL}/tickets/${ticketId}`, {
      headers: { Authorization: `Bearer ${token}` }
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
    return res.json()
  },

  // Admin Tickets
  getAllTickets: async (token, status) => {
    const url = status ? `${API_URL}/admin/tickets?status=${status}` : `${API_URL}/admin/tickets`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error("Failed to fetch tickets")
    return res.json()
  },

  getAdminTicket: async (token, ticketId) => {
    const res = await fetch(`${API_URL}/admin/tickets/${ticketId}`, {
      headers: { Authorization: `Bearer ${token}` }
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
    return res.json()
  },

  deleteTicket: async (token, ticketId) => {
    const res = await fetch(`${API_URL}/admin/tickets/${ticketId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error("Failed to delete ticket")
    return res.json()
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
    return res.json()
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
    return res.json()
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
    return res.json()
  },

  deleteLandingPlan: async (id) => {
    const token = localStorage.getItem("token")
    const res = await fetch(`${API_URL}/admin/frontpage/landing-plans/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error((await res.json()).error || "Failed to delete plan")
    return res.json()
  },

  toggleLandingPlanActive: async (id) => {
    const token = localStorage.getItem("token")
    const res = await fetch(`${API_URL}/admin/frontpage/landing-plans/${id}/toggle-active`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error("Failed to toggle plan status")
    return res.json()
  },

  toggleLandingPlanPopular: async (id) => {
    const token = localStorage.getItem("token")
    const res = await fetch(`${API_URL}/admin/frontpage/landing-plans/${id}/toggle-popular`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error("Failed to toggle popular status")
    return res.json()
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
    return res.json()
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
    return res.json()
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
    return res.json()
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
    return res.json()
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