# AstraNodes — VPS Deployment Guide

Complete step-by-step guide to deploying AstraNodes on a fresh Ubuntu VPS.

---

## Table of Contents

1. [Requirements](#1-requirements)
2. [Before You Start — Checklist](#2-before-you-start--checklist)
3. [DNS Setup](#3-dns-setup)
4. [Pterodactyl Preparation](#4-pterodactyl-preparation)
5. [Running the Deploy Script](#5-running-the-deploy-script)
6. [Prompt Reference](#6-prompt-reference)
7. [What the Script Does](#7-what-the-script-does)
8. [Post-Deploy Tasks](#8-post-deploy-tasks)
9. [Updating AstraNodes](#9-updating-astranodes)
10. [Useful Commands](#10-useful-commands)
11. [Troubleshooting](#11-troubleshooting)
12. [File Reference](#12-file-reference)

---

## 1. Requirements

### VPS

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| OS | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |
| RAM | 1 GB | 2 GB |
| Disk | 10 GB | 20 GB |
| CPU | 1 vCPU | 2 vCPU |
| Root access | ✅ Required | — |

> The VPS only runs the AstraNodes web panel. Minecraft servers run on your Pterodactyl nodes — those are separate machines.

### Software installed automatically by the script

- **Node.js LTS** (via NodeSource)
- **PM2** (process manager, auto-restart on reboot)
- **Nginx** (reverse proxy + static file serving)
- **Certbot** (free Let's Encrypt SSL)
- **UFW** (firewall)

### What you need before running

- A domain name pointed at this VPS (A record)
- A running Pterodactyl panel with at least one node and egg configured
- A Pterodactyl Application API key
- A Discord webhook URL for order notifications
- SSH access to the VPS as root

---

## 2. Before You Start — Checklist

Work through this before running the deploy script. Having everything ready means zero interruptions.

- [ ] VPS is running Ubuntu 22.04 or 24.04
- [ ] You are logged in as `root` (or have passwordless `sudo`)
- [ ] Domain DNS A record is pointing to your VPS IP (allow up to 24 h to propagate)
- [ ] Pterodactyl panel is accessible at a known URL
- [ ] You have a Pterodactyl **Application API key** (not Client key) — see [section 4](#4-pterodactyl-preparation)
- [ ] Your Pterodactyl panel has at least one **node** configured with allocations
- [ ] Your Pterodactyl panel has at least one **egg** configured
- [ ] You have a Discord webhook URL ready
- [ ] You have a GitHub account or the repository cloned on the VPS

---

## 3. DNS Setup

Point your domain at the VPS **before** running the script.

### Option A: Cloudflare Proxy (Recommended)

If your domain is managed by Cloudflare with the **orange cloud (Proxied)** enabled:

1. Add an **A record**: `@` → `YOUR_VPS_IP` (Proxied / orange cloud)
2. In Cloudflare dashboard → **SSL/TLS** → set mode to **Full** or **Full (Strict)**
3. During deployment, answer **Yes** to "Is your domain proxied through Cloudflare?"

The deploy script will generate a self-signed origin certificate on the server. Cloudflare terminates the real SSL at its edge and encrypts the connection back to your origin using this cert. **No Let's Encrypt or certbot needed.**

> Cloudflare handles `www` routing at its edge — no separate `www` DNS record or certificate is required.

### Option B: Direct (no Cloudflare proxy)

If your domain points directly to the VPS (DNS only, **no** Cloudflare proxy):

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `YOUR_VPS_IP` | 300 |

Replace `YOUR_VPS_IP` with the public IPv4 of your VPS.

### Optional: www subdomain (Direct mode only)

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `www` | `YOUR_VPS_IP` | 300 |

> The `www` record is **optional** and only relevant in Direct mode. During deployment, the script asks whether you have a `www` DNS record. If you say no, Certbot and Nginx will only use the bare domain. This prevents certificate errors from trying to validate a non-existent `www` subdomain.

> **Check propagation** before running the deploy script:
> ```bash
> dig +short yourdomain.com
> # or
> curl https://dns.google/resolve?name=yourdomain.com&type=A
> ```
> The result must match your VPS IP.

---

## 4. Pterodactyl Preparation

### Create an Application API key

1. Log into your Pterodactyl admin panel
2. Go to **Admin → Application API**
3. Click **Create New** — description: `AstraNodes`
4. Copy the key — **it is only shown once**
5. Give it **Read & Write** permissions on:
   - Servers
   - Nodes
   - Users
   - Allocations

### Note your Egg ID

1. Go to **Admin → Nests → [Your Nest] → [Your Egg]**
2. The Egg ID is shown in the URL: `/admin/eggs/**15**/`

### Node configuration

AstraNodes automatically selects the best node at provision time — it queries all nodes in your panel and picks the one with the most available memory + a free allocation.

**You do NOT need to note down node IDs.**

Make sure each node has:
- At least a few **unassigned allocations** (ports) — without these no servers can be created
- Enough free RAM and disk for the plans you intend to offer

To add allocations: **Admin → Nodes → [Node] → Allocation** tab → add IP + port range.

---

## 5. Running the Deploy Script

### Step 1 — SSH into your VPS

```bash
ssh root@YOUR_VPS_IP
```

### Step 2 — Clone the repository

```bash
git clone https://github.com/Luffy998899/Astra /opt/astranodes
cd /opt/astranodes
```

### Step 3 — Run the deployment script

```bash
bash deploy.sh
```

> The script is interactive. It walks you through 9 sections of questions, shows a confirmation screen, then installs and configures everything automatically.

The script takes approximately **3–8 minutes** on a typical VPS (varies by download speed).

---

## 6. Prompt Reference

Below is every question the script asks, what it expects, and an example answer.

### Section 1 — General Settings

| Prompt | Required | Example | Notes |
|--------|----------|---------|-------|
| Domain name | ✅ | `astranodes.cloud` | Without `https://` |
| Email for SSL cert | ✅ | `admin@astranodes.cloud` | Used by Let's Encrypt for renewal notices |
| Do you have a DNS record for www? | ✅ | `n` | Only say `y` if you have a www A record pointing to this VPS |
| Install directory | ✅ | `/opt/astranodes` | Where all app files live |
| Backend API port | ✅ | `4000` | Internal only — never exposed publicly |

### Section 2 — Secrets & Auth

| Prompt | Required | Example | Notes |
|--------|----------|---------|-------|
| JWT secret | ✅ | *(auto-generated)* | Press Enter to use the auto-generated 64-char secret |
| JWT expiry | ✅ | `7d` | How long login tokens last |

> The script auto-generates a cryptographically secure secret. Just press Enter unless you have a specific value.

### Section 3 — Database & Storage

| Prompt | Required | Example | Notes |
|--------|----------|---------|-------|
| SQLite database path | ✅ | `/opt/astranodes/backend/data/astranodes.sqlite` | Created automatically |
| Uploads directory | ✅ | `/opt/astranodes/backend/uploads` | For ticket attachments etc. |

### Section 4 — Pterodactyl Panel

| Prompt | Required | Example | Notes |
|--------|----------|---------|-------|
| Panel URL | ✅ | `https://panel.example.com` | Include `https://` |
| Admin API key | ✅ | `ptla_xxxxxxxxxxxxxxxx` | Application key, not client key |
| Default egg ID | ✅ | `15` | Found in panel URL |
| Docker image | ✅ | `ghcr.io/pterodactyl/yolks:java_17` | Must exist on Pterodactyl |
| Startup command | ✅ | `java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar server.jar` | `{{SERVER_MEMORY}}` is replaced by Pterodactyl |
| Pterodactyl ENV JSON | ✅ | `{"MINECRAFT_VERSION":"1.20.1","SERVER_JARFILE":"server.jar","BUILD_NUMBER":"latest"}` | Must be valid JSON |

> **Node ID is not asked.** Nodes are automatically selected at provision time based on available memory, disk, and free allocations.

### Section 5 — Discord Webhooks

| Prompt | Required | Example | Notes |
|--------|----------|---------|-------|
| Main webhook URL | ✅ | `https://discord.com/api/webhooks/...` | Order and UTR alerts |
| Support webhook URL | Optional | `https://discord.com/api/webhooks/...` | New ticket notifications |

**To create a Discord webhook:**
1. Open your Discord server → channel settings → **Integrations → Webhooks**
2. Click **New Webhook**, name it `AstraNodes`
3. Copy the webhook URL

### Section 6 — UPI Payment

| Prompt | Required | Example | Notes |
|--------|----------|---------|-------|
| UPI ID | Optional | `yourname@paytm` | Shown on the Billing page |
| UPI name | Optional | `AstraNodes Hosting` | Business name shown to users |

Leave both blank if you are not accepting UPI payments.

### Section 7 — Adsterra Monetisation

| Prompt | Required | Example | Notes |
|--------|----------|---------|-------|
| API token | Optional | `abc123...` | From Adsterra dashboard |
| Domain ID | Optional | `123456` | Adsterra domain ID |
| Native banner placement ID | Optional | `1234567` | From Adsterra placement |
| Banner placement ID | Optional | `1234568` | From Adsterra placement |
| Native banner key | Optional | `abcdef...` | Placement key |
| Banner key | Optional | `abcdef...` | Placement key |
| Native banner script URL | Optional | `https://...` | |
| Banner script URL | Optional | `https://...` | |
| Native banner container ID | Optional | `container-id` | |

> Press Enter on all Adsterra fields to skip ad serving entirely. The panel works without it.

### Section 8 — Confirm

Review the summary and press **Y** to begin deployment or **N** to abort without making any changes.

---

## 7. What the Script Does

After confirmation the script runs fully automatically:

```
Install packages    →  Node.js LTS, Nginx, PM2, Certbot, UFW
Copy files          →  rsync to /opt/astranodes (or git pull if already cloned)
Write backend/.env  →  chmod 600 — API keys never exposed
Write frontend env  →  VITE_API_URL, VITE_SOCKET_URL
Install deps        →  npm install --omit=dev (backend), npm install (frontend)
Run migrations      →  migrate → migrate-icons → migrate-duration →
                        migrate-tickets → upgrade-tickets → migrate-frontpage
Build frontend      →  npm run build → rsync to /var/www/astranodes
Write PM2 config    →  ecosystem.production.config.cjs (fork mode, auto-restart, gitignored)
Write Nginx config  →  /etc/nginx/sites-available/astranodes
Configure UFW       →  allow SSH + HTTP/HTTPS, block internal API port
Obtain SSL cert     →  certbot --nginx (domain only, or +www if opted in)
Start with PM2      →  pm2 start + pm2 save + pm2 startup
Admin instructions  →  how to promote first admin via set-admin script
```

---

## 8. Post-Deploy Tasks

### Verify the deployment

```bash
# Check PM2 process is running
pm2 status

# Check API is responding
curl -s https://yourdomain.com/api/health

# Check SSL certificate
curl -sI https://yourdomain.com | grep -i "strict-transport"
```

### Create the admin account

Authentication is OAuth-only (Google & Discord). To set up your first admin:

1. Visit `https://yourdomain.com` and log in with Google or Discord
2. Run the set-admin script:

```bash
cd /opt/astranodes/backend
npm run set-admin your-email@example.com
```

3. Log out and back in — the Admin Panel link will appear in the sidebar

### Configure your plans

1. Log in as admin → **Admin Panel → Plans**
2. Create at least one Coin plan and one Real plan
3. Set memory (MB), disk (MB), and CPU values that fit within your Pterodactyl node capacity

### Configure site content

Go to **Admin Panel → Front Page** to set your site name, hero text, and stats displayed on the landing page.

---

## 9. Updating AstraNodes

### Recommended: Use the update script

The safest way to update is the included `update.sh` script. It handles everything automatically:

```bash
cd /opt/astranodes   # or wherever your repo is cloned
bash update.sh
```

**What `update.sh` does (in order):**
1. Backs up your database (keeps last 5 backups in `backend/data/backups/`)
2. Pulls latest code from git
3. Syncs code to install directory (preserves `.env`, database, uploads, PM2 config)
4. Installs/updates backend + frontend dependencies
5. Runs all database migrations (idempotent — safe to repeat)
6. Rebuilds the React frontend
7. Copies build to Nginx web root
8. Updates PM2 ecosystem config path
9. Reloads API via PM2 (zero-downtime)
10. Reloads Nginx

> **Your database, `.env` files, uploads, and PM2 config are NEVER overwritten.**

### What's safe during `git pull`?

The following files are gitignored and will **never** be touched by `git pull`:

| File | Purpose |
|------|---------|
| `backend/.env` | All backend secrets |
| `frontend/.env.production` | Frontend API URL |
| `backend/data/` | SQLite database + WAL files |
| `backend/data/backups/` | Automatic DB backups |
| `backend/uploads/` | User-uploaded files |
| `ecosystem.production.config.cjs` | PM2 config with your paths |
| `~/.astranodes-deploy.conf` | Saved deploy wizard answers |

### Manual update (advanced)

If you prefer to update manually:

```bash
cd /opt/astranodes

# 1. Backup database first!
cp backend/data/astranodes.sqlite backend/data/astranodes.sqlite.bak

# 2. Pull code
git pull --ff-only

# 3. Update dependencies
npm --prefix backend install --omit=dev --quiet
npm --prefix frontend install --quiet

# 4. Run migrations
npm --prefix backend run migrate
npm --prefix backend run migrate-oauth

# 5. Rebuild frontend
npm --prefix frontend run build
rsync -a --delete frontend/dist/ /var/www/astranodes/

# 6. Restart
pm2 reload astranodes-api
nginx -t && systemctl reload nginx
```

---

## 10. Useful Commands

### PM2

```bash
pm2 status                            # show all processes and their state
pm2 logs astranodes-api               # live log stream
pm2 logs astranodes-api --lines 200   # last 200 log lines
pm2 restart astranodes-api            # restart API (zero-downtime)
pm2 stop astranodes-api               # stop API
pm2 start ecosystem.production.config.cjs --env production   # start from config
```

### Nginx

```bash
nginx -t                              # test config syntax
systemctl reload nginx                # reload config without downtime
systemctl status nginx                # service status
tail -f /var/log/nginx/error.log      # live error log
tail -f /var/log/nginx/access.log     # live access log
```

### SSL / Certbot

```bash
certbot certificates                  # list active certs + expiry dates
certbot renew --dry-run               # test renewal without making changes
certbot renew                         # force renewal
```

### Database

```bash
# Backups are automatic during `bash update.sh` — stored in:
ls -la /opt/astranodes/backend/data/backups/

# Manual backup
cp /opt/astranodes/backend/data/astranodes.sqlite \
   /opt/astranodes/backend/data/astranodes.sqlite.bak

# Restore from backup (stop API first!)
pm2 stop astranodes-api
cp /opt/astranodes/backend/data/backups/astranodes-YYYYMMDD-HHMMSS.sqlite \
   /opt/astranodes/backend/data/astranodes.sqlite
pm2 start astranodes-api

# Open with sqlite3
sqlite3 /opt/astranodes/backend/data/astranodes.sqlite
```

### Firewall

```bash
ufw status                            # show current rules
ufw allow 4000                        # temporarily open API port for debugging
ufw deny 4000                         # close it again
```

---

## 11. Troubleshooting

### API returns 502 Bad Gateway

The backend is not running or crashed.

```bash
pm2 status
pm2 logs astranodes-api --lines 50
```

Common causes:
- Missing or invalid `.env` variable — check `pm2 logs` for a startup error
- Port conflict — another process is on port 4000: `lsof -i :4000`
- Database locked — only one PM2 instance should run (fork mode, `instances: 1`)

### CORS errors in browser

The frontend origin is not in the allowed list.

```bash
# Check what FRONTEND_URL is set to
grep FRONTEND_URL /opt/astranodes/backend/.env
```

It must exactly match the URL the browser loads the frontend from (e.g. `https://astranodes.cloud`). Update the value and restart:

```bash
pm2 restart astranodes-api
```

### SSL certificate failed

```bash
# Check DNS is resolving to this VPS
dig +short yourdomain.com

# Retry certbot manually (bare domain only)
certbot --nginx -d yourdomain.com

# Or with www (only if you have a www DNS record)
certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Port 80 must be reachable from the internet for the ACME challenge. Check UFW:

```bash
ufw status | grep "Nginx"
```

### Pterodactyl server creation fails — "All nodes are currently full"

Your panel nodes either have:
- No unassigned allocations (ports) available
- Insufficient free memory or disk for the requested plan

Fix in Pterodactyl admin:
1. **Admin → Nodes → [Node] → Allocation** — add more port ranges
2. Or reduce the RAM/disk values on your AstraNodes plans

### Migrations fail on re-deploy

Migrations are idempotent — running them multiple times is safe. Errors like "table already exists" are warnings, not failures. The `--if-present` flag ensures missing scripts are silently skipped.

### PM2 process does not start after reboot

```bash
# Re-register PM2 systemd service
pm2 startup systemd -u root --hp /root
# Run the command it outputs, then:
pm2 save
```

---

## 12. File Reference

| Path | Purpose |
|------|---------|
| `/opt/astranodes/backend/.env` | All backend secrets and config — `chmod 600` |
| `/opt/astranodes/frontend/.env.production` | Frontend build-time API URL |
| `/opt/astranodes/ecosystem.production.config.cjs` | PM2 process config (gitignored, deploy.sh writes it) |
| `/etc/nginx/sites-available/astranodes` | Nginx virtual host config |
| `/etc/nginx/sites-enabled/astranodes` | Symlink to activate the site |
| `/var/www/astranodes/` | Built React frontend served by Nginx |
| `/var/log/pm2/astranodes-error.log` | Backend error log |
| `/var/log/pm2/astranodes-out.log` | Backend stdout log |
| `/var/log/nginx/error.log` | Nginx error log |
| `/etc/letsencrypt/live/yourdomain.com/` | SSL certificate files |

### backend/.env variable reference

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | ✅ | Set to `production` |
| `PORT` | ✅ | Internal API port (default `4000`) |
| `FRONTEND_URL` | ✅ | Full URL of the frontend (e.g. `https://astranodes.cloud`) |
| `JWT_SECRET` | ✅ | Min 32 chars, used to sign login tokens |
| `JWT_EXPIRES_IN` | ✅ | Token lifetime (e.g. `7d`) |
| `DB_PATH` | ✅ | Absolute path to the SQLite database file |
| `UPLOAD_DIR` | ✅ | Absolute path to the uploads directory |
| `PTERODACTYL_URL` | ✅ | Pterodactyl panel URL |
| `PTERODACTYL_API_KEY` | ✅ | Application API key |
| `PTERODACTYL_DEFAULT_EGG` | ✅ | Egg ID for new servers |
| `PTERODACTYL_DEFAULT_DOCKER_IMAGE` | ✅ | Docker image for new servers |
| `PTERODACTYL_DEFAULT_STARTUP` | ✅ | Startup command template |
| `PTERODACTYL_DEFAULT_ENV` | ✅ | Egg environment variables (JSON) |
| `DISCORD_WEBHOOK_URL` | ✅ | Webhook for order/UTR notifications |
| `DISCORD_SUPPORT_WEBHOOK_URL` | Optional | Webhook for support tickets |
| `UPI_ID` | Optional | UPI ID shown on billing page |
| `UPI_NAME` | Optional | UPI name shown on billing page |
| `ADSTERRA_API_TOKEN` | Optional | Adsterra API token |
| `ADSTERRA_DOMAIN_ID` | Optional | Adsterra domain ID |
| `ADSTERRA_NATIVE_BANNER_ID` | Optional | Native banner placement ID |
| `ADSTERRA_BANNER_ID` | Optional | Banner placement ID |

> `PTERODACTYL_DEFAULT_NODE` is **not required** — node selection is fully automatic. At each server purchase, AstraNodes queries all your panel nodes for real-time memory, disk, and allocation availability, then picks the best one.
