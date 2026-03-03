import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import Topbar from "../components/Topbar.jsx"
import BannerAd from "../components/BannerAd.jsx"
import NativeAd from "../components/NativeAd.jsx"
import { api } from "../services/api.js"
import { detectAdBlock } from "../utils/adBlockDetector.js"
import { AlertTriangle, Coins as CoinsIcon, Clock, Zap } from "lucide-react"

// Seconds the user must view ads before a claim token is issued
const AD_VIEW_SECONDS = 5

export default function Coins() {
  const [balance, setBalance] = useState(0)
  const [coinsPerMinute, setCoinsPerMinute] = useState(1)
  const [balanceLoading, setBalanceLoading] = useState(true)
  const [claiming, setClaiming] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  // "checking" | "blocked" | "clear"
  const [adblockStatus, setAdblockStatus] = useState("checking")
  const [adViewCountdown, setAdViewCountdown] = useState(0)
  const [earnToken, setEarnToken] = useState(null)
  const [fetchingToken, setFetchingToken] = useState(false)
  const [justEarned, setJustEarned] = useState(0)
  const [error, setError] = useState("")
  const [rechecking, setRechecking] = useState(false)
  const navigate = useNavigate()

  // ── 1. Load balance + run adblock detection on mount ──────────────────────
  useEffect(() => {
    const jwt = localStorage.getItem("token")
    if (!jwt) {
      navigate("/login")
      return
    }

    api
      .getBalance(jwt)
      .then((data) => {
        setBalance(data.coins ?? 0)
        setCoinsPerMinute(1)
        if (data.last_claim_time) {
          const elapsed = Math.floor((Date.now() - new Date(data.last_claim_time).getTime()) / 1000)
          setCooldown(Math.max(0, 60 - elapsed))
        }
      })
      .catch(console.error)
      .finally(() => setBalanceLoading(false))

    detectAdBlock().then((blocked) => {
      setAdblockStatus(blocked ? "blocked" : "clear")
      if (!blocked) setAdViewCountdown(AD_VIEW_SECONDS)
    })

    // Re-check every 15 seconds — catches users who enable adblock mid-session
    const recheck = setInterval(() => {
      detectAdBlock().then((blocked) => {
        setAdblockStatus(blocked ? "blocked" : "clear")
        if (!blocked) setAdViewCountdown((prev) => (prev > 0 ? prev : 0))
      })
    }, 15_000)

    return () => clearInterval(recheck)
  }, [navigate])

  // ── Revoke earn token immediately when adblock becomes active ─────────────
  useEffect(() => {
    if (adblockStatus === "blocked") setEarnToken(null)
  }, [adblockStatus])

  // ── 2. Master tick every second ───────────────────────────────────────────
  useEffect(() => {
    const iv = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1))
      setAdViewCountdown((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(iv)
  }, [])

  // ── 3. Fetch earn session token at START of ad-view countdown ─────────────
  useEffect(() => {
    if (adblockStatus !== "clear") return
    if (adViewCountdown !== AD_VIEW_SECONDS && adViewCountdown !== 0) return
    if (cooldown > 0) return
    if (earnToken) return
    if (fetchingToken) return

    const jwt = localStorage.getItem("token")
    if (!jwt) return

    setFetchingToken(true)
    api
      .getEarnSession(jwt)
      .then((data) => setEarnToken(data.earnToken))
      .catch((err) => setError(err.message || "Failed to prepare earn session"))
      .finally(() => setFetchingToken(false))
  }, [adblockStatus, adViewCountdown, cooldown, earnToken, fetchingToken])

  // ── 4. When cooldown ends, restart the ad-view cycle ─────────────────────
  useEffect(() => {
    if (cooldown === 0 && adblockStatus === "clear" && !earnToken && !fetchingToken && adViewCountdown === 0) {
      setAdViewCountdown(AD_VIEW_SECONDS)
    }
  }, [cooldown]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 5. Auto-clear success badge after 2s ─────────────────────────────────
  useEffect(() => {
    if (justEarned > 0) {
      const t = setTimeout(() => setJustEarned(0), 2000)
      return () => clearTimeout(t)
    }
  }, [justEarned])

  // ── Claim handler ─────────────────────────────────────────────────────────
  const handleClaim = async () => {
    if (claiming || cooldown > 0 || adblockStatus !== "clear") return
    if (!earnToken) {
      setError("Ads are still loading — please wait a moment.")
      return
    }

    setClaiming(true)
    setError("")
    const jwt = localStorage.getItem("token")

    try {
      const result = await api.claimCoins(jwt, earnToken)
      setBalance((prev) => prev + result.earned)
      setJustEarned(result.earned)
      // Reset the earn cycle: cooldown + fresh token for next claim
      setCooldown(60)
      setEarnToken(null)
      return
    } catch (err) {
      const wait = err.waitSeconds ?? (err.message?.includes("Too many") ? 70 : 0)
      if (wait > 0) {
        setCooldown(wait)
        setEarnToken(null)
        setError("")
      } else {
        setError(err.message || "Claim failed. Please try again.")
        // Token expired/invalid — reset cycle
        setEarnToken(null)
        setAdViewCountdown(AD_VIEW_SECONDS)
      }
    } finally {
      setClaiming(false)
    }
  }

  // ── Computed UI state ─────────────────────────────────────────────────────
  const canClaim = !claiming && cooldown === 0 && adblockStatus === "clear" && !!earnToken && !fetchingToken

  const buttonLabel = () => {
    if (claiming) return "Claiming..."
    if (adblockStatus === "checking") return "Checking ads..."
    if (adblockStatus === "blocked") return "AdBlock active"
    if (cooldown > 0) return `Cooldown: ${cooldown}s`
    if (adViewCountdown > 0) return `Viewing ads: ${adViewCountdown}s`
    if (fetchingToken) return "Preparing..."
    if (!earnToken) return "Loading..."
    return "Claim now"
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (balanceLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-16 animate-fade-in">
      <Topbar />

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Earn coins</h1>
        <p className="text-slate-400">
          View ads to earn coins every 60 seconds. AdBlock must be disabled.
        </p>
      </div>

      {/* Main claim section */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card-3d bg-dark-800/60 backdrop-blur-sm rounded-xl border border-white/10 p-6 space-y-6">
          <div>
            <p className="text-sm text-slate-400 mb-2">Earn rate</p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold text-primary-400">{coinsPerMinute}</p>
              <p className="text-slate-400">coin / min</p>
            </div>
          </div>

          {/* Status message */}
          <div className="rounded-xl bg-dark-900/80 border border-white/[0.06] px-4 py-3 text-sm min-h-[52px] flex items-center">
            {adblockStatus === "checking" && (
              <p className="text-slate-400 flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-slate-500/30 border-t-slate-400 rounded-full animate-spin" />
                Checking for AdBlock…
              </p>
            )}
            {adblockStatus === "blocked" && (
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-400" />
                <p className="text-yellow-400 font-medium">
                  AdBlock detected — disable it to earn coins
                </p>
              </div>
            )}
            {adblockStatus === "clear" && cooldown > 0 && (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                <p className="text-slate-300">
                  Next claim in <span className="font-semibold text-primary-400">{cooldown}s</span>
                </p>
              </div>
            )}
            {adblockStatus === "clear" && cooldown === 0 && adViewCountdown > 0 && (
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary-400" />
                <p className="text-slate-300">
                  Viewing ads… <span className="font-semibold text-primary-400">{adViewCountdown}s</span>
                </p>
              </div>
            )}
            {adblockStatus === "clear" && cooldown === 0 && adViewCountdown === 0 && fetchingToken && (
              <p className="text-slate-400">Preparing session…</p>
            )}
            {adblockStatus === "clear" && cooldown === 0 && adViewCountdown === 0 && !fetchingToken && earnToken && (
              <p className="text-emerald-400 font-medium">✓ Ready to claim!</p>
            )}
          </div>

          {error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleClaim}
              disabled={!canClaim}
              className={`glow-ring button-3d px-6 py-3 rounded-xl font-semibold transition-all disabled:cursor-not-allowed ${
                canClaim
                  ? "bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-400 hover:to-primary-500 text-white shadow-glow-primary"
                  : "bg-dark-700 text-slate-500 disabled:shadow-none"
              }`}
            >
              {buttonLabel()}
            </button>

            {justEarned > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-sm font-semibold text-emerald-400 animate-slide-up">
                <CoinsIcon className="w-4 h-4" />
                +{justEarned}
              </span>
            )}
          </div>
        </div>

        {/* Adblock warning */}
        {adblockStatus === "blocked" && (
          <div className="bg-dark-800/60 backdrop-blur-sm rounded-xl border border-yellow-500/20 p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <h3 className="font-semibold text-yellow-400 mb-1">Please disable AdBlock</h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Ads fund this platform. Disable your blocker on this page and refresh to start earning
                  coins.
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Detection uses three independent methods. Use the button below after disabling your blocker — no
              page refresh needed.
            </p>
            <button
              onClick={() => {
                setRechecking(true)
                detectAdBlock()
                  .then((blocked) => {
                    setAdblockStatus(blocked ? "blocked" : "clear")
                    if (!blocked) {
                      setAdViewCountdown(AD_VIEW_SECONDS)
                      setEarnToken(null)
                    }
                  })
                  .finally(() => setRechecking(false))
              }}
              disabled={rechecking}
              className="button-3d px-4 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/20 text-yellow-400 rounded-lg font-medium transition-all disabled:opacity-50"
            >
              {rechecking ? "Checking…" : "I've disabled AdBlock — re-check"}
            </button>
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card-3d bg-dark-800/60 backdrop-blur-sm rounded-xl border border-white/10 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-primary-500/10 rounded-lg border border-primary-500/20">
              <CoinsIcon className="w-5 h-5 text-primary-400" />
            </div>
            <p className="text-sm text-slate-400">Balance</p>
          </div>
          <p className="text-2xl font-bold text-white">{balance.toLocaleString()}</p>
        </div>
        
        <div className="card-3d bg-dark-800/60 backdrop-blur-sm rounded-xl border border-white/10 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-accent-500/10 rounded-lg border border-accent-500/20">
              <Zap className="w-5 h-5 text-accent-400" />
            </div>
            <p className="text-sm text-slate-400">Earn rate</p>
          </div>
          <p className="text-2xl font-bold text-white">{coinsPerMinute} / min</p>
        </div>
        
        <div className="card-3d bg-dark-800/60 backdrop-blur-sm rounded-xl border border-white/10 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
              <Clock className="w-5 h-5 text-emerald-400" />
            </div>
            <p className="text-sm text-slate-400">Next claim</p>
          </div>
          <p className="text-2xl font-bold text-white">
            {cooldown > 0 ? `${cooldown}s` : adViewCountdown > 0 ? `${adViewCountdown}s` : "Ready"}
          </p>
        </div>
      </div>

      {/* Ad slots — only rendered when adblock is not active */}
      {adblockStatus !== "blocked" && (
        <>
          <div className="bg-dark-800/60 backdrop-blur-sm rounded-xl border border-white/10 p-6">
            <p className="text-xs text-slate-500 mb-4">Sponsored</p>
            <NativeAd />
          </div>
          <div className="bg-dark-800/60 backdrop-blur-sm rounded-xl border border-white/10 p-6">
            <p className="text-xs text-slate-500 mb-4">Sponsored</p>
            <BannerAd />
          </div>
        </>
      )}
    </div>
  )
}
