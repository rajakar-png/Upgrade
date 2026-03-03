import { CheckCircle2, AlertTriangle, XCircle, X } from "lucide-react"
import { useAppUI } from "../context/AppUIContext.jsx"

const styles = {
  success: {
    icon: CheckCircle2,
    className: "border-emerald-500/40 bg-emerald-900/40 text-emerald-100"
  },
  error: {
    icon: XCircle,
    className: "border-red-500/40 bg-red-900/40 text-red-100"
  },
  warning: {
    icon: AlertTriangle,
    className: "border-amber-500/40 bg-amber-900/40 text-amber-100"
  }
}

export default function ToastViewport() {
  const { toasts, removeToast } = useAppUI()

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[80] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((toast) => {
        const style = styles[toast.type] || styles.success
        const Icon = style.icon

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-soft ${style.className}`}
          >
            <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <p className="flex-1 text-sm font-medium">{toast.message}</p>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="rounded p-1 opacity-70 transition hover:opacity-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
