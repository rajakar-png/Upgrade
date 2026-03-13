# Complete Deployment Guide for VPS

This guide walks through deploying AstraNodes to a production VPS with all the fixes included.

## Prerequisites

- Ubuntu 22.04 or 24.04 VPS
- Domain name pointing to the VPS
- Docker and Docker Compose installed
- Git repository cloned to `/root/Upgrade`

## Step 1: Verify Environment Files

First, ensure all configuration files are present and correctly configured:

```bash
cd /root/Upgrade

# Run the verification script
bash verify-config.sh

# Expected output: "✓ All critical configuration checks passed!"
```

## Step 2: Generate Secure Credentials

If deploying fresh, generate new secure credentials:

```bash
# Generate POSTGRES_PASSWORD (32+ chars)
POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)

# Generate JWT_SECRET (48+ chars)
JWT_SECRET=$(openssl rand -base64 48 | tr -d '/+=' | head -c 48)

echo "POSTGRES_PASSWORD=$POSTGRES_PASSWORD"
echo "JWT_SECRET=$JWT_SECRET"

# Save these values - you'll need them next step
```

## Step 3: Create Root .env File

```bash
cat > /root/Upgrade/.env << 'EOF'
# ── Docker Compose Configuration ──────────────────────────────────────────
POSTGRES_USER=astra
POSTGRES_PASSWORD=<INSERT_YOUR_32_CHAR_PASSWORD_HERE>
POSTGRES_DB=astra
HTTP_PORT=8000
HTTPS_PORT=8443
EOF
```

## Step 4: Update Backend .env File

Edit `/root/Upgrade/backend/.env` and update these values:

```bash
# Critical - Update these:
SITE_DOMAIN=yourdomainname.com
FRONTEND_URL=https://yourdomainname.com
DATABASE_URL=postgresql://astra:<INSERT_SAME_PASSWORD>@postgres:5432/astra
JWT_SECRET=<INSERT_YOUR_48_CHAR_SECRET_HERE>
OAUTH_CALLBACK_URL=https://yourdomainname.com

# OAuth - Configure these for Google/Discord login:
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=

# Pterodactyl - REQUIRED for server creation:
PTERODACTYL_URL=https://panel.yourdomainname.com
PTERODACTYL_API_KEY=ptla_xxxxxxxxxxxxx
PTERODACTYL_DEFAULT_EGG=1
PTERODACTYL_DEFAULT_DOCKER_IMAGE=ghcr.io/pterodactyl/yolks:java_17

# Optional but recommended:
ADMIN_EMAIL=admin@yourdomainname.com
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_ZONE_ID=
CLOUDFLARE_DOMAIN=yourdomainname.com
```

Verify critical fields:
```bash
grep "DATABASE_URL=postgresql://astra:" /root/Upgrade/backend/.env
# Should see: postgresql://astra:<password>@postgres:5432/astra (NOT localhost!)

grep "REDIS_URL=" /root/Upgrade/backend/.env
# Should see: redis://redis:6379 (NOT localhost!)
```

## Step 5: Validate Configuration

```bash
cd /root/Upgrade

# Test docker-compose syntax
docker-compose config > /dev/null && echo "✓ docker-compose.yml is valid" || echo "✗ Invalid configuration"

# Run full verification
bash verify-config.sh

# Check all critical env vars are set
echo "=== Critical Variables Check ==="
grep -E "^(POSTGRES_PASSWORD|DATABASE_URL|JWT_SECRET|PTERODACTYL_)" backend/.env | head -5
```

## Step 6: Build Docker Images

```bash
cd /root/Upgrade

# Pull base images
docker-compose pull

# Build images (this takes 5-10 minutes first time)
docker-compose build

# Verify build succeeded
docker-compose images
# You should see images for: backend, frontend, nginx
```

## Step 7: Start Services

```bash
cd /root/Upgrade

# Start all services in background
docker-compose up -d

# Check status (wait ~30 seconds for them to initialize)
sleep 5
docker-compose ps

# Expected STATUS: all should show "running" or "healthy"
```

## Step 8: Wait for PostgreSQL to Initialize

```bash
# Monitor PostgreSQL startup
docker-compose logs -f postgres

# Watch for message like:
# "PostgreSQL init process complete; ready to accept connections."
# Then Ctrl-C to exit

# Verify PostgreSQL is healthy
docker-compose exec -T postgres pg_isready -U astra
# Expected: "accepting connections"
```

## Step 9: Wait for Backend to Connect

```bash
# Monitor backend startup - this will run Prisma migrations
docker-compose logs -f backend

# Watch for messages like:
# "[Prisma] ✓ Database connected"
# "[AstraNodes] ✓ API listening on http://0.0.0.0:4000/api"

# Once you see the API listening message, Ctrl-C to exit
```

## Step 10: Verify Health Endpoints

```bash
# Test backend health endpoint
curl -s http://localhost:8000/health | jq .
# Expected: {"status":"ok","timestamp":"2026-03-13T...","checks":{"database":"ok","redis":"ok"}}

# Test via Docker internally
docker-compose exec backend curl -s http://localhost:4000/api/health | jq .

# Test frontend is accessible
curl -s http://localhost:8000/ | head -20
```

## Step 11: Set Admin User

