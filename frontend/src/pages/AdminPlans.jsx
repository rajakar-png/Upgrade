import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import {
  Plus, Edit2, Trash2, X, Package, Server, Cpu, HardDrive, Zap,
  Sparkles, Star, Crown, Shield, Rocket, Gift, Gem, Trophy, Circle
} from "lucide-react"
import AdminNav from "../components/AdminNav.jsx"
import SectionHeader from "../components/SectionHeader.jsx"
import ButtonSpinner from "../components/ButtonSpinner.jsx"
import ConfirmModal from "../components/ConfirmModal.jsx"
import { useAppUI } from "../context/AppUIContext.jsx"
import { api } from "../services/api.js"

const iconMap = {
  Package, Server, Cpu, HardDrive, Zap, Sparkles, Star, Crown,
  Shield, Rocket, Gift, Gem, Trophy, Circle
}

const DURATION_TYPES = [
  { value: "days", label: "Days" },
  { value: "weekly", label: "Weekly (7 days)" },
  { value: "monthly", label: "Monthly (30 days)" },
  { value: "lifetime", label: "Lifetime" },
]

function makeCoinDefault() {
  return { name: "", icon: "Package", ram: "", cpu: "", storage: "", coin_price: "", duration_type: "days", duration_days: "", limited_stock: false, stock_amount: "", one_time_purchase: false, backup_count: 0, extra_ports: 0 }
}
function makeRealDefault() {
  return { name: "", icon: "Server", ram: "", cpu: "", storage: "", price: "", duration_type: "days", duration_days: "", limited_stock: false, stock_amount: "", backup_count: 0, extra_ports: 0 }
}

