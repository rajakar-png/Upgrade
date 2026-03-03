import { useState, useEffect, useRef } from "react"
import { useNavigate, useParams } from "react-router-dom"
import Badge from "../components/Badge.jsx"
import { api } from "../services/api.js"

export default function TicketDetail() {
  const { id } = useParams()
  const [ticket, setTicket] = useState(null)
  const [replyMessage, setReplyMessage] = useState("")
  const [replyImage, setReplyImage] = useState(null)
  const [replyImagePreview, setReplyImagePreview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const [enlargedImage, setEnlargedImage] = useState(null)
  const messagesEndRef = useRef(null)
  const navigate = useNavigate()

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
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [ticket?.messages])

  const loadTicket = async () => {
    try {
      const token = localStorage.getItem("token")
      const data = await api.getTicket(token, id)
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
      await api.replyToTicket(token, id, replyMessage, replyImage)
      setReplyMessage("")
      removeReplyImage()
      await loadTicket()
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
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
          onClick={() => navigate("/support")}
          className="button-3d rounded-xl bg-neon-500/20 px-4 py-2 text-sm font-semibold text-neon-200 hover:bg-neon-500/30"
        >
          Back to Tickets
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-white">Ticket #{ticket.id}</h1>
          <p className="text-sm text-slate-400">{ticket.subject}</p>
        </div>
        <button
          onClick={() => navigate("/support")}
          className="button-3d h-10 px-4 rounded-lg border border-white/10 text-sm font-medium text-slate-300 hover:bg-white/[0.04] transition-all"
        >
          ← Back to tickets
        </button>
      </div>

      {/* Ticket Info */}
      <div className="rounded-xl border border-dark-700 bg-dark-900 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <Badge
            label={ticket.status === "open" ? "Open" : "Closed"}
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
          <div className="text-sm text-slate-400">
            <span>Category: <span className="text-slate-300">{ticket.category}</span></span>
          </div>
          <div className="text-xs text-slate-500">
            Created {formatTime(ticket.created_at)}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="rounded-xl border border-dark-700 bg-dark-900 p-6">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">Messages</h3>
        
        <div className="space-y-4 mb-6 max-h-[500px] overflow-y-auto">
          {ticket.messages && ticket.messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender_type === "user" ? "justify-end" : "justify-start"}`}
            >
              <div className={`max-w-[80%] rounded-xl p-4 ${
                msg.sender_type === "user"
                  ? "bg-primary-500/15 border border-primary-500/30"
                  : "bg-dark-800 border border-dark-700"
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs font-semibold ${
                    msg.sender_type === "admin" ? "text-accent-400" : "text-primary-400"
                  }`}>
                    {msg.sender_type === "admin" ? "Support team" : "You"}
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
        {ticket.status === "open" ? (
          <form onSubmit={handleReply} className="space-y-3">
            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-300">
                {error}
              </div>
            )}
            
            {/* Image Preview */}
            {replyImagePreview && (
              <div className="relative rounded-lg border border-dark-700 p-3">
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
              id="reply-message"
              name="replyMessage"
              value={replyMessage}
              onChange={(e) => setReplyMessage(e.target.value)}
              placeholder="Type your message..."
              required
              rows={4}
              maxLength={2000}
              className="w-full px-4 py-3 rounded-lg border border-dark-700 bg-dark-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-primary-500 resize-none"
            />
            <div className="flex justify-between items-center gap-3">
              <div className="flex items-center gap-3">
                <p className="text-xs text-slate-500">{replyMessage.length}/2000</p>
                <label className="cursor-pointer text-sm text-primary-400 hover:text-primary-300 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>Attach image</span>
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
                className="rounded-lg bg-primary-500 px-6 py-2 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
              >
                {sending ? "Sending..." : "Send"}
              </button>
            </div>
          </form>
        ) : (
          <div className="rounded-lg bg-dark-800 border border-dark-700 p-4 text-center text-sm text-slate-400">
            This ticket is closed. Cannot send new messages.
          </div>
        )}
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
    </div>
  )
}
