import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { Plus, Trash2 } from "lucide-react"
import AdminNav from "../components/AdminNav.jsx"
import SectionHeader from "../components/SectionHeader.jsx"
import { useAppUI } from "../context/AppUIContext.jsx"
import { api } from "../services/api.js"
import Button from "../components/ui/Button.jsx"
import Card from "../components/ui/Card.jsx"
import Input from "../components/ui/Input.jsx"

const STATUS_OPTIONS = ["operational", "degraded", "outage", "maintenance", "unknown"]

const STATUS_META = {
  operational: { label: "Operational", dot: "bg-aurora-400", bar: "bg-aurora-900/30 border-aurora-500/30 text-aurora-200" },
  degraded: { label: "Degraded", dot: "bg-amber-400", bar: "bg-amber-900/30 border-amber-500/30 text-amber-200" },
  outage: { label: "Outage", dot: "bg-red-400 animate-pulse", bar: "bg-red-900/30 border-red-500/30 text-red-200" },
  maintenance: { label: "Maintenance", dot: "bg-blue-400", bar: "bg-blue-900/30 border-blue-500/30 text-blue-200" },
  unknown: { label: "Unknown", dot: "bg-slate-500", bar: "border-dark-700/40 text-slate-400" },
}

const DEFAULTS = [
  { name: "Control Panel", status: "operational" },
  { name: "Node 1 (Mumbai)", status: "operational" },
  { name: "Node 2 (Singapore)", status: "operational" },
  { name: "Node 3 (Frankfurt)", status: "operational" },
  { name: "REST API", status: "operational" },
  { name: "Billing & Payments", status: "operational" },
  { name: "Support System", status: "operational" },
  { name: "Auth Service", status: "operational" },
]

export default function AdminStatus() {
  const [services, setServices] = useState(DEFAULTS)
  const [globalMessage, setGlobalMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()
  const { showSuccess, showError } = useAppUI()

  const loadStatusData = useCallback(async () => {
    const data = await api.getAdminFrontpage()
    const section = data?.status_page?.data
    if (section && Array.isArray(section.services) && section.services.length > 0) {
      setServices(section.services)
      setGlobalMessage(section.globalMessage || "")
    }
  }, [])

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) { navigate("/login"); return }

    loadStatusData()
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [navigate, loadStatusData])

  useEffect(() => {
    const refresh = () => loadStatusData().catch(() => {})
    const onFocus = () => refresh()
    const onSync = (event) => {
      const domains = event?.detail?.domains || []
      if (domains.some((domain) => ["frontpage", "admin"].includes(domain))) {
        refresh()
      }
    }

    const interval = setInterval(refresh, 45000)
    window.addEventListener("focus", onFocus)
    window.addEventListener("astra:data-sync", onSync)

    return () => {
      clearInterval(interval)
      window.removeEventListener("focus", onFocus)
      window.removeEventListener("astra:data-sync", onSync)
    }
  }, [loadStatusData])

  const update = (idx, field, value) => {
    setServices((prev) => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s))
  }

  const remove = (idx) => setServices((prev) => prev.filter((_, i) => i !== idx))

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.updateFrontpageSection("status_page", { services, globalMessage })
      showSuccess("Status page saved")
    } catch (err) {
      showError(err.message || "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  // Overall health
  const hasOutage = services.some((s) => s.status === "outage")
  const hasDegraded = services.some((s) => s.status === "degraded" || s.status === "maintenance")
  const overallStatus = hasOutage ? "outage" : hasDegraded ? "degraded" : "operational"
  const overall = STATUS_META[overallStatus]

  if (loading) {
    return <div className="flex items-center justify-center h-64"><p className="text-slate-400">Loading…</p></div>
  }

  return (
    <div className="min-h-screen bg-dark-950">
      <AdminNav />
      <div className="max-w-7xl mx-auto p-6 space-y-6">
      <SectionHeader
        title="Status Page"
        subtitle="Set individual service statuses shown on /status."
        action={
          <div className="flex gap-3">
            <Button onClick={() => navigate("/status")} variant="secondary">
              View Page ↗
            </Button>
            <Button onClick={() => navigate("/admin")} variant="secondary">
              ← Admin
            </Button>
          </div>
        }
      />

      {/* Overall preview */}
      <div className={`rounded-2xl border p-4 ${overall.bar}`}>
        <div className="flex items-center gap-2.5">
          <span className={`h-2.5 w-2.5 rounded-full ${overall.dot}`} />
          <span className="text-sm font-semibold">
            Preview: {overallStatus === "operational" ? "All Systems Operational" : overallStatus === "degraded" ? "Partial Service Disruption" : "Active Outage"}
          </span>
        </div>
      </div>

      {/* Global message */}
      <Card elevated className="space-y-3 p-5">
        <label htmlFor="global-status-message" className="text-xs uppercase tracking-widest text-slate-500">Global Status Message (optional)</label>
        <textarea
          id="global-status-message"
          name="globalStatusMessage"
          className="input w-full resize-none"
          rows={2}
          value={globalMessage}
          onChange={(e) => setGlobalMessage(e.target.value)}
          placeholder="e.g. We are currently investigating elevated latency on Node 1."
        />
        <p className="text-xs text-slate-500">Leave empty to show default message based on overall status.</p>
      </Card>

      {/* Services */}
      <Card elevated className="space-y-3 p-5">
        <h3 className="text-sm font-semibold text-slate-200">Services</h3>
        <div className="space-y-3">
          {services.map((svc, idx) => {
            const meta = STATUS_META[svc.status] || STATUS_META.unknown
            return (
              <div key={idx} className="flex items-center gap-3">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${meta.dot}`} />
                <Input
                  className="flex-1"
                  value={svc.name}
                  onChange={(e) => update(idx, "name", e.target.value)}
                  placeholder="Service name"
                />
                <select
                  className="h-11 w-40 rounded-xl border border-dark-700/60 bg-dark-900/75 px-4 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
                  value={svc.status}
                  onChange={(e) => update(idx, "status", e.target.value)}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{STATUS_META[s]?.label || s}</option>
                  ))}
                </select>
                <Button onClick={() => remove(idx)} variant="ghost" size="sm" className="h-8 w-8 rounded-lg p-0 text-slate-500 hover:text-red-400">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )
          })}
        </div>

        <Button
          onClick={() => setServices((prev) => [...prev, { name: "", status: "operational" }])}
          variant="ghost"
          size="sm"
          className="w-fit px-1 text-xs text-slate-500 hover:text-neon-300"
        >
          <Plus className="h-3.5 w-3.5" /> Add service
        </Button>
      </Card>

      <Button
        type="button"
        loading={saving}
        onClick={handleSave}
        className="w-full"
      >
        Save Status Page
      </Button>
      </div>
    </div>
  )
}
