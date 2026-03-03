import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Plus, Trash2, GripVertical, Zap, ShieldCheck, Coins, Server, Globe, Cpu, HardDrive, Clock, Lock, LifeBuoy, Wifi, Shield, Rocket, Gift, Gem, Star, ArrowRight } from "lucide-react"
import AdminNav from "../components/AdminNav.jsx"
import SectionHeader from "../components/SectionHeader.jsx"
import ButtonSpinner from "../components/ButtonSpinner.jsx"
import { useAppUI } from "../context/AppUIContext.jsx"
import { api } from "../services/api.js"

const ICON_OPTIONS = ["Zap", "ShieldCheck", "Coins", "Server", "Globe", "Cpu", "HardDrive", "Clock", "Lock", "LifeBuoy", "Wifi", "Shield", "Rocket", "Gift", "Gem", "Star"]
const COLOR_OPTIONS = [
  { label: "Amber", value: "text-amber-300" },
  { label: "Neon Green", value: "text-neon-300" },
  { label: "Aurora", value: "text-aurora-300" },
  { label: "Ember", value: "text-ember-300" },
  { label: "Slate", value: "text-slate-300" },
  { label: "Neon 400", value: "text-neon-400" },
  { label: "Aurora 400", value: "text-aurora-400" },
  { label: "Amber 400", value: "text-amber-400" },
]

const DEFAULTS = [
  { icon: "Zap", title: "Automated Renewal", description: "Servers renew automatically from your coin wallet. 12h grace period protects active sessions.", color: "text-amber-300" },
  { icon: "ShieldCheck", title: "Anti-Abuse Core", description: "IP-based coupon protection, per-user limits, and rate-limited endpoints.", color: "text-aurora-300" },
  { icon: "Coins", title: "Coin Economy", description: "Earn coins passively through AFK sessions. Redeem vouchers for bonus coins.", color: "text-neon-300" },
  { icon: "Server", title: "Pterodactyl Integration", description: "Full server lifecycle management via Pterodactyl Admin API.", color: "text-ember-300" },
  { icon: "Globe", title: "Smart Node Selection", description: "Backend selects best available Pterodactyl node based on resource availability.", color: "text-neon-400" },
  { icon: "Cpu", title: "Flexible Resources", description: "Customizable RAM, CPU, and storage to fit any Minecraft use case.", color: "text-aurora-400" },
  { icon: "HardDrive", title: "NVMe Storage", description: "Ultra-fast world loading and minimal chunk lag on every node.", color: "text-slate-300" },
  { icon: "Clock", title: "Flexible Billing", description: "Weekly, monthly, or custom durations — coin and real-money plans.", color: "text-amber-400" },
  { icon: "Lock", title: "Secure Auth", description: "JWT tokens, bcrypt passwords, and rate-limited auth endpoints.", color: "text-neon-300" },
  { icon: "LifeBuoy", title: "24/7 Support", description: "Discord and ticket-based support with fast admin response times.", color: "text-aurora-300" },
]

function makeBlank() {
  return { icon: "Zap", title: "", description: "", color: "text-neon-300" }
}

export default function AdminFeatures() {
  const [features, setFeatures] = useState(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()
  const { showSuccess, showError } = useAppUI()

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) { navigate("/login"); return }

    api.getAdminFrontpage()
      .then((data) => {
        const section = data?.features_page?.data
        if (Array.isArray(section) && section.length > 0) {
          setFeatures(section)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [navigate])

  const update = (idx, field, value) => {
    setFeatures((prev) => prev.map((f, i) => i === idx ? { ...f, [field]: value } : f))
  }

  const addFeature = () => setFeatures((prev) => [...prev, makeBlank()])

  const remove = (idx) => setFeatures((prev) => prev.filter((_, i) => i !== idx))

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.updateFrontpageSection("features_page", features)
      showSuccess("Features page saved")
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
        title="Features Page"
        subtitle="Edit the feature cards shown on the public /features page."
        action={
          <div className="flex gap-3">
            <button onClick={() => navigate("/features")} target="_blank" className="button-3d rounded-xl border border-slate-700/60 px-4 py-2 text-sm font-semibold text-slate-300">
              View Page ↗
            </button>
            <button onClick={() => navigate("/admin")} className="button-3d rounded-xl border border-slate-700/60 px-4 py-2 text-sm font-semibold text-slate-300">
              ← Admin
            </button>
          </div>
        }
      />

      <div className="space-y-3">
        {features.map((feat, idx) => (
          <div key={idx} className="glass rounded-2xl border border-slate-700/40 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-slate-600" />
                <span className="text-sm font-semibold text-slate-300">Feature #{idx + 1}</span>
              </div>
              <button
                onClick={() => remove(idx)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-red-900/30 hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor={`feat-${idx}-title`} className="text-xs uppercase tracking-widest text-slate-500">Title</label>
                <input
                  id={`feat-${idx}-title`}
                  name={`feat-${idx}-title`}
                  className="input mt-1 w-full"
                  value={feat.title}
                  onChange={(e) => update(idx, "title", e.target.value)}
                  placeholder="Feature title"
                />
              </div>
              <div>
                <label htmlFor={`feat-${idx}-icon`} className="text-xs uppercase tracking-widest text-slate-500">Icon</label>
                <select
                  id={`feat-${idx}-icon`}
                  name={`feat-${idx}-icon`}
                  className="input mt-1 w-full"
                  value={feat.icon}
                  onChange={(e) => update(idx, "icon", e.target.value)}
                >
                  {ICON_OPTIONS.map((ic) => (
                    <option key={ic} value={ic}>{ic}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <label htmlFor={`feat-${idx}-description`} className="text-xs uppercase tracking-widest text-slate-500">Description</label>
                <textarea
                  id={`feat-${idx}-description`}
                  name={`feat-${idx}-description`}
                  className="input mt-1 w-full resize-none"
                  rows={2}
                  value={feat.description}
                  onChange={(e) => update(idx, "description", e.target.value)}
                  placeholder="Short description"
                />
              </div>
              <div>
                <label htmlFor={`feat-${idx}-color`} className="text-xs uppercase tracking-widest text-slate-500">Icon Color</label>
                <select
                  id={`feat-${idx}-color`}
                  name={`feat-${idx}-color`}
                  className="input mt-1 w-full"
                  value={feat.color}
                  onChange={(e) => update(idx, "color", e.target.value)}
                >
                  {COLOR_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={addFeature}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-600 py-4 text-sm text-slate-400 hover:border-neon-500/50 hover:text-neon-300 transition"
      >
        <Plus className="h-4 w-4" /> Add Feature
      </button>

      <ButtonSpinner
        loading={saving}
        onClick={handleSave}
        className="button-3d w-full rounded-xl bg-neon-500/20 border border-neon-500/30 px-4 py-3 text-sm font-semibold text-neon-200 hover:bg-neon-500/30"
      >
        Save Features Page
      </ButtonSpinner>
      </div>
    </div>
  )
}
