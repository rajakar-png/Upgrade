import { useAppUI } from "../context/AppUIContext.jsx"
import { CheckCircle, XCircle, AlertTriangle, X } from "lucide-react"

const CONFIG = {
  success: {
    icon: CheckCircle,
    bar: "bg-aurora-500",
    border: "border-aurora-400/30",
    text: "text-aurora-200",
    bg: "bg-aurora-900/50"
  },
  error: {
    icon: XCircle,
    bar: "bg-red-500",
    border: "border-red-400/30",
    text: "text-red-200",
    bg: "bg-red-900/50"
  },
  warning: {
    icon: AlertTriangle,
    bar: "bg-amber-500",
    border: "border-amber-400/30",
    text: "text-amber-200",
    bg: "bg-amber-900/50"
  }
}

function Toast({ id, type, message }) {
  const { removeToast } = useAppUI()
  const cfg = CONFIG[type] || CONFIG.success
  const Icon = cfg.icon

  return (
    <div
      role="alert"
      className={`pointer-events-auto flex items-start gap-3 rounded-2xl border ${cfg.border} ${cfg.bg} backdrop-blur-md px-4 py-3 shadow-soft animate-fade-up w-full max-w-sm`}
    >
      <div className={`relative h-0.5 w-1 self-stretch rounded-full ${cfg.bar} opacity-80`} />
      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${cfg.text}`} />
      <p className={`flex-1 text-sm font-medium ${cfg.text}`}>{message}</p>
      <button
        onClick={() => removeToast(id)}
        className="shrink-0 text-slate-500 hover:text-slate-300 transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

export default function ToastContainer() {
  const { toasts } = useAppUI()

  if (!toasts.length) return null

  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="pointer-events-none fixed top-5 right-5 z-[9000] flex flex-col gap-3 items-end"
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} />
      ))}
    </div>
  )
}
