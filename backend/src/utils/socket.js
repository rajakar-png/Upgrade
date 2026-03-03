/**
 * Socket.io singleton — import `io` anywhere in routes to emit real-time events
 */
import { Server } from "socket.io"
import { verifyToken } from "./jwt.js"
import { setupConsoleProxy } from "../services/consoleProxy.js"

let io = null

export function initSocket(httpServer, corsOrigin) {
  // corsOrigin can be true (allow all), an array, or a function
  const originValue = corsOrigin === true ? "*" : corsOrigin

  io = new Server(httpServer, {
    cors: {
      origin: originValue,
      credentials: originValue !== "*",
      methods: ["GET", "POST"]
    },
    transports: ["polling", "websocket"],
    allowEIO3: true
  })

  // Authenticate every socket connection via JWT
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token
    if (!token) {
      // Allow unauthenticated connections for public broadcasts (plans, frontpage)
      // but tag them so future private events can be gated
      socket.data.authenticated = false
      return next()
    }
    try {
      const decoded = verifyToken(token)
      socket.data.user = decoded
      socket.data.authenticated = true
      next()
    } catch {
      next(new Error("Authentication failed"))
    }
  })

  io.on("connection", (socket) => {
    console.log(`[Socket] Client connected: ${socket.id} auth=${socket.data.authenticated}`)
    socket.on("disconnect", () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`)
    })
  })

  // Attach Pterodactyl console WebSocket proxy
  setupConsoleProxy(io)

  console.log("[Socket] ✓ Socket.io initialized")
  return io
}

export function getIO() {
  if (!io) throw new Error("Socket.io not initialized — call initSocket first")
  return io
}
