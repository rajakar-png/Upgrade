import { NavLink } from "react-router-dom"
import {
  LayoutDashboard, MessageSquare, Layout, Settings, List,
  MapPin, Info, BookOpen, Activity, Package
} from "lucide-react"

const adminNav = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard },
  { to: "/admin/tickets", label: "Support Tickets", icon: MessageSquare },
  { to: "/admin/plans", label: "Plans", icon: Package },
  { to: "/admin/frontpage", label: "Homepage Content", icon: Layout },
  { to: "/admin/landing-plans", label: "Landing Plans", icon: List },
  { to: "/admin/features", label: "Features", icon: List },
  { to: "/admin/locations", label: "Locations", icon: MapPin },
  { to: "/admin/about", label: "About", icon: Info },
  { to: "/admin/knowledgebase", label: "Knowledgebase", icon: BookOpen },
  { to: "/admin/status", label: "Status", icon: Activity },
  { to: "/admin/site-settings", label: "Site Settings", icon: Settings }
]

export default function AdminNav() {
  return (
    <nav className="flex flex-wrap items-center gap-2 p-4 bg-dark-800 border-b border-dark-700 overflow-x-auto">
      {adminNav.map((item) => {
        const Icon = item.icon
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/admin"}
            className={({ isActive }) =>
              `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? "bg-primary-500/10 text-primary-400 border border-primary-500/20"
                  : "text-slate-400 hover:bg-white/5 hover:text-white border border-transparent"
              }`
            }
          >
            <Icon size={16} />
            {item.label}
          </NavLink>
        )
      })}
    </nav>
  )
}
