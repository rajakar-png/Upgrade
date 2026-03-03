import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Plus, Trash2 } from "lucide-react"
import AdminNav from "../components/AdminNav.jsx"
import SectionHeader from "../components/SectionHeader.jsx"
import ButtonSpinner from "../components/ButtonSpinner.jsx"
import { useAppUI } from "../context/AppUIContext.jsx"
import { api } from "../services/api.js"

const DEFAULTS = {
  heading: "Powering Minecraft communities worldwide",
  subheading: "Built by developers who understand that every millisecond and every coin matters.",
  stats: {
    servers: "1000+",
    countries: "20+",
    uptime: "99.9%",
    players: "50k+"
  },
  storyTitle: "Our Story",
  storyText: "AstraNodes was built to solve a simple problem: most Minecraft hosts are expensive, unreliable, or both. We created a platform with fair coin-based billing, automated renewals, and a clean dashboard that gets out of your way.",
  storyText2: "Every feature was designed around real operator feedback — from the anti-abuse coupon system to the dynamic front page you can update without touching code.",
  values: [
    { title: "Transparency", description: "No hidden fees. Coin costs are visible before purchase." },
    { title: "Reliability", description: "99.9% uptime SLA backed by enterprise-grade nodes." },
    { title: "Fairness", description: "AFK coin earning means free players have a path to hosting." },
    { title: "Speed", description: "Server provisioning completes in under 30 seconds." },
  ]
}

export default function AdminAbout() {
  const [data, setData] = useState(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()
  const { showSuccess, showError } = useAppUI()

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) { navigate("/login"); return }

    api.getAdminFrontpage()
      .then((res) => {
        const section = res?.about_page?.data
        if (section && typeof section === "object" && section.heading) {
          setData({ ...DEFAULTS, ...section, stats: { ...DEFAULTS.stats, ...(section.stats || {}) } })
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [navigate])

  const set = (field, value) => setData((prev) => ({ ...prev, [field]: value }))
  const setStat = (key, value) => setData((prev) => ({ ...prev, stats: { ...prev.stats, [key]: value } }))
  
  const updateValue = (idx, field, val) => {
    setData((prev) => ({ ...prev, values: prev.values.map((v, i) => i === idx ? { ...v, [field]: val } : v) }))
  }
  const addValue = () => setData((prev) => ({ ...prev, values: [...prev.values, { title: "", description: "" }] }))
  const removeValue = (idx) => setData((prev) => ({ ...prev, values: prev.values.filter((_, i) => i !== idx) }))

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.updateFrontpageSection("about_page", data)
      showSuccess("About page saved")
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
        title="About Page"
        subtitle="Edit the content shown on the public /about page."
        action={
          <div className="flex gap-3">
            <button onClick={() => navigate("/about")} className="button-3d rounded-xl border border-slate-700/60 px-4 py-2 text-sm font-semibold text-slate-300">
              View Page ↗
            </button>
            <button onClick={() => navigate("/admin")} className="button-3d rounded-xl border border-slate-700/60 px-4 py-2 text-sm font-semibold text-slate-300">
              ← Admin
            </button>
          </div>
        }
      />

      {/* Hero Text */}
      <div className="glass rounded-2xl border border-slate-700/40 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-200">Hero Section</h3>
        <div>
          <label htmlFor="about-heading" className="text-xs uppercase tracking-widest text-slate-500">Heading</label>
          <input id="about-heading" name="heading" className="input mt-1 w-full" value={data.heading} onChange={(e) => set("heading", e.target.value)} />
        </div>
        <div>
          <label htmlFor="about-subheading" className="text-xs uppercase tracking-widest text-slate-500">Subheading</label>
          <textarea id="about-subheading" name="subheading" className="input mt-1 w-full resize-none" rows={2} value={data.subheading} onChange={(e) => set("subheading", e.target.value)} />
        </div>
      </div>

      {/* Stats */}
      <div className="glass rounded-2xl border border-slate-700/40 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-200">Stats Cards</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { key: "servers", label: "Servers" },
            { key: "countries", label: "Countries" },
            { key: "uptime", label: "Uptime" },
            { key: "players", label: "Players" },
          ].map(({ key, label }) => (
            <div key={key}>
              <label htmlFor={`about-stat-${key}`} className="text-xs uppercase tracking-widest text-slate-500">{label}</label>
              <input id={`about-stat-${key}`} name={key} className="input mt-1 w-full" value={data.stats?.[key] || ""} onChange={(e) => setStat(key, e.target.value)} placeholder={DEFAULTS.stats[key]} />
            </div>
          ))}
        </div>
      </div>

      {/* Story */}
      <div className="glass rounded-2xl border border-slate-700/40 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-200">Story Section</h3>
        <div>
          <label htmlFor="about-story-title" className="text-xs uppercase tracking-widest text-slate-500">Section Title</label>
          <input id="about-story-title" name="storyTitle" className="input mt-1 w-full" value={data.storyTitle} onChange={(e) => set("storyTitle", e.target.value)} />
        </div>
        <div>
          <label htmlFor="about-story-text" className="text-xs uppercase tracking-widest text-slate-500">Paragraph 1</label>
          <textarea id="about-story-text" name="storyText" className="input mt-1 w-full resize-none" rows={3} value={data.storyText} onChange={(e) => set("storyText", e.target.value)} />
        </div>
        <div>
          <label htmlFor="about-story-text2" className="text-xs uppercase tracking-widest text-slate-500">Paragraph 2</label>
          <textarea id="about-story-text2" name="storyText2" className="input mt-1 w-full resize-none" rows={3} value={data.storyText2} onChange={(e) => set("storyText2", e.target.value)} />
        </div>
      </div>

      {/* Values */}
      <div className="glass rounded-2xl border border-slate-700/40 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-200">Values Grid</h3>
        <div className="space-y-3">
          {(data.values || []).map((v, idx) => (
            <div key={idx} className="flex gap-3 items-start">
              <div className="flex-1 grid grid-cols-2 gap-3">
                <input className="input" value={v.title} onChange={(e) => updateValue(idx, "title", e.target.value)} placeholder="Value title" />
                <input className="input" value={v.description} onChange={(e) => updateValue(idx, "description", e.target.value)} placeholder="Short description" />
              </div>
              <button onClick={() => removeValue(idx)} className="mt-2 rounded-lg p-1.5 text-slate-500 hover:text-red-400">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <button onClick={addValue} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-neon-300">
          <Plus className="h-3.5 w-3.5" /> Add value
        </button>
      </div>

      <ButtonSpinner
        loading={saving}
        onClick={handleSave}
        className="button-3d w-full rounded-xl bg-neon-500/20 border border-neon-500/30 px-4 py-3 text-sm font-semibold text-neon-200 hover:bg-neon-500/30"
      >
        Save About Page
      </ButtonSpinner>
      </div>
    </div>
  )
}
