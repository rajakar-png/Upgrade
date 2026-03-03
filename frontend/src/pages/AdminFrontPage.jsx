import { useState, useEffect, cloneElement, isValidElement } from "react"
import { Link } from "react-router-dom"
import AdminNav from "../components/AdminNav.jsx"
import SectionHeader from "../components/SectionHeader.jsx"
import { api } from "../services/api.js"
import {
  Save, Plus, Trash2, ChevronDown, ChevronUp, ArrowLeft,
  Layout, Type, List, BarChart2, AlignLeft, X
} from "lucide-react"

const SECTIONS = [
  { key: "hero", label: "Hero Section", icon: Layout },
  { key: "features", label: "Features Section", icon: List },
  { key: "about", label: "About / CTA Section", icon: AlignLeft },
  { key: "stats", label: "Stats Section", icon: BarChart2 },
  { key: "footer", label: "Footer", icon: Type }
]

const ICON_OPTIONS = [
  "Zap", "ShieldCheck", "Coins", "Server", "Package", "Sparkles",
  "Star", "Crown", "Shield", "Rocket", "Gift", "Gem", "Trophy",
  "Clock", "Globe", "Lock", "Cpu", "HardDrive", "Wifi", "LifeBuoy"
]

export default function AdminFrontPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [content, setContent] = useState({})
  const [openSections, setOpenSections] = useState({ hero: true })
  const [toast, setToast] = useState(null)

  useEffect(() => {
    loadContent()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadContent() {
    try {
      setLoading(true)
      const data = await api.getAdminFrontpage()
      // Normalize: extract .data from each section
      const normalized = {}
      for (const key of Object.keys(data)) {
        normalized[key] = data[key]?.data ?? data[key]
      }
      setContent(normalized)
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

  function toggleSection(key) {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  async function saveSection(key) {
    try {
      setSaving(key)
      await api.updateFrontpageSection(key, content[key])
      showToast(`${key} section saved!`)
    } catch (err) {
      showToast(err.message, "error")
    } finally {
      setSaving(null)
    }
  }

  function updateHero(field, value) {
    setContent((prev) => ({ ...prev, hero: { ...prev.hero, [field]: value } }))
  }

  function updateAbout(field, value) {
    setContent((prev) => ({ ...prev, about: { ...prev.about, [field]: value } }))
  }

  function updateStats(field, value) {
    setContent((prev) => ({ ...prev, stats: { ...prev.stats, [field]: value } }))
  }

  function updateFooter(field, value) {
    setContent((prev) => ({ ...prev, footer: { ...prev.footer, [field]: value } }))
  }

  // Features
  function updateFeature(idx, field, value) {
    setContent((prev) => {
      const features = Array.isArray(prev.features) ? [...prev.features] : []
      features[idx] = { ...features[idx], [field]: value }
      return { ...prev, features }
    })
  }

  function addFeature() {
    setContent((prev) => ({
      ...prev,
      features: [...(Array.isArray(prev.features) ? prev.features : []), { title: "", description: "", icon: "Zap" }]
    }))
  }

  function removeFeature(idx) {
    setContent((prev) => ({
      ...prev,
      features: prev.features.filter((_, i) => i !== idx)
    }))
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-slate-400">Loading content...</div>
      </div>
    )
  }

  const hero = content.hero || {}
  const features = Array.isArray(content.features) ? content.features : []
  const about = content.about || {}
  const stats = content.stats || {}
  const footer = content.footer || {}

  return (
    <div className="min-h-screen bg-dark-950">
      <AdminNav />
      <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed right-6 top-6 z-50 flex items-center gap-3 rounded-xl border px-5 py-3 text-sm font-semibold shadow-lg transition-all ${
          toast.type === "error"
            ? "border-red-700/50 bg-red-900/80 text-red-200"
            : "border-neon-500/40 bg-neon-900/80 text-neon-200"
        }`}>
          {toast.msg}
          <button onClick={() => setToast(null)}><X className="h-3 w-3" /></button>
        </div>
      )}

      <div className="flex items-center gap-4">
        <Link to="/admin" className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200">
          <ArrowLeft className="h-4 w-4" /> Back to Admin
        </Link>
      </div>

      <SectionHeader title="Front Page Editor" subtitle="Edit all sections shown on the public landing page. Changes go live instantly." />

      <div className="space-y-4">
        {SECTIONS.map(({ key, label, icon: Icon }) => (
          <div key={key} className="glass rounded-2xl border border-slate-700/40 overflow-hidden">
            <button
              onClick={() => toggleSection(key)}
              className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-slate-800/30 transition"
            >
              <div className="flex items-center gap-3">
                <Icon className="h-4 w-4 text-neon-300" />
                <span className="font-semibold text-slate-100">{label}</span>
              </div>
              {openSections[key] ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </button>

            {openSections[key] && (
              <div className="border-t border-slate-700/40 px-6 py-5 space-y-4">
                {/* ── Hero ── */}
                {key === "hero" && (
                  <>
                    <Field label="Page Title">
                      <textarea rows={2} className="input w-full resize-none" value={hero.title || ""} onChange={(e) => updateHero("title", e.target.value)} />
                    </Field>
                    <Field label="Subtitle">
                      <textarea rows={3} className="input w-full resize-none" value={hero.subtitle || ""} onChange={(e) => updateHero("subtitle", e.target.value)} />
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Primary Button Text">
                        <input className="input w-full" value={hero.primaryButtonText || ""} onChange={(e) => updateHero("primaryButtonText", e.target.value)} />
                      </Field>
                      <Field label="Primary Button Link">
                        <input className="input w-full" value={hero.primaryButtonLink || ""} onChange={(e) => updateHero("primaryButtonLink", e.target.value)} />
                      </Field>
                      <Field label="Secondary Button Text">
                        <input className="input w-full" value={hero.secondaryButtonText || ""} onChange={(e) => updateHero("secondaryButtonText", e.target.value)} />
                      </Field>
                      <Field label="Secondary Button Link">
                        <input className="input w-full" value={hero.secondaryButtonLink || ""} onChange={(e) => updateHero("secondaryButtonLink", e.target.value)} />
                      </Field>
                    </div>
                    <Field label="Background Image URL (optional)">
                      <input className="input w-full" placeholder="https://..." value={hero.backgroundImage || ""} onChange={(e) => updateHero("backgroundImage", e.target.value)} />
                    </Field>
                  </>
                )}

                {/* ── Features ── */}
                {key === "features" && (
                  <div className="space-y-4">
                    {features.map((f, idx) => (
                      <div key={idx} className="relative rounded-xl border border-slate-700/50 bg-ink-900/60 p-4 space-y-3">
                        <button onClick={() => removeFeature(idx)} className="absolute right-3 top-3 rounded-lg p-1 text-slate-500 hover:bg-red-900/30 hover:text-red-300">
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Feature {idx + 1}</p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="Title">
                            <input className="input w-full" value={f.title || ""} onChange={(e) => updateFeature(idx, "title", e.target.value)} />
                          </Field>
                          <Field label="Icon">
                            <select className="input w-full" value={f.icon || "Zap"} onChange={(e) => updateFeature(idx, "icon", e.target.value)}>
                              {ICON_OPTIONS.map((ic) => <option key={ic}>{ic}</option>)}
                            </select>
                          </Field>
                        </div>
                        <Field label="Description">
                          <textarea rows={2} className="input w-full resize-none" value={f.description || ""} onChange={(e) => updateFeature(idx, "description", e.target.value)} />
                        </Field>
                      </div>
                    ))}
                    <button onClick={addFeature} className="flex items-center gap-2 rounded-xl border border-dashed border-slate-700/60 px-4 py-3 text-sm text-slate-400 hover:border-neon-500/40 hover:text-neon-300 transition w-full justify-center">
                      <Plus className="h-4 w-4" /> Add Feature
                    </button>
                  </div>
                )}

                {/* ── About ── */}
                {key === "about" && (
                  <>
                    <Field label="Heading">
                      <input className="input w-full" value={about.heading || ""} onChange={(e) => updateAbout("heading", e.target.value)} />
                    </Field>
                    <Field label="Description">
                      <textarea rows={2} className="input w-full resize-none" value={about.description || ""} onChange={(e) => updateAbout("description", e.target.value)} />
                    </Field>
                  </>
                )}

                {/* ── Stats ── */}
                {key === "stats" && (
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Active Servers">
                      <input className="input w-full" value={stats.activeServers || ""} onChange={(e) => updateStats("activeServers", e.target.value)} />
                    </Field>
                    <Field label="Total Users">
                      <input className="input w-full" value={stats.totalUsers || ""} onChange={(e) => updateStats("totalUsers", e.target.value)} />
                    </Field>
                    <Field label="Uptime %">
                      <input className="input w-full" value={stats.uptime || ""} onChange={(e) => updateStats("uptime", e.target.value)} />
                    </Field>
                  </div>
                )}

                {/* ── Footer ── */}
                {key === "footer" && (
                  <Field label="Footer Text">
                    <input className="input w-full" value={footer.text || ""} onChange={(e) => updateFooter("text", e.target.value)} />
                  </Field>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => saveSection(key)}
                    disabled={saving === key}
                    className="button-3d flex items-center gap-2 rounded-xl bg-neon-500/20 px-5 py-2.5 text-sm font-semibold text-neon-200 disabled:opacity-60"
                  >
                    <Save className="h-4 w-4" />
                    {saving === key ? "Saving..." : "Save Section"}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  const id = `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "")}`
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</label>
      {isValidElement(children) ? cloneElement(children, { id, name: id }) : children}
    </div>
  )
}
