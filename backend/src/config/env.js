import dotenv from "dotenv"
import { z } from "zod"
import { fileURLToPath } from "url"
import path from "path"

// Load .env relative to this file's location so it works regardless of cwd
// File is at backend/src/config/env.js → go up 3 dirs to reach backend/
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, "../../.env") })

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.string().default("4000"),
  FRONTEND_URL: z.string().default("http://localhost:5173"),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default("7d"),
  DB_PATH: z.string().default("./data/astranodes.sqlite"),
  UPLOAD_DIR: z.string().default("./uploads"),
  RATE_LIMIT_WINDOW: z.string().default("900000"),
  RATE_LIMIT_MAX: z.string().default("200"),
  PTERODACTYL_URL: z.string().min(1),
  PTERODACTYL_API_KEY: z.string().min(1),
  // Optional client API key (PTLC_xxx) — required for backup management.
  // Generate in Pterodactyl panel: Account → API Credentials (as an admin account).
  PTERODACTYL_CLIENT_KEY: z.string().optional(),
  // PTERODACTYL_DEFAULT_NODE is no longer required — nodes are selected
  // automatically by selectBestNode() based on real-time resource availability.
  // You may still set it as a hint but it is no longer used.
  PTERODACTYL_DEFAULT_NODE: z.string().optional(),
  PTERODACTYL_DEFAULT_EGG: z.string().min(1),
  PTERODACTYL_DEFAULT_ALLOCATION: z.string().optional(),
  PTERODACTYL_DEFAULT_DOCKER_IMAGE: z.string().min(1),
  PTERODACTYL_DEFAULT_STARTUP: z.string().min(1),
  PTERODACTYL_DEFAULT_ENV: z.string().default("{}"),
  DISCORD_WEBHOOK_URL: z.string().optional().default(""),
  // Optional support webhook
  DISCORD_SUPPORT_WEBHOOK_URL: z.string().optional(),
  // UPI payment details shown on Billing page
  UPI_ID: z.string().optional().default(""),
  UPI_NAME: z.string().optional().default(""),
  ADSTERRA_API_TOKEN: z.string().optional().default(""),
  ADSTERRA_DOMAIN_ID: z.string().optional().default("0"),
  ADSTERRA_NATIVE_BANNER_ID: z.string().optional(),
  ADSTERRA_BANNER_ID: z.string().optional(),
  ADSTERRA_NATIVE_BANNER_KEY: z.string().optional(),
  ADSTERRA_BANNER_KEY: z.string().optional(),
  ADSTERRA_NATIVE_BANNER_SCRIPT: z.string().optional(),
  ADSTERRA_BANNER_SCRIPT: z.string().optional(),
  ADSTERRA_NATIVE_CONTAINER_ID: z.string().optional(),
  // CurseForge API key (optional — enables CurseForge plugin/mod search + install)
  CURSEFORGE_API_KEY: z.string().optional(),
  // OAuth Configuration
  SESSION_SECRET: z.string().min(32),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  DISCORD_CLIENT_ID: z.string().optional(),
  DISCORD_CLIENT_SECRET: z.string().optional(),
  OAUTH_CALLBACK_URL: z.string().default("http://localhost:4000"),
  // Set to "true" to skip TLS certificate verification for Wings connections
  // (only needed if Wings uses self-signed certificates)
  WINGS_ALLOW_SELF_SIGNED: z.string().optional().default("false")
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error("Invalid environment configuration", parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = {
  ...parsed.data,
  PORT: Number(parsed.data.PORT),
  RATE_LIMIT_WINDOW: Number(parsed.data.RATE_LIMIT_WINDOW),
  RATE_LIMIT_MAX: Number(parsed.data.RATE_LIMIT_MAX),
  PTERODACTYL_DEFAULT_NODE: parsed.data.PTERODACTYL_DEFAULT_NODE ? Number(parsed.data.PTERODACTYL_DEFAULT_NODE) : null,
  PTERODACTYL_DEFAULT_EGG: Number(parsed.data.PTERODACTYL_DEFAULT_EGG),
  PTERODACTYL_DEFAULT_ALLOCATION: parsed.data.PTERODACTYL_DEFAULT_ALLOCATION ? Number(parsed.data.PTERODACTYL_DEFAULT_ALLOCATION) : null,
  ADSTERRA_DOMAIN_ID: Number(parsed.data.ADSTERRA_DOMAIN_ID),
  ADSTERRA_NATIVE_BANNER_ID: parsed.data.ADSTERRA_NATIVE_BANNER_ID ? Number(parsed.data.ADSTERRA_NATIVE_BANNER_ID) : null,
  ADSTERRA_BANNER_ID: parsed.data.ADSTERRA_BANNER_ID ? Number(parsed.data.ADSTERRA_BANNER_ID) : null
}
