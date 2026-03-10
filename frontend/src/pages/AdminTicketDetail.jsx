import { useState, useEffect, useRef, useCallback } from "react"
import { useNavigate, useParams } from "react-router-dom"
import AdminNav from "../components/AdminNav.jsx"
import SectionHeader from "../components/SectionHeader.jsx"
import Badge from "../components/Badge.jsx"
import ConfirmModal from "../components/ConfirmModal.jsx"
import Button from "../components/ui/Button.jsx"
import Card from "../components/ui/Card.jsx"
import { useAppUI } from "../context/AppUIContext.jsx"
import { api, getBackendBaseUrl } from "../services/api.js"

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

  const getApiUrl = () => getBackendBaseUrl()

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

  const loadTicket = useCallback(async () => {
    try {
      const token = localStorage.getItem("token")
      const data = await api.getAdminTicket(token, id)
      setTicket(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    const refresh = () => loadTicket()
    const onFocus = () => refresh()
    const onSync = (event) => {
      if (event?.detail?.source === "admin-ticket-detail") return
      const domains = event?.detail?.domains || []
      if (domains.some((domain) => ["tickets", "support", "admin"].includes(domain))) {
        refresh()
      }
    }

    const interval = setInterval(refresh, 30000)
    window.addEventListener("focus", onFocus)
    window.addEventListener("astra:data-sync", onSync)

    return () => {
      clearInterval(interval)
      window.removeEventListener("focus", onFocus)
      window.removeEventListener("astra:data-sync", onSync)
    }
  }, [loadTicket])

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
      window.dispatchEvent(new CustomEvent("astra:data-sync", { detail: { domains: ["tickets", "support", "admin"], source: "admin-ticket-detail" } }))
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
      window.dispatchEvent(new CustomEvent("astra:data-sync", { detail: { domains: ["tickets", "support", "admin"], source: "admin-ticket-detail" } }))
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
      window.dispatchEvent(new CustomEvent("astra:data-sync", { detail: { domains: ["tickets", "support", "admin"], source: "admin-ticket-detail" } }))
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
        <Button
          onClick={() => navigate("/admin/tickets")}
          variant="secondary"
          size="md"
        >
          Back to Tickets
        </Button>
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
          <Button
            onClick={() => navigate("/admin/tickets")}
            variant="secondary"
            size="md"
          >
            ← Back to Tickets
          </Button>
        }
      />

      {/* User Info Panel */}
      <Card className="surface-card surface-elevated card-3d p-6">
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
      </Card>

      {/* Ticket Info & Actions */}
      <Card className="surface-card surface-elevated card-3d p-6">
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
              <Button
                onClick={() => handleStatusChange("closed")}
                disabled={statusChanging}
                variant="secondary"
                size="md"
              >
                Close Ticket
              </Button>
            ) : (
              <Button
                onClick={() => handleStatusChange("open")}
                disabled={statusChanging}
                variant="secondary"
                size="md"
              >
                Reopen Ticket
              </Button>
            )}
            <Button
              onClick={() => setDeleteConfirmOpen(true)}
              variant="danger"
              size="md"
            >
              Delete
            </Button>
          </div>
        </div>
      </Card>

      {/* Messages */}
      <Card className="surface-card surface-elevated card-3d p-6">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">Conversation</h3>
        
        <div className="space-y-4 mb-6 max-h-[500px] overflow-y-auto">
          {ticket.messages && ticket.messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender_type === "user" ? "justify-start" : "justify-end"}`}
            >
              <div className={`max-w-[80%] rounded-2xl p-4 ${
                msg.sender_type === "user"
                  ? "bg-slate-800/50 border border-dark-700/50"
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
            <div className="surface-card rounded-lg bg-red-900/20 border border-red-700/30 p-3 text-sm text-red-300">
              {error}
            </div>
          )}
          
          {/* Image Preview */}
          {replyImagePreview && (
            <div className="surface-card relative rounded-lg border border-dark-700/60 p-3">
              <img src={replyImagePreview} alt="Preview" className="max-h-32 rounded-lg" />
              <button
                type="button"
                onClick={removeReplyImage}
                className="absolute top-1 right-1 bg-red-900/80 hover:bg-red-900 text-red-200 rounded-full p-1"
                aria-label="Remove selected image"
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
            className="w-full px-4 py-3 rounded-lg border border-dark-700/60 bg-dark-900/80 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-ember-500/50 resize-none"
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
            <Button
              type="submit"
              disabled={sending || !replyMessage.trim()}
              size="md"
              variant="secondary"
            >
              {sending ? "Sending..." : "Send Response"}
            </Button>
          </div>
        </form>
      </Card>
      
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
              aria-label="Close enlarged image"
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
