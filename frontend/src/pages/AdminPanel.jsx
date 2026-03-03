import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import AdminNav from "../components/AdminNav.jsx"
import SectionHeader from "../components/SectionHeader.jsx"
import Badge from "../components/Badge.jsx"
import ConfirmModal from "../components/ConfirmModal.jsx"
import { useAppUI } from "../context/AppUIContext.jsx"
import { api } from "../services/api.js"
import {
  Package,
  Server,
  Cpu,
  HardDrive,
  Zap,
  Sparkles,
  Star,
  Crown,
  Shield,
  Rocket,
  Gift,
  Gem,
  Trophy,
  Diamond,
  Circle,
  Plus,
  Edit2,
  Trash2,
  X
} from "lucide-react"

// Icon mapping for dynamic rendering
const iconMap = {
  Package,
  Server,
  Cpu,
  HardDrive,
  Zap,
  Sparkles,
  Star,
  Crown,
  Shield,
  Rocket,
  Gift,
  Gem,
  Trophy,
  Diamond,
  Circle
}

export default function AdminPanel() {
  const [users, setUsers] = useState([])
  const [servers, setServers] = useState([])
  const [utrs, setUtrs] = useState([])
  const [coinPlans, setCoinPlans] = useState([])
  const [realPlans, setRealPlans] = useState([])
  const [coupons, setCoupons] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [flagging, setFlagging] = useState({})
  const [changingRole, setChangingRole] = useState({})
  const [approving, setApproving] = useState({})
  const [suspending, setSuspending] = useState({})
  const [deleting, setDeleting] = useState({})
  const [deletingPlan, setDeletingPlan] = useState(false)
  const [deletingUser, setDeletingUser] = useState({})
  const [planModal, setPlanModal] = useState({ open: false, type: null, mode: 'create', data: null })
  const [planForm, setPlanForm] = useState({})
  const [savingPlan, setSavingPlan] = useState(false)
  const [deleteModal, setDeleteModal] = useState({ open: false, type: null, id: null })
  const [couponModal, setCouponModal] = useState({ open: false, mode: 'create', data: null })
  const [couponForm, setCouponForm] = useState({})
  const [savingCoupon, setSavingCoupon] = useState(false)
  const [deletingCoupon, setDeletingCoupon] = useState({})
  // Confirm modals state
  const [confirmModal, setConfirmModal] = useState({ open: false, title: "", message: "", detail: "", onConfirm: null, loading: false })
  const navigate = useNavigate()
  const { showSuccess, showError } = useAppUI()

  const openConfirm = (opts) => setConfirmModal({ open: true, loading: false, ...opts })
  const closeConfirm = () => setConfirmModal({ open: false, title: "", message: "", detail: "", onConfirm: null, loading: false })

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) {
      navigate("/login")
      return
    }

    const loadAdminData = async () => {
      try {
        const [usersData, serversData, utrsData, coinPlansData, realPlansData, couponsData] = await Promise.all([
          api.getUsers(token),
          api.getServers(token),
          api.getUTRSubmissionsAdmin(token),
          api.getCoinPlans(),
          api.getRealPlans(),
          api.getCoupons(token)
        ])

        setUsers(usersData || [])
        setServers(serversData || [])
        setUtrs(utrsData || [])
        setCoinPlans(coinPlansData || [])
        setRealPlans(realPlansData || [])
        setCoupons(couponsData || [])
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadAdminData()
  }, [navigate])

  const handleFlagUser = async (userId, currentlyFlagged) => {
    setFlagging((prev) => ({ ...prev, [userId]: true }))
    setError("")

    try {
      const token = localStorage.getItem("token")
      await api.flagUser(token, userId, !currentlyFlagged)

      // Refresh users
      const data = await api.getUsers(token)
      setUsers(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setFlagging((prev) => ({ ...prev, [userId]: false }))
    }
  }

  const handleChangeRole = async (userId, currentRole, userEmail) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin'
    const action = newRole === 'admin' ? 'Promote' : 'Demote'
    
    openConfirm({
      title: `${action} User`,
      message: `${action} "${userEmail}" to ${newRole}?`,
      detail: newRole === 'admin' 
        ? "Admin users have full access to the admin panel and can manage all resources."
        : "This will remove admin privileges from this user.",
      confirmLabel: `${action} to ${newRole.charAt(0).toUpperCase() + newRole.slice(1)}`,
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, loading: true }))
        setChangingRole((prev) => ({ ...prev, [userId]: true }))
        try {
          const token = localStorage.getItem("token")
          await api.changeUserRole(token, userId, newRole)
          
          // Refresh users
          const data = await api.getUsers(token)
          setUsers(data || [])
          showSuccess(`User "${userEmail}" ${action.toLowerCase()}d to ${newRole}`)
          closeConfirm()
        } catch (err) {
          showError(err.message || `Failed to ${action.toLowerCase()} user`)
          setConfirmModal((prev) => ({ ...prev, loading: false }))
        } finally {
          setChangingRole((prev) => ({ ...prev, [userId]: false }))
        }
      }
    })
  }

  const handleDeleteUser = async (userId, userEmail) => {
    openConfirm({
      title: "Delete User",
      message: `Permanently delete "${userEmail}"?`,
      detail: "This removes all their servers, tickets, and data. Cannot be undone.",
      confirmLabel: "Delete User",
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, loading: true }))
        setDeletingUser((prev) => ({ ...prev, [userId]: true }))
        try {
          const token = localStorage.getItem("token")
          await api.deleteUser(token, userId)
          setUsers((prev) => prev.filter((u) => u.id !== userId))
          showSuccess(`User "${userEmail}" deleted`)
          closeConfirm()
        } catch (err) {
          showError(err.message || "Failed to delete user")
          setConfirmModal((prev) => ({ ...prev, loading: false }))
        } finally {
          setDeletingUser((prev) => ({ ...prev, [userId]: false }))
        }
      }
    })
  }

  const handleSuspendServer = async (serverId) => {
    setSuspending((prev) => ({ ...prev, [serverId]: true }))
    setError("")

    try {
      const token = localStorage.getItem("token")
      await api.suspendServer(token, serverId)

      // Refresh servers
      const data = await api.getServers(token)
      setServers(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setSuspending((prev) => ({ ...prev, [serverId]: false }))
    }
  }

  const handleDeleteServer = async (serverId) => {
    openConfirm({
      title: "Delete Server",
      message: "Permanently delete this server?",
      detail: "The Pterodactyl server will be removed. This action cannot be undone.",
      confirmLabel: "Delete Server",
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, loading: true }))
        setDeleting((prev) => ({ ...prev, [serverId]: true }))
        try {
          const token = localStorage.getItem("token")
          await api.deleteServer(token, serverId)
          const data = await api.getServers(token)
          setServers(data || [])
          showSuccess("Server deleted")
          closeConfirm()
        } catch (err) {
          showError(err.message || "Failed to delete server")
          setConfirmModal((prev) => ({ ...prev, loading: false }))
        } finally {
          setDeleting((prev) => ({ ...prev, [serverId]: false }))
        }
      }
    })
  }

  const openPlanModal = (type, mode, data = null) => {
    if (mode === 'edit' && data) {
      setPlanForm(data)
    } else {
      setPlanForm({
        name: '',
        icon: type === 'coin' ? 'Package' : 'Server',
        ram: '',
        cpu: '',
        storage: '',
        [type === 'coin' ? 'coin_price' : 'price']: '',
        duration_type: 'days',
        duration_days: '',
        limited_stock: false,
        stock_amount: '',
        one_time_purchase: false
      })
    }
    setPlanModal({ open: true, type, mode, data })
  }

  const closePlanModal = () => {
    setPlanModal({ open: false, type: null, mode: 'create', data: null })
    setPlanForm({})
    setError("")
  }

  const handleSavePlan = async (e) => {
    e.preventDefault()
    setSavingPlan(true)
    setError("")

    try {
      const token = localStorage.getItem("token")
      const { type, mode, data } = planModal

      // Prepare plan data (RAM and Storage are in GB)
      const planData = {
        name: planForm.name,
        icon: planForm.icon || (type === 'coin' ? 'Package' : 'Server'),
        ram: parseInt(planForm.ram),
        cpu: parseInt(planForm.cpu),
        storage: parseInt(planForm.storage),
        [type === 'coin' ? 'coin_price' : 'price']: parseFloat(planForm[type === 'coin' ? 'coin_price' : 'price']),
        duration_type: planForm.duration_type,
        duration_days: parseInt(planForm.duration_days),
        limited_stock: Boolean(planForm.limited_stock),
        stock_amount: planForm.limited_stock ? parseInt(planForm.stock_amount) : null
      }

      // For coin plans, add one_time_purchase
      if (type === 'coin') {
        planData.one_time_purchase = Boolean(planForm.one_time_purchase)
      }

      if (mode === 'create') {
        if (type === 'coin') {
          await api.createCoinPlan(token, planData)
        } else {
          await api.createRealPlan(token, planData)
        }
      } else {
        if (type === 'coin') {
          await api.updateCoinPlan(token, data.id, planData)
        } else {
          await api.updateRealPlan(token, data.id, planData)
        }
      }

      // Refresh plans
      const [coinData, realData] = await Promise.all([
        api.getCoinPlans(),
        api.getRealPlans()
      ])
      setCoinPlans(coinData || [])
      setRealPlans(realData || [])

      closePlanModal()
    } catch (err) {
      console.error("[ADMIN] Error saving plan:", err)
      setError(err.message)
    } finally {
      setSavingPlan(false)
    }
  }

  const handleDeletePlan = async () => {
    setDeletingPlan(true)
    setError("")

    try {
      const token = localStorage.getItem("token")
      const { type, id } = deleteModal

      if (type === 'coin') {
        await api.deleteCoinPlan(token, id)
      } else {
        await api.deleteRealPlan(token, id)
      }

      // Refresh plans
      const [coinData, realData] = await Promise.all([
        api.getCoinPlans(),
        api.getRealPlans()
      ])
      setCoinPlans(coinData || [])
      setRealPlans(realData || [])

      setDeleteModal({ open: false, type: null, id: null })
    } catch (err) {
      setError(err.message)
    } finally {
      setDeletingPlan(false)
    }
  }

  // ── Coupon handlers ────────────────────────────────────────────────────────

  const openCouponModal = (mode, data = null) => {
    if (mode === 'edit' && data) {
      setCouponForm({
        ...data,
        // Format datetime-local compatible string from stored value
        expires_at: data.expires_at ? data.expires_at.slice(0, 16) : ''
      })
    } else {
      // Default expiry: 7 days from now
      const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      const defaultExpiry = d.toISOString().slice(0, 16)
      setCouponForm({ code: '', coin_reward: '', max_uses: '', per_user_limit: 1, expires_at: defaultExpiry, active: true })
    }
    setCouponModal({ open: true, mode, data })
  }

  const closeCouponModal = () => {
    setCouponModal({ open: false, mode: 'create', data: null })
    setCouponForm({})
    setError("")
  }

  const handleSaveCoupon = async (e) => {
    e.preventDefault()
    setSavingCoupon(true)
    setError("")
    try {
      const token = localStorage.getItem("token")
      const payload = {
        code: couponForm.code.toUpperCase().trim(),
        coin_reward: parseInt(couponForm.coin_reward),
        max_uses: parseInt(couponForm.max_uses),
        per_user_limit: parseInt(couponForm.per_user_limit) || 1,
        expires_at: couponForm.expires_at,
        active: Boolean(couponForm.active)
      }
      if (couponModal.mode === 'create') {
        await api.createCoupon(token, payload)
      } else {
        await api.updateCoupon(token, couponModal.data.id, payload)
      }
      setCoupons(await api.getCoupons(token))
      closeCouponModal()
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingCoupon(false)
    }
  }

  const handleDeleteCoupon = async (id) => {
    openConfirm({
      title: "Delete Coupon",
      message: "Delete this coupon code?",
      detail: "Users will no longer be able to redeem it.",
      confirmLabel: "Delete Coupon",
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, loading: true }))
        setDeletingCoupon((prev) => ({ ...prev, [id]: true }))
        try {
          const token = localStorage.getItem("token")
          await api.deleteCoupon(token, id)
          setCoupons((prev) => prev.filter((c) => c.id !== id))
          showSuccess("Coupon deleted")
          closeConfirm()
        } catch (err) {
          showError(err.message || "Failed to delete coupon")
          setConfirmModal((prev) => ({ ...prev, loading: false }))
        } finally {
          setDeletingCoupon((prev) => ({ ...prev, [id]: false }))
        }
      }
    })
  }

  const handleApproveUTR = async (utrId) => {
    setApproving((prev) => ({ ...prev, [`approve-${utrId}`]: true }))
    setError("")

    try {
      const token = localStorage.getItem("token")
      await api.approveUTR(token, utrId)

      // Refresh UTRs
      const data = await api.getUTRSubmissionsAdmin(token)
      setUtrs(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setApproving((prev) => ({ ...prev, [`approve-${utrId}`]: false }))
    }
  }

  const handleRejectUTR = async (utrId) => {
    setApproving((prev) => ({ ...prev, [`reject-${utrId}`]: true }))
    setError("")

    try {
      const token = localStorage.getItem("token")
      await api.rejectUTR(token, utrId)

      // Refresh UTRs
      const data = await api.getUTRSubmissionsAdmin(token)
      setUtrs(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setApproving((prev) => ({ ...prev, [`reject-${utrId}`]: false }))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-slate-400">Loading admin data...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark-950">
      <AdminNav />
      <div className="max-w-7xl mx-auto p-6 space-y-8">
      <SectionHeader
        title="Admin Overview"
        subtitle="Monitor users, plans, coupons, and server lifecycle." />

      {error && (
        <div className="rounded-lg bg-red-900/20 border border-red-700/30 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Users Section */}
      <div className="rounded-2xl border border-slate-800/60 bg-ink-900/70 p-6">
        <h2 className="text-base font-semibold text-slate-200 mb-3 flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-aurora-400 inline-block" /> Users ({users.length})</h2>
          <div className="space-y-3">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-800/60 bg-ink-950/60 px-4 py-3"
              >
                <div className="flex-1 min-w-0 space-y-0.5">
                  <p className="font-semibold text-slate-100 truncate">{user.email}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                    <span>ID: {user.id}</span>
                    <span className="capitalize">{user.role}</span>
                    <span>{user.coins ?? 0} coins</span>
                    {user.balance > 0 && <span>₹{user.balance}</span>}
                    {user.ip_address && <span>IP: {user.ip_address}</span>}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {user.flagged && <Badge label="Flagged" tone="suspended" />}
                  {user.role === "admin" && <Badge label="Admin" tone="approved" />}
                  <button
                    onClick={() => handleChangeRole(user.id, user.role, user.email)}
                    disabled={changingRole[user.id]}
                    className={`text-xs px-2 py-1 rounded ${
                      user.role === 'admin' 
                        ? 'bg-slate-800/60 text-slate-300 hover:bg-slate-800' 
                        : 'bg-blue-900/20 text-blue-300 hover:bg-blue-900/40'
                    } disabled:opacity-60 disabled:cursor-not-allowed`}
                  >
                    {changingRole[user.id] ? "..." : user.role === 'admin' ? 'Demote' : 'Promote'}
                  </button>
                  <button
                    onClick={() => handleFlagUser(user.id, user.flagged)}
                    disabled={flagging[user.id]}
                    className="text-xs px-2 py-1 rounded bg-yellow-900/20 text-yellow-300 hover:bg-yellow-900/40 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {flagging[user.id] ? "..." : user.flagged ? "Unflag" : "Flag"}
                  </button>
                  <button
                    onClick={() => handleDeleteUser(user.id, user.email)}
                    disabled={deletingUser[user.id]}
                    className="text-xs px-2 py-1 rounded bg-red-900/20 text-red-400 hover:bg-red-900/40 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {deletingUser[user.id] ? "Deleting..." : "Remove"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

      {/* Servers Section */}
      <div className="rounded-2xl border border-slate-800/60 bg-ink-900/70 p-6">
        <h2 className="text-base font-semibold text-slate-200 mb-3 flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-neon-400 inline-block" /> Servers ({servers.length})</h2>
          <div className="space-y-3">
            {servers.map((server) => (
              <div
                key={server.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800/60 bg-ink-950/60 px-4 py-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-100">{server.name}</p>
                  <p className="text-xs text-slate-500">
                    Owner: {server.owner_email}
                    {server.location && <span className="ml-2 text-slate-600">📍 {server.location}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    label={server.status}
                    tone={
                      server.status === "active"
                        ? "approved"
                        : server.status === "suspended"
                        ? "suspended"
                        : "rejected"
                    }
                  />
                  {server.status !== "deleted" && (
                    <>
                      <button
                        onClick={() => handleSuspendServer(server.id)}
                        disabled={suspending[server.id]}
                        className="text-xs px-3 py-1 rounded bg-orange-900/20 text-orange-300 hover:bg-orange-900/40 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {suspending[server.id] ? "Suspending..." : "Suspend"}
                      </button>
                      <button
                        onClick={() => handleDeleteServer(server.id)}
                        disabled={deleting[server.id]}
                        className="text-xs px-3 py-1 rounded bg-red-900/20 text-red-300 hover:bg-red-900/40 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {deleting[server.id] ? "Deleting..." : "Delete"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

      {/* UTR Section */}
      <div className="rounded-2xl border border-slate-800/60 bg-ink-900/70 p-6">
        <h2 className="text-base font-semibold text-slate-200 mb-3 flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-amber-400 inline-block" /> UTR Submissions ({utrs.length})</h2>
          <div className="space-y-3">
            {utrs.map((utr) => (
              <div
                key={utr.id}
                className="rounded-xl border border-slate-800/60 bg-ink-950/60 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-100">
                      {utr.user_email} - ₹{utr.amount}
                    </p>
                    <p className="text-xs text-slate-500">UTR: {utr.utr_number}</p>
                  </div>
                  <Badge
                    label={utr.status}
                    tone={
                      utr.status === "approved"
                        ? "approved"
                        : utr.status === "rejected"
                        ? "rejected"
                        : "approved"
                    }
                  />
                </div>

                {utr.screenshot_url && (
                  <div className="mb-3 max-w-xs">
                    <img
                      src={utr.screenshot_url}
                      alt="UTR receipt"
                      className="rounded-lg max-h-40 object-cover border border-slate-700/40"
                    />
                  </div>
                )}

                {utr.status === "pending" && (
                  <div className="flex gap-2 pt-3 border-t border-slate-800/40">
                    <button
                      onClick={() => handleApproveUTR(utr.id)}
                      disabled={approving[`approve-${utr.id}`]}
                      className="flex-1 text-xs px-3 py-2 rounded bg-aurora-900/20 text-aurora-300 hover:bg-aurora-900/40 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {approving[`approve-${utr.id}`] ? "Approving..." : "Approve"}
                    </button>
                    <button
                      onClick={() => handleRejectUTR(utr.id)}
                      disabled={approving[`reject-${utr.id}`]}
                      className="flex-1 text-xs px-3 py-2 rounded bg-red-900/20 text-red-300 hover:bg-red-900/40 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {approving[`reject-${utr.id}`] ? "Rejecting..." : "Reject"}
                    </button>
                  </div>
                )}
              </div>
            ))}

            {utrs.length === 0 && (
              <p className="text-slate-400 text-center py-8">No submissions to review</p>
            )}
          </div>
        </div>

      {/* Plans Section */}
      <div className="space-y-6">
          {/* Coin Plans Section */}
          <div className="rounded-2xl border border-slate-800/60 bg-ink-900/70 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-100">Coin Plans</h3>
              <button
                onClick={() => openPlanModal('coin', 'create')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-aurora-900/30 hover:bg-aurora-900/50 text-aurora-200 transition-all duration-200 hover:scale-105"
              >
                <Plus size={16} />
                Add Coin Plan
              </button>
            </div>
            <div className="space-y-3">
              {coinPlans.map((plan) => {
                const IconComponent = iconMap[plan.icon] || Package
                return (
                  <div
                    key={plan.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800/60 bg-ink-950/60 px-4 py-3"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-aurora-900/20 flex items-center justify-center text-aurora-300">
                        <IconComponent size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-100">{plan.name}</p>
                        <p className="text-xs text-slate-500">
                          {plan.ram}GB RAM • {plan.cpu} CPU • {plan.storage}GB Storage
                        </p>
                        <p className="text-xs text-aurora-300 mt-1">
                          {plan.coin_price} coins • {plan.duration_days} days
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openPlanModal('coin', 'edit', plan)}
                        className="p-2 rounded bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 transition-colors"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteModal({ open: true, type: 'coin', id: plan.id })}
                        className="p-2 rounded bg-red-900/20 hover:bg-red-900/40 text-red-300 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )
              })}
              {coinPlans.length === 0 && (
                <p className="text-slate-400 text-center py-8">No coin plans yet</p>
              )}
            </div>
          </div>

          {/* Real Money Plans Section */}
          <div className="rounded-2xl border border-slate-800/60 bg-ink-900/70 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-100">Real Money Plans</h3>
              <button
                onClick={() => openPlanModal('real', 'create')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-aurora-900/30 hover:bg-aurora-900/50 text-aurora-200 transition-all duration-200 hover:scale-105"
              >
                <Plus size={16} />
                Add Real Plan
              </button>
            </div>
            <div className="space-y-3">
              {realPlans.map((plan) => {
                const IconComponent = iconMap[plan.icon] || Server
                return (
                  <div
                    key={plan.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800/60 bg-ink-950/60 px-4 py-3"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-aurora-900/20 flex items-center justify-center text-aurora-300">
                        <IconComponent size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-100">{plan.name}</p>
                        <p className="text-xs text-slate-500">
                          {plan.ram}GB RAM • {plan.cpu} CPU • {plan.storage}GB Storage
                        </p>
                        <p className="text-xs text-aurora-300 mt-1">
                          ₹{plan.price} • {plan.duration_days} days
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openPlanModal('real', 'edit', plan)}
                        className="p-2 rounded bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 transition-colors"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteModal({ open: true, type: 'real', id: plan.id })}
                        className="p-2 rounded bg-red-900/20 hover:bg-red-900/40 text-red-300 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )
              })}
              {realPlans.length === 0 && (
                <p className="text-slate-400 text-center py-8">No real money plans yet</p>
              )}
            </div>
          </div>
        </div>

      {/* Coupons Section */}
      <div className="rounded-2xl border border-slate-800/60 bg-ink-900/70 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-ember-400 inline-block" /> Coupon Codes ({coupons.length})</h2>
            <button
              onClick={() => openCouponModal('create')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-aurora-900/30 hover:bg-aurora-900/50 text-aurora-200 transition-all duration-200 hover:scale-105"
            >
              <Plus size={16} />
              New Code
            </button>
          </div>
          <div className="space-y-3">
            {coupons.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800/60 bg-ink-950/60 px-4 py-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-mono font-bold text-slate-100 tracking-widest">{c.code}</p>
                    {!c.active && <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">Inactive</span>}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    <span className="text-neon-300 font-semibold">{c.coin_reward} coins</span>
                    {" · "}
                    Uses: {c.times_used ?? 0} / {c.max_uses}
                    {" · "}
                    Per user: {c.per_user_limit}
                    {" · "}
                    Expires: {c.expires_at ? new Date(c.expires_at).toLocaleDateString() : "—"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openCouponModal('edit', c)}
                    className="p-2 rounded bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 transition-colors"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => handleDeleteCoupon(c.id)}
                    disabled={deletingCoupon[c.id]}
                    className="p-2 rounded bg-red-900/20 hover:bg-red-900/40 text-red-300 transition-colors disabled:opacity-60"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
            {coupons.length === 0 && (
              <p className="text-slate-400 text-center py-8">No coupon codes yet — create one above</p>
            )}
          </div>
        </div>

      {/* Coupon Create/Edit Modal */}
      {couponModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-800/60 bg-ink-900 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-100">
                {couponModal.mode === 'create' ? 'New Coupon Code' : 'Edit Coupon Code'}
              </h3>
              <button onClick={closeCouponModal} className="p-2 rounded-lg hover:bg-slate-800/60 text-slate-400 hover:text-slate-300">
                <X size={20} />
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded-lg bg-red-900/20 border border-red-700/30 p-3 text-sm text-red-300">{error}</div>
            )}

            <form onSubmit={handleSaveCoupon} className="space-y-4">
              {/* Code */}
              <div>
                <label htmlFor="coupon-code" className="block text-sm font-medium text-slate-300 mb-1">Code</label>
                <input
                  id="coupon-code"
                  name="code"
                  type="text"
                  value={couponForm.code || ''}
                  onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. LAUNCH50"
                  required
                  className="w-full px-4 py-2 rounded-lg border border-slate-700/50 bg-ink-950/60 text-slate-200 font-mono placeholder-slate-500 focus:outline-none focus:border-aurora-500/50"
                />
              </div>

              {/* Coins */}
              <div>
                <label htmlFor="coupon-coins" className="block text-sm font-medium text-slate-300 mb-1">Coins to Give</label>
                <input
                  id="coupon-coins"
                  name="coinReward"
                  type="number"
                  value={couponForm.coin_reward || ''}
                  onChange={(e) => setCouponForm({ ...couponForm, coin_reward: e.target.value })}
                  placeholder="500"
                  required
                  min="1"
                  className="w-full px-4 py-2 rounded-lg border border-slate-700/50 bg-ink-950/60 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-aurora-500/50"
                />
              </div>

              {/* Use limits */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="coupon-max-uses" className="block text-sm font-medium text-slate-300 mb-1">Total Use Limit</label>
                  <input
                    id="coupon-max-uses"
                    name="maxUses"
                    type="number"
                    value={couponForm.max_uses || ''}
                    onChange={(e) => setCouponForm({ ...couponForm, max_uses: e.target.value })}
                    placeholder="100"
                    required
                    min="1"
                    className="w-full px-4 py-2 rounded-lg border border-slate-700/50 bg-ink-950/60 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-aurora-500/50"
                  />
                </div>
                <div>
                  <label htmlFor="coupon-per-user" className="block text-sm font-medium text-slate-300 mb-1">Per-User Limit</label>
                  <input
                    id="coupon-per-user"
                    name="perUserLimit"
                    type="number"
                    value={couponForm.per_user_limit || 1}
                    onChange={(e) => setCouponForm({ ...couponForm, per_user_limit: e.target.value })}
                    placeholder="1"
                    required
                    min="1"
                    className="w-full px-4 py-2 rounded-lg border border-slate-700/50 bg-ink-950/60 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-aurora-500/50"
                  />
                </div>
              </div>

              {/* Expiry */}
              <div>
                <label htmlFor="coupon-expires" className="block text-sm font-medium text-slate-300 mb-1">Expiry Date &amp; Time</label>
                <input
                  id="coupon-expires"
                  name="expiresAt"
                  type="datetime-local"
                  value={couponForm.expires_at || ''}
                  onChange={(e) => setCouponForm({ ...couponForm, expires_at: e.target.value })}
                  required
                  className="w-full px-4 py-2 rounded-lg border border-slate-700/50 bg-ink-950/60 text-slate-200 focus:outline-none focus:border-aurora-500/50"
                />
              </div>

              {/* Active toggle */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(couponForm.active)}
                  onChange={(e) => setCouponForm({ ...couponForm, active: e.target.checked })}
                  className="rounded border-slate-700/50 bg-ink-950/60 text-aurora-500 focus:ring-aurora-500/50"
                />
                <span className="text-sm font-medium text-slate-300">Active (users can redeem)</span>
              </label>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={savingCoupon}
                  className="flex-1 px-6 py-3 rounded-lg bg-aurora-900/30 hover:bg-aurora-900/50 text-aurora-200 font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {savingCoupon ? 'Saving...' : couponModal.mode === 'create' ? 'Create Code' : 'Update Code'}
                </button>
                <button
                  type="button"
                  onClick={closeCouponModal}
                  disabled={savingCoupon}
                  className="px-6 py-3 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 font-semibold transition-colors disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Plan Create/Edit Modal */}
      {planModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-800/60 bg-ink-900 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-100">
                {planModal.mode === 'create' ? 'Create' : 'Edit'} {planModal.type === 'coin' ? 'Coin' : 'Real Money'} Plan
              </h3>
              <button
                onClick={closePlanModal}
                className="p-2 rounded-lg hover:bg-slate-800/60 text-slate-400 hover:text-slate-300 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded-lg bg-red-900/20 border border-red-700/30 p-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <form onSubmit={handleSavePlan} className="space-y-4">
              {/* Plan Name */}
              <div>
                <label htmlFor="plan-name" className="block text-sm font-medium text-slate-300 mb-2">
                  Plan Name
                </label>
                <input
                  id="plan-name"
                  name="planName"
                  type="text"
                  value={planForm.name || ''}
                  onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                  placeholder="e.g., Starter Plan"
                  required
                  className="w-full px-4 py-2 rounded-lg border border-slate-700/50 bg-ink-950/60 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-aurora-500/50"
                />
              </div>

              {/* Icon Picker */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Icon
                </label>
                <div className="grid grid-cols-5 sm:grid-cols-8 gap-2">
                  {Object.keys(iconMap).map((iconName) => {
                    const IconComponent = iconMap[iconName]
                    const isSelected = planForm.icon === iconName
                    return (
                      <button
                        key={iconName}
                        type="button"
                        onClick={() => setPlanForm({ ...planForm, icon: iconName })}
                        className={`p-3 rounded-lg border transition-all ${
                          isSelected
                            ? 'border-aurora-500 bg-aurora-900/30 text-aurora-300'
                            : 'border-slate-700/50 bg-ink-950/60 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                        }`}
                      >
                        <IconComponent size={20} className="mx-auto" />
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Resources Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="plan-ram" className="block text-sm font-medium text-slate-300 mb-2">
                    RAM (GB)
                  </label>
                  <input
                    id="plan-ram"
                    name="ram"
                    type="number"
                    value={planForm.ram || ''}
                    onChange={(e) => setPlanForm({ ...planForm, ram: e.target.value })}
                    placeholder="4"
                    required
                    min="1"
                    className="w-full px-4 py-2 rounded-lg border border-slate-700/50 bg-ink-950/60 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-aurora-500/50"
                  />
                </div>
                <div>
                  <label htmlFor="plan-cpu" className="block text-sm font-medium text-slate-300 mb-2">
                    CPU Cores
                  </label>
                  <input
                    id="plan-cpu"
                    name="cpu"
                    type="number"
                    value={planForm.cpu || ''}
                    onChange={(e) => setPlanForm({ ...planForm, cpu: e.target.value })}
                    placeholder="2"
                    required
                    min="1"
                    className="w-full px-4 py-2 rounded-lg border border-slate-700/50 bg-ink-950/60 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-aurora-500/50"
                  />
                </div>
                <div>
                  <label htmlFor="plan-storage" className="block text-sm font-medium text-slate-300 mb-2">
                    Storage (GB)
                  </label>
                  <input
                    id="plan-storage"
                    name="storage"
                    type="number"
                    value={planForm.storage || ''}
                    onChange={(e) => setPlanForm({ ...planForm, storage: e.target.value })}
                    placeholder="20"
                    required
                    min="1"
                    className="w-full px-4 py-2 rounded-lg border border-slate-700/50 bg-ink-950/60 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-aurora-500/50"
                  />
                </div>
              </div>

              {/* Pricing */}
              <div>
                <label htmlFor="plan-price" className="block text-sm font-medium text-slate-300 mb-2">
                  {planModal.type === 'coin' ? 'Coin Price' : 'Price (₹)'}
                </label>
                <input
                  id="plan-price"
                  name="price"
                  type="number"
                  value={planForm[planModal.type === 'coin' ? 'coin_price' : 'price'] || ''}
                  onChange={(e) =>
                    setPlanForm({
                      ...planForm,
                      [planModal.type === 'coin' ? 'coin_price' : 'price']: e.target.value
                    })
                  }
                  placeholder={planModal.type === 'coin' ? '500' : '299'}
                  required
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-2 rounded-lg border border-slate-700/50 bg-ink-950/60 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-aurora-500/50"
                />
              </div>

              {/* Duration */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="plan-duration-type" className="block text-sm font-medium text-slate-300 mb-2">
                    Duration Type
                  </label>
                  <select
                    id="plan-duration-type"
                    name="durationType"
                    value={planForm.duration_type || 'days'}
                    onChange={(e) => setPlanForm({ ...planForm, duration_type: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-slate-700/50 bg-ink-950/60 text-slate-200 focus:outline-none focus:border-aurora-500/50"
                  >
                    <option value="days">Days</option>
                    <option value="lifetime">Lifetime</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="plan-duration-days" className="block text-sm font-medium text-slate-300 mb-2">
                    Duration (Days)
                  </label>
                  <input
                    id="plan-duration-days"
                    name="durationDays"
                    type="number"
                    value={planForm.duration_days || ''}
                    onChange={(e) => setPlanForm({ ...planForm, duration_days: e.target.value })}
                    placeholder="30"
                    required
                    min="1"
                    className="w-full px-4 py-2 rounded-lg border border-slate-700/50 bg-ink-950/60 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-aurora-500/50"
                  />
                </div>
              </div>

              {/* Stock Settings */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
                  <input
                    type="checkbox"
                    checked={planForm.limited_stock || false}
                    onChange={(e) =>
                      setPlanForm({ ...planForm, limited_stock: e.target.checked })
                    }
                    className="rounded border-slate-700/50 bg-ink-950/60 text-aurora-500 focus:ring-aurora-500/50"
                  />
                  Limited Stock
                </label>
                {planForm.limited_stock && (
                  <input
                    type="number"
                    value={planForm.stock_amount || ''}
                    onChange={(e) => setPlanForm({ ...planForm, stock_amount: e.target.value })}
                    placeholder="100"
                    min="1"
                    className="w-full px-4 py-2 rounded-lg border border-slate-700/50 bg-ink-950/60 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-aurora-500/50"
                  />
                )}
              </div>

              {/* One-time Purchase (Coin Plans Only) */}
              {planModal.type === 'coin' && (
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                    <input
                      type="checkbox"
                      checked={planForm.one_time_purchase || false}
                      onChange={(e) =>
                        setPlanForm({ ...planForm, one_time_purchase: e.target.checked })
                      }
                      className="rounded border-slate-700/50 bg-ink-950/60 text-aurora-500 focus:ring-aurora-500/50"
                    />
                    One-time Purchase Only
                  </label>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={savingPlan}
                  className="flex-1 px-6 py-3 rounded-lg bg-aurora-900/30 hover:bg-aurora-900/50 text-aurora-200 font-semibold transition-all duration-200 hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {savingPlan ? 'Saving...' : planModal.mode === 'create' ? 'Create Plan' : 'Update Plan'}
                </button>
                <button
                  type="button"
                  onClick={closePlanModal}
                  disabled={savingPlan}
                  className="px-6 py-3 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="relative w-full max-w-md rounded-2xl border border-red-800/60 bg-ink-900 p-6">
            <h3 className="text-xl font-bold text-red-300 mb-4">Delete Plan</h3>
            <p className="text-slate-300 mb-6">
              Are you sure you want to delete this plan? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDeletePlan}
                disabled={deletingPlan}
                className="flex-1 px-6 py-3 rounded-lg bg-red-900/30 hover:bg-red-900/50 text-red-300 font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {deletingPlan ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={() => setDeleteModal({ open: false, type: null, id: null })}
                disabled={deletingPlan}
                className="px-6 py-3 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global confirm modal for delete actions */}
      <ConfirmModal
        open={confirmModal.open}
        title={confirmModal.title}
        message={confirmModal.message}
        detail={confirmModal.detail}
        confirmLabel={confirmModal.confirmLabel || "Confirm"}
        confirmVariant="danger"
        loading={confirmModal.loading}
        onConfirm={confirmModal.onConfirm}
        onClose={closeConfirm}
      />
      </div>
    </div>
  )
}
