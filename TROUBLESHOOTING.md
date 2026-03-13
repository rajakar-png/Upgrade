# Domain & Connectivity Troubleshooting Guide

## Quick Diagnosis

Run this on your VPS to check everything:

```bash
# Check if containers are running
docker-compose ps

# Check container logs for errors
docker-compose logs backend
docker-compose logs frontend
docker-compose logs nginx

# Test internal connectivity
docker-compose exec backend curl -s http://frontend:3000 | head -20
docker-compose exec frontend curl -s http://backend:4000/api/health

# Check nginx configuration
docker-compose exec nginx nginx -t

# Test port accessibility
curl -v http://localhost:8000
curl -v http://YOUR_DOMAIN:8000
```

---

## Issue 1: Domain Not Resolving

### Check Cloudflare DNS Records

Your DNS records should look like:

| Type | Name | Content | Note |
|------|------|---------|------|
| A | example.com | your_vps_ip | Server IP |
| A | www.example.com | your_vps_ip | WWW subdomain |
| A | *.example.com | your_vps_ip | Wildcard (optional) |

**Verify DNS propagation:**
```bash
# Check what IP your domain resolves to
nslookup example.com
dig example.com @8.8.8.8

# Should return your VPS IP
```

### Cloudflare Proxy Status

If using Cloudflare proxy (orange cloud):
- ✓ Good for DDoS protection
- ⚠️ Might conflict with custom ports (8000/8443)
- ✓ Forward SSL correctly with `X-Forwarded-Proto` header (already in nginx)

**Recommendation**: Set DNS records to **DNS only** (gray cloud) for development, or configure Cloudflare rules for port 8000.

---

## Issue 2: Backend/Frontend Not Running Properly

### Check .env Configuration

Your `.env` file **MUST** have:

```bash
# 1. Domain must be set (used for SSL and FRONTEND_URL redirect)
SITE_DOMAIN=example.com

# 2. Frontend URL must match your actual domain (not localhost)
FRONTEND_URL=https://example.com
# OR if using HTTP on dev:
FRONTEND_URL=http://example.com:8000

# 3. Pterodactyl must be configured (required by backend)
PTERODACTYL_URL=https://your-pterodactyl.com
PTERODACTYL_API_KEY=<your-api-key>
PTERODACTYL_CLIENT_KEY=<your-client-key>

# 4. Database must be configured
POSTGRES_PASSWORD=<secure-password>
DATABASE_URL=postgresql://astra:password@postgres:5432/astra

# 5. Redis configured
REDIS_URL=redis://redis:6379

# 6. Admin email for SSL
ADMIN_EMAIL=admin@example.com
```

### Verify Environment Variables

```bash
# Check what's in your .env
cat backend/.env | grep -E "SITE_DOMAIN|FRONTEND_URL|PTERODACTYL|DATABASE_URL"

# The deploy.sh script should auto-fill missing critical vars:
./scripts/deploy.sh --sync-env
```

---

## Issue 3: Nginx Can't Reach Backend/Frontend

### Test Container Networking

```bash
# From inside backend, can it reach frontend?
docker-compose exec backend curl -v http://frontend:3000

# From inside frontend, can it reach backend?
docker-compose exec frontend curl -v http://backend:4000/api/health

# From nginx, can it reach both?
docker-compose exec nginx curl -v http://backend:4000/api/health
docker-compose exec nginx curl -v http://frontend:3000
```

If any of these fail:
1. Check `docker-compose ps` — all 6 services should be `Up`
2. Check logs: `docker-compose logs <service>`
3. Verify all services are on the `public` network:
   ```bash
   docker network inspect <project>_public
   ```

### Nginx Configuration Check

```bash
# Validate nginx config
docker-compose exec nginx nginx -t

# If it fails, check the config:
cat nginx/nginx.conf | head -50
```

---

## Issue 4: Port 8000/8443 Not Accessible

### Check if Port is Open

```bash
# From your local machine
curl -v http://your-vps-ip:8000

# From the VPS itself
curl -v http://localhost:8000

# Check what's listening on port 8000
sudo netstat -tulpn | grep 8000
# OR
sudo lsof -i :8000
```

### Firewall Issues

```bash
# If using UFW
sudo ufw allow 8000
sudo ufw allow 8443
sudo ufw status

# If using iptables
sudo iptables -L -n | grep 8000
```

---

## Issue 5: SSL Certificate Problems

### Check Certificate Status

```bash
# Verify cert exists and is valid
ls -la ssl/live/
openssl x509 -in ssl/live/fullchain.pem -text -noout | grep -A 2 "Validity"

# Check cert domain
openssl x509 -in ssl/live/fullchain.pem -noout -subject
```

### If Certificate is Self-Signed

Self-signed certs work but browsers will warn. To update:

