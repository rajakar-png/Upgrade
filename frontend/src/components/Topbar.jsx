import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { ChevronDown, User, Settings, LogOut, Coins } from "lucide-react"

export default function Topbar() {
  const navigate = useNavigate()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)
  const user = (() => {
    try { return JSON.parse(localStorage.getItem("user") || "{}") } catch { return {} }
  })()
  const balance = user.coins || 0

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [dropdownOpen])

  const handleLogout = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    navigate("/login")
  }

  return (
    <header className="flex items-center justify-between gap-4 pb-6 border-b border-dark-700/50">
      <div>
        <h1 className="text-2xl font-bold text-white">
          Welcome back
        </h1>
        <p className="text-sm text-slate-400 mt-1">{user.email}</p>
      </div>
      <div className="flex items-center gap-4">
        {/* Balance Display */}
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-dark-800/60 backdrop-blur-sm border border-dark-700/50">
          <Coins className="h-4 w-4 text-primary-400" />
          <span className="text-sm font-semibold text-white">{balance} Coins</span>
        </div>

        {/* User Menu */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-dark-800/60 backdrop-blur-sm border border-dark-700/50 hover:border-dark-600/60 hover:bg-dark-800/80 transition-all"
          >
            <div className="h-8 w-8 rounded-full bg-primary-500/15 border border-primary-500/20 flex items-center justify-center">
              <User className="h-4 w-4 text-primary-400" />
            </div>
            <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 rounded-xl bg-dark-800/95 backdrop-blur-xl border border-dark-700/50 shadow-2xl overflow-hidden z-50">
              <a
                href="/settings"
                className="flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-dark-700/60 hover:text-white transition-all"
              >
                <Settings className="h-4 w-4" />
                Account settings
              </a>
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-all w-full text-left"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
