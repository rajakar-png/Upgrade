import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import Topbar from "../components/Topbar.jsx"
import Badge from "../components/Badge.jsx"
import { api } from "../services/api.js"
import { 
  MessageSquare, Plus, Clock, ChevronRight, 
  LifeBuoy
} from "lucide-react"

export default function Support() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const navigate = useNavigate()

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) {
      navigate("/login")
      return
    }

    const loadTickets = async () => {
      try {
        const token = localStorage.getItem("token")
        const data = await api.getMyTickets(token)
        setTickets(data || [])
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadTickets()
  }, [navigate])

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  if (loading) return (
     <div className="flex flex-col h-96 items-center justify-center space-y-4">
       <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary-500 border-t-transparent" />
       <p className="text-sm text-slate-400">Loading tickets...</p>
     </div>
  )

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      <Topbar />

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-slate-100">Support tickets</h1>
          <p className="text-sm text-slate-400">Get help from our support team</p>
        </div>
        
        <button
          onClick={() => navigate("/support/new")}
          className="h-12 px-6 rounded-lg bg-primary-500 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-primary-600 transition-all shadow-elegant"
        >
          <Plus size={18} /> Create ticket
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          Error: {error}
        </div>
      )}

      {/* Ticket List */}
      <div className="space-y-4">
        {tickets.length > 0 ? (
          tickets.map((ticket) => (
            <button
              key={ticket.id}
              onClick={() => navigate(`/support/${ticket.id}`)}
              className="w-full text-left group bg-dark-900 border border-dark-700 rounded-xl p-6 hover:border-primary-500/50 transition-all"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="px-3 py-1 rounded-lg bg-dark-800 border border-dark-700 text-xs font-medium text-slate-400">
                      #{ticket.id.toString().padStart(4, '0')}
                    </span>
                    <span className="text-xs text-slate-500">{ticket.category}</span>
                    <span className="text-xs text-slate-500">•</span>
                    <span className="text-xs text-slate-500">{formatDate(ticket.updated_at)}</span>
                  </div>
                  
                  <h4 className="text-lg font-semibold text-slate-100 group-hover:text-primary-400 transition-colors">{ticket.subject}</h4>
                  
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <MessageSquare size={14} /> {ticket.message_count} {ticket.message_count === 1 ? 'message' : 'messages'}
                    </span>
                    {ticket.priority && (
                      <span className={`px-2 py-0.5 rounded ${
                        ticket.priority === "High" ? "bg-red-500/10 text-red-400" :
                        ticket.priority === "Medium" ? "bg-amber-500/10 text-amber-400" :
                        "bg-slate-500/10 text-slate-400"
                      }`}>
                        {ticket.priority}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <Badge
                    label={ticket.status === "open" ? "Open" : "Closed"}
                    tone={ticket.status === "open" ? "approved" : "rejected"}
                  />
                  <ChevronRight size={20} className="text-slate-600 group-hover:text-primary-400 transition-colors" />
                </div>
              </div>
            </button>
          ))
        ) : (
          <div className="bg-dark-900 border border-dashed border-dark-700 rounded-2xl p-16 flex flex-col items-center justify-center text-center">
            <div className="h-16 w-16 rounded-2xl bg-dark-800 flex items-center justify-center text-slate-600 mb-6">
               <LifeBuoy size={32} />
            </div>
            <h3 className="text-xl font-semibold text-slate-300 mb-2">No tickets yet</h3>
            <p className="text-sm text-slate-500 mb-6 max-w-sm">
              Create a support ticket if you need help with anything.
            </p>
            <button
              onClick={() => navigate("/support/new")}
              className="h-12 px-6 rounded-lg bg-dark-800 border border-dark-700 text-slate-300 font-medium text-sm hover:bg-dark-700 transition-all"
            >
              Create your first ticket
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
