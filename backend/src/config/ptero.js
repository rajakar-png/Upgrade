import axios from "axios"
import { env } from "./env.js"

const panelUrl = env.PTERODACTYL_URL.replace(/\/$/, "")

/**
 * Application API – admin operations (create/delete servers, manage users, etc.)
 * Uses the admin API key (PTLA_xxx) stored in PTERODACTYL_API_KEY.
 */
export const appApi = axios.create({
  baseURL: `${panelUrl}/api/application`,
  headers: {
    Authorization: `Bearer ${env.PTERODACTYL_API_KEY}`,
    Accept: "application/json",
    "Content-Type": "application/json"
  },
  timeout: 15000
})

/**
 * Client API – per-server actions that require a client key (PTLC_xxx).
 * Used for: backup create/list/delete/restore, file manager, console.
 * Set PTERODACTYL_CLIENT_KEY in .env to enable backup management.
 * Generate in Pterodactyl panel: Account → API Credentials (admin account).
 */
export const clientApi = env.PTERODACTYL_CLIENT_KEY
  ? axios.create({
      baseURL: `${panelUrl}/api/client`,
      headers: {
        Authorization: `Bearer ${env.PTERODACTYL_CLIENT_KEY}`,
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      timeout: 30000
    })
  : null

