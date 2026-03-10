import { Loader2 } from "lucide-react"
import { cn } from "../../utils/cn.js"

const variantClasses = {
  primary: "bg-primary-500 text-white border border-primary-400/30 hover:bg-primary-400 shadow-lg shadow-primary-500/20",
  secondary: "bg-dark-800/70 text-slate-100 border border-dark-700/60 hover:bg-dark-700/70",
  ghost: "bg-transparent text-slate-200 border border-dark-700/50 hover:bg-dark-800/50",
  danger: "bg-red-500/15 text-red-300 border border-red-500/30 hover:bg-red-500/25"
}

const sizeClasses = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-sm",
  lg: "h-12 px-6 text-base"
}

export default function Button({
  children,
  className = "",
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  type = "button",
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        "button-3d inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-55",
        variantClasses[variant] || variantClasses.primary,
        sizeClasses[size] || sizeClasses.md,
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
      {children}
    </button>
  )
}