```bash
# If you have a real domain now, regenerate Let's Encrypt cert:
./scripts/deploy.sh --ssl

# Or manually with certbot:
docker run --rm -v $(pwd)/ssl:/etc/letsencrypt \
  -p 80:80 \
  certbot/certbot certonly \
  --standalone \
  -d example.com \
  --non-interactive \
  --agree-tos \
  --email admin@example.com
```

---

## Issue 6: FRONTEND_URL Mismatch

The frontend must know where to call the API. If `FRONTEND_URL` is wrong:
- API calls fail with 404/500
- CORS errors in browser console
- Frontend can't authenticate

### Fix Frontend URL

1. Update `.env`:
   ```bash
   FRONTEND_URL=https://example.com  # Use your actual domain
   ```

2. Rebuild frontend:
   ```bash
   docker-compose build frontend
   docker-compose up -d frontend
   ```

3. Verify it's loaded in browser:
   ```bash
   # Open browser console
   http://your-domain:8000
   # Should load from FRONTEND_URL
   ```

---

## Complete Deployment Checklist

Run this in order on your VPS:

```bash
# 1. SSH into VPS
ssh root@your-vps-ip

# 2. Navigate to project
cd ~/Fixing  # or wherever your project is

# 3. Sync environment (interactive setup)
./scripts/deploy.sh --sync-env

# 4. When prompted, enter:
#    - SITE_DOMAIN: your actual domain
#    - FRONTEND_URL: https://example.com (or http://example.com:8000 for dev)
#    - POSTGRES_PASSWORD: secure password
#    - JWT_SECRET: generate random
#    - PTERODACTYL_URL: your panel URL
#    - PTERODACTYL_API_KEY: from panel
#    - PTERODACTYL_CLIENT_KEY: from panel
#    - ADMIN_EMAIL: admin@your-domain

# 5. Full deployment
./scripts/deploy.sh

# 6. Check status
docker-compose ps
docker-compose logs -f nginx

# 7. Test connectivity
curl http://localhost:8000
curl http://your-domain:8000
```

---

## Still Not Working? Debug Commands

```bash
# See all running containers
docker-compose ps

# Check backend health
curl -v http://your-domain:8000/api/health
curl -v http://localhost:8000/api/health

# Check frontend is served
curl -v http://your-domain:8000 | head -50

# Check nginx is proxying correctly
docker-compose exec nginx curl -v http://backend:4000/api/health

# See full nginx error logs
docker-compose logs nginx | tail -100

# See backend application logs
docker-compose logs backend | tail -100

# Check database connection
docker-compose exec backend psql -U astra -d astra -c "SELECT 1"

# Check Redis connection
docker-compose exec backend redis-cli -h redis ping
```

---

## Environment Variables Quick Map

| Variable | Purpose | Example |
|----------|---------|---------|
| `SITE_DOMAIN` | **Your actual domain** | `example.com` |
| `FRONTEND_URL` | Where frontend is hosted | `https://example.com` |
| `POSTGRES_PASSWORD` | Database password | `secure_password` |
| `DATABASE_URL` | Backend DB connection | `postgresql://astra:pwd@postgres:5432/astra` |
| `REDIS_URL` | Backend cache | `redis://redis:6379` |
| `JWT_SECRET` | Token signing | (auto-generated if empty) |
| `PTERODACTYL_URL` | Panel domain | `https://panel.example.com` |
| `PTERODACTYL_API_KEY` | API key | from panel settings |
| `CLOUDFLARE_DOMAIN` | Cloudflare domain (optional) | `example.com` |
| `CLOUDFLARE_ZONE_ID` | Cloudflare Zone ID (optional) | from Cloudflare dashboard |

---

## Common Error Messages

### "Cannot GET /api/health"
- Backend not running or crashed
- Check: `docker-compose logs backend`

### "Connection refused"
- Service not listening
- Check ports: `docker-compose ps`
- Check logs: `docker-compose logs <service>`

### "Bad Gateway"
- Nginx can't reach backend/frontend
- Check container networking: `docker network inspect <project>_public`

### "SSL certificate problem"
- Self-signed cert or domain mismatch
- Check: `openssl x509 -in ssl/live/fullchain.pem -noout -subject`
- Regenerate if needed: `./scripts/deploy.sh --ssl`

### "CORS error"
- `FRONTEND_URL` mismatch
- Frontend trying to call wrong API endpoint
- Check browser console → see actual URL being called

---

## Quick Reset (If Everything is Broken)

```bash
# Stop all containers
docker-compose down

# Remove all local data (WARNING: deletes database!)
docker-compose down -v

# Rebuild from scratch
docker-compose build
docker-compose up -d

# Re-configure
./scripts/deploy.sh --sync-env
```

This will reset everything but keep your code.
