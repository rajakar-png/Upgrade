import { useNavigate } from "react-router-dom"
import { MapPin, Server, Clock, Cpu, Database, HardDrive } from "lucide-react"
import Badge from "./Badge.jsx"

export default function ServerCard({ server, onRenew, renewing, countdown, graceCountdown }) {
  const navigate = useNavigate()

  const statusTone = {
    active: "success",
    suspended: "warning",
    deleted: "danger"
  }

  const statusLabel = {
    active: "Online",
    suspended: "Suspended",
    deleted: "Deleted"
  }

  const handleManage = () => {
    navigate(`/servers/${server.id}/manage`)
  }

  const getExpiryText = () => {
    if (!countdown) return "Loading..."
    if (countdown === "EXPIRED") return "Expired"
    return `Expires in ${countdown}`
  }

  return (
    <div className="card-3d group h-full flex flex-col rounded-xl border border-white/10 bg-dark-800/60 backdrop-blur-sm p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary-500/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      <div className="flex items-start justify-between gap-3 mb-4 relative">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-primary-500/10 border border-primary-500/20 flex items-center justify-center">
              <Server className="h-4 w-4 text-primary-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">{server.name}</h3>
          </div>
          <p className="text-sm text-slate-400">{server.plan}</p>
          {server.ip && server.port && (
            <p
              className="flex items-center gap-1 text-xs text-slate-400 mt-1 cursor-pointer hover:text-primary-300 transition-colors"
              title="Click to copy address"
              onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(`${server.ip}:${server.port}`) }}
            >
              <MapPin className="h-3 w-3" />
              {server.ip}:{server.port}
            </p>
          )}
          {server.location && !(server.ip && server.port) && (
            <p className="flex items-center gap-1 text-xs text-slate-500 mt-1">
              <MapPin className="h-3 w-3" />
              {server.location}
            </p>
          )}
        </div>
        <Badge label={statusLabel[server.status] || server.status} tone={statusTone[server.status]} />
      </div>

      {server.status === "suspended" && graceCountdown && graceCountdown !== "PURGE IMMINENT" && (
        <div className="mb-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-3 text-sm text-yellow-400">
          ⚠️ Suspended. Renew within {graceCountdown} to avoid deletion.
        </div>
      )}

      {graceCountdown === "PURGE IMMINENT" && (
        <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
          ⚠️ Deletion imminent. Renew immediately.
        </div>
      )}

      {/* Server Specs */}
      <div className="flex-1 space-y-3 mb-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Expires
          </span>
          <span className="text-white font-medium">{getExpiryText()}</span>
        </div>
        {server.ram && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400 flex items-center gap-2">
              <Database className="h-4 w-4" />
              RAM
            </span>
            <span className="text-white font-medium">{server.ram}</span>
          </div>
        )}
        {server.cpu && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400 flex items-center gap-2">
              <Cpu className="h-4 w-4" />
              CPU
            </span>
            <span className="text-white font-medium">{server.cpu}%</span>
          </div>
        )}
        {(server.disk || server.storage) && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400 flex items-center gap-2">
              <HardDrive className="h-4 w-4" />
              Storage
            </span>
            <span className="text-white font-medium">{server.disk || server.storage}</span>
          </div>
        )}
      </div>

      {server.status !== "deleted" && (
        <div className="flex gap-3 mt-auto pt-4 border-t border-white/[0.06] relative">
          <button
            onClick={handleManage}
            className="button-3d flex-1 rounded-lg bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-400 hover:to-primary-500 px-4 py-2.5 text-sm font-semibold text-white shadow-glow-primary transition-all"
          >
            Manage
          </button>
          <button
            onClick={() => onRenew && onRenew(server.id)}
            disabled={renewing}
            className="button-3d flex-1 rounded-lg border border-white/10 hover:border-white/20 bg-dark-700/60 hover:bg-dark-600/60 px-4 py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {renewing ? "Renewing..." : "Renew"}
          </button>
        </div>
      )}
    </div>
  )
}
