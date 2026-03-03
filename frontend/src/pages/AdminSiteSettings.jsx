import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import AdminNav from "../components/AdminNav.jsx"
import SectionHeader from "../components/SectionHeader.jsx"
import ButtonSpinner from "../components/ButtonSpinner.jsx"
import { useAppUI } from "../context/AppUIContext.jsx"
import { api, getBackendBaseUrl } from "../services/api.js"
import { Image, Globe, Eye, EyeOff, AlertTriangle, CheckCircle, ChevronRight } from "lucide-react"

export default function AdminSiteSettings() {
  const [settings, setSettings] = useState({
    siteName: "AstraNodes",
    backgroundOverlayOpacity: 0.45,
    heroTitle: "",
    heroSubtitle: "",
    maintenanceMode: false
  })
  const [backgroundFile, setBackgroundFile] = useState(null)
  const [backgroundPreview, setBackgroundPreview] = useState("")
  const [faviconFile, setFaviconFile] = useState(null)
  const [faviconPreview, setFaviconPreview] = useState("")
  const [logoFile, setLogoFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState("")
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingBg, setUploadingBg] = useState(false)
  const [uploadingFav, setUploadingFav] = useState(false)
  const navigate = useNavigate()
  const { showSuccess, showError, refreshSiteSettings } = useAppUI()

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) {
      navigate("/login")
      return
    }

    api.getSiteSettings().then((data) => {
      if (data) {
        setSettings({
          siteName: data.siteName || "AstraNodes",
          backgroundOverlayOpacity: data.backgroundOverlayOpacity ?? 0.45,
          heroTitle: data.heroTitle || "",
          heroSubtitle: data.heroSubtitle || "",
          maintenanceMode: Boolean(data.maintenanceMode)
        })
        if (data.backgroundImage) {
          setBackgroundPreview(`${getBackendBaseUrl()}${data.backgroundImage}`)
        }
        if (data.faviconPath) {
          setFaviconPreview(`${getBackendBaseUrl()}${data.faviconPath}`)
        }
        if (data.logoPath) {
          setLogoPreview(`${getBackendBaseUrl()}${data.logoPath}`)
        }
      }
    }).catch(() => {}).finally(() => setLoading(false))
  }, [navigate])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.updateSiteSettings({
        siteName: settings.siteName,
        heroTitle: settings.heroTitle,
        heroSubtitle: settings.heroSubtitle,
        backgroundOverlayOpacity: Number(settings.backgroundOverlayOpacity),
        maintenanceMode: settings.maintenanceMode
      })
      await refreshSiteSettings()
      showSuccess("Site settings saved")
    } catch (err) {
      showError(err.message || "Failed to save settings")
    } finally {
      setSaving(false)
    }
  }

  const handleBgUpload = async () => {
    if (!backgroundFile) return
    setUploadingBg(true)
    try {
      const result = await api.uploadBackgroundImage(backgroundFile)
      const path = result.data?.backgroundImage || result.backgroundImage
      if (path) setBackgroundPreview(`${getBackendBaseUrl()}${path}?v=${Date.now()}`)
      await refreshSiteSettings()
      showSuccess("Background image updated")
      setBackgroundFile(null)
    } catch (err) {
      showError(err.message || "Failed to upload background")
    } finally {
      setUploadingBg(false)
    }
  }

  const handleFaviconUpload = async () => {
    if (!faviconFile) return
    setUploadingFav(true)
    try {
      const result = await api.uploadFavicon(faviconFile)
      const path = result.data?.faviconPath || result.faviconPath
      if (path) {
        const ts = result.data?.version || Date.now()
        setFaviconPreview(`${getBackendBaseUrl()}${path}?v=${ts}`)
      }
      await refreshSiteSettings()
      showSuccess("Favicon updated")
      setFaviconFile(null)
    } catch (err) {
      showError(err.message || "Failed to upload favicon")
    } finally {
      setUploadingFav(false)
    }
  }

  const handleLogoUpload = async () => {
    if (!logoFile) return
    setUploadingLogo(true)
    try {
      const result = await api.uploadLogo(logoFile)
      const path = result.data?.logoPath || result.logoPath
      if (path) setLogoPreview(`${getBackendBaseUrl()}${path}?v=${Date.now()}`)
      await refreshSiteSettings()
      showSuccess("Logo updated — header logo refreshed")
      setLogoFile(null)
    } catch (err) {
      showError(err.message || "Failed to upload logo")
    } finally {
      setUploadingLogo(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-slate-400">Loading settings…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark-950">
      <AdminNav />
      <div className="max-w-7xl mx-auto p-6 space-y-8">
      <SectionHeader
        title="Site Settings"
        subtitle="Control site name, background, favicon, and maintenance mode."
        action={
          <button
            onClick={() => navigate("/admin")}
            className="button-3d rounded-xl border border-slate-700/60 px-4 py-2 text-sm font-semibold text-slate-300"
          >
            ← Back to Admin
          </button>
        }
      />

      <form onSubmit={handleSave} className="space-y-6">
        {/* General Settings */}
        <div className="glass rounded-2xl border border-slate-700/40 p-6 space-y-5">
          <h3 className="flex items-center gap-2 text-base font-semibold text-slate-100">
            <Globe className="h-4 w-4 text-neon-300" />
            General
          </h3>

          <div>
            <label htmlFor="site-name" className="text-xs uppercase tracking-[0.3em] text-slate-500">Site Name</label>
            <input
              id="site-name"
              name="siteName"
              type="text"
              value={settings.siteName}
              onChange={(e) => setSettings((s) => ({ ...s, siteName: e.target.value }))}
              className="input mt-2 w-full"
              placeholder="AstraNodes"
            />
          </div>

          <div>
            <label htmlFor="hero-title" className="text-xs uppercase tracking-[0.3em] text-slate-500">Hero Title</label>
            <input
              id="hero-title"
              name="heroTitle"
              type="text"
              value={settings.heroTitle}
              onChange={(e) => setSettings((s) => ({ ...s, heroTitle: e.target.value }))}
              className="input mt-2 w-full"
              placeholder="Hosting crafted for Minecraft empires."
            />
          </div>

          <div>
            <label htmlFor="hero-subtitle" className="text-xs uppercase tracking-[0.3em] text-slate-500">Hero Subtitle</label>
            <textarea
              id="hero-subtitle"
              name="heroSubtitle"
              value={settings.heroSubtitle}
              onChange={(e) => setSettings((s) => ({ ...s, heroSubtitle: e.target.value }))}
              rows={3}
              className="input mt-2 w-full resize-none"
              placeholder="Launch servers in seconds…"
            />
          </div>

          <div>
            <label htmlFor="bg-overlay-opacity" className="text-xs uppercase tracking-[0.3em] text-slate-500">
              Background Overlay Opacity
              <span className="ml-2 font-mono text-neon-300">
                {Math.round(Number(settings.backgroundOverlayOpacity) * 100)}%
              </span>
            </label>
            <input
              id="bg-overlay-opacity"
              name="backgroundOverlayOpacity"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={settings.backgroundOverlayOpacity}
              onChange={(e) => setSettings((s) => ({ ...s, backgroundOverlayOpacity: parseFloat(e.target.value) }))}
              className="mt-2 w-full accent-neon-400"
            />
            <div className="mt-1 flex justify-between text-xs text-slate-600">
              <span>0% (transparent)</span>
              <span>100% (opaque)</span>
            </div>
          </div>
        </div>

        {/* Maintenance Mode */}
        <div className={`glass rounded-2xl border p-6 space-y-3 ${settings.maintenanceMode ? "border-amber-500/40" : "border-slate-700/40"}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className={`h-4 w-4 ${settings.maintenanceMode ? "text-amber-400" : "text-slate-500"}`} />
              <h3 className="text-base font-semibold text-slate-100">Maintenance Mode</h3>
            </div>
            <button
              type="button"
              onClick={() => setSettings((s) => ({ ...s, maintenanceMode: !s.maintenanceMode }))}
              className={`relative h-7 w-13 rounded-full transition-colors ${settings.maintenanceMode ? "bg-amber-500" : "bg-slate-700"}`}
              role="switch"
              aria-checked={settings.maintenanceMode}
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${settings.maintenanceMode ? "translate-x-7" : "translate-x-1"}`}
              />
            </button>
          </div>
          <p className="text-xs text-slate-400">
            {settings.maintenanceMode
              ? "⚠️ Maintenance mode is ACTIVE — users will see a maintenance page"
              : "Maintenance mode is disabled — site is live for all users"}
          </p>
        </div>

        <ButtonSpinner
          type="submit"
          loading={saving}
          className="button-3d w-full rounded-xl bg-neon-500/20 border border-neon-500/30 px-4 py-3 text-sm font-semibold text-neon-200 hover:bg-neon-500/30"
        >
          Save General Settings
        </ButtonSpinner>
      </form>

      {/* Background Image Upload */}
      <div className="glass rounded-2xl border border-slate-700/40 p-6 space-y-5">
        <h3 className="flex items-center gap-2 text-base font-semibold text-slate-100">
          <Image className="h-4 w-4 text-neon-300" />
          Background Image
        </h3>

        {backgroundPreview && (
          <div className="relative overflow-hidden rounded-xl border border-slate-700/60 h-32">
            <img src={backgroundPreview} alt="Background" className="w-full h-full object-cover opacity-60" />
            <span className="absolute bottom-2 left-2 text-xs text-slate-300 bg-ink-950/70 px-2 py-1 rounded">Current</span>
          </div>
        )}

        <div className="flex gap-3">
          <label className="flex-1 cursor-pointer">
            <span className="block text-xs text-slate-500 mb-1">Image file (.jpg/.png/.webp)</span>
            <input
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={(e) => {
                const f = e.target.files?.[0] || null
                setBackgroundFile(f)
                if (f) setBackgroundPreview(URL.createObjectURL(f))
              }}
              className="input w-full text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-neon-500/20 file:text-neon-200 file:text-xs file:px-3 file:py-1.5"
            />
          </label>
          <div className="flex items-end">
            <ButtonSpinner
              type="button"
              loading={uploadingBg}
              disabled={!backgroundFile}
              onClick={handleBgUpload}
              className="button-3d rounded-xl bg-neon-500/20 border border-neon-500/30 px-4 py-2 text-sm font-semibold text-neon-200 hover:bg-neon-500/30 disabled:opacity-40"
            >
              Upload
            </ButtonSpinner>
          </div>
        </div>
        <p className="text-xs text-slate-500">
          No blur — uses background-size:cover. Set overlay opacity above to control visibility.
        </p>
      </div>

      {/* Favicon Upload */}
      <div className="glass rounded-2xl border border-slate-700/40 p-6 space-y-5">
        <h3 className="flex items-center gap-2 text-base font-semibold text-slate-100">
          <CheckCircle className="h-4 w-4 text-neon-300" />
          Favicon
        </h3>

        {faviconPreview && (
          <div className="flex items-center gap-3">
            <img src={faviconPreview} alt="Favicon" className="h-8 w-8 rounded" />
            <span className="text-xs text-slate-400">Current favicon</span>
          </div>
        )}

        <div className="flex gap-3">
          <label className="flex-1 cursor-pointer">
            <span className="block text-xs text-slate-500 mb-1">Favicon (.ico/.png/.svg)</span>
            <input
              type="file"
              accept=".ico,.png,.svg,image/x-icon,image/png,image/svg+xml"
              onChange={(e) => {
                const f = e.target.files?.[0] || null
                setFaviconFile(f)
                if (f) setFaviconPreview(URL.createObjectURL(f))
              }}
              className="input w-full text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-aurora-500/20 file:text-aurora-200 file:text-xs file:px-3 file:py-1.5"
            />
          </label>
          <div className="flex items-end">
            <ButtonSpinner
              type="button"
              loading={uploadingFav}
              disabled={!faviconFile}
              onClick={handleFaviconUpload}
              className="button-3d rounded-xl bg-aurora-500/20 border border-aurora-500/30 px-4 py-2 text-sm font-semibold text-aurora-200 hover:bg-aurora-500/30 disabled:opacity-40"
            >
              Upload
            </ButtonSpinner>
          </div>
        </div>
        <p className="text-xs text-slate-500">
          Cache-busted automatically after upload. Browser tab will show new favicon instantly.
        </p>
      </div>

      {/* Logo Upload */}
      <div className="glass rounded-2xl border border-slate-700/40 p-6 space-y-5">
        <h3 className="flex items-center gap-2 text-base font-semibold text-slate-100">
          <Image className="h-4 w-4 text-aurora-300" />
          Site Logo
        </h3>
        <p className="text-xs text-slate-400">
          Replaces the letter avatar in the header/sidebar with a custom image. Recommended size: 36×36px or any square PNG/SVG.
        </p>

        {logoPreview && (
          <div className="flex items-center gap-3">
            <img src={logoPreview} alt="Logo" className="h-9 w-9 rounded-xl object-contain border border-slate-700/60" />
            <span className="text-xs text-slate-400">Current logo</span>
          </div>
        )}

        <div className="flex gap-3">
          <label className="flex-1 cursor-pointer">
            <span className="block text-xs text-slate-500 mb-1">Logo image (.png/.svg/.webp)</span>
            <input
              type="file"
              accept="image/png,image/webp,image/svg+xml,image/jpeg"
              onChange={(e) => {
                const f = e.target.files?.[0] || null
                setLogoFile(f)
                if (f) setLogoPreview(URL.createObjectURL(f))
              }}
              className="input w-full text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-ember-500/20 file:text-ember-200 file:text-xs file:px-3 file:py-1.5"
            />
          </label>
          <div className="flex items-end">
            <ButtonSpinner
              type="button"
              loading={uploadingLogo}
              disabled={!logoFile}
              onClick={handleLogoUpload}
              className="button-3d rounded-xl bg-ember-500/20 border border-ember-500/30 px-4 py-2 text-sm font-semibold text-ember-200 hover:bg-ember-500/30 disabled:opacity-40"
            >
              Upload
            </ButtonSpinner>
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}
