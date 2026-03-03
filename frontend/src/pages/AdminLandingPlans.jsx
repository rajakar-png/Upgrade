import { useState, useEffect, cloneElement, isValidElement } from "react"
import { Link } from "react-router-dom"
import AdminNav from "../components/AdminNav.jsx"
import SectionHeader from "../components/SectionHeader.jsx"
import Badge from "../components/Badge.jsx"
import { api } from "../services/api.js"
import {
  Plus, Edit2, Trash2, Star, Eye, EyeOff, X, Save, ArrowLeft, Server
} from "lucide-react"

const EMPTY_PLAN = {
  name: "",
  price: "",
  ram: "",
  cpu: "",
  storage: "",
  features: [],
  popular: false,
  active: true
}

export default function AdminLandingPlans() {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // null | "create" | "edit"
  const [form, setForm] = useState(EMPTY_PLAN)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [featureInput, setFeatureInput] = useState("")
  const [toast, setToast] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  useEffect(() => {
    loadPlans()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadPlans() {
    try {
      setLoading(true)
      const data = await api.getAdminLandingPlans()
      setPlans(data)
    } catch (err) {
      showToast(err.message, "error")
    } finally {
      setLoading(false)
    }
  }

  function showToast(msg, type = "success") {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  function openCreate() {
    setForm(EMPTY_PLAN)
    setFeatureInput("")
    setEditId(null)
    setModal("create")
  }

  function openEdit(plan) {
    setForm({
      name: plan.name,
      price: String(plan.price),
      ram: String(plan.ram),
      cpu: String(plan.cpu),
      storage: String(plan.storage),
      features: Array.isArray(plan.features) ? [...plan.features] : [],
      popular: plan.popular,
      active: plan.active
    })
    setFeatureInput("")
    setEditId(plan.id)
    setModal("edit")
  }

  function closeModal() {
    setModal(null)
    setEditId(null)
    setForm(EMPTY_PLAN)
  }

  function addFeature() {
    const trimmed = featureInput.trim()
    if (!trimmed) return
    setForm((prev) => ({ ...prev, features: [...prev.features, trimmed] }))
    setFeatureInput("")
  }

  function removeFeature(idx) {
    setForm((prev) => ({ ...prev, features: prev.features.filter((_, i) => i !== idx) }))
  }

  function validate() {
    if (!form.name.trim()) return "Name is required"
    if (form.price === "" || isNaN(Number(form.price)) || Number(form.price) < 0) return "Valid price is required"
    if (!form.ram || isNaN(Number(form.ram)) || Number(form.ram) < 1) return "RAM must be a positive integer"
    if (!form.cpu || isNaN(Number(form.cpu)) || Number(form.cpu) < 1) return "CPU must be a positive integer"
    if (!form.storage || isNaN(Number(form.storage)) || Number(form.storage) < 1) return "Storage must be a positive integer"
    return null
  }

  async function handleSave() {
    const err = validate()
    if (err) return showToast(err, "error")

    const payload = {
      name: form.name.trim(),
      price: Number(form.price),
      ram: Number(form.ram),
      cpu: Number(form.cpu),
      storage: Number(form.storage),
      features: form.features,
      popular: form.popular,
      active: form.active
    }

    try {
      setSaving(true)
      if (modal === "edit") {
        await api.updateLandingPlan(editId, payload)
        showToast("Plan updated")
      } else {
        await api.createLandingPlan(payload)
        showToast("Plan created")
      }
      closeModal()
      loadPlans()
    } catch (err) {
      showToast(err.message, "error")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    try {
      await api.deleteLandingPlan(id)
      showToast("Plan deleted")
      setConfirmDelete(null)
      loadPlans()
    } catch (err) {
      showToast(err.message, "error")
    }
  }

  async function toggleActive(id) {
    try {
      await api.toggleLandingPlanActive(id)
      loadPlans()
    } catch (err) {
      showToast(err.message, "error")
    }
  }

  async function togglePopular(id) {
    try {
      await api.toggleLandingPlanPopular(id)
      loadPlans()
    } catch (err) {
      showToast(err.message, "error")
    }
  }

  return (
    <div className="min-h-screen bg-dark-950">
      <AdminNav />
      <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed right-6 top-6 z-50 flex items-center gap-3 rounded-xl border px-5 py-3 text-sm font-semibold shadow-lg ${
          toast.type === "error"
            ? "border-red-700/50 bg-red-900/80 text-red-200"
            : "border-neon-500/40 bg-neon-900/80 text-neon-200"
        }`}>
          {toast.msg}
          <button onClick={() => setToast(null)}><X className="h-3 w-3" /></button>
        </div>
      )}

      {/* Confirm Delete */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass w-full max-w-sm rounded-2xl border border-slate-700/50 p-6 space-y-4">
            <h3 className="text-lg font-semibold text-slate-100">Delete Plan?</h3>
            <p className="text-sm text-slate-400">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 rounded-xl border border-slate-700/60 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800/50">Cancel</button>
              <button onClick={() => handleDelete(confirmDelete)} className="flex-1 rounded-xl bg-red-900/30 border border-red-700/50 py-2 text-sm font-semibold text-red-300 hover:bg-red-900/50">Delete</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-4">
        <Link to="/admin" className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200">
          <ArrowLeft className="h-4 w-4" /> Back to Admin
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <SectionHeader title="Landing Page Plans" subtitle="Plans displayed on the public front page. Separate from coin/real plans." />
        <button onClick={openCreate} className="button-3d flex items-center gap-2 rounded-xl bg-neon-500/20 px-4 py-2.5 text-sm font-semibold text-neon-200">
          <Plus className="h-4 w-4" /> New Plan
        </button>
      </div>

      {loading ? (
        <p className="text-slate-400">Loading plans...</p>
      ) : plans.length === 0 ? (
        <div className="glass rounded-2xl border border-dashed border-slate-700/50 p-12 text-center">
          <Server className="mx-auto h-8 w-8 text-slate-600" />
          <p className="mt-3 text-slate-400">No landing plans yet.</p>
          <button onClick={openCreate} className="mt-4 button-3d rounded-xl bg-neon-500/20 px-4 py-2 text-sm font-semibold text-neon-200">
            Create First Plan
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => (
            <div key={plan.id} className={`glass relative rounded-2xl border p-5 space-y-4 ${plan.popular ? "border-neon-500/40" : "border-slate-700/40"} ${!plan.active ? "opacity-60" : ""}`}>
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full border border-neon-500/50 bg-neon-900/80 px-3 py-0.5 text-xs font-semibold text-neon-200">Popular</span>
                </div>
              )}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-slate-100">{plan.name}</h3>
                  <p className="text-xl font-bold text-neon-200 mt-1">₹{plan.price}<span className="text-sm font-normal text-slate-400">/mo</span></p>
                </div>
                {!plan.active && <Badge variant="warning">Inactive</Badge>}
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs text-slate-400">
                <div className="rounded-lg bg-ink-900/60 px-2 py-1.5 text-center">
                  <div className="font-semibold text-slate-200">{plan.ram} GB</div>
                  <div>RAM</div>
                </div>
                <div className="rounded-lg bg-ink-900/60 px-2 py-1.5 text-center">
                  <div className="font-semibold text-slate-200">{plan.cpu}</div>
                  <div>CPU</div>
                </div>
                <div className="rounded-lg bg-ink-900/60 px-2 py-1.5 text-center">
                  <div className="font-semibold text-slate-200">{plan.storage} GB</div>
                  <div>Storage</div>
                </div>
              </div>

              {plan.features.length > 0 && (
                <ul className="space-y-1 text-xs text-slate-400">
                  {plan.features.slice(0, 4).map((f, i) => <li key={i} className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-neon-400/60" />{f}</li>)}
                  {plan.features.length > 4 && <li className="text-slate-500">+{plan.features.length - 4} more</li>}
                </ul>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                <button onClick={() => openEdit(plan)} className="flex items-center gap-1.5 rounded-lg border border-slate-700/60 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800/50">
                  <Edit2 className="h-3 w-3" /> Edit
                </button>
                <button onClick={() => toggleActive(plan.id)} className="flex items-center gap-1.5 rounded-lg border border-slate-700/60 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800/50">
                  {plan.active ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  {plan.active ? "Deactivate" : "Activate"}
                </button>
                <button onClick={() => togglePopular(plan.id)} className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${plan.popular ? "border-neon-500/40 bg-neon-900/20 text-neon-200" : "border-slate-700/60 text-slate-400 hover:bg-slate-800/50"}`}>
                  <Star className="h-3 w-3" /> Popular
                </button>
                <button onClick={() => setConfirmDelete(plan.id)} className="flex items-center gap-1.5 rounded-lg border border-red-700/40 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-900/20">
                  <Trash2 className="h-3 w-3" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass w-full max-w-lg rounded-2xl border border-slate-700/50 overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-700/40 px-6 py-4">
              <h2 className="font-semibold text-slate-100">{modal === "edit" ? "Edit Plan" : "New Landing Plan"}</h2>
              <button onClick={closeModal}><X className="h-4 w-4 text-slate-400 hover:text-slate-200" /></button>
            </div>
            <div className="p-6 space-y-4">
              <FormField label="Plan Name">
                <input className="input w-full" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Basic" />
              </FormField>

              <FormField label="Price (₹/month)">
                <input className="input w-full" type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))} placeholder="199" />
              </FormField>

              <div className="grid grid-cols-3 gap-3">
                <FormField label="RAM (GB)">
                  <input className="input w-full" type="number" min="1" value={form.ram} onChange={(e) => setForm((p) => ({ ...p, ram: e.target.value }))} placeholder="2" />
                </FormField>
                <FormField label="CPU (cores)">
                  <input className="input w-full" type="number" min="1" value={form.cpu} onChange={(e) => setForm((p) => ({ ...p, cpu: e.target.value }))} placeholder="2" />
                </FormField>
                <FormField label="Storage (GB)">
                  <input className="input w-full" type="number" min="1" value={form.storage} onChange={(e) => setForm((p) => ({ ...p, storage: e.target.value }))} placeholder="20" />
                </FormField>
              </div>

              <FormField label="Features">
                <div className="flex gap-2">
                  <input className="input flex-1" value={featureInput} onChange={(e) => setFeatureInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addFeature())} placeholder="e.g. DDoS Protection" />
                  <button onClick={addFeature} className="rounded-xl bg-neon-500/20 px-3 text-neon-200"><Plus className="h-4 w-4" /></button>
                </div>
                {form.features.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {form.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-1.5 rounded-full border border-slate-700/50 bg-ink-900/60 px-3 py-1 text-xs text-slate-300">
                        {f}
                        <button onClick={() => removeFeature(i)} className="text-slate-500 hover:text-red-300"><X className="h-3 w-3" /></button>
                      </li>
                    ))}
                  </ul>
                )}
              </FormField>

              <div className="flex gap-6">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
                  <input type="checkbox" className="rounded" checked={form.active} onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))} />
                  Active
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
                  <input type="checkbox" className="rounded" checked={form.popular} onChange={(e) => setForm((p) => ({ ...p, popular: e.target.checked }))} />
                  Mark as Popular
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-700/40 px-6 py-4">
              <button onClick={closeModal} className="rounded-xl border border-slate-700/60 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800/50">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="button-3d flex items-center gap-2 rounded-xl bg-neon-500/20 px-5 py-2 text-sm font-semibold text-neon-200 disabled:opacity-60">
                <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Plan"}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}

function FormField({ label, children }) {
  const id = `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "")}`
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</label>
      {isValidElement(children) ? cloneElement(children, { id, name: id }) : children}
    </div>
  )
}
