import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "../services/api.js"

export default function NewTicket() {
  const [formData, setFormData] = useState({
    category: "Server Issue",
    subject: "",
    message: "",
    priority: "Medium"
  })
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const navigate = useNavigate()

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file")
      return
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be smaller than 5MB")
      return
    }

    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    setError("")
  }

  const removeImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImageFile(null)
    setImagePreview(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError("")

    try {
      const token = localStorage.getItem("token")
      const result = await api.createTicket(token, formData, imageFile)
      navigate(`/support/${result.id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-white">Create support ticket</h1>
        <p className="text-sm text-slate-400">Describe your issue and our team will assist you</p>
      </div>

      <div className="rounded-xl border border-white/10 bg-dark-800/60 backdrop-blur-sm p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-lg bg-red-900/20 border border-red-700/30 p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Category */}
          <div>
            <label htmlFor="ticket-category" className="block text-sm font-medium text-slate-300 mb-2">
              Category *
            </label>
            <select
              id="ticket-category"
              name="category"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              required
              className="w-full px-4 py-3 rounded-lg border border-dark-700 bg-dark-800 text-slate-200 focus:outline-none focus:border-primary-500"
            >
              <option value="Billing">Billing</option>
              <option value="Server Issue">Server Issue</option>
              <option value="Bug">Bug</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Priority */}
          <div>
            <label htmlFor="ticket-priority" className="block text-sm font-medium text-slate-300 mb-2">
              Priority *
            </label>
            <select
              id="ticket-priority"
              name="priority"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              required
              className="w-full px-4 py-3 rounded-lg border border-dark-700 bg-dark-800 text-slate-200 focus:outline-none focus:border-primary-500"
            >
              <option value="Low">Low - General question or minor issue</option>
              <option value="Medium">Medium - Affects functionality</option>
              <option value="High">High - Critical or urgent issue</option>
            </select>
          </div>

          {/* Subject */}
          <div>
            <label htmlFor="ticket-subject" className="block text-sm font-medium text-slate-300 mb-2">
              Subject *
            </label>
            <input
              id="ticket-subject"
              name="subject"
              type="text"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder="Brief description of your issue"
              required
              minLength={5}
              maxLength={200}
              className="w-full px-4 py-3 rounded-lg border border-dark-700 bg-dark-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-primary-500"
            />
            <p className="mt-1 text-xs text-slate-500">
              {formData.subject.length}/200 characters
            </p>
          </div>

          {/* Message */}
          <div>
            <label htmlFor="ticket-message" className="block text-sm font-medium text-slate-300 mb-2">
              Message *
            </label>
            <textarea
              id="ticket-message"
              name="message"
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              placeholder="Provide detailed information about your issue..."
              required
              minLength={10}
              maxLength={2000}
              rows={8}
              className="w-full px-4 py-3 rounded-lg border border-dark-700 bg-dark-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-primary-500 resize-none"
            />
            <p className="mt-1 text-xs text-slate-500">
              {formData.message.length}/2000 characters
            </p>
          </div>

          {/* Image Upload */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Attach screenshot (optional)
            </label>
            {!imagePreview ? (
              <div className="relative">
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={handleImageChange}
                  className="hidden"
                  id="ticket-image"
                />
                <label
                  htmlFor="ticket-image"
                  className="flex flex-col items-center justify-center w-full px-4 py-6 border-2 border-dashed border-dark-700 rounded-lg cursor-pointer hover:border-primary-500/50 transition-colors"
                >
                  <svg className="w-10 h-10 text-slate-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm text-slate-400">Click to upload image</p>
                  <p className="text-xs text-slate-500 mt-1">PNG, JPG, WebP (max 5MB)</p>
                </label>
              </div>
            ) : (
              <div className="relative rounded-lg border border-dark-700 p-4">
                <img src={imagePreview} alt="Preview" className="max-h-64 rounded-lg mx-auto" />
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute top-2 right-2 bg-red-900/80 hover:bg-red-900 text-red-200 rounded-full p-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => navigate("/support")}
              className="button-3d flex-1 rounded-lg border border-white/10 px-4 py-3 text-sm font-semibold text-slate-300 hover:bg-white/[0.04] transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="button-3d flex-1 rounded-lg bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-400 hover:to-primary-500 px-4 py-3 text-sm font-semibold text-white shadow-glow-primary disabled:opacity-60 disabled:cursor-not-allowed transition-all"
            >
              {submitting ? "Creating..." : "Submit ticket"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