```bash
# Find a user email (they must exist in database - created via OAuth login first)
# Or create migration to add a test user

# Set them as admin
docker-compose exec backend node scripts/setAdmin.js user@example.com

# Expected output:
# ✓ user@example.com is now an admin (id: 1)
```

## Step 12: Check All Containers Are Healthy

```bash
# Detailed status
docker-compose ps --no-trunc

# All should show "healthy" or "running"
# If any show "unhealthy" or "exited":
docker-compose logs <service-name>
```

## Step 13: Monitor Logs for Errors

```bash
# View last 50 lines from each service
docker-compose logs --timestamps

# Or follow in real-time
docker-compose logs -f

# To view specific service
docker-compose logs -f backend
docker-compose logs -f postgres
docker-compose logs -f redis
```

## Step 14: Set Up SSL Certificates (Optional)

If you want HTTPS (recommended for production):

```bash
# Create ssl directory if it doesn't exist
mkdir -p /root/Upgrade/ssl/live

# Option A: Use Let's Encrypt (requires port 80 to be open)
# Install certbot
apt-get update && apt-get install -y certbot python3-certbot-nginx

# Request certificate
certbot certonly --standalone -d yourdomainname.com

# Copy to ssl directory
cp /etc/letsencrypt/live/yourdomainname.com/fullchain.pem /root/Upgrade/ssl/live/cert.pem
cp /etc/letsencrypt/live/yourdomainname.com/privkey.pem /root/Upgrade/ssl/live/key.pem

# Option B: Self-signed certificate (for testing)
# Skip this if using Let's Encrypt
openssl req -x509 -newkey rsa:4096 -keyout /root/Upgrade/ssl/live/key.pem \
  -out /root/Upgrade/ssl/live/cert.pem -days 365 -nodes \
  -subj "/C=US/ST=State/L=City/O=Org/CN=yourdomainname.com"

# Restart nginx with SSL
docker-compose restart nginx
```

## Step 15: Configure DNS & Firewall

```bash
# Update DNS to point to this VPS IP (do this in your domain registrar)
A record: yourdomainname.com → <your-vps-ip>

# Allow traffic through firewall
ufw allow 8000/tcp   # HTTP
ufw allow 8443/tcp   # HTTPS
ufw status
```

## Verify Production Deployment

```bash
# Test from your local machine (replace with your VPS IP or domain)
curl -s http://<vps-ip>:8000/health | jq .
curl -s https://yourdomainname.com/health | jq .

# Visit in browser
# http://<vps-ip>:8000
# https://yourdomainname.com
```

## Troubleshooting

If any service fails to start, follow this order:

### 1. PostgreSQL issues
```bash
docker-compose logs postgres | tail -50

# Common fixes:
# - Check POSTGRES_PASSWORD is set in .env
# - Check backend/.env DATABASE_URL uses @postgres: not @localhost:
# - Check port 5432 is not already in use
```

### 2. Redis issues
```bash
docker-compose logs redis | tail -50

# Common fixes:
# - Check backend/.env REDIS_URL is redis://redis:6379
# - Check port 6379 is not already in use
```

### 3. Backend issues
```bash
docker-compose logs backend | tail -100

# Common fixes:
# - Check DATABASE_URL in backend/.env (must have @postgres:, not @localhost:)
# - Check JWT_SECRET is at least 32 characters
# - Check PTERODACTYL_URL and PTERODACTYL_API_KEY are set
# - Wait for PostgreSQL to be healthy first
```

### 4. Frontend issues
```bash
docker-compose logs frontend | tail -50

# Common fixes:
# - Check API_INTERNAL_URL is set to http://backend:4000
# - Check backend is healthy first
```

### 5. Complete restart if stuck
```bash
# Stop everything
docker-compose down

# Clean database (WARNING: erases data!)
sudo rm -rf postgres_data/

# Restart from step 7
docker-compose up -d
```

## Maintenance

### Viewing logs
```bash
# Real-time logs
docker-compose logs -f

# Specific service
docker-compose logs -f backend

# Health status
docker-compose ps
```

### Updating configuration
```bash
# Edit backend/.env
nano backend/.env

# Restart affected service
docker-compose restart backend
```

### Database backups
```bash
# Backup database
docker-compose exec postgres pg_dumpall -U astra > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore from backup
docker-compose exec -T postgres psql -U astra < backup_20260313_120000.sql
```

### Logs & monitoring
```bash
# Continuous monitoring
watch -n 1 'docker-compose ps'

# Health check
curl -s http://localhost:8000/health | jq .status

# Database size
docker-compose exec postgres psql -U astra -d astra -c "SELECT pg_size_pretty(pg_database_size('astra'));"
```

## Success Criteria

Your deployment is successful when:

- ✓ All containers show "running" or "healthy" in `docker-compose ps`
- ✓ `curl http://localhost:8000/health` returns `{"status":"ok",...}`
- ✓ Backend logs show `[Prisma] ✓ Database connected`
- ✓ Backend logs show `[AstraNodes] ✓ API listening on http://0.0.0.0:4000/api`
- ✓ Frontend is accessible at `http://<vps-ip>:8000`
- ✓ OAuth login works (Google/Discord)
- ✓ You can create servers via Pterodactyl panel integration

## Next Steps

1. Configure Cloudflare (if using)
2. Set up monitoring/alerts
3. Configure backups
4. Set up CI/CD for updates
