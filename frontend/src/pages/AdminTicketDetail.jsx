import { useState, useEffect, useRef } from "react"
import { useNavigate, useParams } from "react-router-dom"
import AdminNav from "../components/AdminNav.jsx"
import SectionHeader from "../components/SectionHeader.jsx"
import Badge from "../components/Badge.jsx"
import ConfirmModal from "../components/ConfirmModal.jsx"
import { useAppUI } from "../context/AppUIContext.jsx"
import { api } from "../services/api.js"

export default function AdminTicketDetail() {
  const { id } = useParams()
  const [ticket, setTicket] = useState(null)
  const [replyMessage, setReplyMessage] = useState("")
  const [replyImage, setReplyImage] = useState(null)
  const [replyImagePreview, setReplyImagePreview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [statusChanging, setStatusChanging] = useState(false)
  const [error, setError] = useState("")
  const [enlargedImage, setEnlargedImage] = useState(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const messagesEndRef = useRef(null)
  const navigate = useNavigate()
  const { showSuccess, showError } = useAppUI()

  const getApiUrl = () => {
    if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace("/api", "")
    if (window.location.hostname.includes("app.github.dev")) {
      return window.location.origin.replace("-5173.", "-4000.")
    }
    return "http://localhost:4000"
  }

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file")
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be smaller than 5MB")
      return
    }

    setReplyImage(file)
    setReplyImagePreview(URL.createObjectURL(file))
    setError("")
  }

  const removeReplyImage = () => {
    if (replyImagePreview) URL.revokeObjectURL(replyImagePreview)
    setReplyImage(null)
    setReplyImagePreview(null)
  }

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) {
      navigate("/login")
      return
    }

    loadTicket()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, navigate])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [ticket?.messages])

  const loadTicket = async () => {
    try {
      const token = localStorage.getItem("token")
      const data = await api.getAdminTicket(token, id)
      setTicket(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleReply = async (e) => {
    e.preventDefault()
    if (!replyMessage.trim()) return

    setSending(true)
    setError("")

    try {
      const token = localStorage.getItem("token")
      await api.adminReplyToTicket(token, id, replyMessage, replyImage)
      setReplyMessage("")
      removeReplyImage()
      await loadTicket()
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  const handleStatusChange = async (newStatus) => {
    setStatusChanging(true)
    setError("")

    try {
      const token = localStorage.getItem("token")
      await api.updateTicketStatus(token, id, newStatus)
      await loadTicket()
    } catch (err) {
      setError(err.message)
    } finally {
      setStatusChanging(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const token = localStorage.getItem("token")
      await api.deleteTicket(token, id)
      showSuccess("Ticket deleted successfully")
      navigate("/admin/tickets")
    } catch (err) {
      showError(err.message || "Failed to delete ticket")
    } finally {
      setDeleting(false)
      setDeleteConfirmOpen(false)
    }
  }

  const formatTime = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleString()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-slate-400">Loading ticket...</p>
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <p className="text-slate-400 mb-4">Ticket not found</p>
        <button
          onClick={() => navigate("/admin/tickets")}
          className="button-3d rounded-xl bg-neon-500/20 px-4 py-2 text-sm font-semibold text-neon-200 hover:bg-neon-500/30"
        >
          Back to Tickets
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark-950">
      <AdminNav />
      <div className="max-w-5xl mx-auto p-6 space-y-6">
      <SectionHeader
        title={`Ticket #${ticket.id}`}
        subtitle={ticket.subject}
        action={
          <button
            onClick={() => navigate("/admin/tickets")}
            className="button-3d rounded-xl border border-slate-600/60 px-4 py-2 text-sm font-semibold text-slate-300 hover:border-slate-500/80"
          >
            ← Back to Tickets
          </button>
        }
      />

      {/* User Info Panel */}
      <div className="rounded-2xl border border-slate-800/60 bg-ink-900/70 p-6">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">User Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-slate-500 mb-1">Username</p>
            <p className="text-sm text-slate-200 font-semibold">{ticket.user_username || ticket.username || "N/A"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Email</p>
            <p className="text-sm text-slate-200">{ticket.user_email || ticket.email || "N/A"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">User ID</p>
            <p className="text-sm text-slate-200 font-mono">{ticket.user_id}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Account Created</p>
            <p className="text-sm text-slate-200">{ticket.user_created_at ? formatTime(ticket.user_created_at) : "N/A"}</p>
          </div>
        </div>
      </div>

      {/* Ticket Info & Actions */}
      <div className="rounded-2xl border border-slate-800/60 bg-ink-900/70 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <Badge
              label={ticket.status}
              tone={ticket.status === "open" ? "active" : "rejected"}
            />
            {ticket.priority && (
              <Badge
                label={ticket.priority}
                tone={
                  ticket.priority === "High" ? "rejected" : 
                  ticket.priority === "Medium" ? "warning" : 
                  "neutral"
                }
              />
            )}
            <span className="text-xs px-3 py-1 rounded bg-slate-800/50 text-slate-400">
              {ticket.category}
            </span>
            <div className="text-xs text-slate-500">
              Created {formatTime(ticket.created_at)}
            </div>
          </div>
          
          <div className="flex gap-2">
            {ticket.status === "open" ? (
              <button
                onClick={() => handleStatusChange("closed")}
                disabled={statusChanging}
                className="button-3d rounded-lg bg-slate-700/30 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-700/50 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Close Ticket
              </button>
            ) : (
              <button
                onClick={() => handleStatusChange("open")}
                disabled={statusChanging}
                className="button-3d rounded-lg bg-aurora-500/20 px-4 py-2 text-sm font-semibold text-aurora-200 hover:bg-aurora-500/30 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Reopen Ticket
              </button>
            )}
            <button
              onClick={() => setDeleteConfirmOpen(true)}
              className="button-3d rounded-lg bg-red-900/20 border border-red-700/30 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-900/30"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="rounded-2xl border border-slate-800/60 bg-ink-900/70 p-6">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">Conversation</h3>
        
        <div className="space-y-4 mb-6 max-h-[500px] overflow-y-auto">
          {ticket.messages && ticket.messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender_type === "user" ? "justify-start" : "justify-end"}`}
            >
              <div className={`max-w-[80%] rounded-2xl p-4 ${
                msg.sender_type === "user"
                  ? "bg-slate-800/50 border border-slate-700/50"
                  : "bg-ember-500/15 border border-ember-500/30"
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs font-semibold ${
                    msg.sender_type === "admin" ? "text-ember-300" : "text-slate-300"
                  }`}>
                    {msg.sender_type === "admin" ? "You (Support)" : `${msg.sender_name || `User #${msg.sender_id}`}`}
                  </span>
                  <span className="text-xs text-slate-500">
                    {formatTime(msg.created_at)}
                  </span>
                </div>
                <p className="text-sm text-slate-200 whitespace-pre-wrap">{msg.message}</p>
                {msg.image && (
                  <div className="mt-3">
                    <img
                      src={`${getApiUrl()}${msg.image}`}
                      alt="Attachment"
                      className="max-w-full max-h-64 rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => setEnlargedImage(`${getApiUrl()}${msg.image}`)}
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Reply Form */}
        <form onSubmit={handleReply} className="space-y-3">
          {error && (
            <div className="rounded-lg bg-red-900/20 border border-red-700/30 p-3 text-sm text-red-300">
              {error}
            </div>
          )}
          
          {/* Image Preview */}
          {replyImagePreview && (
            <div className="relative rounded-lg border border-slate-700/60 p-3">
              <img src={replyImagePreview} alt="Preview" className="max-h-32 rounded-lg" />
              <button
                type="button"
                onClick={removeReplyImage}
                className="absolute top-1 right-1 bg-red-900/80 hover:bg-red-900 text-red-200 rounded-full p-1"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
          
          <textarea
            id="admin-reply-message"
            name="replyMessage"
            value={replyMessage}
            onChange={(e) => setReplyMessage(e.target.value)}
            placeholder="Type your response..."
            required
            rows={4}
            maxLength={2000}
            className="w-full px-4 py-3 rounded-lg border border-slate-700/60 bg-ink-950/60 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-ember-500/50 resize-none"
          />
          <div className="flex justify-between items-center gap-3">
            <div className="flex items-center gap-3">
              <p className="text-xs text-slate-500">{replyMessage.length}/2000</p>
              <label className="cursor-pointer text-sm text-ember-400 hover:text-ember-300 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>Add image</span>
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </label>
            </div>
            <button
              type="submit"
              disabled={sending || !replyMessage.trim()}
              className="button-3d rounded-lg bg-ember-500/20 px-6 py-2 text-sm font-semibold text-ember-200 hover:bg-ember-500/30 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {sending ? "Sending..." : "Send Response"}
            </button>
          </div>
        </form>
      </div>
      
      {/* Image Enlargement Modal */}
      {enlargedImage && (
        <div 
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setEnlargedImage(null)}
        >
          <div className="relative max-w-6xl max-h-[90vh]">
            <img 
              src={enlargedImage} 
              alt="Enlarged" 
              className="max-w-full max-h-[90vh] rounded-lg"
            />
            <button
              onClick={() => setEnlargedImage(null)}
              className="absolute top-4 right-4 bg-red-900/80 hover:bg-red-900 text-red-200 rounded-full p-3"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        open={deleteConfirmOpen}
        title="Delete Ticket"
        message={`Permanently delete ticket #${ticket?.id}?`}
        detail="This removes all messages and attachments. This action cannot be undone."
        confirmLabel="Delete Ticket"
        confirmVariant="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onClose={() => setDeleteConfirmOpen(false)}
      />
      </div>
    </div>
  )
}
