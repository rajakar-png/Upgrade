import { useEffect, useState } from "react"
import { NavLink, useNavigate } from "react-router-dom"
import { LayoutDashboard, Package, Coins, Ticket, CreditCard, Server, Shield, LogOut, LifeBuoy, Layout, Star, Settings, SlidersHorizontal, Zap, MapPin, Users, BookOpen, Activity, ChevronRight } from "lucide-react"
import Logo from "./Logo.jsx"

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/plans", label: "Plans", icon: Package },
  { to: "/servers", label: "Servers", icon: Server },
  { to: "/billing", label: "Billing", icon: CreditCard },
  { to: "/coins", label: "Coins", icon: Coins },
  { to: "/support", label: "Support", icon: LifeBuoy }
]

export default function Sidebar() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("user") || "{}") } catch { return {} }
  })
  const isAdmin = user.role === "admin"
  const navigate = useNavigate()

  // Re-read user whenever localStorage changes (e.g. after callback redirect)
  useEffect(() => {
    const sync = () => {
      try { setUser(JSON.parse(localStorage.getItem("user") || "{}")) } catch { setUser({}) }
    }
    window.addEventListener("storage", sync)
    return () => window.removeEventListener("storage", sync)
  }, [])

  const handleLogout = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    navigate("/login")
  }

  return (
    <aside className="hidden w-64 flex-col gap-6 border-r border-white/[0.06] bg-dark-900/80 backdrop-blur-xl px-5 py-6 lg:flex">
      <Logo size="lg" />
      
      <nav className="flex flex-1 flex-col gap-1">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-primary-500/10 text-primary-400 border border-primary-500/20 shadow-sm shadow-primary-500/10"
                    : "text-slate-400 hover:bg-white/5 hover:text-white border border-transparent hover:border-white/5"
                }`
              }
            >
              <Icon className="h-5 w-5 transition-transform duration-200 group-hover:scale-110" />
              {item.label}
              <ChevronRight className="h-3.5 w-3.5 ml-auto opacity-0 transition-all group-hover:opacity-50 group-hover:translate-x-0.5" />
            </NavLink>
          )
        })}
      </nav>
      
      <div className="space-y-3">
        {isAdmin && (
          <div className="rounded-xl border border-primary-500/20 bg-primary-500/5 p-4 transition-all hover:border-primary-500/30 hover:bg-primary-500/10">
            <NavLink
              to="/admin"
              className="flex items-center gap-2 text-sm font-semibold text-white hover:text-primary-300 transition-colors"
            >
              <Shield className="h-4 w-4 text-primary-400" />
              Admin panel
              <ChevronRight className="h-3.5 w-3.5 ml-auto opacity-50" />
            </NavLink>
          </div>
        )}
        
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="mb-3 text-sm">
            <p className="font-semibold text-white truncate">{user.email}</p>
            <p className="mt-1 text-xs text-slate-500 font-medium">{isAdmin ? "Administrator" : "User"}</p>
          </div>
          <button
            onClick={handleLogout}
            className="button-3d flex w-full items-center justify-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/20 hover:border-red-500/30 transition-all"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </div>
    </aside>
  )
}
