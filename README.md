# AstraNodes

Full-stack Minecraft hosting platform with a premium dashboard UI, secure backend, automated renewals, and Pterodactyl lifecycle integration.

## Stack
- Frontend: React (Vite) + TailwindCSS v4
- Backend: Node.js (Express) + SQLite
- Auth: OAuth 2.0 (Google & Discord) + JWT
- Automation: cron-based expiry checks + automatic backups

## Project Structure
- frontend/ - UI and client routing
- backend/ - API, database, cron, and Pterodactyl integration

## Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

## Backend Setup
```bash
cd backend
cp .env.example .env
# Configure OAuth credentials in .env:
# - GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (from Google Cloud Console)
# - DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET (from Discord Developer Portal)
# - OAUTH_CALLBACK_URL (your backend URL)
npm install
npm run migrate
npm run migrate-tickets
npm run upgrade-tickets
npm run migrate-frontpage
npm run dev
```

> **📝 Note:** Database files are automatically excluded from git (see `.gitignore`). 
> A fresh database is created automatically when running migrations. 
> See [DATABASE.md](DATABASE.md) for detailed information.

## Create First Admin User

Since authentication is OAuth-only, use the setAdmin script after first login:

```bash
cd backend
# First, login via Google or Discord OAuth in the web app
# Then promote your account to admin:
node scripts/setAdmin.js your-email@example.com
```

For detailed admin setup instructions, see [ADMIN_SETUP.md](ADMIN_SETUP.md).

Once you're an admin, you can promote other users from the Admin Panel.

## Dynamic Front Page

The landing page is fully editable from the admin panel — no code changes required.

### Admin Pages
- `/admin/frontpage` — Edit Hero, Features, About, Stats, and Footer sections
- `/admin/landing-plans` — Create/edit/delete public pricing plans shown on the front page

### How It Works
- All content is stored in the `site_content` SQLite table (one row per section, JSON content)
- Pricing plans are stored in the `landing_plans` table (separate from coin/real plans)
- The front page fetches content from `GET /api/frontpage` and plans from `GET /api/frontpage/landing-plans`
- Changes made by an admin are broadcast via **Socket.io** to all connected browsers instantly — no page refresh needed

### API Endpoints
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/frontpage` | Public | All site content sections |
| GET | `/api/frontpage/landing-plans` | Public | Active landing plans |
| GET | `/api/admin/frontpage` | Admin | Same as above (admin prefill) |
| PUT | `/api/admin/frontpage/:section` | Admin | Update a section (hero/features/about/stats/footer) |
| GET | `/api/admin/frontpage/landing-plans` | Admin | All plans including inactive |
| POST | `/api/admin/frontpage/landing-plans` | Admin | Create plan |
| PUT | `/api/admin/frontpage/landing-plans/:id` | Admin | Update plan |
| DELETE | `/api/admin/frontpage/landing-plans/:id` | Admin | Delete plan |
| PATCH | `/api/admin/frontpage/landing-plans/:id/toggle-active` | Admin | Toggle visibility |
| PATCH | `/api/admin/frontpage/landing-plans/:id/toggle-popular` | Admin | Toggle popular badge |

### Socket.io Events
| Event | Direction | Payload |
|-------|-----------|---------|
| `frontpage:update` | Server → Clients | `{ section, data }` |
| `plans:update` | Server → Clients | `Plan[]` (active plans only) |

## Database Migrations

### Add Icon Support to Plans (Run once for existing databases)
```bash
cd backend
npm run migrate-icons
```

This adds the `icon` column to both `plans_coin` and `plans_real` tables. Required if you're upgrading from a version without icon support.

### Update Duration Types (Run once for existing databases)
```bash
cd backend
npm run migrate-duration
```

This updates the database constraints to support new duration types ("days" and "lifetime") and makes `duration_days` required. Run this if you see validation errors when creating plans.

## Plan Management

Admins can create, edit, and delete plans from the admin panel with the following features:

### Available Icons
Choose from 15 lucide-react icons for your plans:
- Package, Server, Cpu, HardDrive, Zap ⚡
- Sparkles ✨, Star ⭐, Crown 👑, Shield 🛡️
- Rocket 🚀, Gift 🎁, Gem 💎, Trophy 🏆, Diamond 💠, Circle ⭕

### Plan Fields
- **Name**: Display name for the plan
- **Icon**: Custom icon from the available set
- **Resources**: RAM (GB), CPU (cores), Storage (GB)
- **Pricing**: Coin price or real money price (₹)
- **Duration**: Type (days/lifetime) and number of days
- **Stock**: Optional limited stock with quantity
- **One-time Purchase**: (Coin plans only) Allow purchase only once per user

### One-Time Purchase Plans
When enabled on a coin plan, users can only purchase that specific plan once. However, they can still:
- **Renew** their existing server with that plan (extend the expiration)
- Purchase other plans normally
- Purchase the same plan again if their previous server was deleted

This is useful for limited-edition or special promotional plans where you want to restrict users to one active server per plan.

### Automatic Frontend Updates
When admins create, edit, or delete plans, changes are immediately reflected on the Plans page for all users. No caching or manual refresh required - the Plans page fetches live data from the database on every load.

## AFK Coins with Ads Monetization

The Coins page (/coins) is monetized with Adsterra ads via their Publisher API. The system supports **both iframe-based and script-based ad placements**.

**How it works:**
- Backend fetches your ad placements from Adsterra API
- Displays ads on the Coins page via iframe (for direct_url placements) or custom script (for other formats)
- Users **MUST view ads before they can claim coins** - this is monetization requirement
- If no valid ads are configured, coin claiming is **DISABLED**
- AdBlock detection also prevents earning if blocker is enabled

**Setup:**
1. Create account at https://adsterra.com
2. Create ad placements (native banner, standard banner, or any other format)
3. Get your domain ID and placement IDs from Adsterra dashboard
4. Add to `.env`:
   ```
   ADSTERRA_API_TOKEN=your_token
   ADSTERRA_DOMAIN_ID=your_domain_id
   ADSTERRA_NATIVE_BANNER_ID=placement_id_1
   ADSTERRA_BANNER_ID=placement_id_2
   ```
5. Test with: `curl http://localhost:4000/api/ads/test`
6. Look for your placements and check the types
7. Restart backend
8. Ads appear automatically on the Coins page

