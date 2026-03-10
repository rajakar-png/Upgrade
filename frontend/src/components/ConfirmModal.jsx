import { useEffect, useId } from "react"
import { AlertTriangle, X } from "lucide-react"
import Button from "./ui/Button.jsx"

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
  const titleId = useId()
  const messageId = useId()

  useEffect(() => {
    if (!open) return
    function handleKey(e) {
      if (e.key === "Escape" && !loading) onClose()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [open, onClose, loading])

  if (!open) return null

  const variant = confirmVariant === "danger" ? "danger" : "primary"

  return (
    <div
      className="fixed inset-0 z-[9500] flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && !loading && onClose()}
    >
      <div className="absolute inset-0 bg-dark-950/80 backdrop-blur-sm" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        className="relative w-full max-w-md rounded-2xl bg-dark-800/90 backdrop-blur-xl border border-dark-700/50 p-8 shadow-2xl animate-slide-up"
      >
        <button
          onClick={onClose}
          disabled={loading}
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
            <h2 id={titleId} className="text-lg font-semibold text-slate-100">
              {title}
            </h2>
            <p id={messageId} className="text-sm text-slate-400">{message}</p>
            {detail && (
              <p className="mt-2 rounded-lg border border-dark-700/40 bg-dark-900/60 px-3 py-2 text-xs text-slate-500">
                {detail}
              </p>
            )}
          </div>
        </div>

        <div className="mt-8 flex gap-3">
          <Button
            onClick={onClose}
            disabled={loading}
            className="flex-1"
            variant="secondary"
            size="md"
          >
            {cancelLabel}
          </Button>
          <Button
            loading={loading}
            onClick={onConfirm}
            className="flex-1"
            variant={variant}
            size="md"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
