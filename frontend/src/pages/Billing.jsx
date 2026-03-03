import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { Copy, Check, IndianRupee, Upload, Clock } from "lucide-react"
import SectionHeader from "../components/SectionHeader.jsx"
import { api } from "../services/api.js"
import Badge from "../components/Badge.jsx"

export default function Billing() {
  const [amount, setAmount] = useState("")
  const [utrNumber, setUtrNumber] = useState("")
  const [screenshot, setScreenshot] = useState(null)
  const [submissions, setSubmissions] = useState([])
  const [upiSettings, setUpiSettings] = useState({ upiId: null, upiName: null })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)
  const fileRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) {
      navigate("/login")
      return
    }

    const load = async () => {
      try {
        const [submissionsData, paymentData] = await Promise.all([
          api.getUTRSubmissions(token),
          api.getPaymentSettings()
        ])
        setSubmissions(submissionsData || [])
        setUpiSettings(paymentData)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [navigate])

  const copyUpi = () => {
    if (!upiSettings.upiId) return
    navigator.clipboard.writeText(upiSettings.upiId).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")

    if (!amount || !utrNumber || !screenshot) {
      setError("Please fill in all fields and attach a screenshot")
      return
    }

    setSubmitting(true)

    try {
      const token = localStorage.getItem("token")
      await api.submitUTR(token, parseFloat(amount), utrNumber, screenshot)
      const data = await api.getUTRSubmissions(token)
      setSubmissions(data || [])
      setAmount("")
      setUtrNumber("")
      setScreenshot(null)
      if (fileRef.current) fileRef.current.value = ""
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-white">Add funds</h1>
        <p className="text-sm text-slate-400">Pay via UPI, then submit your UTR number and screenshot for verification.</p>
      </div>

      {/* Step 1 — UPI Payment Details */}
      <div className="rounded-2xl border border-primary-500/30 bg-primary-900/10 p-6">
        <p className="text-sm font-semibold text-primary-400 mb-4">Step 1: Send payment via UPI</p>

        {upiSettings.upiId ? (
          <div className="space-y-4">
            {upiSettings.upiName && (
              <div>
                <p className="text-xs text-slate-400 mb-1">Pay to</p>
                <p className="text-lg font-semibold text-slate-100">{upiSettings.upiName}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-slate-400 mb-2">UPI ID</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 rounded-xl border border-primary-500/40 bg-dark-950 px-4 py-3">
                  <p className="font-mono text-lg font-semibold text-primary-200 select-all">{upiSettings.upiId}</p>
                </div>
                <button
                  onClick={copyUpi}
                  className="flex items-center gap-2 rounded-xl border border-primary-500/30 bg-primary-900/20 px-4 py-3 text-sm font-semibold text-primary-200 hover:bg-primary-900/40 transition-all"
                >
                  {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
            <div className="rounded-xl border border-dark-700 bg-dark-950 px-4 py-3 text-sm text-slate-300">
              <p>1. Open any UPI app (GPay, PhonePe, Paytm, etc.)</p>
              <p className="mt-1">2. Send the exact amount you want to add to your balance</p>
              <p className="mt-1">3. Note the <span className="text-primary-300 font-semibold">UTR / Reference number</span> from the payment receipt</p>
              <p className="mt-1">4. Take a <span className="text-primary-300 font-semibold">screenshot</span> of the payment confirmation</p>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-500/30 bg-amber-900/10 p-4 text-sm text-amber-300">
            ⚠️ UPI payment details not configured yet. Please contact support.
          </div>
        )}
      </div>

      {/* Step 2 — Submit UTR */}
      <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <div className="rounded-2xl border border-dark-700 bg-dark-900 p-6">
          <p className="text-sm font-semibold text-slate-300 mb-5">Step 2: Submit your payment proof</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-red-900/20 border border-red-700/30 p-3 text-sm text-red-300">
                {error}
              </div>
            )}
            <div>
              <label htmlFor="billing-amount" className="text-sm text-slate-300 font-medium">Amount paid (₹)</label>
              <div className="relative mt-2">
                <IndianRupee size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="billing-amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  min="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  className="w-full rounded-xl border border-dark-700 bg-dark-800 pl-9 pr-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:border-primary-500 focus:outline-none"
                  placeholder="25.00"
                />
              </div>
            </div>
            <div>
              <label htmlFor="billing-utr" className="text-sm text-slate-300 font-medium">UTR / Reference number</label>
              <input
                id="billing-utr"
                name="utrNumber"
                type="text"
                value={utrNumber}
                onChange={(e) => setUtrNumber(e.target.value)}
                required
                className="mt-2 w-full rounded-xl border border-dark-700 bg-dark-800 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:border-primary-500 focus:outline-none"
                placeholder="UTR000000000000"
              />
              <p className="mt-1 text-xs text-slate-400">Found in your UPI app transaction history</p>
            </div>
            <div>
              <label htmlFor="billing-screenshot" className="text-sm text-slate-300 font-medium">Payment screenshot</label>
              <div
                onClick={() => fileRef.current?.click()}
                className="mt-2 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-dark-700 bg-dark-950 px-4 py-6 text-sm text-slate-400 hover:border-primary-500/40 hover:text-primary-300 transition-colors"
              >
                <Upload size={20} />
                {screenshot ? (
                  <span className="text-primary-300 font-medium">{screenshot.name}</span>
                ) : (
                  <span>Click to attach screenshot</span>
                )}
              </div>
              <input
                ref={fileRef}
                id="billing-screenshot"
                name="screenshot"
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={(e) => setScreenshot(e.target.files?.[0] || null)}
                required
                className="hidden"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 px-4 py-3 text-sm font-semibold text-white shadow-glow-primary hover:from-primary-400 hover:to-primary-500 disabled:opacity-60 disabled:cursor-not-allowed button-3d transition-all"
            >
              {submitting ? "Submitting..." : "Submit for review"}
            </button>
          </form>
        </div>

        {/* Submission history */}
        <div className="rounded-2xl border border-dark-700 bg-dark-900 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={14} className="text-slate-400" />
            <p className="text-sm text-slate-300">Recent submissions</p>
          </div>
          {submissions.length > 0 ? (
            <div className="space-y-3 text-sm">
              {submissions.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-dark-700 bg-dark-950 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-100">₹{Number(item.amount).toFixed(2)}</p>
                      <p className="text-xs text-slate-400 mt-0.5 font-mono">{item.utr_number}</p>
                    </div>
                    <Badge
                      label={item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                      tone={
                        item.status === "approved" ? "approved"
                        : item.status === "rejected" ? "rejected"
                        : "pending"
                      }
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {new Date(item.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 text-center py-8">No submissions yet</p>
          )}
        </div>
      </div>
    </div>
  )
}
