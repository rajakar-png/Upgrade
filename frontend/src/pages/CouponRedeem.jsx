import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "../services/api.js"
import { useAppUI } from "../context/AppUIContext.jsx"

export default function CouponRedeem() {
  const [code, setCode] = useState("")
  const [redemptions, setRedemptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [redeeming, setRedeeming] = useState(false)
  const navigate = useNavigate()
  const { showSuccess, showError } = useAppUI()

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) {
      navigate("/login")
      return
    }

    const loadRedemptions = async () => {
      try {
        const data = await api.getCouponHistory(token)
        setRedemptions(data || [])
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    loadRedemptions()
  }, [navigate])

  const handleRedeem = async (e) => {
    e.preventDefault()

    if (!code.trim()) {
      showError("Please enter a coupon code.")
      return
    }

    setRedeeming(true)

    try {
      const token = localStorage.getItem("token")
      const result = await api.redeemCoupon(token, code)
      showSuccess(`Redeemed! +${result.reward} coins`)

      // Refresh history
      const data = await api.getCouponHistory(token)
      setRedemptions(data || [])

      setCode("")
    } catch (err) {
      showError(err.message || "Failed to redeem coupon.")
    } finally {
      setRedeeming(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-slate-100">Redeem coupon</h1>
          <p className="text-sm text-slate-400">One code per IP. Abuse prevention is enforced automatically.</p>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary-500 border-t-transparent" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-white">Redeem coupon</h1>
        <p className="text-sm text-slate-400">One code per IP. Abuse prevention is enforced automatically.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        <div className="rounded-xl border border-dark-700 bg-dark-900 p-6">
          <form onSubmit={handleRedeem} className="space-y-4">
            <div>
              <label htmlFor="coupon-code" className="text-sm font-medium text-slate-300">Coupon code</label>
              <input
                id="coupon-code"
                name="code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="mt-2 w-full rounded-lg border border-dark-700 bg-dark-800 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:border-primary-500 focus:outline-none"
                placeholder="ASTRA-BOOST"
              />
            </div>
            <button
              type="submit"
              disabled={redeeming}
              className="w-full rounded-lg bg-primary-500 px-4 py-3 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
            >
              {redeeming ? "Redeeming..." : "Redeem"}
            </button>
          </form>
        </div>
        <div className="rounded-xl border border-dark-700 bg-dark-900 p-6">
          <p className="text-sm text-slate-300 font-medium mb-4">Anti-abuse checks</p>
          <ul className="space-y-3 text-sm text-slate-400">
            <li>✓ IP uniqueness enforced</li>
            <li>✓ Max uses and per-user limits</li>
            <li>✓ Auto-flag suspicious accounts</li>
          </ul>
        </div>
      </div>
      {redemptions.length > 0 && (
        <div className="rounded-xl border border-dark-700 bg-dark-900 p-6">
          <p className="text-sm text-slate-300 font-medium mb-4">Recent redemptions</p>
          <div className="grid gap-3 text-sm">
            {redemptions.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dark-700 bg-dark-950 px-4 py-3"
              >
                <div>
                  <p className="font-semibold text-slate-100">{item.code}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(item.redeemed_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-primary-400">+{item.coin_reward} coins</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
