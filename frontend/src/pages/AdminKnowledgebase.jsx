import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react"
import AdminNav from "../components/AdminNav.jsx"
import SectionHeader from "../components/SectionHeader.jsx"
import { useAppUI } from "../context/AppUIContext.jsx"
import { api } from "../services/api.js"
import Button from "../components/ui/Button.jsx"
import Card from "../components/ui/Card.jsx"
import Input from "../components/ui/Input.jsx"

const DEFAULTS = [
  {
    category: "Getting Started",
    items: [
      { q: "How do I create a server?", a: "Register an account, go to Plans, select a plan, and click Deploy. Your server is provisioned in seconds." },
      { q: "What Minecraft versions are supported?", a: "All major Java Edition versions (1.8–1.21) plus Forge, Fabric, Paper, Purpur, and Bungeecord." },
    ]
  },
  {
    category: "Billing & Coins",
    items: [
      { q: "What are coins?", a: "Coins are the internal currency. Earn them via AFK sessions, redeem vouchers, or buy via billing." },
      { q: "Do coins expire?", a: "Coins never expire while your account is active. Servers do expire if coins run out at renewal." },
    ]
  },
  {
    category: "Technical",
    items: [
      { q: "How does DDoS protection work?", a: "All nodes are behind enterprise Anycast mitigation. Attacks are scrubbed before reaching your server." },
      { q: "Can I upload my own JAR?", a: "Yes — use the Pterodactyl file manager or SFTP to upload custom JARs, plugins, and worlds." },
    ]
  },
  {
    category: "Account & Security",
    items: [
      { q: "How do I reset my password?", a: "Go to Dashboard → Settings and use the Reset Password section. You'll need your current password." },
    ]
  },
]

export default function AdminKnowledgebase() {
  const [categories, setCategories] = useState(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState({})
  const navigate = useNavigate()
  const { showSuccess, showError } = useAppUI()

  const loadKnowledgebaseData = useCallback(async () => {
    const data = await api.getAdminFrontpage()
    const section = data?.knowledgebase_page?.data
    if (Array.isArray(section) && section.length > 0) setCategories(section)
  }, [])

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) { navigate("/login"); return }

    loadKnowledgebaseData()
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [navigate, loadKnowledgebaseData])

  useEffect(() => {
    const refresh = () => loadKnowledgebaseData().catch(() => {})
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
  }, [loadKnowledgebaseData])

  const toggleExpand = (idx) => setExpanded((prev) => ({ ...prev, [idx]: !prev[idx] }))

  const setCatName = (idx, name) => {
    setCategories((prev) => prev.map((c, i) => i === idx ? { ...c, category: name } : c))
  }

  const updateItem = (catIdx, itemIdx, field, val) => {
    setCategories((prev) => prev.map((c, ci) => {
      if (ci !== catIdx) return c
      const items = c.items.map((it, ii) => ii === itemIdx ? { ...it, [field]: val } : it)
      return { ...c, items }
    }))
  }

  const addItem = (catIdx) => {
    setCategories((prev) => prev.map((c, ci) => ci === catIdx ? { ...c, items: [...c.items, { q: "", a: "" }] } : c))
  }

  const removeItem = (catIdx, itemIdx) => {
    setCategories((prev) => prev.map((c, ci) => {
      if (ci !== catIdx) return c
      return { ...c, items: c.items.filter((_, ii) => ii !== itemIdx) }
    }))
  }

  const removeCategory = (idx) => setCategories((prev) => prev.filter((_, i) => i !== idx))

  const addCategory = () => setCategories((prev) => [...prev, { category: "New Category", items: [{ q: "", a: "" }] }])

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.updateFrontpageSection("knowledgebase_page", categories)
      showSuccess("Knowledgebase saved")
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
        title="Knowledgebase Page"
        subtitle="Edit FAQ categories and Q&A items shown on /knowledgebase."
        action={
          <div className="flex gap-3">
            <Button onClick={() => navigate("/knowledgebase")} variant="secondary">
              View Page ↗
            </Button>
            <Button onClick={() => navigate("/admin")} variant="secondary">
              ← Admin
            </Button>
          </div>
        }
      />

      <div className="space-y-3">
        {categories.map((cat, catIdx) => (
          <Card key={catIdx} elevated className="overflow-hidden">
            {/* Category header */}
            <div className="flex items-center gap-3 p-4">
              <Button
                type="button"
                onClick={() => toggleExpand(catIdx)}
                variant="ghost"
                className="flex h-auto flex-1 items-center gap-3 p-0 text-left"
              >
                {expanded[catIdx] ? <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />}
                <Input
                  onClick={(e) => e.stopPropagation()}
                  value={cat.category}
                  onChange={(e) => setCatName(catIdx, e.target.value)}
                  className="flex-1 text-sm font-semibold"
                  placeholder="Category name"
                />
              </Button>
              <span className="rounded-full border border-dark-700/40 px-2 py-0.5 text-xs text-slate-500">{cat.items.length} items</span>
              <Button onClick={() => removeCategory(catIdx)} variant="ghost" size="sm" className="h-8 w-8 rounded-lg p-0 text-slate-500 hover:text-red-400">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            {/* Items */}
            {expanded[catIdx] && (
              <div className="border-t border-dark-700/40 p-4 space-y-3">
                {cat.items.map((item, itemIdx) => (
                  <div key={itemIdx} className="rounded-xl border border-dark-700/30 bg-ink-900/40 p-4 space-y-3">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 space-y-2">
                        <div>
                          <label htmlFor={`kb-${catIdx}-${itemIdx}-q`} className="text-xs uppercase tracking-widest text-slate-500">Question</label>
                          <Input
                            id={`kb-${catIdx}-${itemIdx}-q`}
                            name={`kb-${catIdx}-${itemIdx}-q`}
                            className="mt-1"
                            value={item.q}
                            onChange={(e) => updateItem(catIdx, itemIdx, "q", e.target.value)}
                            placeholder="Frequently asked question"
                          />
                        </div>
                        <div>
                          <label htmlFor={`kb-${catIdx}-${itemIdx}-a`} className="text-xs uppercase tracking-widest text-slate-500">Answer</label>
                          <textarea
                            id={`kb-${catIdx}-${itemIdx}-a`}
                            name={`kb-${catIdx}-${itemIdx}-a`}
                            className="input mt-1 w-full resize-none"
                            rows={3}
                            value={item.a}
                            onChange={(e) => updateItem(catIdx, itemIdx, "a", e.target.value)}
                            placeholder="Detailed answer"
                          />
                        </div>
                      </div>
                      <Button onClick={() => removeItem(catIdx, itemIdx)} variant="ghost" size="sm" className="mt-6 h-8 w-8 rounded-lg p-0 text-slate-500 hover:text-red-400">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button onClick={() => addItem(catIdx)} variant="ghost" size="sm" className="w-fit px-1 py-1 text-xs text-slate-500 hover:text-neon-300">
                  <Plus className="h-3.5 w-3.5" /> Add Q&A
                </Button>
              </div>
            )}
          </Card>
        ))}
      </div>

      <Button
        onClick={addCategory}
        variant="ghost"
        className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-dark-600 text-sm text-slate-400 hover:border-neon-500/50 hover:text-neon-300"
      >
        <Plus className="h-4 w-4" /> Add Category
      </Button>

      <Button
        type="button"
        loading={saving}
        onClick={handleSave}
        className="w-full"
      >
        Save Knowledgebase
      </Button>
      </div>
    </div>
  )
}
