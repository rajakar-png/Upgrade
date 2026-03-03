import { useNavigate } from "react-router-dom"
import { AlertCircle, ChevronLeft, Radio, Terminal } from "lucide-react"

export default function NotFound() {
  const navigate = useNavigate()

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-8 animate-fade-in">
      <div className="relative group perspective-1000">
        <div className="absolute -inset-10 bg-red-500/10 blur-[100px] rounded-full animate-pulse" />
        
        <div className="relative bg-dark-900/60 border border-white/10 rounded-[4rem] p-16 lg:p-24 backdrop-blur-3xl flex flex-col items-center text-center max-w-2xl shadow-2xl">
           <div className="h-32 w-32 rounded-[3.5rem] bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 mb-12 shadow-glow-red/20 group-hover:scale-110 transition-transform duration-700 animate-shake">
              <AlertCircle size={64} />
           </div>

           <div className="space-y-4 mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-[10px] font-black text-red-500 uppercase tracking-widest italic">
                <Radio size={12} className="animate-pulse" /> SIGNAL LOST
              </div>
              <h1 className="text-5xl lg:text-6xl font-black text-white italic uppercase tracking-tighter leading-none">
                SECTOR <span className="text-red-500 text-glow-red">404</span>
              </h1>
              <p className="text-xs font-black text-slate-600 uppercase italic tracking-[0.2em] leading-relaxed">
                The requested coordinate set does not exist in the Astra cluster. Transmission terminated.
              </p>
           </div>

           <div className="grid grid-cols-2 gap-4 w-full mb-12 opacity-40">
              <div className="p-6 rounded-3xl bg-white/2 border border-white/5 flex flex-col items-center">
                 <Terminal size={16} className="text-slate-500 mb-2" />
                 <span className="text-[9px] font-black text-white uppercase tracking-widest italic">ERR_CODE</span>
                 <span className="text-[8px] font-black text-slate-700 uppercase italic">VOID_REF_NULL</span>
              </div>
              <div className="p-6 rounded-3xl bg-white/2 border border-white/5 flex flex-col items-center">
                 <AlertCircle size={16} className="text-slate-500 mb-2" />
                 <span className="text-[9px] font-black text-white uppercase tracking-widest italic">COORD_SIG</span>
                 <span className="text-[8px] font-black text-slate-700 uppercase italic">OUT_OF_BOUNDS</span>
              </div>
           </div>

           <button 
             onClick={() => navigate("/")}
             className="h-20 w-full rounded-[2rem] bg-white/5 border border-white/10 text-white font-black italic text-[11px] uppercase tracking-widest flex items-center justify-center gap-4 hover:bg-white/10 hover:border-red-500/20 transition-all hover:scale-[1.02] active:scale-95 group/btn"
           >
             <ChevronLeft size={20} className="group-hover/btn:-translate-x-1 transition-transform" />
             RE-ENTER CONTROLLED SPACE
           </button>
        </div>
      </div>
    </div>
  )
}
