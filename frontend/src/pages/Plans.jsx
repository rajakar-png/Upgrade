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
  Wallet,
  Check,
  Bot,
  Pickaxe
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
  Circle,
  Bot
}

export default function Plans() {
  const [category, setCategory] = useState("minecraft") // "minecraft" | "bot"
  const [coinPlans, setCoinPlans] = useState([])
  const [realPlans, setRealPlans] = useState([])
  const [locations, setLocations] = useState([])
  const [eggs, setEggs] = useState([])
  const [loadingNodes, setLoadingNodes] = useState(false)
  const [loadingEggs, setLoadingEggs] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [serverName, setServerName] = useState("")
  const [selectedNode, setSelectedNode] = useState(null)
  const [selectedEgg, setSelectedEgg] = useState(null)
  const [purchasing, setPurchasing] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const navigate = useNavigate()
  const { showSuccess, showError } = useAppUI()

  // Load plans whenever category changes
  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) { navigate("/login"); return }

    setLoading(true)
    setSelectedPlan(null)
    setEggs([])
    setSelectedEgg(null)

    const loadPlans = async () => {
      try {
        const [coin, real] = await Promise.all([
          api.getCoinPlans(category),
          api.getRealPlans(category)
        ])
        setCoinPlans(coin || [])
        setRealPlans(real || [])
      } catch (err) {
        showError(err.message || "Failed to load plans")
      } finally {
        setLoading(false)
      }
    }

    loadPlans()
  }, [category, navigate, showError])

  const handleConfirmPurchase = async () => {
    if (!selectedPlan || !serverName.trim() || !selectedEgg) return

    setPurchasing(true)
    try {
      const token = localStorage.getItem("token")
      const result = await api.purchaseServer(
        token,
        selectedPlan.type,
        selectedPlan.id,
        serverName,
        selectedNode?.nodeId || undefined,
        selectedNode?.name || "",
        selectedEgg.name,
        selectedEgg.id,
        category
      )
      showSuccess("Server purchased successfully! Redirecting…")
      const purchasedCategory = category
      setSelectedPlan(null)
      setServerName("")
      setSelectedNode(null)
      setSelectedEgg(null)
      setConfirmOpen(false)
      // Redirect bot servers to the deploy tab so the user can upload their ZIP
      if (purchasedCategory === "bot" && result.server_id) {
        navigate(`/servers/${result.server_id}/manage?tab=deploy`)
      } else {
        navigate("/servers")
      }
    } catch (err) {
      showError(err.message || "Purchase failed")
    } finally {
      setPurchasing(false)
    }
  }

  // Fetch live nodes and eggs from Pterodactyl when the user opens the purchase form
  const handleSelectPlan = (plan) => {
    setSelectedPlan(plan)
    setSelectedEgg(null)
    setEggs([])
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
    
    // Fetch eggs filtered by category
    setLoadingEggs(true)
    api
      .getAvailableEggs(token, category)
      .then((eggsList) => {
        setEggs(eggsList || [])
        if (eggsList && eggsList.length > 0) setSelectedEgg(eggsList[0])
      })
      .catch(() => {})
      .finally(() => setLoadingEggs(false))
  }

  const handleRequestPurchase = (e) => {
    e.preventDefault()
    if (!selectedPlan || !serverName.trim() || !selectedEgg) {
      showError("Please select a plan, enter a name, and choose " + (category === "minecraft" ? "server software" : "a bot runtime"))
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

      {/* ── Category Toggle ─────────────────────────────────────────────── */}
      <div className="flex justify-center animate-fade-in">
        <div className="inline-flex rounded-xl border border-dark-700/50 bg-dark-900/80 backdrop-blur-sm p-1.5 gap-1">
          <button
            onClick={() => setCategory("minecraft")}
            className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all duration-200 ${
              category === "minecraft"
                ? "bg-primary-500/15 text-primary-300 border border-primary-500/30 shadow-sm shadow-primary-500/10"
                : "text-slate-400 hover:text-white hover:bg-dark-800/50 border border-transparent"
            }`}
          >
            <Pickaxe className="h-4 w-4" />
            Minecraft Hosting
          </button>
          <button
            onClick={() => setCategory("bot")}
            className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all duration-200 ${
              category === "bot"
                ? "bg-neon-500/15 text-neon-300 border border-neon-500/30 shadow-sm shadow-neon-500/10"
                : "text-slate-400 hover:text-white hover:bg-dark-800/50 border border-transparent"
            }`}
          >
            <Bot className="h-4 w-4" />
            Bot Hosting
          </button>
        </div>
      </div>

      {/* Coin Plans Section */}
      <section className="space-y-6 animate-fade-in">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-500/10 border border-primary-500/20 mb-4">
            <Coins className="h-3.5 w-3.5 text-primary-400" />
            <span className="text-xs font-semibold text-primary-300 uppercase tracking-wider">Coin Plans</span>
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">
            {category === "minecraft" ? "Minecraft coin plans" : "Bot hosting coin plans"}
          </h2>
          <p className="text-slate-400 max-w-2xl">
            {category === "minecraft"
              ? "Use coins to provision Minecraft servers with flexible durations."
              : "Use coins to deploy and host your Discord bots, Node.js apps, and more."}
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
                    : "border-dark-700/50 bg-dark-800/60 hover:border-primary-500/30 hover:bg-dark-800/80"
                }`}
              >
                {/* Subtle glow on hover */}
                <div className={`absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-primary-500 to-accent-500 opacity-0 blur-md transition-opacity duration-300 -z-10 ${isActive ? "opacity-20" : "group-hover:opacity-20"}`} />

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${
                      isActive ? "bg-primary-500/20 text-primary-400 shadow-glow-primary" : "bg-dark-800/60 text-slate-400 group-hover:bg-primary-500/10 group-hover:text-primary-400"
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
                      <div className="h-7 w-7 rounded-lg bg-dark-800/60 flex items-center justify-center"><HardDrive size={14} className="text-primary-400" /></div>
                      <span>{plan.storage} GB storage</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-lg bg-dark-800/60 flex items-center justify-center"><Cpu size={14} className="text-primary-400" /></div>
                      <span>{plan.cpu} CPU cores</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-lg bg-dark-800/60 flex items-center justify-center"><Zap size={14} className="text-primary-400" /></div>
                      <span>{plan.ram} GB RAM</span>
                    </div>
                  </div>
                  
                  <div className="border-t border-dark-700/50 pt-4">
                    {plan.initial_price === 0 ? (
                      <>
                        <p className={`text-3xl font-extrabold ${isActive ? "text-gradient" : "text-green-400"}`}>FREE</p>
                        <p className="text-sm text-slate-500">first purchase • then {plan.renewal_price || plan.coin_price} coins / {plan.duration_days} days</p>
                      </>
                    ) : (
                      <>
                        <p className={`text-3xl font-extrabold ${isActive ? "text-gradient" : "text-white"}`}>{plan.initial_price ?? plan.coin_price}</p>
                        <p className="text-sm text-slate-500">coins first buy{plan.renewal_price && plan.renewal_price !== plan.initial_price ? ` • ${plan.renewal_price} renewal` : ''} / {plan.duration_days} days</p>
                      </>
                    )}
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
          <h2 className="text-3xl font-bold text-white mb-2">
            {category === "minecraft" ? "Minecraft premium plans" : "Bot hosting premium plans"}
          </h2>
          <p className="text-slate-400 max-w-2xl">
            {category === "minecraft"
              ? "Balance-powered Minecraft plans with the same duration flexibility."
              : "Premium bot hosting with dedicated resources and priority support."}
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
                    : "border-dark-700/50 bg-dark-800/60 hover:border-accent-500/30 hover:bg-dark-800/80"
                }`}
              >
                <div className={`absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-primary-500 to-accent-500 opacity-0 blur-md transition-opacity duration-300 -z-10 ${isActive ? "opacity-20" : "group-hover:opacity-20"}`} />

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${
                      isActive ? "bg-accent-500/20 text-accent-400 shadow-glow-accent" : "bg-dark-800/60 text-slate-400 group-hover:bg-accent-500/10 group-hover:text-accent-400"
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
                      <div className="h-7 w-7 rounded-lg bg-dark-800/60 flex items-center justify-center"><HardDrive size={14} className="text-accent-400" /></div>
                      <span>{plan.storage} GB storage</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-lg bg-dark-800/60 flex items-center justify-center"><Cpu size={14} className="text-accent-400" /></div>
                      <span>{plan.cpu} CPU cores</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-lg bg-dark-800/60 flex items-center justify-center"><Zap size={14} className="text-accent-400" /></div>
                      <span>{plan.ram} GB RAM</span>
                    </div>
                  </div>
                  
                  <div className="border-t border-dark-700/50 pt-4">
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
        <div className="card-3d relative rounded-2xl border border-dark-700/50 bg-dark-800/70 backdrop-blur-sm p-8 animate-fade-in">
          {/* Glow accent */}
          <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-primary-500/10 via-accent-500/10 to-primary-500/10 blur-xl -z-10" />
          
          <h3 className="text-2xl font-bold text-white mb-2">
            {category === "minecraft" ? "Configure your server" : "Configure your bot"}
          </h3>
          <p className="text-sm text-slate-400 mb-8">
            {category === "minecraft"
              ? "Fill in the details below to deploy your new Minecraft server."
              : "Pick your runtime and location to deploy your bot."}
          </p>
          
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
                className="w-full bg-dark-900/80 border border-dark-700/50 rounded-xl px-4 py-3.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-primary-500/50 focus:ring-2 focus:ring-primary-500/20 transition-all"
              />
            </div>
            
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-200 mb-3">
                <Package className="w-4 h-4 text-primary-400" />
                {category === "minecraft" ? "Server software" : "Bot runtime"}
              </label>
              {loadingEggs && (
                <div className="flex items-center gap-2 text-sm text-slate-400"><div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" /> Loading {category === "minecraft" ? "available software" : "bot runtimes"}...</div>
              )}
              {!loadingEggs && eggs.length === 0 && (
                <p className="text-sm text-slate-500">No {category === "minecraft" ? "server software" : "bot runtimes"} available.</p>
              )}
              {!loadingEggs && eggs.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 max-h-64 overflow-y-auto pr-1">
                  {eggs.map((egg) => (
                    <button
                      key={egg.id}
                      type="button"
                      onClick={() => setSelectedEgg(egg)}
                      className={`group/egg rounded-xl border-2 p-4 text-left transition-all duration-200 ${
                        selectedEgg?.id === egg.id
                          ? "border-primary-500 bg-primary-500/20 ring-2 ring-primary-500/40 shadow-glow-primary scale-[1.02]"
                          : "border-dark-700/50 bg-dark-900/60 hover:border-primary-500/30 hover:bg-dark-900/80"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className={`font-semibold truncate ${selectedEgg?.id === egg.id ? "text-primary-300" : "text-white"}`}>{egg.name}</p>
                          <p className="text-xs text-slate-500 mt-0.5 truncate">{egg.nestName}</p>
                          {egg.description && (
                            <p className="text-sm text-slate-400 mt-1 line-clamp-2">{egg.description}</p>
                          )}
                        </div>
                        {selectedEgg?.id === egg.id && (
                          <div className="w-5 h-5 rounded-full bg-primary-500 flex-shrink-0 mt-0.5 flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" />
                          </div>
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
                    className={`group/loc rounded-xl border-2 p-4 text-left transition-all duration-200 ${
                      selectedNode?.nodeId === node.nodeId
                        ? "border-primary-500 bg-primary-500/20 ring-2 ring-primary-500/40 shadow-glow-primary scale-[1.02]"
                        : "border-dark-700/50 bg-dark-900/60 hover:border-primary-500/30 hover:bg-dark-900/80"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className={`font-semibold truncate ${selectedNode?.nodeId === node.nodeId ? "text-primary-300" : "text-white"}`}>{node.name}</p>
                        <p className="text-sm text-slate-400 mt-1">
                          {node.freeAllocCount} slot{node.freeAllocCount !== 1 ? "s" : ""} free
                        </p>
                      </div>
                      {selectedNode?.nodeId === node.nodeId && (
                        <div className="w-5 h-5 rounded-full bg-primary-500 flex-shrink-0 mt-0.5 flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
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
                className="button-3d flex-1 px-6 py-3.5 bg-dark-900/80 hover:bg-dark-700/80 text-slate-200 rounded-xl font-semibold border border-dark-700/50 hover:border-dark-600/60 transition-all"
              >
                Cancel
              </button>
              <ButtonSpinner
                type="submit"
                loading={purchasing}
                className="glow-ring button-3d flex-1 px-6 py-3.5 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white rounded-xl font-bold transition-all shadow-glow-primary hover:shadow-lg hover:shadow-primary-500/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:!shadow-none"
              >
              🚀 {category === "minecraft" ? "Purchase server" : "Deploy bot"}
              </ButtonSpinner>
            </div>
          </form>
        </div>
      )}

      <ConfirmModal
        open={confirmOpen}
        title="Confirm purchase"
        message={`Deploy "${serverName}" using the ${selectedPlan?.name} plan with ${selectedEgg?.name || (category === "minecraft" ? "default software" : "default runtime")}?`}
        detail={
          selectedPlan?.type === "coin"
            ? (selectedPlan?.initial_price === 0
                ? `First purchase is FREE! Renewal costs ${selectedPlan?.renewal_price || selectedPlan?.coin_price} coins every ${selectedPlan?.duration_days} days.`
                : `This will cost ${selectedPlan?.initial_price ?? selectedPlan?.coin_price} coins for ${selectedPlan?.duration_days} days. Renewal: ${selectedPlan?.renewal_price || selectedPlan?.coin_price} coins.`)
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
