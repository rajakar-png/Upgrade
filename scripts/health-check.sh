#!/usr/bin/env bash

# ══════════════════════════════════════════════════════════════════════════════
#  Deployment Health Check Script
#  Run this to diagnose domain/backend/frontend connectivity issues
# ══════════════════════════════════════════════════════════════════════════════

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; }
info() { echo -e "${BLUE}[i]${NC} $1"; }
step() { echo -e "\n${BLUE}══ $1 ══${NC}\n"; }

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
ENV_FILE="./backend/.env"

# ── Helper: Check if command exists ────────────────────────────────────────
cmd_exists() {
    command -v "$1" &>/dev/null
}

# ── Helper: Get env value ─────────────────────────────────────────────────
get_env() {
    local key="$1"
    grep "^${key}=" "$ENV_FILE" 2>/dev/null | tail -1 | cut -d'=' -f2- || echo ""
}

step "1. Container Status"

if docker-compose -f "$COMPOSE_FILE" ps 2>/dev/null | grep -q "postgres"; then
    log "Docker Compose is responding"
    docker-compose -f "$COMPOSE_FILE" ps
else
    err "Docker Compose not responding. Is docker daemon running?"
    exit 1
fi

echo ""

# Check each service
for service in postgres redis backend frontend nginx; do
    if docker-compose -f "$COMPOSE_FILE" ps "$service" 2>/dev/null | grep -q "Up"; then
        log "$service is running"
    else
        err "$service is not running or unhealthy"
    fi
done

step "2. Environment Configuration"

SITE_DOMAIN=$(get_env "SITE_DOMAIN")
FRONTEND_URL=$(get_env "FRONTEND_URL")
POSTGRES_PASSWORD=$(get_env "POSTGRES_PASSWORD")
PTERODACTYL_URL=$(get_env "PTERODACTYL_URL")
DATABASE_URL=$(get_env "DATABASE_URL")

if [[ -n "$SITE_DOMAIN" ]]; then
    log "SITE_DOMAIN is set: $SITE_DOMAIN"
else
    err "SITE_DOMAIN is empty! Run: ./scripts/deploy.sh --sync-env"
fi

if [[ -n "$FRONTEND_URL" ]]; then
    log "FRONTEND_URL is set: $FRONTEND_URL"
    if [[ "$FRONTEND_URL" == "http://localhost:3000" ]]; then
        warn "FRONTEND_URL points to localhost. Frontend won't work from remote."
    fi
else
    err "FRONTEND_URL is empty! Frontend will fail to load."
fi

if [[ -n "$POSTGRES_PASSWORD" ]]; then
    log "POSTGRES_PASSWORD is set (length: ${#POSTGRES_PASSWORD})"
else
    err "POSTGRES_PASSWORD is empty!"
fi

if [[ -n "$PTERODACTYL_URL" ]]; then
    log "PTERODACTYL_URL is set: $PTERODACTYL_URL"
else
    warn "PTERODACTYL_URL is empty. Backend won't work without it."
fi

if [[ -n "$DATABASE_URL" ]]; then
    log "DATABASE_URL is set"
else
    warn "DATABASE_URL is empty (will be auto-generated from POSTGRES vars at runtime)"
fi

step "3. Network Connectivity"

# Test DNS
if [[ -n "$SITE_DOMAIN" ]]; then
    info "Testing DNS resolution for $SITE_DOMAIN..."
    if cmd_exists nslookup; then
        if nslookup "$SITE_DOMAIN" 2>/dev/null | grep -q "Address"; then
            RESOLVED_IP=$(nslookup "$SITE_DOMAIN" 2>/dev/null | grep "Address" | tail -1 | awk '{print $2}')
            log "Domain resolves to: $RESOLVED_IP"
        else
            warn "Domain does not resolve yet (DNS might not be propagated)"
        fi
    elif cmd_exists dig; then
        if dig "$SITE_DOMAIN" +short 2>/dev/null | grep -q "."; then
            RESOLVED_IP=$(dig "$SITE_DOMAIN" +short | head -1)
            log "Domain resolves to: $RESOLVED_IP"
        else
            warn "Domain does not resolve yet"
        fi
    fi
