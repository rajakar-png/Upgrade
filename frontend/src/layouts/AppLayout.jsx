import { useEffect, useState } from "react"
import { NavLink, Outlet, useNavigate } from "react-router-dom"
import { LogOut, LayoutDashboard, Package, Coins, Server, CreditCard, Ticket, LifeBuoy, Shield } from "lucide-react"
import Sidebar from "../components/Sidebar.jsx"
import Logo from "../components/Logo.jsx"
import { api } from "../services/api.js"
import Button from "../components/ui/Button.jsx"
import ErrorBoundary from "../components/ErrorBoundary.jsx"

const mobileNav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/plans", label: "Plans", icon: Package },
  { to: "/coins", label: "Coins", icon: Coins },
  { to: "/servers", label: "Servers", icon: Server },
  { to: "/billing", label: "Billing", icon: CreditCard },
  { to: "/coupons", label: "Redeem", icon: Ticket },
  { to: "/support", label: "Support", icon: LifeBuoy }
]

export default function AppLayout() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("user") || "{}") } catch { return {} }
  })
  const isAdmin = user.role === "admin"
  const navigate = useNavigate()

  // Keep user in sync: refresh from /api/auth/me on every layout mount
  useEffect(() => {
    api.getMe()
      .then(u => {
        if (u) {
          localStorage.setItem("user", JSON.stringify(u))
          setUser(u)
        }
      })
      .catch(() => {})
  }, [])

  const handleLogout = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    navigate("/login")
  }

  return (
    <div className="min-h-screen bg-dark-950 text-slate-100">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[auto_1fr]">
        <Sidebar />
        <main className="px-4 py-6 sm:px-6 lg:px-10">
          <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-dark-700/50 bg-dark-800/40 px-4 py-4 backdrop-blur-xl lg:hidden">
            <div className="flex items-center justify-between">
              <Logo size="md" />
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <Button
                    onClick={() => navigate("/admin")}
                    variant="secondary"
                    size="sm"
                    className="px-2.5 text-xs"
                  >
                    <Shield className="h-3 w-3" />
                    Admin Panel
                  </Button>
                )}
                <Button
                  onClick={handleLogout}
                  variant="danger"
                  size="sm"
                  className="px-2.5 text-xs"
                >
                  <LogOut className="h-3 w-3" />
                  Sign out
                </Button>
              </div>
            </div>
            <div className="flex overflow-x-auto gap-1.5 pb-1 scrollbar-none">
              {mobileNav.map((item) => {
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all duration-200 ${
                        isActive ? "bg-primary-500/15 text-primary-300 border border-primary-500/20" : "text-slate-400 hover:bg-dark-800/50 hover:text-slate-200 border border-transparent"
                      }`
                    }
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </NavLink>
                )
              })}
            </div>
          </div>
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
