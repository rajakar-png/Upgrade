#!/usr/bin/env bash

# ══════════════════════════════════════════════════════════════════════════════
#  Quick Fix: Apply Domain Configuration to All Services
#  Run this after adding your domain in Cloudflare
# ══════════════════════════════════════════════════════════════════════════════

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[DEPLOY]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()  { echo -e "${RED}[ERROR]${NC} $1"; }
info() { echo -e "${CYAN}[INFO]${NC} $1"; }
step() { echo -e "\n${BLUE}══ $1 ══${NC}"; }

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
ENV_FILE="./backend/.env"

# ── Helper: Get env value ─────────────────────────────────────────────────
read_env_value() {
    local key="$1"
    grep "^${key}=" "$ENV_FILE" 2>/dev/null | tail -1 | cut -d'=' -f2- || echo ""
}

# ── Helper: Set env value ─────────────────────────────────────────────────
set_env_value() {
    local key="$1"
    local value="$2"
    if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
        awk -v k="${key}=" -v line="${key}=${value}" '{if(index($0,k)==1) print line; else print}' "$ENV_FILE" > "${ENV_FILE}.tmp"
        mv "${ENV_FILE}.tmp" "$ENV_FILE"
    else
        echo "${key}=${value}" >> "$ENV_FILE"
    fi
}

step "Domain Configuration Quick Fix"

log "Reading current configuration..."

SITE_DOMAIN=$(read_env_value "SITE_DOMAIN")
FRONTEND_URL=$(read_env_value "FRONTEND_URL")

if [[ -z "$SITE_DOMAIN" ]]; then
    err "SITE_DOMAIN is not set!"
    echo ""
    echo "Please run first:"
    echo "  ./scripts/deploy.sh --sync-env"
    echo ""
    echo "And enter your domain when prompted."
    exit 1
fi

log "Current SITE_DOMAIN: $SITE_DOMAIN"
log "Current FRONTEND_URL: $FRONTEND_URL"

# Fix FRONTEND_URL if it's still on localhost
if [[ "$FRONTEND_URL" == "http://localhost"* ]] || [[ -z "$FRONTEND_URL" ]]; then
    warn "FRONTEND_URL points to localhost. Updating to: https://$SITE_DOMAIN"
    set_env_value "FRONTEND_URL" "https://$SITE_DOMAIN"
    FRONTEND_URL="https://$SITE_DOMAIN"
    log "FRONTEND_URL updated!"
else
    log "FRONTEND_URL is already set: $FRONTEND_URL (no change)"
fi

step "Verifying Cloudflare DNS"

if command -v dig &>/dev/null; then
    info "Checking DNS resolution for $SITE_DOMAIN..."
    RESOLVED_IP=$(dig "$SITE_DOMAIN" +short 2>/dev/null | head -1)
    if [[ -n "$RESOLVED_IP" ]]; then
        log "Domain resolves to: $RESOLVED_IP"
    else
        warn "Domain does not resolve yet. This is normal if you just added the DNS record."
        warn "DNS propagation can take 5-60 minutes."
        warn "Check with: dig $SITE_DOMAIN @8.8.8.8"
    fi
fi

step "Updating Docker Containers"

info "Stopping containers..."
docker-compose -f "$COMPOSE_FILE" stop frontend >/dev/null 2>&1 || true

info "Rebuilding frontend with new FRONTEND_URL..."
docker-compose -f "$COMPOSE_FILE" build --no-cache frontend 2>&1 | tail -20

info "Starting frontend..."
docker-compose -f "$COMPOSE_FILE" up -d frontend

info "Applying nginx SSL configuration..."
CERT_FILE="./ssl/live/fullchain.pem"
if [[ -f "$CERT_FILE" ]]; then
    log "SSL certificate found, redeploying..."
    docker-compose -f "$COMPOSE_FILE" restart nginx
else
    warn "No SSL certificate found. Run: ./scripts/deploy.sh --ssl"
fi

step "Verification"

sleep 5  # Wait for containers to start

info "Checking frontend is running..."
if docker-compose -f "$COMPOSE_FILE" ps frontend | grep -q "Up"; then
    log "Frontend is running"
else
    err "Frontend failed to start. Check logs: docker-compose logs frontend"
fi

info "Checking nginx is running..."
if docker-compose -f "$COMPOSE_FILE" ps nginx | grep -q "Up"; then
    log "Nginx is running"
else
    err "Nginx failed to start. Check logs: docker-compose logs nginx"
fi

echo ""
echo -e "${GREEN}✓ Quick fix applied!${NC}"
echo ""
echo "Next steps:"
echo "  1. Verify DNS is propagated: dig $SITE_DOMAIN @8.8.8.8"
echo "  2. Test your domain: curl http://$SITE_DOMAIN:8000"
echo "  3. Check logs: docker-compose logs -f frontend nginx"
echo "  4. If SSL needed: ./scripts/deploy.sh --ssl"
echo ""
echo "If frontend still doesn't load:"
echo "  1. Check browser console for API errors"
echo "  2. Verify FRONTEND_URL in .env: grep FRONTEND_URL $ENV_FILE"
echo "  3. Check logs: docker-compose logs frontend"
echo ""