export default function AdminPlans() {
  const [coinPlans, setCoinPlans] = useState([])
  const [realPlans, setRealPlans] = useState([])
  const [tab, setTab] = useState("coin")
  const [loading, setLoading] = useState(true)

  const [modal, setModal] = useState({ open: false, type: "coin", mode: "create", data: null })
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState("")

  const [confirmModal, setConfirmModal] = useState({ open: false, title: "", message: "", detail: "", onConfirm: null, loading: false })
  const navigate = useNavigate()
  const { showSuccess, showError } = useAppUI()

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) { navigate("/login"); return }

    Promise.all([api.getCoinPlans(), api.getRealPlans()])
      .then(([coin, real]) => {
        setCoinPlans(coin || [])
        setRealPlans(real || [])
      })
      .catch((err) => showError(err.message || "Failed to load plans"))
      .finally(() => setLoading(false))
  }, [navigate, showError])

  const openModal = (type, mode, data = null) => {
    setFormError("")
    if (mode === "edit" && data) {
      setForm({ ...data })
    } else {
      setForm(type === "coin" ? makeCoinDefault() : makeRealDefault())
    }
    setModal({ open: true, type, mode, data })
  }
  const closeModal = () => { setModal({ open: false, type: "coin", mode: "create", data: null }); setForm({}); setFormError("") }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setFormError("")
    try {
      const token = localStorage.getItem("token")
      const { type, mode, data } = modal
      const planData = {
        name: form.name,
        icon: form.icon || (type === "coin" ? "Package" : "Server"),
        ram: parseInt(form.ram),
        cpu: parseInt(form.cpu),
        storage: parseInt(form.storage),
        [type === "coin" ? "coin_price" : "price"]: parseFloat(form[type === "coin" ? "coin_price" : "price"]),
        duration_type: form.duration_type,
        duration_days: parseInt(form.duration_days),
        limited_stock: Boolean(form.limited_stock),
        stock_amount: form.limited_stock ? parseInt(form.stock_amount) : null
      }
      planData.backup_count = parseInt(form.backup_count) || 0
      planData.extra_ports = parseInt(form.extra_ports) || 0
      if (type === "coin") planData.one_time_purchase = Boolean(form.one_time_purchase)

      if (mode === "create") {
        if (type === "coin") await api.createCoinPlan(token, planData)
        else await api.createRealPlan(token, planData)
        showSuccess("Plan created")
      } else {
        if (type === "coin") await api.updateCoinPlan(token, data.id, planData)
        else await api.updateRealPlan(token, data.id, planData)
        showSuccess("Plan updated")
      }

      const [coin, real] = await Promise.all([api.getCoinPlans(), api.getRealPlans()])
      setCoinPlans(coin || [])
      setRealPlans(real || [])
      closeModal()
    } catch (err) {
      setFormError(err.message || "Failed to save plan")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (type, id, name) => {
    setConfirmModal({
      open: true, loading: false,
      title: "Delete Plan",
      message: `Delete "${name}"?`,
      detail: "Users with existing servers on this plan will keep their servers. New purchases will be blocked.",
      confirmLabel: "Delete",
      onConfirm: async () => {
        setConfirmModal((p) => ({ ...p, loading: true }))
        try {
          const token = localStorage.getItem("token")
          if (type === "coin") await api.deleteCoinPlan(token, id)
          else await api.deleteRealPlan(token, id)
          const [coin, real] = await Promise.all([api.getCoinPlans(), api.getRealPlans()])
          setCoinPlans(coin || [])
          setRealPlans(real || [])
          showSuccess("Plan deleted")
          setConfirmModal({ open: false, title: "", message: "", detail: "", onConfirm: null, loading: false })
        } catch (err) {
          showError(err.message || "Failed to delete plan")
          setConfirmModal((p) => ({ ...p, loading: false }))
        }
      }
    })
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><p className="text-slate-400">Loading plans…</p></div>
  }

  const plans = tab === "coin" ? coinPlans : realPlans

  return (
    <div className="min-h-screen bg-dark-950">
      <AdminNav />
      <div className="max-w-7xl mx-auto p-6 space-y-6">
      <SectionHeader
        title="Plans Manager"
        subtitle="Create and manage coin plans and real-money plans for your users."
        action={
          <div className="flex gap-3">
            <button onClick={() => navigate("/admin")} className="button-3d rounded-xl border border-slate-700/60 px-4 py-2 text-sm font-semibold text-slate-300">
              ← Admin
            </button>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex gap-2 rounded-xl border border-slate-800/60 bg-ink-900/50 p-1.5 w-fit">
        {["coin", "real"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-5 py-2 text-sm font-semibold transition ${tab === t ? "bg-neon-500/20 text-neon-200 border border-neon-500/30" : "text-slate-400 hover:text-slate-200"}`}
          >
            {t === "coin" ? "Coin Plans" : "Real Money Plans"}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">{plans.length} {tab === "coin" ? "coin" : "real money"} plans</p>
        <button
          onClick={() => openModal(tab, "create")}
          className="flex items-center gap-2 rounded-xl bg-neon-500/20 border border-neon-500/30 px-4 py-2 text-sm font-semibold text-neon-200 hover:bg-neon-500/30"
        >
          <Plus className="h-4 w-4" />
          New {tab === "coin" ? "Coin" : "Real"} Plan
        </button>
      </div>

      {/* Plans List */}
      <div className="space-y-3">
        {plans.map((plan) => {
          const Icon = iconMap[plan.icon] || Package
          return (
            <div key={plan.id} className="glass rounded-2xl border border-slate-700/40 px-5 py-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-neon-900/20 text-neon-300">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-100">{plan.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {plan.ram}GB RAM · {plan.cpu} CPU · {plan.storage}GB SSD
                  </p>
                  <p className="text-xs text-neon-300 mt-1">
                    {tab === "coin" ? `${plan.coin_price} coins` : `₹${plan.price}`}
                    {" · "}
                    {plan.duration_type === "lifetime" ? "Lifetime" : `${plan.duration_days} days`}
                    {plan.limited_stock ? ` · Stock: ${plan.stock_amount ?? "?"}` : ""}
                    {tab === "coin" && plan.one_time_purchase ? " · One-time" : ""}
                    {plan.backup_count > 0 ? ` · ${plan.backup_count} backup${plan.backup_count > 1 ? "s" : ""}` : ""}
                    {plan.extra_ports > 0 ? ` · ${plan.extra_ports} extra port${plan.extra_ports > 1 ? "s" : ""}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => openModal(tab, "edit", plan)}
                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(tab, plan.id, plan.name)}
                    className="rounded-lg p-2 text-slate-500 hover:bg-red-900/30 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )
        })}

        {plans.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-700/40 py-12 text-center">
            <p className="text-slate-400 text-sm">No {tab === "coin" ? "coin" : "real money"} plans yet.</p>
            <button onClick={() => openModal(tab, "create")} className="mt-3 text-xs text-neon-400 hover:text-neon-300">
              Create your first plan →
            </button>
          </div>
        )}
      </div>

      {/* Plan Modal */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-800/60 bg-ink-900 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-100">
                {modal.mode === "create" ? "Create" : "Edit"} {modal.type === "coin" ? "Coin" : "Real Money"} Plan
              </h3>
              <button onClick={closeModal} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 rounded-lg border border-red-700/30 bg-red-900/20 p-3 text-sm text-red-300">{formError}</div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              {/* Name */}
              <div>
                <label htmlFor="plan-name" className="block text-sm font-medium text-slate-300 mb-1">Plan Name</label>
                <input
                  id="plan-name"
                  name="planName"
                  type="text"
                  value={form.name || ""}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., Starter Plan"
                  required
                  className="input w-full"
                />
              </div>

              {/* Icon */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Icon</label>
                <div className="grid grid-cols-7 gap-2">
                  {Object.keys(iconMap).map((name) => {
                    const Ic = iconMap[name]
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => setForm({ ...form, icon: name })}
                        title={name}
                        className={`flex items-center justify-center rounded-lg border p-2.5 transition ${form.icon === name ? "border-neon-500 bg-neon-900/30 text-neon-300" : "border-slate-700/50 bg-ink-950/60 text-slate-400 hover:border-slate-600 hover:text-slate-200"}`}
                      >
                        <Ic className="h-5 w-5" />
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Resources */}
              <div className="grid grid-cols-3 gap-4">
                {[{ key: "ram", label: "RAM (GB)", ph: "4" }, { key: "cpu", label: "CPU Cores", ph: "2" }, { key: "storage", label: "Storage (GB)", ph: "20" }].map(({ key, label, ph }) => (
                  <div key={key}>
                    <label htmlFor={`plan-${key}`} className="block text-sm font-medium text-slate-300 mb-1">{label}</label>
                    <input
                      id={`plan-${key}`}
                      name={key}
                      type="number" min="1" required
                      value={form[key] || ""}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                      placeholder={ph}
                      className="input w-full"
                    />
                  </div>
                ))}
              </div>

              {/* Price */}
              <div>
                <label htmlFor="plan-price" className="block text-sm font-medium text-slate-300 mb-1">
                  {modal.type === "coin" ? "Coin Price" : "Price (₹)"}
                </label>
                <input
                  id="plan-price"
                  name="planPrice"
                  type="number" min="0" step="0.01" required
                  value={form[modal.type === "coin" ? "coin_price" : "price"] || ""}
                  onChange={(e) => setForm({ ...form, [modal.type === "coin" ? "coin_price" : "price"]: e.target.value })}
                  placeholder={modal.type === "coin" ? "500" : "299"}
                  className="input w-full"
                />
              </div>

              {/* Duration */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="plan-duration-type" className="block text-sm font-medium text-slate-300 mb-1">Duration Type</label>
                  <select id="plan-duration-type" name="durationType" className="input w-full" value={form.duration_type || "days"} onChange={(e) => setForm({ ...form, duration_type: e.target.value })}>
                    {DURATION_TYPES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="plan-duration-days" className="block text-sm font-medium text-slate-300 mb-1">Duration (days)</label>
                  <input
                    id="plan-duration-days"
                    name="durationDays"
                    type="number" min="1" required
                    value={form.duration_days || ""}
                    onChange={(e) => setForm({ ...form, duration_days: e.target.value })}
                    placeholder="30"
                    className="input w-full"
                  />
                </div>
              </div>

              {/* Stock */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-300 cursor-pointer">
                  <input type="checkbox" checked={Boolean(form.limited_stock)} onChange={(e) => setForm({ ...form, limited_stock: e.target.checked })} className="rounded border-slate-700/50" />
                  Limited Stock
                </label>
                {form.limited_stock && (
                  <input type="number" min="1" value={form.stock_amount || ""} onChange={(e) => setForm({ ...form, stock_amount: e.target.value })} placeholder="Stock amount" className="input w-full" />
                )}
              </div>

              {/* Backups & Extra Ports */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="plan-backup-count" className="block text-sm font-medium text-slate-300 mb-1">Backup Limit</label>
                  <input
                    id="plan-backup-count"
                    name="backupCount"
                    type="number" min="0"
                    value={form.backup_count ?? 0}
                    onChange={(e) => setForm({ ...form, backup_count: e.target.value })}
                    placeholder="0"
                    className="input w-full"
                  />
                  <p className="mt-1 text-[10px] text-slate-600">Number of backups users can create (0 = disabled)</p>
                </div>
                <div>
                  <label htmlFor="plan-extra-ports" className="block text-sm font-medium text-slate-300 mb-1">Extra Ports</label>
                  <input
                    id="plan-extra-ports"
                    name="extraPorts"
                    type="number" min="0"
                    value={form.extra_ports ?? 0}
                    onChange={(e) => setForm({ ...form, extra_ports: e.target.value })}
                    placeholder="0"
                    className="input w-full"
                  />
                  <p className="mt-1 text-[10px] text-slate-600">Additional port allocations beyond the default (0 = no extras)</p>
                </div>
              </div>

              {/* One-time (coin only) */}
              {modal.type === "coin" && (
                <label className="flex items-center gap-2 text-sm font-medium text-slate-300 cursor-pointer">
                  <input type="checkbox" checked={Boolean(form.one_time_purchase)} onChange={(e) => setForm({ ...form, one_time_purchase: e.target.checked })} className="rounded border-slate-700/50" />
                  One-time purchase per user
                </label>
              )}

              <div className="flex gap-3 pt-2">
                <ButtonSpinner
                  type="submit"
                  loading={saving}
                  className="flex-1 rounded-xl bg-neon-500/20 border border-neon-500/30 py-3 text-sm font-semibold text-neon-200 hover:bg-neon-500/30"
                >
                  {modal.mode === "create" ? "Create Plan" : "Save Changes"}
                </ButtonSpinner>
                <button type="button" onClick={closeModal} className="rounded-xl border border-slate-700/60 px-6 py-3 text-sm font-semibold text-slate-300 hover:bg-slate-800/50">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm delete modal */}
      <ConfirmModal
        open={confirmModal.open}
        title={confirmModal.title}
        message={confirmModal.message}
        detail={confirmModal.detail}
        confirmLabel={confirmModal.confirmLabel}
        loading={confirmModal.loading}
        onConfirm={confirmModal.onConfirm}
        onClose={() => setConfirmModal({ open: false, title: "", message: "", detail: "", onConfirm: null, loading: false })}
      />
      </div>
    </div>
  )
}
