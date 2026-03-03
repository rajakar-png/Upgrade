import { useState } from "react"
import { Link } from "react-router-dom"
import { MessageSquare, Mail, ExternalLink, Send, Loader2, LogIn, UserPlus } from "lucide-react"
import PublicNavbar from "../components/PublicNavbar.jsx"
import { useAppUI } from "../context/AppUIContext.jsx"
import { api } from "../services/api.js"

const CHANNELS = [
  {
    icon: MessageSquare,
    color: "text-indigo-300",
    bg: "bg-indigo-500/10",
    border: "border-indigo-500/20",
    label: "Discord Server",
    desc: "Fastest response, community support, and announcements.",
    action: "Join Discord",
    href: "https://discord.gg/astranodes"
  },
  {
    icon: Mail,
    color: "text-aurora-300",
    bg: "bg-aurora-500/10",
    border: "border-aurora-500/20",
    label: "Email / Tickets",
    desc: "Billing issues, account problems, or formal requests.",
    action: "Open Ticket",
    href: "/support"
  }
]

export default function Contact() {
  const { showSuccess, showError } = useAppUI()
  const [form, setForm] = useState({ subject: "", message: "" })
  const [sending, setSending] = useState(false)
  const isLoggedIn = Boolean(localStorage.getItem("token"))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.subject.trim() || !form.message.trim()) {
      showError("Please fill in all fields.")
      return
    }
    setSending(true)
    try {
      const token = localStorage.getItem("token")
      await api.createTicket(token, {
        category: "General Inquiry",
        subject: form.subject,
        message: form.message,
        priority: "Medium"
      }, null)
      showSuccess("Message sent! Check your support tickets for replies.")
      setForm({ subject: "", message: "" })
    } catch (err) {
      showError(err.message || "Failed to send message")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-h-screen bg-dark-950 text-slate-100 animate-fade-in">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <PublicNavbar />

        <section className="text-center mb-14 space-y-4">
          <p className="text-xs uppercase tracking-[0.5em] text-slate-500">Get in touch</p>
          <h1 className="text-4xl font-semibold text-slate-100 sm:text-5xl">
            We&apos;re here to <span className="text-aurora-200">help</span>
          </h1>
          <p className="mx-auto max-w-xl text-lg text-slate-400">
            Reach out via Discord for the fastest response, or use the form below for general enquiries.
          </p>
        </section>

        <div className="grid gap-5 sm:grid-cols-2 mb-12">
          {CHANNELS.map(({ icon: Icon, color, bg, border, label, desc, action, href }) => (
            <a
              key={label}
              href={href}
              target={href.startsWith("http") ? "_blank" : undefined}
              rel="noopener noreferrer"
              className={`glass group flex flex-col gap-3 rounded-2xl border ${border} p-6 shadow-soft transition-transform hover:-translate-y-0.5`}
            >
              <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${bg}`}>
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-100">{label}</h3>
                <p className="text-sm text-slate-400 mt-1">{desc}</p>
              </div>
              <span className={`mt-auto flex items-center gap-1 text-sm font-semibold ${color}`}>
                {action} <ExternalLink className="h-3.5 w-3.5 opacity-70" />
              </span>
            </a>
          ))}
        </div>

        <div className="glass rounded-2xl border border-slate-700/40 p-8 shadow-soft">
          <h2 className="mb-6 text-lg font-semibold text-slate-100">Send a message</h2>

          {!isLoggedIn ? (
            <div className="text-center space-y-4 py-6">
              <p className="text-slate-400">You need an account to send us a message so we can track and reply to your request.</p>
              <div className="flex justify-center gap-3">
                <Link
                  to="/register"
                  className="button-3d inline-flex items-center gap-2 rounded-xl bg-neon-500/20 border border-neon-500/30 px-5 py-2.5 text-sm font-semibold text-neon-200 hover:bg-neon-500/30 transition-colors"
                >
                  <UserPlus className="h-4 w-4" /> Create Account
                </Link>
                <Link
                  to="/login"
                  className="button-3d inline-flex items-center gap-2 rounded-xl border border-slate-700/40 px-5 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-800/40 transition-colors"
                >
                  <LogIn className="h-4 w-4" /> Login
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="contact-subject" className="mb-1.5 block text-xs font-medium text-slate-400">Subject</label>
                <input
                  id="contact-subject"
                  name="subject"
                  value={form.subject}
                  onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
                  placeholder="Brief description of your issue"
                  className="w-full rounded-xl border border-slate-700/60 bg-ink-900/60 px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-neon-500/50 focus:ring-1 focus:ring-neon-500/30"
                />
              </div>
              <div>
                <label htmlFor="contact-message" className="mb-1.5 block text-xs font-medium text-slate-400">Message</label>
                <textarea
                  id="contact-message"
                  name="message"
                  value={form.message}
                  onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
                  rows={5}
                  placeholder="Describe your issue or question..."
                  className="w-full rounded-xl border border-slate-700/60 bg-ink-900/60 px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-neon-500/50 focus:ring-1 focus:ring-neon-500/30 resize-none"
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <button
                  type="submit"
                  disabled={sending}
                  className="button-3d flex items-center gap-2 rounded-xl bg-neon-500/20 border border-neon-500/30 px-5 py-2.5 text-sm font-semibold text-neon-200 hover:bg-neon-500/30 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {sending ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
                  ) : (
                    <><Send className="h-4 w-4" /> Send Message</>
                  )}
                </button>
                <Link to="/support" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                  View your tickets →
                </Link>
              </div>
            </form>
          )}
        </div>

        <footer className="mt-12 border-t border-slate-800/60 pt-6 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} AstraNodes. All rights reserved.
        </footer>
      </div>
    </div>
  )
}
