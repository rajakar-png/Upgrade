import { Outlet, Link } from "react-router-dom"
import Logo from "../components/Logo.jsx"
import { ShieldCheck, Activity, Globe, Zap, Database, Lock, ChevronRight, ArrowUpRight } from "lucide-react"

export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-dark-950 text-slate-100 selection:bg-accent-500 selection:text-dark-950 font-sans tracking-tight overflow-hidden relative">
      {/* Cinematic Background Engine */}
      <div className="fixed inset-0 pointer-events-none z-0">
         <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(6,182,212,0.08),transparent_50%)] animate-pulse" />
         <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(139,92,246,0.05),transparent_50%)]" />
         <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-accent-500/5 blur-[120px] rounded-full animate-bounce-slow" />
         
         {/* Subtle Scanline Overlay */}
         <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-10 bg-[length:100%_4px,3px_100%] pointer-events-none opacity-[0.03]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-12 lg:py-20">
        <div className="mb-20 flex items-center justify-between">
            <Link to="/" className="group flex items-center gap-4 hover:scale-105 transition-transform">
              <Logo size="lg" />
              <div className="h-10 w-[1px] bg-white/10 hidden sm:block" />
              <div className="hidden sm:block">
                 <p className="text-[10px] font-black text-white italic uppercase tracking-[0.3em] leading-none mb-1">ASTRA FLEET</p>
                 <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest italic">COMMAND INTERFACE V4.2</p>
              </div>
            </Link>
            <div className="hidden lg:flex items-center gap-8">
               <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-glow-emerald animate-pulse" />
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">GLOBAL_UPLINK_ACTIVE</span>
               </div>
               <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-accent-500 shadow-glow-accent animate-pulse" />
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">SECURE_TUNNEL_READY</span>
               </div>
            </div>
        </div>

        <div className="grid flex-1 items-center gap-16 xl:gap-32 lg:grid-cols-2">
          {/* Hero Branding */}
          <div className="space-y-12 max-w-xl animate-slide-up">
            <div className="space-y-6">
               <div className="inline-flex items-center gap-3 px-4 py-2 rounded-2xl bg-white/5 border border-white/10">
                  <Lock size={12} className="text-accent-500" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 italic">Authorization Required</span>
               </div>
               <h1 className="text-5xl lg:text-7xl font-black text-white italic uppercase tracking-tighter leading-[0.9]">
                 SECURE <span className="text-gradient-accent text-glow-accent">GALACTIC</span> ACCESS.
               </h1>
               <p className="text-lg text-slate-500 font-medium italic leading-relaxed">
                 Initialize your operative identifiers to command high-performance clusters across 
                 the decentralized backbone with <span className="text-white font-black">zero friction</span>.
               </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label: "INSTANT_CORE", icon: Zap, desc: "Provisioning < 30s" },
                { label: "FAILSAFE_SYNC", icon: ShieldCheck, desc: "Auto-renewal logic" },
                { label: "DDoS_EXCLUSION", icon: Globe, desc: "L7 Mitigation active" },
                { label: "PTERODACTYL_V2", icon: Activity, desc: "Logic automation" }
              ].map((item, i) => (
                <div key={i} className="group flex items-start gap-4 p-5 rounded-[2rem] border border-white/[0.06] bg-dark-900/50 backdrop-blur-3xl transition-all hover:bg-white/5 hover:border-white/10 hover:translate-y-[-2px]">
                  <div className="h-10 w-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-accent-500 group-hover:scale-110 transition-transform">
                     <item.icon size={18} />
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest italic mb-1">{item.label}</p>
                    <p className="text-[11px] font-black text-white uppercase italic tracking-tighter">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="pt-8 border-t border-white/5 opacity-40">
               <p className="text-[9px] font-black text-slate-700 uppercase tracking-[0.4em] italic leading-loose">
                  ASTRA_NODES // DECENTRALIZED DATA CLUSTERS // END-TO-END CRYPTOGRAPHIC SECURITY ENFORCED ON ALL LAYERS.
               </p>
            </div>
          </div>

          {/* Form Container */}
          <div className="relative group/container perspective-1000">
            <div className="absolute -inset-1 bg-gradient-to-r from-accent-500/20 via-purple-500/20 to-accent-500/20 rounded-[3.5rem] blur-xl opacity-20 group-hover/container:opacity-40 transition-opacity" />
            <div className="relative bg-dark-900/50 border border-white/10 rounded-[3.5rem] p-10 lg:p-14 backdrop-blur-3xl shadow-2xl transition-all duration-700 group-hover/container:rotate-y-2 group-hover/container:border-white/20">
               <div className="absolute top-0 right-0 p-8 opacity-5">
                  <Database size={100} className="text-accent-500 rotate-12" />
               </div>
               <Outlet />
            </div>
            
            {/* HUD Callout */}
            <div className="absolute -bottom-12 -right-12 hidden xl:flex items-center gap-4 px-6 py-4 rounded-[1.5rem] bg-indigo-500/10 border border-indigo-500/20 backdrop-blur-3xl animate-bounce-slow">
               <div className="h-10 w-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <ShieldCheck size={20} />
               </div>
               <div className="text-right">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic mb-0.5">ENCRYPTION</p>
                  <p className="text-[11px] font-black text-white italic tracking-tighter uppercase">AES-256 BIT READY</p>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