fi

# Test internal service connectivity
step "4. Internal Service Connectivity"

info "Testing backend health from Nginx container..."
if docker-compose -f "$COMPOSE_FILE" exec -T nginx curl -s http://backend:4000/api/health >/dev/null 2>&1; then
    log "Nginx can reach backend"
else
    err "Nginx CANNOT reach backend:4000 (check backend logs)"
    docker-compose -f "$COMPOSE_FILE" logs backend | tail -10
fi

info "Testing frontend connectivity from Nginx container..."
if docker-compose -f "$COMPOSE_FILE" exec -T nginx curl -s http://frontend:3000 >/dev/null 2>&1; then
    log "Nginx can reach frontend"
else
    err "Nginx CANNOT reach frontend:3000 (check frontend logs)"
    docker-compose -f "$COMPOSE_FILE" logs frontend | tail -10
fi

# Test port accessibility
step "5. Port Accessibility"

info "Checking if port 8000 is accessible..."
if docker-compose -f "$COMPOSE_FILE" exec -T nginx curl -s http://localhost:8000 >/dev/null 2>&1; then
    log "Port 8000 is accessible from nginx container"
else
    err "Port 8000 not responding"
fi

info "Checking if port 8443 (HTTPS) is configured..."
if [[ -f "ssl/live/fullchain.pem" ]]; then
    log "SSL certificate exists"
    EXPIRY=$(openssl x509 -enddate -noout -in ssl/live/fullchain.pem 2>/dev/null | cut -d= -f2)
    log "Certificate expires: $EXPIRY"
else
    warn "No SSL certificate found yet (self-signed might be generated)"
fi

# Test database
step "6. Database Connectivity"

info "Testing PostgreSQL connection..."
if docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U astra >/dev/null 2>&1; then
    log "PostgreSQL is ready"
else
    err "PostgreSQL is not ready or inaccessible"
fi

# Test Redis
step "7. Cache (Redis) Connectivity"

info "Testing Redis connection..."
if docker-compose -f "$COMPOSE_FILE" exec -T redis redis-cli ping >/dev/null 2>&1; then
    log "Redis is responding"
else
    err "Redis is not responding"
fi

# Nginx config validation
step "8. Nginx Configuration"

info "Validating nginx configuration..."
if docker-compose -f "$COMPOSE_FILE" exec -T nginx nginx -t >/dev/null 2>&1; then
    log "Nginx configuration is valid"
else
    err "Nginx configuration has errors:"
    docker-compose -f "$COMPOSE_FILE" exec -T nginx nginx -t
fi

step "9. Summary & Next Steps"

echo ""
echo "Health check complete!"
echo ""
echo "If issues were found above:"
echo ""
echo "1. For empty SITE_DOMAIN or FRONTEND_URL:"
echo "   → Run: ./scripts/deploy.sh --sync-env"
echo "   → Enter your actual domain and FRONTEND_URL"
echo ""
echo "2. For DNS not resolving:"
echo "   → Check Cloudflare DNS records are pointing to your VPS IP"
echo "   → Wait 24-48 hours for propagation"
echo "   → Verify with: dig $SITE_DOMAIN @8.8.8.8"
echo ""
echo "3. For backend/frontend not running:"
echo "   → Check logs: docker-compose logs backend"
echo "   → Rebuild: docker-compose build <service>"
echo "   → Restart: docker-compose up -d <service>"
echo ""
echo "4. For port not accessible:"
echo "   → Check firewall: sudo ufw allow 8000/tcp"
echo "   → Check binding: sudo lsof -i :8000"
echo ""
echo "5. For FRONTEND_URL issues:"
echo "   → Make sure it matches your actual domain/IP"
echo "   → NOT localhost or internal IPs"
echo ""
echo "Full troubleshooting guide: see TROUBLESHOOTING.md"
echo ""