**Ad Format Types:**

- **iframe** - Direct URL embedding (fastest, no script injection)
  - Shows as `"type": "iframe"` in test output
  - Loads directly in an iframe

- **script** - Script-based ads (popunders, social bars, native ads, etc.)
  - Shows as `"type": "script"` in test output  
  - Requires `key` field from Adsterra API
  - Frontend sets up `atOptions` and injects the script
  - Example: `https://www.highperformanceformat.com/{key}/invoke.js`

**Revenue:**
- Earn per impression and per click
- Multiple placement types for varied user experience
- AdBlock detection protects ad revenue by preventing earnings when ads are blocked




## Backend Environment Variables
Set these in backend/.env:

### Required Configuration
- **JWT_SECRET** - Secret key for JWT tokens (minimum 10 characters)
- **JWT_EXPIRES_IN** - Token expiration time (default: 7d)
- **DB_PATH** - Path to SQLite database file
- **DISCORD_WEBHOOK_URL** - Discord webhook for UTR notifications

### Monetization
- **ADSTERRA_API_TOKEN** - Your Adsterra API token for displaying ads on the Coins/AFK page. Get this by logging into Adsterra and generating a new token.
- **ADSTERRA_DOMAIN_ID** - Your domain ID from Adsterra (required)
- **ADSTERRA_NATIVE_BANNER_ID** - *(Optional)* Placement ID for native banner ads with direct_url. Leave empty to auto-detect.
- **ADSTERRA_BANNER_ID** - *(Optional)* Placement ID for standard banner ads with direct_url. Leave empty to auto-detect.
- **ADSTERRA_NATIVE_BANNER_KEY** - *(Optional)* Placement key for script-based native banner ads (used when API does not return key).
- **ADSTERRA_BANNER_KEY** - *(Optional)* Placement key for script-based banner ads (used when API does not return key).
- **ADSTERRA_NATIVE_BANNER_SCRIPT** - *(Optional)* Script URL for native banner ads (effectivegatecpm domain).
- **ADSTERRA_BANNER_SCRIPT** - *(Optional)* Script URL for banner ads (highperformanceformat domain).
- **ADSTERRA_NATIVE_CONTAINER_ID** - *(Optional)* Container ID for script-based native banner ads.

**Adsterra Setup:**
The system fetches your ad placements directly from Adsterra API and displays them on the Coins/AFK page. It supports both **iframe-based** (direct_url) and **script-based** placements.

1. Login to Adsterra dashboard
2. Go to Placements section
3. Note the ID for each placement you want to use
4. Add to `.env`: `ADSTERRA_NATIVE_BANNER_ID=xxx` and `ADSTERRA_BANNER_ID=yyy`
5. Restart backend and test

**Script-based placements:**
If Adsterra does not return `key`/`script` in the API response, add them manually:
- `ADSTERRA_BANNER_KEY` and `ADSTERRA_BANNER_SCRIPT` for banner ads
- `ADSTERRA_NATIVE_BANNER_SCRIPT` and `ADSTERRA_NATIVE_CONTAINER_ID` for native ads

**Test Adsterra Configuration (requires admin JWT token):**
```bash
cd backend
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" http://localhost:4000/api/ads/test
```

