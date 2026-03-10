import { cn } from "../../utils/cn.js"

export default function Card({ children, className = "", elevated = false, ...props }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-dark-700/50 bg-dark-800/45 backdrop-blur-xl",
        elevated ? "card-3d" : "",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
