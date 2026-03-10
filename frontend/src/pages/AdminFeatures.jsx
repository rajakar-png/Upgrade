import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { Plus, Trash2, GripVertical, Zap, ShieldCheck, Coins, Server, Globe, Cpu, HardDrive, Clock, Lock, LifeBuoy, Wifi, Shield, Rocket, Gift, Gem, Star, ArrowRight } from "lucide-react"
import AdminNav from "../components/AdminNav.jsx"
import SectionHeader from "../components/SectionHeader.jsx"
import { useAppUI } from "../context/AppUIContext.jsx"
import { api } from "../services/api.js"
import Button from "../components/ui/Button.jsx"
import Card from "../components/ui/Card.jsx"
import Input from "../components/ui/Input.jsx"

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

  const loadFeaturesData = useCallback(async () => {
    const data = await api.getAdminFrontpage()
    const section = data?.features_page?.data
    if (Array.isArray(section) && section.length > 0) {
      setFeatures(section)
    }
  }, [])

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) { navigate("/login"); return }

    loadFeaturesData()
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [navigate, loadFeaturesData])

  useEffect(() => {
    const refresh = () => loadFeaturesData().catch(() => {})
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
  }, [loadFeaturesData])

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
            <Button onClick={() => navigate("/features")} variant="secondary">
              View Page ↗
            </Button>
            <Button onClick={() => navigate("/admin")} variant="secondary">
              ← Admin
            </Button>
          </div>
        }
      />

      <div className="space-y-3">
        {features.map((feat, idx) => (
          <Card key={idx} elevated className="space-y-4 p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-slate-600" />
                <span className="text-sm font-semibold text-slate-300">Feature #{idx + 1}</span>
              </div>
              <Button
                onClick={() => remove(idx)}
                variant="ghost"
                size="sm"
                className="h-8 w-8 rounded-lg p-0 text-slate-500 hover:bg-red-900/30 hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor={`feat-${idx}-title`} className="text-xs uppercase tracking-widest text-slate-500">Title</label>
                <Input
                  id={`feat-${idx}-title`}
                  name={`feat-${idx}-title`}
                  className="mt-1"
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
                  className="mt-1 h-11 w-full rounded-xl border border-dark-700/60 bg-dark-900/75 px-4 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
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
                  className="mt-1 h-11 w-full rounded-xl border border-dark-700/60 bg-dark-900/75 px-4 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
                  value={feat.color}
                  onChange={(e) => update(idx, "color", e.target.value)}
                >
                  {COLOR_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Button
        onClick={addFeature}
        variant="ghost"
        className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-dark-600 text-sm text-slate-400 hover:border-neon-500/50 hover:text-neon-300"
      >
        <Plus className="h-4 w-4" /> Add Feature
      </Button>

      <Button
        type="button"
        loading={saving}
        onClick={handleSave}
        className="w-full"
      >
        Save Features Page
      </Button>
      </div>
    </div>
  )
}