Expected output format:
```json
{
  "success": true,
  "totalPlacements": 2,
  "placements": [
    {
      "id": 28669969,
      "title": "468x60_1",
      "key": "abc123def456...",
      "format": "iframe",
      "width": 468,
      "height": 60,
      "type": "script",
      "allFields": ["id", "title", "key", "format", "width", "height", ...]
    }
  ]
}
```

Check the output for:
- `"type": "iframe"` = Direct URL embedding (loads directly)
- `"type": "script"` = Script-based (needs key field)
- `"key": "..."` = Required for script injection
- `"format"`: "iframe" or other format type

Both types are supported and will allow users to earn coins.




### Pterodactyl Integration
Pterodactyl settings for server provisioning:

- **PTERODACTYL_URL** - Full URL to your Pterodactyl panel (e.g., https://panel.example.com)
- **PTERODACTYL_API_KEY** - Admin API key from Pterodactyl panel
- **PTERODACTYL_DEFAULT_EGG** - Egg ID for Minecraft servers (must be a number)
- **PTERODACTYL_DEFAULT_DOCKER_IMAGE** - Docker image (e.g., ghcr.io/pterodactyl/yolks:java_17)
- **PTERODACTYL_DEFAULT_STARTUP** - Startup command (e.g., java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar server.jar)
- **PTERODACTYL_DEFAULT_ENV** - Environment variables as JSON. For Paper egg, use: `{"MINECRAFT_VERSION":"1.20.1","SERVER_JARFILE":"server.jar","BUILD_NUMBER":"latest"}`

**Automatic Node & Allocation Selection:**
Node and allocation selection is fully automatic. At each server purchase, AstraNodes queries all your panel nodes for real-time memory, disk, and allocation availability, then picks the best one. No manual node ID or allocation ID configuration is needed.

Make sure each Pterodactyl node has:
- At least a few **unassigned allocations** (ports)
- Enough free RAM and disk for the plans you intend to offer

**Test your configuration:**
```bash
cd backend
npm run test-pterodactyl
```

This will validate your Pterodactyl settings and show available allocations.

## Production Deployment

An interactive deployment script is included for Ubuntu 22.04 / 24.04 VPS servers.

### Prerequisites
- A fresh Ubuntu 22.04 or 24.04 VPS
- A domain pointing to your server's IP (for SSL)
- Root or sudo access

### Steps

**1. Clone the repo on your VPS:**
```bash
git clone https://github.com/Luffy998899/Astra.git
cd Astra
```

**2. Run the deploy script:**
```bash
bash deploy.sh
```

The script will interactively ask for:
- Your domain name (e.g. `panel.example.com`)
- Whether you have a `www` DNS record (defaults to no)
- OAuth credentials (Google & Discord)
- Pterodactyl panel URL and API key
- JWT secret
- Discord webhook URL
- Adsterra API credentials (optional)
- UPI ID and name (shown on the billing page, optional)

It then automatically:
- Installs Node.js, Nginx, PM2, and Certbot
- Writes `backend/.env` from your answers
- Runs all database migrations
- Builds the React frontend
- Configures Nginx with reverse proxy + WebSocket support
- Starts the backend with PM2 (`astranodes-api`)
- Obtains and configures an SSL certificate (domain only, or +www if opted in)

### After Deployment

| Task | Command |
|------|---------|
| View logs | `pm2 logs astranodes-api` |
| Restart backend | `pm2 restart astranodes-api` |
| Check status | `pm2 status` |
| **Update (safe)** | `bash update.sh` |

> **`update.sh` automatically backs up your database** before pulling code. It preserves your `.env`, database, uploads, and PM2 config. See [VPS_GUIDE.md](VPS_GUIDE.md) for details.

### Create Admin User (after deploy)

Authentication is OAuth-only (Google & Discord). After your first login:

```bash
cd /opt/astranodes/backend
npm run set-admin your-email@example.com
```

Log out and back in — the Admin Panel link will appear.

### Environment File
Your production environment variables live at `backend/.env`. Reference `backend/.env.production.example` for all available options with descriptions.

### Production File Safety

The following files are **gitignored** and will never be overwritten by `git pull` or `bash update.sh`:

- `backend/.env` — all backend secrets
- `frontend/.env.production` — frontend API URL
- `backend/data/` — SQLite database + WAL files
- `backend/data/backups/` — automatic DB backups (created by `update.sh`)
- `backend/uploads/` — user-uploaded files
- `ecosystem.production.config.cjs` — PM2 config with your install paths

---

## Key Features
- Coin plans and real money plans with weekly/monthly/custom durations
- Automated renewal, 12h grace period, suspend and delete flow
- AFK coin system with adblock enforcement
- Coupon anti-abuse rules with IP flagging
- UTR billing with secure uploads and Discord delivery
- Admin panel controls for plans, coupons, users, and servers

## Notes
- Uploads are stored in backend/UPLOAD_DIR and deleted after UTR review.
- Tailwind v4 uses PostCSS plugin @tailwindcss/postcss.
