import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import Topbar from "../components/Topbar.jsx"
import ConfirmModal from "../components/ConfirmModal.jsx"
import ButtonSpinner from "../components/ButtonSpinner.jsx"
import { useAppUI } from "../context/AppUIContext.jsx"
import { api } from "../services/api.js"
import {
  MapPin,
  Package,
  Server,
  Cpu,
  HardDrive,
  Zap,
  Sparkles,
  Star,
  Crown,
  Shield,
  Rocket,
  Gift,
  Gem,
  Trophy,
  Diamond,
  Circle,
  Coins,
  Wallet
} from "lucide-react"

// Icon mapping for dynamic rendering
const iconMap = {
  Package,
  Server,
  Cpu,
  HardDrive,
  Zap,
  Sparkles,
  Star,
  Crown,
  Shield,
  Rocket,
  Gift,
  Gem,
  Trophy,
  Diamond,
  Circle
}

export default function Plans() {
  const [coinPlans, setCoinPlans] = useState([])
  const [realPlans, setRealPlans] = useState([])
  const [locations, setLocations] = useState([])
  const [eggs, setEggs] = useState([])
  const [loadingNodes, setLoadingNodes] = useState(false)
  const [loadingEggs, setLoadingEggs] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [serverName, setServerName] = useState("")
  const [selectedNode, setSelectedNode] = useState(null) // { nodeId, name }
  const [selectedEgg, setSelectedEgg] = useState(null) // { id, name, description }
  const [purchasing, setPurchasing] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const navigate = useNavigate()
  const { showSuccess, showError } = useAppUI()

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) {
      navigate("/login")
      return
    }

    const loadPlans = async () => {
      try {
        const [coin, real] = await Promise.all([api.getCoinPlans(), api.getRealPlans()])
        setCoinPlans(coin || [])
        setRealPlans(real || [])
      } catch (err) {
        showError(err.message || "Failed to load plans")
      } finally {
        setLoading(false)
      }
    }

    loadPlans()
  }, [navigate, showError])

  const handleConfirmPurchase = async () => {
    if (!selectedPlan || !serverName.trim() || !selectedEgg) return

    setPurchasing(true)
    try {
      const token = localStorage.getItem("token")
      await api.purchaseServer(
        token,
        selectedPlan.type,
        selectedPlan.id,
        serverName,
        selectedNode?.nodeId || undefined,
        selectedNode?.name || "",
        selectedEgg.name,
        selectedEgg.id
      )
      showSuccess("Server purchased successfully! Redirecting…")
      setSelectedPlan(null)
      setServerName("")
      setSelectedNode(null)
      setSelectedEgg(null)
      setConfirmOpen(false)
      navigate("/servers")
    } catch (err) {
      showError(err.message || "Purchase failed")
    } finally {
      setPurchasing(false)
    }
  }

  // Fetch live nodes and eggs from Pterodactyl when the user opens the purchase form
  const handleSelectPlan = (plan) => {
    setSelectedPlan(plan)
    const token = localStorage.getItem("token")
    
    // Fetch nodes if not already loaded
    if (locations.length === 0) {
      setLoadingNodes(true)
      api
        .getAvailableNodes(token)
        .then((nodes) => {
          setLocations(nodes || [])
          if (nodes && nodes.length > 0) setSelectedNode(nodes[0])
        })
        .catch(() => {})
        .finally(() => setLoadingNodes(false))
    }
    
    // Fetch eggs if not already loaded
    if (eggs.length === 0) {
      setLoadingEggs(true)
      api
        .getAvailableEggs(token)
        .then((eggsList) => {
          setEggs(eggsList || [])
          if (eggsList && eggsList.length > 0) setSelectedEgg(eggsList[0])
        })
        .catch(() => {})
        .finally(() => setLoadingEggs(false))
    }
  }

  const handleRequestPurchase = (e) => {
    e.preventDefault()
    if (!selectedPlan || !serverName.trim() || !selectedEgg) {
      showError("Please select a plan, enter a server name, and choose server software")
      return
    }
    setConfirmOpen(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-gray-400">Loading plans...</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-16">
      <Topbar />

      {/* Coin Plans Section */}
      <section className="space-y-6 animate-fade-in">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-500/10 border border-primary-500/20 mb-4">
            <Coins className="h-3.5 w-3.5 text-primary-400" />
            <span className="text-xs font-semibold text-primary-300 uppercase tracking-wider">Coin Plans</span>
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">Coin plans</h2>
          <p className="text-slate-400 max-w-2xl">
            Use coins to provision servers with flexible durations.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {coinPlans.map((plan) => {
            const IconComponent = iconMap[plan.icon] || Package
            const isActive = selectedPlan?.id === plan.id && selectedPlan?.type === "coin"
            return (
              <div
                key={plan.id}
                onClick={() => handleSelectPlan({ ...plan, type: "coin" })}
                className={`card-3d group relative cursor-pointer rounded-2xl border p-6 transition-all duration-300 ${
                  isActive
                    ? "border-primary-500 bg-dark-800/90 shadow-glow-primary"
                    : "border-white/10 bg-dark-800/60 hover:border-primary-500/30 hover:bg-dark-800/80"
                }`}
              >
                {/* Subtle glow on hover */}
                <div className={`absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-primary-500 to-accent-500 opacity-0 blur-lg transition-opacity duration-300 -z-10 ${isActive ? "opacity-20" : "group-hover:opacity-10"}`} />

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${
                      isActive ? "bg-primary-500/20 text-primary-400 shadow-glow-primary" : "bg-white/5 text-slate-400 group-hover:bg-primary-500/10 group-hover:text-primary-400"
                    }`}>
                      <IconComponent size={24} />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-lg">{plan.name}</h3>
                      <p className="text-xs text-primary-400 font-medium">Coin plan</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2.5 text-sm text-slate-400">
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-lg bg-white/5 flex items-center justify-center"><HardDrive size={14} className="text-primary-400" /></div>
                      <span>{plan.storage} GB storage</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-lg bg-white/5 flex items-center justify-center"><Cpu size={14} className="text-primary-400" /></div>
                      <span>{plan.cpu} CPU cores</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-lg bg-white/5 flex items-center justify-center"><Zap size={14} className="text-primary-400" /></div>
                      <span>{plan.ram} GB RAM</span>
                    </div>
                  </div>
                  
                  <div className="border-t border-white/10 pt-4">
                    <p className={`text-3xl font-extrabold ${isActive ? "text-gradient" : "text-white"}`}>{plan.coin_price}</p>
                    <p className="text-sm text-slate-500">coins / {plan.duration_days} days</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Real Money Plans Section */}
      <section className="space-y-6 animate-fade-in">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent-500/10 border border-accent-500/20 mb-4">
            <Wallet className="h-3.5 w-3.5 text-accent-400" />
            <span className="text-xs font-semibold text-accent-300 uppercase tracking-wider">Premium Plans</span>
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">Real money plans</h2>
          <p className="text-slate-400 max-w-2xl">
            Balance-powered plans with the same duration flexibility.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {realPlans.map((plan) => {
            const IconComponent = iconMap[plan.icon] || Server
            const isActive = selectedPlan?.id === plan.id && selectedPlan?.type === "real"
            return (
              <div
                key={plan.id}
                onClick={() => handleSelectPlan({ ...plan, type: "real" })}
                className={`card-3d group relative cursor-pointer rounded-2xl border p-6 transition-all duration-300 ${
                  isActive
                    ? "border-accent-500 bg-dark-800/90 shadow-glow-accent"
                    : "border-white/10 bg-dark-800/60 hover:border-accent-500/30 hover:bg-dark-800/80"
                }`}
              >
                <div className={`absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-accent-500 to-primary-500 opacity-0 blur-lg transition-opacity duration-300 -z-10 ${isActive ? "opacity-20" : "group-hover:opacity-10"}`} />

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${
                      isActive ? "bg-accent-500/20 text-accent-400 shadow-glow-accent" : "bg-white/5 text-slate-400 group-hover:bg-accent-500/10 group-hover:text-accent-400"
                    }`}>
                      <IconComponent size={24} />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-lg">{plan.name}</h3>
                      <p className="text-xs text-accent-400 font-medium">Real money</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2.5 text-sm text-slate-400">
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-lg bg-white/5 flex items-center justify-center"><HardDrive size={14} className="text-accent-400" /></div>
                      <span>{plan.storage} GB storage</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-lg bg-white/5 flex items-center justify-center"><Cpu size={14} className="text-accent-400" /></div>
                      <span>{plan.cpu} CPU cores</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-lg bg-white/5 flex items-center justify-center"><Zap size={14} className="text-accent-400" /></div>
                      <span>{plan.ram} GB RAM</span>
                    </div>
                  </div>
                  
                  <div className="border-t border-white/10 pt-4">
                    <p className={`text-3xl font-extrabold ${isActive ? "text-gradient-accent" : "text-white"}`}>₹{plan.price.toFixed(2)}</p>
                    <p className="text-sm text-slate-500">/ {plan.duration_days} days</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Configuration Form */}
      {selectedPlan && (
        <div className="relative rounded-2xl border border-white/10 bg-dark-800/70 backdrop-blur-sm p-8 animate-fade-in">
          {/* Glow accent */}
          <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-primary-500/10 via-accent-500/10 to-primary-500/10 blur-xl -z-10" />
          
          <h3 className="text-2xl font-bold text-white mb-2">Configure your server</h3>
          <p className="text-sm text-slate-400 mb-8">Fill in the details below to deploy your new server.</p>
          
          <form onSubmit={handleRequestPurchase} className="space-y-8">
            <div>
              <label htmlFor="server-name" className="block text-sm font-semibold text-slate-200 mb-2">
                Server name
              </label>
              <input
                id="server-name"
                name="serverName"
                type="text"
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                placeholder="e.g., Astra SMP"
                className="w-full bg-dark-900/80 border border-white/10 rounded-xl px-4 py-3.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-primary-500/50 focus:ring-2 focus:ring-primary-500/20 transition-all"
              />
            </div>
            
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-200 mb-3">
                <Package className="w-4 h-4 text-primary-400" />
                Server software
              </label>
              {loadingEggs && (
                <div className="flex items-center gap-2 text-sm text-slate-400"><div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" /> Loading available software...</div>
              )}
              {!loadingEggs && eggs.length === 0 && (
                <p className="text-sm text-slate-500">No server software available.</p>
              )}
              {!loadingEggs && eggs.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 max-h-64 overflow-y-auto pr-1">
                  {eggs.map((egg) => (
                    <button
                      key={egg.id}
                      type="button"
                      onClick={() => setSelectedEgg(egg)}
                      className={`group/egg rounded-xl border p-4 text-left transition-all duration-200 ${
                        selectedEgg?.id === egg.id
                          ? "border-primary-500 bg-primary-500/10 shadow-glow-primary"
                          : "border-white/10 bg-dark-900/60 hover:border-primary-500/30 hover:bg-dark-900/80"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-white truncate">{egg.name}</p>
                          <p className="text-xs text-slate-500 mt-0.5 truncate">{egg.nestName}</p>
                          {egg.description && (
                            <p className="text-sm text-slate-400 mt-1 line-clamp-2">{egg.description}</p>
                          )}
                        </div>
                        {selectedEgg?.id === egg.id && (
                          <div className="w-2.5 h-2.5 rounded-full bg-primary-500 flex-shrink-0 mt-1.5 animate-pulse" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-200 mb-3">
                <MapPin className="w-4 h-4 text-primary-400" />
                Server location
              </label>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {loadingNodes && (
                  <div className="flex items-center gap-2 text-sm text-slate-400 col-span-full"><div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" /> Loading locations...</div>
                )}
                {!loadingNodes && locations.length === 0 && (
                  <p className="text-sm text-slate-500 col-span-full">
                    No locations available right now.
                  </p>
                )}
                {locations.map((node) => (
                  <button
                    key={node.nodeId}
                    type="button"
                    onClick={() => setSelectedNode(node)}
                    className={`group/loc rounded-xl border p-4 text-left transition-all duration-200 ${
                      selectedNode?.nodeId === node.nodeId
                        ? "border-primary-500 bg-primary-500/10 shadow-glow-primary"
                        : "border-white/10 bg-dark-900/60 hover:border-primary-500/30 hover:bg-dark-900/80"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-white truncate">{node.name}</p>
                        <p className="text-sm text-slate-400 mt-1">
                          {node.freeAllocCount} slot{node.freeAllocCount !== 1 ? "s" : ""} free
                        </p>
                      </div>
                      {selectedNode?.nodeId === node.nodeId && (
                        <div className="w-2.5 h-2.5 rounded-full bg-primary-500 flex-shrink-0 mt-1.5 animate-pulse" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={() => setSelectedPlan(null)}
                className="button-3d flex-1 px-6 py-3.5 bg-dark-900/80 hover:bg-dark-700/80 text-slate-200 rounded-xl font-semibold border border-white/10 hover:border-white/20 transition-all"
              >
                Cancel
              </button>
              <ButtonSpinner
                type="submit"
                loading={purchasing}
                className="glow-ring button-3d flex-1 px-6 py-3.5 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white rounded-xl font-bold transition-all shadow-glow-primary hover:shadow-lg hover:shadow-primary-500/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:!shadow-none"
              >
                🚀 Purchase server
              </ButtonSpinner>
            </div>
          </form>
        </div>
      )}

      <ConfirmModal
        open={confirmOpen}
        title="Confirm purchase"
        message={`Deploy "${serverName}" using the ${selectedPlan?.name} plan with ${selectedEgg?.name || 'default software'}?`}
        detail={
          selectedPlan?.type === "coin"
            ? `This will cost ${selectedPlan?.coin_price} coins for ${selectedPlan?.duration_days} days.`
            : `This will charge ₹${selectedPlan?.price?.toFixed(2)} for ${selectedPlan?.duration_days} days.`
        }
        confirmLabel="Purchase"
        confirmVariant="primary"
        loading={purchasing}
        onConfirm={handleConfirmPurchase}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  )
}
