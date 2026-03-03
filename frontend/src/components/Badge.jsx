const colors = {
  success:  "bg-green-500/10 text-green-400 border-green-500/20",
  warning:  "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  danger:   "bg-red-500/10 text-red-400 border-red-500/20",
  info:     "bg-blue-500/10 text-blue-400 border-blue-500/20",
  // Legacy aliases
  active:   "bg-green-500/10 text-green-400 border-green-500/20",
  suspended:"bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  deleted:  "bg-red-500/10 text-red-400 border-red-500/20",
  admin:    "bg-blue-500/10 text-blue-400 border-blue-500/20",
  approved: "bg-green-500/10 text-green-400 border-green-500/20",
  rejected: "bg-red-500/10 text-red-400 border-red-500/20",
  pending:  "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
}

export default function Badge({ label, tone = "info" }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium ${
        colors[tone] || colors.info
      }`}
    >
      {label}
    </span>
  )
}
