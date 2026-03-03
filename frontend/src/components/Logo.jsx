import { useAppUI } from "../context/AppUIContext.jsx"
import { getBackendBaseUrl } from "../services/api.js"

export default function Logo({ size = "md" }) {
  const sizes = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-2xl"
  }
  const { siteSettings } = useAppUI()
  const name = siteSettings?.siteName || "AstraNodes"
  const logoPath = siteSettings?.logoPath
  const logoUrl = logoPath ? `${getBackendBaseUrl()}${logoPath}` : null
  const letter = name.charAt(0).toUpperCase()

  // Two-tone: split at last space, or halve when single word
  let first = name, last = ""
  const spaceIdx = name.lastIndexOf(" ")
  if (spaceIdx > 0) {
    first = name.slice(0, spaceIdx)
    last = name.slice(spaceIdx + 1)
  } else if (name.length > 4) {
    const half = Math.ceil(name.length / 2)
    first = name.slice(0, half)
    last = name.slice(half)
  }

  return (
    <div className="flex items-center gap-3">
      {logoUrl ? (
        <img src={logoUrl} alt={name} className="h-10 w-10 rounded-lg object-contain" />
      ) : (
        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
          <span className="text-white font-bold text-lg">
            {letter}
          </span>
        </div>
      )}
      <div className={`font-semibold ${sizes[size] || sizes.md}`}>
        <span className="text-white">{first}</span>
        <span className="bg-gradient-to-r from-primary-400 to-primary-500 bg-clip-text text-transparent">{last}</span>
      </div>
    </div>
  )
}
