import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { api, getBackendBaseUrl } from "../services/api.js"

// Convert a relative upload path like /uploads/foo.png → full backend URL
function toFullUrl(path) {
  if (!path) return ""
  if (path.startsWith("http")) return path
  return `${getBackendBaseUrl()}${path}`
}

const AppUIContext = createContext(null)

function ensureFavicon(pathWithVersion) {
  if (!pathWithVersion) return

  let link = document.querySelector("link[rel='icon']")
  if (!link) {
    link = document.createElement("link")
    link.rel = "icon"
    document.head.appendChild(link)
  }

  link.href = pathWithVersion
}

export function AppUIProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const [loadingCount, setLoadingCount] = useState(0)
  const [siteSettings, setSiteSettings] = useState({
    siteName: "AstraNodes",
    backgroundImage: "",
    backgroundOverlayOpacity: 0.45,
    faviconPath: "",
    logoPath: "",
    heroTitle: "",
    heroSubtitle: "",
    maintenanceMode: false
  })

  const notify = useCallback((type, message) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    setToasts((prev) => [...prev, { id, type, message }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id))
    }, 4200)
  }, [])

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const showSuccess = useCallback((message) => notify("success", message), [notify])
  const showError = useCallback((message) => notify("error", message), [notify])
  const showWarning = useCallback((message) => notify("warning", message), [notify])

  const beginLoading = useCallback(() => {
    setLoadingCount((count) => count + 1)
  }, [])

  const endLoading = useCallback(() => {
    setLoadingCount((count) => Math.max(0, count - 1))
  }, [])

  const refreshSiteSettings = useCallback(async () => {
    try {
      const settings = await api.getSiteSettings()
      if (settings) setSiteSettings(settings)
      return settings ?? null
    } catch {
      return null
    }
  }, [])

  useEffect(() => {
    refreshSiteSettings() // eslint-disable-line react-hooks/set-state-in-effect
  }, [refreshSiteSettings])

  useEffect(() => {
    document.title = siteSettings.siteName || "AstraNodes"

    const bgUrl = toFullUrl(siteSettings.backgroundImage)
    if (bgUrl) {
      document.documentElement.style.setProperty("--site-bg-image", `url('${bgUrl}')`)
    } else {
      document.documentElement.style.setProperty("--site-bg-image", "none")
    }

    const overlayOpacity = Number(siteSettings.backgroundOverlayOpacity ?? 0.45)
    document.documentElement.style.setProperty("--site-overlay-opacity", String(Math.min(1, Math.max(0, overlayOpacity))))

    if (siteSettings.faviconPath) {
      const ts = Date.now()
      ensureFavicon(`${toFullUrl(siteSettings.faviconPath)}?v=${ts}`)
    }
  }, [siteSettings])

  const value = useMemo(() => ({
    toasts,
    removeToast,
    showSuccess,
    showError,
    showWarning,
    beginLoading,
    endLoading,
    isLoading: loadingCount > 0,
    siteSettings,
    refreshSiteSettings
  }), [
    toasts,
    removeToast,
    showSuccess,
    showError,
    showWarning,
    beginLoading,
    endLoading,
    loadingCount,
    siteSettings,
    refreshSiteSettings
  ])

  return <AppUIContext.Provider value={value}>{children}</AppUIContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAppUI() {
  const context = useContext(AppUIContext)
  if (!context) {
    throw new Error("useAppUI must be used within AppUIProvider")
  }
  return context
}
