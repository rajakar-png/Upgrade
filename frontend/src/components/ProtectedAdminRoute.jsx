import { useEffect, useState } from "react"
import { Navigate } from "react-router-dom"

function getApiUrl() {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL
  if (window.location.hostname.includes("app.github.dev")) {
    return window.location.origin.replace("-5173.", "-4000.") + "/api"
  }
  return "http://localhost:4000/api"
}

export default function ProtectedAdminRoute({ children }) {
  const token = localStorage.getItem("token")

  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("user") || "{}") } catch { return {} }
  })
  const [checking, setChecking] = useState(() => !!token)

  // Always verify the role from the server — don't trust potentially stale localStorage
  useEffect(() => {
    if (!token) return
    fetch(`${getApiUrl()}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(u => {
        if (u) {
          localStorage.setItem("user", JSON.stringify(u))
          setUser(u)
        }
        setChecking(false)
      })
      .catch(() => setChecking(false))
  }, [token])

  if (!token) return <Navigate to="/login" replace />

  if (checking) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-400" />
      </div>
    )
  }

  if (user.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="rounded-2xl border border-red-800/60 bg-red-900/20 p-8 text-center">
          <h2 className="text-2xl font-bold text-red-300 mb-2">Access Denied</h2>
          <p className="text-slate-400 mb-4">This area is restricted to administrators only.</p>
          <a
            href="/dashboard"
            className="button-3d rounded-xl bg-aurora-500/20 px-6 py-2 text-sm font-semibold text-aurora-200 hover:bg-aurora-500/30"
          >
            Return to Dashboard
          </a>
        </div>
      </div>
    )
  }

  return children
}
