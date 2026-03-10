import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "../services/api.js"
import { useAppUI } from "../context/AppUIContext.jsx"
import SectionHeader from "../components/SectionHeader.jsx"
import Button from "../components/ui/Button.jsx"
import Card from "../components/ui/Card.jsx"
import Input from "../components/ui/Input.jsx"

export default function CouponRedeem() {
  const [code, setCode] = useState("")
  const [redemptions, setRedemptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [redeeming, setRedeeming] = useState(false)
  const navigate = useNavigate()
  const { showSuccess, showError } = useAppUI()

  const loadRedemptions = useCallback(async () => {
    const token = localStorage.getItem("token")
    if (!token) return
    const data = await api.getCouponHistory(token)
    setRedemptions(data || [])
  }, [])

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) {
      navigate("/login")
      return
    }

    loadRedemptions()
      .catch((err) => {
        console.error(err)
      })
      .finally(() => setLoading(false))
  }, [navigate, loadRedemptions])

  useEffect(() => {
    const refresh = () => loadRedemptions().catch(() => {})
    const onFocus = () => refresh()
    const onSync = (event) => {
      if (event?.detail?.source === "coupon-redeem") return
      const domains = event?.detail?.domains || []
      if (domains.some((domain) => ["coupons", "balance", "dashboard"].includes(domain))) {
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
  }, [loadRedemptions])

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
      await loadRedemptions()

      window.dispatchEvent(new CustomEvent("astra:data-sync", { detail: { domains: ["coupons", "balance", "dashboard"], source: "coupon-redeem" } }))

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
        <SectionHeader
          title="Redeem coupon"
          subtitle="One code per IP. Abuse prevention is enforced automatically."
        />
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary-500 border-t-transparent" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionHeader
        title="Redeem coupon"
        subtitle="One code per IP. Abuse prevention is enforced automatically."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        <Card elevated className="surface-card surface-elevated card-3d p-6">
          <form onSubmit={handleRedeem} className="space-y-4">
            <div>
              <label htmlFor="coupon-code" className="text-sm font-medium text-slate-300">Coupon code</label>
              <Input
                id="coupon-code"
                name="code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="mt-2"
                placeholder="ASTRA-BOOST"
              />
            </div>
            <Button
              type="submit"
              loading={redeeming}
              className="w-full"
            >
              {redeeming ? "Redeeming..." : "Redeem"}
            </Button>
          </form>
        </Card>
        <Card elevated className="surface-card surface-elevated card-3d p-6">
          <p className="text-sm text-slate-300 font-medium mb-4">Anti-abuse checks</p>
          <ul className="space-y-3 text-sm text-slate-400">
            <li>✓ IP uniqueness enforced</li>
            <li>✓ Max uses and per-user limits</li>
            <li>✓ Auto-flag suspicious accounts</li>
          </ul>
        </Card>
      </div>
      {redemptions.length > 0 && (
        <Card elevated className="surface-card surface-elevated card-3d p-6">
          <p className="text-sm text-slate-300 font-medium mb-4">Recent redemptions</p>
          <div className="grid gap-3 text-sm">
            {redemptions.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dark-700/70 bg-dark-950/80 px-4 py-3"
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
        </Card>
      )}
    </div>
  )
}
