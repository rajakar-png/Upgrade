import { io } from "socket.io-client"
import { getBackendBaseUrl } from "./api.js"

let socket = null

function getSocketUrl() {
  const viteEnv = (typeof import.meta !== "undefined" && import.meta.env) ? import.meta.env : {}
  if (viteEnv.VITE_SOCKET_URL) return viteEnv.VITE_SOCKET_URL
  return getBackendBaseUrl()
}

export function getRealtimeSocket() {
  if (!socket) {
    socket = io(getSocketUrl(), {
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 12000
    })
  }

  return socket
}

export function subscribeRealtime(event, handler) {
  const client = getRealtimeSocket()
  client.on(event, handler)

  return () => {
    client.off(event, handler)
  }
}

export function getRealtimeState() {
  const client = getRealtimeSocket()
  return {
    connected: client.connected,
    id: client.id
  }
}
