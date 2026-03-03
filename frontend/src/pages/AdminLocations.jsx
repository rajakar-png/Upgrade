import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Plus, Trash2 } from "lucide-react"
import AdminNav from "../components/AdminNav.jsx"
import SectionHeader from "../components/SectionHeader.jsx"
import ButtonSpinner from "../components/ButtonSpinner.jsx"
import { useAppUI } from "../context/AppUIContext.jsx"
import { api } from "../services/api.js"

const STATUS_OPTIONS = ["operational", "degraded", "coming-soon", "maintenance"]

const DEFAULTS = [
  { flag: "🇮🇳", city: "Mumbai", country: "India", latency: "~5 ms", status: "operational", features: ["NVMe SSD", "1 Gbps uplink", "DDoS Protection"] },
  { flag: "🇸🇬", city: "Singapore", country: "Singapore", latency: "~35 ms", status: "operational", features: ["NVMe SSD", "1 Gbps uplink", "DDoS Protection"] },
  { flag: "🇩🇪", city: "Frankfurt", country: "Germany", latency: "~120 ms", status: "operational", features: ["NVMe SSD", "10 Gbps uplink", "DDoS Protection"] },
  { flag: "🇺🇸", city: "New York", country: "United States", latency: "~180 ms", status: "coming-soon", features: ["NVMe SSD", "10 Gbps uplink", "DDoS Protection"] },
]

const STATUS_COLORS = {
  operational: "bg-aurora-900/30 border-aurora-500/30 text-aurora-200",
  degraded: "bg-amber-900/30 border-amber-500/30 text-amber-200",
  "coming-soon": "bg-slate-800/40 border-slate-600/30 text-slate-400",
  maintenance: "bg-red-900/30 border-red-500/30 text-red-200",
}

function makeBlank() {
  return { flag: "🌐", city: "", country: "", latency: "", status: "operational", features: ["NVMe SSD", "DDoS Protection"] }
}

export default function AdminLocations() {
  const [locations, setLocations] = useState(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()
  const { showSuccess, showError } = useAppUI()

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) { navigate("/login"); return }

    api.getAdminFrontpage()
      .then((data) => {
        const section = data?.locations_page?.data
        if (Array.isArray(section) && section.length > 0) setLocations(section)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [navigate])

  const update = (idx, field, value) => {
    setLocations((prev) => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l))
  }

  const updateFeature = (locIdx, featIdx, value) => {
    setLocations((prev) => prev.map((l, i) => {
      if (i !== locIdx) return l
      const feats = [...l.features]
      feats[featIdx] = value
      return { ...l, features: feats }
    }))
  }

  const addFeature = (locIdx) => {
    setLocations((prev) => prev.map((l, i) => i === locIdx ? { ...l, features: [...l.features, ""] } : l))
  }

  const removeFeature = (locIdx, featIdx) => {
    setLocations((prev) => prev.map((l, i) => {
      if (i !== locIdx) return l
      return { ...l, features: l.features.filter((_, fi) => fi !== featIdx) }
    }))
  }

  const remove = (idx) => setLocations((prev) => prev.filter((_, i) => i !== idx))

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.updateFrontpageSection("locations_page", locations)
      showSuccess("Locations page saved")
    } catch (err) {
      showError(err.message || "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><p className="text-slate-400">Loading…</p></div>
  }

  return (
    <div className="min-h-screen bg-dark-950">
      <AdminNav />
      <div className="max-w-7xl mx-auto p-6 space-y-6">
      <SectionHeader
        title="Locations Page"
        subtitle="Edit server regions shown on the public /locations page."
        action={
          <div className="flex gap-3">
            <button onClick={() => navigate("/locations")} className="button-3d rounded-xl border border-slate-700/60 px-4 py-2 text-sm font-semibold text-slate-300">
              View Page ↗
            </button>
            <button onClick={() => navigate("/admin")} className="button-3d rounded-xl border border-slate-700/60 px-4 py-2 text-sm font-semibold text-slate-300">
              ← Admin
            </button>
          </div>
        }
      />

      <div className="space-y-4">
        {locations.map((loc, idx) => (
          <div key={idx} className="glass rounded-2xl border border-slate-700/40 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-300">{loc.flag} {loc.city || "New Location"}</span>
              <button onClick={() => remove(idx)} className="rounded-lg p-1.5 text-slate-500 hover:bg-red-900/30 hover:text-red-400">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label htmlFor={`loc-${idx}-flag`} className="text-xs uppercase tracking-widest text-slate-500">Flag Emoji</label>
                <input id={`loc-${idx}-flag`} name={`loc-${idx}-flag`} className="input mt-1 w-full" value={loc.flag} onChange={(e) => update(idx, "flag", e.target.value)} placeholder="🇮🇳" />
              </div>
              <div>
                <label htmlFor={`loc-${idx}-city`} className="text-xs uppercase tracking-widest text-slate-500">City</label>
                <input id={`loc-${idx}-city`} name={`loc-${idx}-city`} className="input mt-1 w-full" value={loc.city} onChange={(e) => update(idx, "city", e.target.value)} placeholder="Mumbai" />
              </div>
              <div>
                <label htmlFor={`loc-${idx}-country`} className="text-xs uppercase tracking-widest text-slate-500">Country</label>
                <input id={`loc-${idx}-country`} name={`loc-${idx}-country`} className="input mt-1 w-full" value={loc.country} onChange={(e) => update(idx, "country", e.target.value)} placeholder="India" />
              </div>
              <div>
                <label htmlFor={`loc-${idx}-latency`} className="text-xs uppercase tracking-widest text-slate-500">Latency</label>
                <input id={`loc-${idx}-latency`} name={`loc-${idx}-latency`} className="input mt-1 w-full" value={loc.latency} onChange={(e) => update(idx, "latency", e.target.value)} placeholder="~5 ms" />
              </div>
            </div>

            <div>
              <label className="text-xs uppercase tracking-widest text-slate-500">Status</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => update(idx, "status", s)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${loc.status === s ? STATUS_COLORS[s] : "border-slate-700/40 text-slate-500 hover:border-slate-600"}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs uppercase tracking-widest text-slate-500">Features (bullet points)</label>
              <div className="mt-2 space-y-2">
                {(loc.features || []).map((f, fi) => (
                  <div key={fi} className="flex gap-2">
                    <input
                      className="input flex-1"
                      value={f}
                      onChange={(e) => updateFeature(idx, fi, e.target.value)}
                      placeholder="e.g. NVMe SSD"
                    />
                    <button onClick={() => removeFeature(idx, fi)} className="rounded-lg px-2 text-slate-500 hover:text-red-400">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <button onClick={() => addFeature(idx)} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-neon-300">
                  <Plus className="h-3 w-3" /> Add feature
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => setLocations((prev) => [...prev, makeBlank()])}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-600 py-4 text-sm text-slate-400 hover:border-neon-500/50 hover:text-neon-300 transition"
      >
        <Plus className="h-4 w-4" /> Add Location
      </button>

      <ButtonSpinner
        loading={saving}
        onClick={handleSave}
        className="button-3d w-full rounded-xl bg-neon-500/20 border border-neon-500/30 px-4 py-3 text-sm font-semibold text-neon-200 hover:bg-neon-500/30"
      >
        Save Locations Page
      </ButtonSpinner>
      </div>
    </div>
  )
}
