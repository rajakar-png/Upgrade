import { Loader2 } from "lucide-react"

export default function ButtonSpinner({ children, loading = false, disabled = false, className = "", ...props }) {
  return (
    <button
      disabled={disabled || loading}
      className={`relative inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
      {...props}
    >
      {loading && (
        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
      )}
      {children}
    </button>
  )
}
