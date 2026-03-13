# New Interactive Deploy Script

## Overview

The new `deploy.sh` is a complete rewrite following your old script's interactive pattern:

- ✅ **Domain-First Approach** — asks for domain immediately
- ✅ **Interactive Prompts** — 8 sections with clear instructions
- ✅ **Auto-Everything** — generates configs, builds, deploys in one go
- ✅ **Config Saving** — saves to `~/.astranodes-docker-deploy.conf` so re-runs skip questions
- ✅ **Full Docker** — uses Docker Compose for all services (PostgreSQL, Redis, Backend, Frontend, Nginx)
- ✅ **SSL Auto Setup** — tries Cloudflare DNS challenge → HTTP challenge → self-signed
- ✅ **Friendly Output** — colored text, progress indicators, clear next steps

## Usage

### First Run (Interactive)

```bash
cd ~/Fixing  # Your project directory
bash scripts/deploy.sh
```

This will:
1. Ask for domain (e.g., `astranodes.cloud`)
2. Ask for admin email
3. Generate database password
4. Generate JWT secret
5. Ask for Google OAuth credentials
6. Ask for Discord OAuth credentials
7. Ask for Pterodactyl panel URL + API key
8. Ask optional Cloudflare, Discord webhooks, UPI, etc.
9. Review and confirm
10. **Automatically build and deploy everything**

### Subsequent Runs (Saved Config)

```bash
bash scripts/deploy.sh
```

You'll be prompted:
```
? Reuse saved settings? (skip all questions) [Y/n]:
```

Press Enter to skip all questions and deploy again instantly.

## Features

### Section 1 — Domain & Basic Config
- Domain name (required)
- Admin email (required)

### Section 2 — Database & Secrets
- PostgreSQL password (auto-generated)
- JWT secret (auto-generated)

### Section 3 — OAuth
- Google Client ID + Secret
- Discord Client ID + Secret
- **Shows OAuth callback URLs automatically**

### Section 4 — Pterodactyl
- Panel URL
- Admin API key
- Optional client API key for backups

### Section 5 — Cloudflare (Optional)
- Email
- API token
- Zone ID
- Skip all if using Let's Encrypt only

### Section 6 — Discord Webhooks (Optional)
- General webhook for UTR notifications
- Support webhook for user requests

### Section 7 — Monetization (Optional)
- UPI ID for billing
- UPI name

### Section 8 — Review & Confirm
- Shows full summary
- Requires user confirmation before deploying

## Automatic Deployment

After confirmation, the script automatically:

1. **Validates** Docker and Docker Compose installed
2. **Generates** `backend/.env` with all configuration
3. **Builds** Docker images (backend, frontend, nginx)
4. **Starts** all containers (postgres, redis, backend, frontend, nginx)
5. **Waits** for all services to be healthy
6. **Requests** SSL certificate:
   - Try Cloudflare DNS challenge (if credentials provided)
   - Fallback to HTTP challenge on port 80
   - Fallback to self-signed if both fail
7. **Verifies** all containers are running
8. **Shows** final summary with next steps

## Configuration File

Saved to: `~/.astranodes-docker-deploy.conf`

Example:
```bash
SITE_DOMAIN='astranodes.cloud'
POSTGRES_PASSWORD='secure_random_password_here'
JWT_SECRET='another_secure_random_secret_here'
GOOGLE_CLIENT_ID='123456.apps.googleusercontent.com'
# ... etc
```

To **clear saved config** and re-enter all values:
```bash
rm ~/.astranodes-docker-deploy.conf
bash scripts/deploy.sh
```

## Differences from Old Script

| Feature | Old Script | New Script |
|---------|-----------|-----------|
| **Infrastructure** | Bare metal (PM2) | Docker Compose |
| **Database** | SQLite | PostgreSQL + Redis |
| **Deployment** | npm + PM2 | Docker containers |
| **SSL** | certbot only | Cloudflare DNS + Certbot HTTP + Self-signed |
| **Interactive** | ✅ Yes | ✅ Yes |
| **Config Saving** | ✅ Yes | ✅ Yes |
| **Auto-rebuild** | ✅ Yes | ✅ Yes (docker-compose build) |
| **Reverse Proxy** | Nginx (manual) | Nginx (Docker) |
| **Port binding** | 80/443 | 8000/8443 (configurable) |

## After Deployment

### Access Your Site

```bash
https://your-domain.com
```

### Create First Admin Account

1. Visit `https://your-domain.com`
2. Login with Google or Discord OAuth
3. Run:
   ```bash
   docker-compose exec backend npm run set-admin your-email@example.com
   ```
4. Refresh page to access Admin Panel

### Useful Commands

```bash
# View all services
docker-compose ps

# View logs (all)
docker-compose logs -f

# View backend logs only
docker-compose logs -f backend

# Restart a service
docker-compose restart backend

# Stop all
docker-compose down

# View saved config
cat ~/.astranodes-docker-deploy.conf

# Access database
docker-compose exec postgres psql -U astra -d astra
```

## Troubleshooting

If deployment fails, see:
- `TROUBLESHOOTING.md` — complete debugging guide
- `FRONTEND_CONFIGURATION.md` — frontend API setup
- `PORT_CONFIGURATION.md` — port mapping and reverse proxy

Run health check:
```bash
bash scripts/health-check.sh
```

## Key Advantages Over the Old Script

1. **Docker Isolation** — no system-wide Python/Node version issues
2. **PostgreSQL + Redis** — more reliable than SQLite, better for production
3. **Automatic DNS challenge** — SSL setup is seamless with Cloudflare
4. **Port flexibility** — internal services on 8000/8443, other services unaffected
5. **Easy backups** — PostgreSQL dumps work reliably
6. **Horizontal scaling** — docker-compose can easily spawn multiple backends
7. **CI/CD ready** — Docker Compose works on any system with Docker

## What's NOT Changed

- Still 100% interactive like the old script
- Still saves config for future runs
- Still asks one question at a time clearly
- Still provides colored output and progress
- Still handles secrets securely (chmod 600)
- Still supports all OAuth, Pterodactyl, Discord integrations

## Next Run on Deployment Changes

If you need to change domain, API keys, or any config:

```bash
# Option 1: Clear saved config and re-run interactively
rm ~/.astranodes-docker-deploy.conf
bash scripts/deploy.sh

# Option 2: Edit the config manually
nano ~/.astranodes-docker-deploy.conf
bash scripts/deploy.sh  # Will reuse edited config
```
