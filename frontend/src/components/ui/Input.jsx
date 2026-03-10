import { cn } from "../../utils/cn.js"

export default function Input({ className = "", ...props }) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-xl border border-dark-700/60 bg-dark-900/75 px-4 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40",
        className
      )}
      {...props}
    />
  )
}
