# Port Configuration & Reverse Proxy Setup

This document details the port configuration to avoid conflicts with Pterodactyl Panel and other services.

## Service Port Mapping

### Production (docker-compose.yml)

| Service | Internal Port | Host Port | Notes |
|---------|---------------|-----------|-------|
| Nginx (HTTP) | - | 8000 | Configurable via `HTTP_PORT` env var |
| Nginx (HTTPS) | - | 8443 | Configurable via `HTTPS_PORT` env var |
| Backend | 4000 | Internal Only | Not exposed to host |
| Frontend | 3000 | Internal Only | Not exposed to host |
| PostgreSQL | 5432 | Internal Only | Not exposed to host |
| Redis | 6379 | Internal Only | Not exposed to host |

### Development (docker-compose.dev.yml)

| Service | Port | Notes |
|---------|------|-------|
| PostgreSQL | 5433 | Local development only (alternative port) |
| Redis | 6380 | Local development only (alternative port) |

## Reverse Proxy Configuration

All traffic flows through Nginx reverse proxy:

```
External Traffic → Nginx (8000/8443) → Backend (4000) / Frontend (3000)
```

### Nginx Routing Rules

- **`/api/*`** → Backend service (4000)
- **`/api/auth/*`** → Backend service with stricter rate limiting
- **`/uploads/*`** → Backend service (static files)
- **`/socket.io/*`** → Backend service (WebSocket support)
- **`/*`** → Frontend service (3000)
- **`/health`** → Backend health check (no logging)

## Environment Variables

### To Change Ports

Set these variables before running `docker-compose`:

```bash
# Change HTTP port (default: 8000)
export HTTP_PORT=8080

# Change HTTPS port (default: 8443)
export HTTPS_PORT=9443

# Run docker-compose with custom ports
docker-compose -f docker-compose.yml up -d
```

Or in `.env.production`:

```env
HTTP_PORT=8080
HTTPS_PORT=8443
```

## SSL/TLS Configuration

### HTTP to HTTPS Redirect (Optional)

To add automatic HTTP → HTTPS redirect, uncomment this in `nginx/nginx.conf`:

```nginx
server {
    listen 8000;
    server_name _;
    return 301 https://$host:8443$request_uri;
}
```

### SSL Certificate Setup

Place SSL certificates in `./ssl/live/`:

- `cert.pem` - SSL certificate
- `key.pem` - Private key

These are mounted read-only in the Nginx container.

## Avoiding Port Conflicts

### With Pterodactyl Panel

If Pterodactyl uses ports 80/443 or 8080:

1. **Pterodactyl**: Configure to use ports 8080/8081 or 9000/9001
2. **AstraNodes**: Uses ports 8000/8443 (no conflict)
3. **PostgreSQL/Redis**: Internal-only, no external binding

### Checking Port Usage

```bash
# Check what's using port 8000
sudo lsof -i :8000

# Check all listening ports
sudo netstat -tulpn | grep LISTEN

# Docker services port mapping
docker-compose -f docker-compose.yml ps
```

## Troubleshooting

### Connection Refused

If you get "connection refused" on port 8000/8443:

1. Verify containers are running: `docker-compose ps`
2. Check Nginx logs: `docker-compose logs nginx`
3. Ensure no other service is using the port: `sudo lsof -i :8000`

### Pterodactyl Conflicts

If Pterodactyl is interfering:

1. Check Pterodactyl's bind port: Look in `/etc/pterodactyl/config/app.php` or Docker config
2. Reconfigure one service to use different ports
3. Restart both services

### Health Check Failures

If `./scripts/deploy.sh` fails health checks:

1. Verify `HTTP_PORT` matches the configured port
2. Check logs: `docker-compose logs -f nginx backend frontend`
3. Ensure backend/frontend are healthy: `docker-compose ps`

## Performance Tuning

Current Nginx rate limiting settings:

- **API endpoints**: 30 requests/second with 20 request burst
- **Auth endpoints**: 5 requests/minute with 3 request burst
- **Request timeout**: 30 seconds (API), 5 seconds (connect)
- **Max upload size**: 10MB

To adjust, edit `nginx/nginx.conf` and rebuild:

```bash
docker-compose build nginx
docker-compose up -d nginx
```
