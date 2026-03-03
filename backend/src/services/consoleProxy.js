import WebSocket from "ws"
import { pteroManage } from "./pteroManage.js"
import { createWingsToken } from "../config/wingsClient.js"
import { getOne } from "../config/db.js"
import { env } from "../config/env.js"

/** socketId → { ws, uuid, nodeId, pteroServerId } */
const activeSessions = new Map()

/**
 * Attach console-proxy event handlers to the existing Socket.io server.
 * Called once from initSocket after io is ready.
 */
export function setupConsoleProxy(io) {
  io.on("connection", (socket) => {
    console.log(`[ConsoleProxy] New socket ${socket.id}, authenticated=${socket.data.authenticated}`)
    
    // Console features require an authenticated socket
    if (!socket.data.authenticated) return

    /* ── Join a server's console ───────────────────────────────────────── */
    socket.on("console:join", async ({ serverId }) => {
      console.log(`[ConsoleProxy] console:join received for serverId=${serverId} from socket ${socket.id}`)
      try {
        // Verify the authenticated user owns this server
        const server = await getOne(
          "SELECT pterodactyl_server_id FROM servers WHERE id = ? AND user_id = ? AND status != 'deleted'",
          [serverId, socket.data.user.sub]
        )
        if (!server) {
          console.log(`[ConsoleProxy] Server not found for serverId=${serverId} userId=${socket.data.user.sub}`)
          socket.emit("console:error", { message: "Server not found or access denied" })
          return
        }

        if (!server.pterodactyl_server_id) {
          console.log(`[ConsoleProxy] Server ${serverId} has no pterodactyl_server_id (provisioning pending?)`)
          socket.emit("console:error", { message: "Server is still being provisioned. Please wait and try again." })
          return
        }

        // Tear down any previous session on this socket
        cleanupSession(socket.id)

        // Resolve uuid + node from the Application API
        console.log(`[ConsoleProxy] Resolving server details for pteroId=${server.pterodactyl_server_id}`)
        const details = await pteroManage.getServerDetails(server.pterodactyl_server_id)
        const { uuid, node: nodeId } = details
        console.log(`[ConsoleProxy] Got uuid=${uuid} nodeId=${nodeId}`)

        // Generate a Wings JWT and get the WebSocket URL
        const creds = await createWingsToken(nodeId, uuid)

        console.log("[ConsoleProxy] Connecting to Wings WS:", creds.socket)

        // Connect directly to Wings WebSocket
        // The Authorization header is required for Wings' API auth middleware
        const pteroWs = new WebSocket(creds.socket, {
          headers: {
            Authorization: `Bearer ${creds.bearerToken}`,
            Origin: env.PTERODACTYL_URL || ""
          },
          // Only skip TLS verification if explicitly opted in (self-signed Wings certs)
          rejectUnauthorized: env.WINGS_ALLOW_SELF_SIGNED !== "true",
          handshakeTimeout: 10000
        })

        // Timeout: if Wings doesn't send "auth success" within 15s, abort
        let authReceived = false
        const wingsAuthTimeout = setTimeout(() => {
          if (!authReceived) {
            console.error("[ConsoleProxy] Wings auth timeout for", uuid)
            socket.emit("console:error", {
              message: "Server daemon did not respond in time. It may be offline or unreachable."
            })
            cleanupSession(socket.id)
          }
        }, 15000)

        activeSessions.set(socket.id, {
          ws: pteroWs,
          uuid,
          nodeId,
          pteroServerId: server.pterodactyl_server_id,
          authTimeout: wingsAuthTimeout
        })

        pteroWs.on("open", () => {
          console.log("[ConsoleProxy] WS opened, sending auth token")
          pteroWs.send(JSON.stringify({ event: "auth", args: [creds.token] }))
        })

        pteroWs.on("message", (raw) => {
          try {
            const msg = JSON.parse(raw.toString())
            switch (msg.event) {
              case "auth success":
                console.log("[ConsoleProxy] Wings auth success for", uuid)
                authReceived = true
                clearTimeout(wingsAuthTimeout)
                socket.emit("console:connected")
                break
              case "console output":
                socket.emit("console:output", { line: msg.args?.[0] ?? "" })
                break
              case "status":
                socket.emit("console:status", { status: msg.args?.[0] ?? "" })
                break
              case "stats":
                try {
                  socket.emit("console:stats", JSON.parse(msg.args?.[0] ?? "{}"))
                } catch {
                  /* ignore bad JSON */
                }
                break
              case "token expiring":
              case "token expired":
                console.log("[ConsoleProxy] Token expiring, refreshing for", uuid)
                refreshToken(socket, uuid, nodeId)
                break
              case "jwt error":
                console.error("[ConsoleProxy] JWT auth rejected by Wings:", msg.args?.[0])
                socket.emit("console:error", { message: "Authentication rejected by server daemon" })
                cleanupSession(socket.id)
                break
              default:
                break
            }
          } catch {
            /* ignore unparseable frames */
          }
        })

        pteroWs.on("close", (code, reason) => {
          console.log("[ConsoleProxy] WS closed:", code, reason?.toString())
          clearTimeout(wingsAuthTimeout)
          socket.emit("console:disconnected")
          activeSessions.delete(socket.id)
        })

        pteroWs.on("error", (err) => {
          console.error("[ConsoleProxy] WS error:", err.message)
          if (!authReceived) {
            socket.emit("console:error", {
              message: `Cannot reach server daemon: ${err.message}`
            })
          } else {
            socket.emit("console:error", { message: "Console connection lost" })
          }
          cleanupSession(socket.id)
        })

        pteroWs.on("unexpected-response", (req, res) => {
          let body = ""
          res.on("data", (chunk) => { body += chunk })
          res.on("end", () => {
            console.error(`[ConsoleProxy] WS upgrade rejected: ${res.statusCode} ${res.statusMessage}`, body.substring(0, 200))
            socket.emit("console:error", {
              message: `Daemon rejected connection (${res.statusCode}). Check Wings configuration.`
            })
            cleanupSession(socket.id)
          })
        })
      } catch (err) {
        console.error("[ConsoleProxy] join error:", err.message, err.stack)
        socket.emit("console:error", { message: err.message || "Failed to connect to console" })
      }
    })

    /* ── Send a command ────────────────────────────────────────────────── */
    socket.on("console:command", ({ command }) => {
      // Security: validate command input
      if (typeof command !== "string" || command.length === 0 || command.length > 512) return
      // Strip newlines/carriage returns to prevent multi-command injection
      const sanitized = command.replace(/[\r\n]+/g, " ").trim()
      if (!sanitized) return

      const s = activeSessions.get(socket.id)
      if (!s?.ws || s.ws.readyState !== WebSocket.OPEN) {
        socket.emit("console:error", { message: "Console not connected" })
        return
      }
      s.ws.send(JSON.stringify({ event: "send command", args: [sanitized] }))
    })

    /* ── Power signal via WS ───────────────────────────────────────────── */
    socket.on("console:power", ({ signal }) => {
      // Security: whitelist valid power signals
      if (!["start", "stop", "restart", "kill"].includes(signal)) return

      const s = activeSessions.get(socket.id)
      if (!s?.ws || s.ws.readyState !== WebSocket.OPEN) {
        socket.emit("console:error", { message: "Console not connected" })
        return
      }
      s.ws.send(JSON.stringify({ event: "set state", args: [signal] }))
    })

    /* ── Leave / disconnect ────────────────────────────────────────────── */
    socket.on("console:leave", () => cleanupSession(socket.id))
    socket.on("disconnect", () => cleanupSession(socket.id))
  })

  console.log("[ConsoleProxy] ✓ Console proxy initialized")
}

/* ── Helpers ────────────────────────────────────────────────────────────────── */

async function refreshToken(socket, uuid, nodeId) {
  try {
    const { token } = await createWingsToken(nodeId, uuid)
    const s = activeSessions.get(socket.id)
    if (s?.ws?.readyState === WebSocket.OPEN) {
      s.ws.send(JSON.stringify({ event: "auth", args: [token] }))
    }
  } catch (err) {
    console.error("[ConsoleProxy] token refresh failed:", err.message)
  }
}

function cleanupSession(socketId) {
  const s = activeSessions.get(socketId)
  if (s) {
    if (s.authTimeout) clearTimeout(s.authTimeout)
    if (s.ws) {
      try {
        s.ws.close()
      } catch {
        /* already closed */
      }
    }
  }
  activeSessions.delete(socketId)
}
