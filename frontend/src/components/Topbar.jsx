import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { ChevronDown, User, Settings, LogOut, Coins } from "lucide-react"
import Button from "./ui/Button.jsx"

function readUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}")
  } catch {
    return {}
  }
}

export default function Topbar() {
  const navigate = useNavigate()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)
  const [user, setUser] = useState(readUser)
  const balance = user.coins || 0

  useEffect(() => {
    const sync = () => setUser(readUser())
    window.addEventListener("storage", sync)
    window.addEventListener("astra:data-sync", sync)
    return () => {
      window.removeEventListener("storage", sync)
      window.removeEventListener("astra:data-sync", sync)
    }
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    const handleEsc = (e) => {
      if (e.key === "Escape") setDropdownOpen(false)
    }
    document.addEventListener("mousedown", handleClickOutside)
    window.addEventListener("keydown", handleEsc)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      window.removeEventListener("keydown", handleEsc)
    }
  }, [dropdownOpen])

  const handleLogout = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    navigate("/login")
  }

  return (
    <header className="flex flex-col items-start justify-between gap-4 border-b border-dark-700/50 pb-6 sm:flex-row sm:items-center">
      <div>
        <h1 className="text-2xl font-bold text-white">Welcome back</h1>
        <p className="text-sm text-slate-400 mt-1">{user.email}</p>
      </div>
      <div className="flex w-full items-center justify-end gap-3 sm:w-auto">
        {/* Balance Display */}
        <div className="flex h-11 items-center gap-2 rounded-xl border border-dark-700/50 bg-dark-800/60 px-4 backdrop-blur-sm">
          <Coins className="h-4 w-4 text-primary-400" />
          <span className="text-sm font-semibold text-white">{balance} coins</span>
        </div>

        {/* User Menu */}
        <div className="relative" ref={dropdownRef}>
          <Button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="px-3"
            variant="secondary"
            size="md"
            aria-haspopup="menu"
            aria-expanded={dropdownOpen}
            aria-controls="topbar-user-menu"
          >
            <div className="h-8 w-8 rounded-full bg-primary-500/15 border border-primary-500/20 flex items-center justify-center">
              <User className="h-4 w-4 text-primary-400" />
            </div>
            <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
          </Button>

          {dropdownOpen && (
            <div
              id="topbar-user-menu"
              role="menu"
              aria-label="User menu"
              className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-xl border border-dark-700/50 bg-dark-800/95 shadow-2xl backdrop-blur-xl"
            >
              <a
                href="/settings"
                role="menuitem"
                className="flex items-center gap-3 px-4 py-3 text-sm text-slate-300 transition-all hover:bg-dark-700/60 hover:text-white"
              >
                <Settings className="h-4 w-4" />
                Account Settings
              </a>
              <button
                onClick={handleLogout}
                role="menuitem"
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-red-400 transition-all hover:bg-red-500/10"
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
