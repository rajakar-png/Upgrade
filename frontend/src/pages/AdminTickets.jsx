import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "../services/api.js"
import { useAppUI } from "../context/AppUIContext.jsx"
import AdminNav from "../components/AdminNav.jsx"
import Badge from "../components/Badge.jsx"
import { 
  MessageSquare, Clock, Search, Inbox, ChevronRight
} from "lucide-react"

export default function AdminTickets() {
  const [tickets, setTickets] = useState([])
  const [filter, setFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const { showError } = useAppUI()

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) {
      navigate("/login")
      return
    }
    loadTickets()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, navigate])

  const loadTickets = async () => {
    try {
      const token = localStorage.getItem("token")
      const data = await api.getAllTickets(token, filter !== "all" ? filter : undefined)
      setTickets(data || [])
    } catch (err) {
      showError(err.message || "Failed to load tickets.")
    } finally {
      setLoading(false)
    }
  }

  const formatRelativeTime = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const filteredTickets = tickets.filter(
    (t) =>
      t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.id.toString().includes(searchQuery)
  )

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary-500 border-t-transparent mb-4" />
        <p className="text-sm text-slate-400">Loading tickets...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark-950">
      <AdminNav />
      
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-slate-100">Support Tickets</h1>
          <p className="text-sm text-slate-400">
            Manage and respond to user support requests
          </p>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex gap-2">
            {[
              { id: "all", label: "All" },
              { id: "open", label: "Open" },
              { id: "closed", label: "Closed" }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === tab.id
                    ? "bg-primary-500 text-white"
                    : "bg-dark-800 text-slate-400 hover:bg-dark-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative flex-1 max-w-md">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input 
              type="text" 
              placeholder="Search by subject or ID..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 bg-dark-800 border border-dark-700 rounded-lg pl-10 pr-4 text-sm text-slate-100 placeholder-slate-500 focus:border-primary-500 focus:outline-none transition-all"
            />
          </div>
        </div>

        {/* Tickets List */}
        <div className="space-y-3">
          {filteredTickets.length === 0 ? (
            <div className="bg-dark-800 border border-dark-700 rounded-xl p-12 text-center">
              <Inbox className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-300 mb-2">No tickets found</h3>
              <p className="text-sm text-slate-500">
                {searchQuery ? "Try adjusting your search." : "No support tickets to display."}
              </p>
            </div>
          ) : (
            filteredTickets.map((ticket) => (
              <div 
                key={ticket.id}
                onClick={() => navigate(`/admin/tickets/${ticket.id}`)}
                className="bg-dark-800 border border-dark-700 rounded-xl p-5 hover:border-primary-500/50 transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary-500/10 text-primary-400 flex-shrink-0">
                      <MessageSquare size={20} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-base font-semibold text-slate-100 truncate ">
                          {ticket.subject}
                        </h3>
                        <Badge variant={ticket.status === 'open' ? 'success' : 'default'}>
                          {ticket.status}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-slate-400">
                        <span>#{ticket.id}</span>
                        <span>•</span>
                        <span>{ticket.user_email || "Anonymous"}</span>
                        <span>•</span>
                        <div className="flex items-center gap-1.5">
                          <Clock size={14} />
                          <span>{formatRelativeTime(ticket.updated_at)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <ChevronRight size={20} className="text-slate-600 group-hover:text-primary-500 flex-shrink-0 transition-colors" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
