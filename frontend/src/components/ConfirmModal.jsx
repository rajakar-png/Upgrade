import { useEffect } from "react"
import { AlertTriangle, X } from "lucide-react"
import ButtonSpinner from "./ButtonSpinner.jsx"

export default function ConfirmModal({
  open,
  title = "Confirm Action",
  message = "Are you sure?",
  detail,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmVariant = "danger",
  loading = false,
  onConfirm,
  onClose
}) {
  useEffect(() => {
    if (!open) return
    function handleKey(e) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [open, onClose])

  if (!open) return null

  const variantCls =
    confirmVariant === "danger"
      ? "bg-red-900/30 border border-red-700/40 text-red-200 hover:bg-red-900/50"
      : "bg-primary-500/15 border border-primary-500/30 text-primary-300 hover:bg-primary-500/25"

  return (
    <div
      className="fixed inset-0 z-[9500] flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute inset-0 bg-dark-950/80 backdrop-blur-sm" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="relative w-full max-w-md rounded-2xl bg-dark-800/90 backdrop-blur-xl border border-white/10 p-8 shadow-2xl animate-slide-up"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-red-700/30 bg-red-900/30">
            <AlertTriangle className="h-5 w-5 text-red-300" />
          </div>
          <div className="space-y-1">
            <h2 id="modal-title" className="text-lg font-semibold text-slate-100">
              {title}
            </h2>
            <p className="text-sm text-slate-400">{message}</p>
            {detail && (
              <p className="mt-2 rounded-lg border border-white/[0.06] bg-dark-900/60 px-3 py-2 text-xs text-slate-500">
                {detail}
              </p>
            )}
          </div>
        </div>

        <div className="mt-8 flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="button-3d flex-1 rounded-xl border border-slate-700/60 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-800/30 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <ButtonSpinner
            loading={loading}
            onClick={onConfirm}
            className={`button-3d flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold ${variantCls}`}
          >
            {confirmLabel}
          </ButtonSpinner>
        </div>
      </div>
    </div>
  )
}
