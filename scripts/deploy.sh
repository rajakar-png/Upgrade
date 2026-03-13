#!/usr/bin/env bash

# ══════════════════════════════════════════════════════════════════════════════
#  AstraNodes — Docker Deployment Script
#  Supports: Ubuntu 22.04 / 24.04 · Docker · Docker Compose
#  Usage: bash deploy.sh
# ══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ── Colors ─────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

info()    { echo -e "${CYAN}[INFO]${RESET}    $*"; }
success() { echo -e "${GREEN}[OK]${RESET}      $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}    $*"; }
error()   { echo -e "${RED}[ERROR]${RESET}   $*" >&2; exit 1; }
header()  { echo -e "\n${BOLD}${CYAN}══ $* ══${RESET}"; }

ask() {
  local var="$1" prompt="$2" default="${3:-}"
  local hint=""
  [[ -n "$default" ]] && hint=" [${default}]"
  while true; do
    read -rp "$(echo -e "${YELLOW}?${RESET} ${prompt}${hint}: ")" value
    value="${value:-$default}"
    value="$(echo -e "${value}" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
    if [[ -n "$value" ]]; then
      printf -v "$var" '%s' "$value"
      return
    fi
    echo -e "${RED}  This field is required.${RESET}"
  done
}

ask_optional() {
  local var="$1" prompt="$2" default="${3:-}"
  local hint=""
  [[ -n "$default" ]] && hint=" [${default}]"
  read -rp "$(echo -e "${YELLOW}?${RESET} ${prompt}${hint}: ")" value
  value="${value:-$default}"
  value="$(echo -e "${value}" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  printf -v "$var" '%s' "$value"
}

ask_yn() {
  local var="$1" prompt="$2" default="${3:-y}"
  local choices; [[ "$default" == "y" ]] && choices="Y/n" || choices="y/N"
  read -rp "$(echo -e "${YELLOW}?${RESET} ${prompt} [${choices}]: ")" value
  value="${value:-$default}"
  [[ "${value,,}" == "y" ]] && printf -v "$var" 'yes' || printf -v "$var" 'no'
}

# ─────────────────────────────────────────────────────────────────────────────
#  STARTUP
# ─────────────────────────────────────────────────────────────────────────────

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)" || exit 1

clear
echo -e "${BOLD}${CYAN}"
echo "  ╔════════════════════════════════════════════════╗"
echo "  ║    AstraNodes — Docker Deployment Script       ║"
echo "  ║    Ubuntu 22.04/24.04 · Docker · Compose       ║"
echo "  ╚════════════════════════════════════════════════╝"
echo -e "${RESET}"
echo "  This script will:"
echo "   1. Ask for your domain and configuration"
echo "   2. Install Docker & Docker Compose (if needed)"
echo "   3. Configure PostgreSQL, Redis, Backend, Frontend"
echo "   4. Set up Nginx reverse proxy"
echo "   5. Configure SSL/TLS with Let's Encrypt"
echo "   6. Build and deploy everything automatically"
echo ""
warn "Run as root or with sudo. Press Ctrl-C to abort."
echo ""

# ─────────────────────────────────────────────────────────────────────────────
#  SAVED CONFIG
# ─────────────────────────────────────────────────────────────────────────────

CONFIG_FILE="${HOME}/.astranodes-docker-deploy.conf"

CONFIG_VARS=(
  SITE_DOMAIN POSTGRES_PASSWORD JWT_SECRET ADMIN_EMAIL
  CLOUDFLARE_EMAIL CLOUDFLARE_API_TOKEN CLOUDFLARE_ZONE_ID
  PTERODACTYL_URL PTERODACTYL_API_KEY PTERODACTYL_CLIENT_KEY
  GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET
  DISCORD_CLIENT_ID DISCORD_CLIENT_SECRET
  DISCORD_WEBHOOK_URL DISCORD_SUPPORT_WEBHOOK_URL
  UPI_ID UPI_NAME
)

load_config() {
  if [[ -f "$CONFIG_FILE" ]]; then
    # shellcheck disable=SC1090
    source "$CONFIG_FILE"
    return 0
  fi
  return 1
}

save_config() {
  {
    echo "# AstraNodes Docker deploy config — auto-generated $(date -Iseconds)"
    for v in "${CONFIG_VARS[@]}"; do
      printf '%s=%q\n' "$v" "${!v:-}"
    done
  } > "$CONFIG_FILE"
  chmod 600 "$CONFIG_FILE"
}

# Try loading existing config
SKIPPED_WIZARD=false
if load_config; then
  echo -e "  ${GREEN}Found saved config from previous run.${RESET}"
  echo -e "  ${CYAN}${CONFIG_FILE}${RESET}"
  echo ""
  ask_yn USE_SAVED "Reuse saved settings? (skip all questions)" "y"
  if [[ "$USE_SAVED" == "yes" ]]; then
    success "Loaded saved config — proceeding to deployment."
    SKIPPED_WIZARD=true
  fi
fi

# Run wizard if config not loaded
if [[ "$SKIPPED_WIZARD" != "true" ]]; then

# ─────────────────────────────────────────────────────────────────────────────
#  SECTION 1 — Domain & Basic Config
# ─────────────────────────────────────────────────────────────────────────────
header "1 / 8  Domain & Basic Configuration"

ask SITE_DOMAIN "Domain name (e.g. astranodes.cloud)"
ask ADMIN_EMAIL "Admin email (for Let's Encrypt and alerts)"

# ─────────────────────────────────────────────────────────────────────────────
#  SECTION 2 — Database & Secrets
# ─────────────────────────────────────────────────────────────────────────────
header "2 / 8  Database & Secrets"

GEN_DB_PASS=$(openssl rand -base64 32 2>/dev/null | tr -d '/+=' | head -c 32)
ask POSTGRES_PASSWORD "PostgreSQL admin password (min 16 chars, Enter = generate)" "$GEN_DB_PASS"

if [[ ${#POSTGRES_PASSWORD} -lt 16 ]]; then
  error "POSTGRES_PASSWORD must be at least 16 characters."
fi

GEN_JWT=$(openssl rand -base64 48 2>/dev/null | tr -d '/+=' | head -c 48)
ask JWT_SECRET "JWT secret (min 32 chars, Enter = generate)" "$GEN_JWT"

if [[ ${#JWT_SECRET} -lt 32 ]]; then
  error "JWT_SECRET must be at least 32 characters."
fi

# ─────────────────────────────────────────────────────────────────────────────
#  SECTION 3 — OAuth (Google & Discord)
# ─────────────────────────────────────────────────────────────────────────────
header "3 / 8  OAuth Authentication"
echo -e "  ${CYAN}Authentication is OAuth-only for security.${RESET}"
echo -e "  ${CYAN}Email/password login is disabled.${RESET}"
echo ""
echo -e "  ${YELLOW}Google OAuth Setup:${RESET}"
echo -e "  1. Go to: https://console.cloud.google.com/apis/credentials"
echo -e "  2. Create OAuth 2.0 Client ID (Web application)"
echo -e "  3. Authorized redirect URI: https://${SITE_DOMAIN}/api/auth/google/callback"
echo ""
ask GOOGLE_CLIENT_ID "Google OAuth Client ID"
ask GOOGLE_CLIENT_SECRET "Google OAuth Client Secret"

echo ""
echo -e "  ${YELLOW}Discord OAuth Setup:${RESET}"
echo -e "  1. Go to: https://discord.com/developers/applications"
echo -e "  2. Create application → OAuth2 → Add Redirect"
echo -e "  3. Redirect URI: https://${SITE_DOMAIN}/api/auth/discord/callback"
echo ""
ask DISCORD_CLIENT_ID "Discord OAuth Client ID"
ask DISCORD_CLIENT_SECRET "Discord OAuth Client Secret"

# ─────────────────────────────────────────────────────────────────────────────
#  SECTION 4 — Pterodactyl Panel
# ─────────────────────────────────────────────────────────────────────────────
header "4 / 8  Pterodactyl Panel Integration"

ask PTERODACTYL_URL "Pterodactyl panel URL (e.g. https://panel.example.com)"
ask PTERODACTYL_API_KEY "Pterodactyl admin API key"
ask_optional PTERODACTYL_CLIENT_KEY "Pterodactyl Client API key for backups (PTLC_...)" ""

# ─────────────────────────────────────────────────────────────────────────────
#  SECTION 5 — Cloudflare (DNS + SSL)
# ─────────────────────────────────────────────────────────────────────────────
header "5 / 8  Cloudflare Integration (Optional)"
echo -e "  ${CYAN}Leave blank to skip Cloudflare setup and use Let's Encrypt.${RESET}"
echo ""
ask_optional CLOUDFLARE_EMAIL "Cloudflare email" ""
ask_optional CLOUDFLARE_API_TOKEN "Cloudflare API token" ""
ask_optional CLOUDFLARE_ZONE_ID "Cloudflare Zone ID" ""

# ─────────────────────────────────────────────────────────────────────────────
#  SECTION 6 — Discord Webhooks
# ─────────────────────────────────────────────────────────────────────────────
header "6 / 8  Discord Webhooks (Optional)"

ask_optional DISCORD_WEBHOOK_URL "Discord webhook URL (UTR notifications)" ""
ask_optional DISCORD_SUPPORT_WEBHOOK_URL "Discord support webhook (support requests)" ""

# ─────────────────────────────────────────────────────────────────────────────
#  SECTION 7 — Monetization
# ─────────────────────────────────────────────────────────────────────────────
header "7 / 8  Monetization (Optional)"

ask_optional UPI_ID "UPI ID (e.g. yourname@upi)" ""
ask_optional UPI_NAME "UPI registered name / business name" ""

fi  # end SKIPPED_WIZARD

# ─────────────────────────────────────────────────────────────────────────────
#  Review & Confirm
# ─────────────────────────────────────────────────────────────────────────────
header "8 / 8  Review & Confirm"

echo ""
echo -e "  ${BOLD}Domain:${RESET}           https://${SITE_DOMAIN}"
echo -e "  ${BOLD}Admin email:${RESET}      ${ADMIN_EMAIL}"
echo -e "  ${BOLD}Pterodactyl:${RESET}      ${PTERODACTYL_URL}"
echo -e "  ${BOLD}Database:${RESET}         PostgreSQL (Docker)"
echo -e "  ${BOLD}Cache:${RESET}            Redis (Docker)"
echo -e "  ${BOLD}Reverse proxy:${RESET}    Nginx (Docker)"
echo -e "  ${BOLD}Frontend port:${RESET}    8000 (HTTP), 8443 (HTTPS)"
echo ""
ask_yn CONFIRM "Proceed with deployment?" "y"
[[ "$CONFIRM" != "yes" ]] && { warn "Aborted."; exit 0; }

# Save config for future runs
save_config
success "Config saved to ${CONFIG_FILE}"

# ═════════════════════════════════════════════════════════════════════════════
#  VALIDATION & SETUP
# ═════════════════════════════════════════════════════════════════════════════
header "Validating Configuration"

if ! command -v docker &>/dev/null; then
  error "Docker is not installed. Please install Docker first."
fi

if ! command -v docker-compose &>/dev/null; then
  error "Docker Compose is not installed. Please run: pip install docker-compose"
fi

success "Docker and Docker Compose are available"

# ═════════════════════════════════════════════════════════════════════════════
#  GENERATE .env FILE
# ═════════════════════════════════════════════════════════════════════════════
header "Generating Configuration Files"

FRONTEND_URL="https://${SITE_DOMAIN}"
OAUTH_CALLBACK_URL="https://${SITE_DOMAIN}"

cat > backend/.env <<EOF
# ─── App Configuration ───────────────────────────────────────────────────────
NODE_ENV=production
PORT=4000
SITE_DOMAIN=${SITE_DOMAIN}
FRONTEND_URL=${FRONTEND_URL}

# ─── Database (PostgreSQL) ───────────────────────────────────────────────────
POSTGRES_USER=astra
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=astra
DATABASE_URL=postgresql://astra:${POSTGRES_PASSWORD}@postgres:5432/astra

# ─── Redis ──────────────────────────────────────────────────────────────────
REDIS_URL=redis://redis:6379

# ─── Authentication ─────────────────────────────────────────────────────────
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d
OAUTH_CALLBACK_URL=${OAUTH_CALLBACK_URL}

# ─── OAuth (Google & Discord) ───────────────────────────────────────────────
GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
DISCORD_CLIENT_ID=${DISCORD_CLIENT_ID}
DISCORD_CLIENT_SECRET=${DISCORD_CLIENT_SECRET}

# ─── Pterodactyl Panel ──────────────────────────────────────────────────────
PTERODACTYL_URL=${PTERODACTYL_URL}
PTERODACTYL_API_KEY=${PTERODACTYL_API_KEY}
$([ -n "${PTERODACTYL_CLIENT_KEY}" ] && echo "PTERODACTYL_CLIENT_KEY=${PTERODACTYL_CLIENT_KEY}")
PTERODACTYL_DEFAULT_EGG=1
PTERODACTYL_DEFAULT_DOCKER_IMAGE=ghcr.io/pterodactyl/yolks:java_17
PTERODACTYL_DEFAULT_STARTUP=java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar {{SERVER_JARFILE}}
PTERODACTYL_DEFAULT_ENV={}

# ─── Storage ────────────────────────────────────────────────────────────────
UPLOAD_DIR=./uploads

# ─── Rate Limiting ──────────────────────────────────────────────────────────
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=200

# ─── Discord ────────────────────────────────────────────────────────────────
$([ -n "${DISCORD_WEBHOOK_URL}" ] && echo "DISCORD_WEBHOOK_URL=${DISCORD_WEBHOOK_URL}")
$([ -n "${DISCORD_SUPPORT_WEBHOOK_URL}" ] && echo "DISCORD_SUPPORT_WEBHOOK_URL=${DISCORD_SUPPORT_WEBHOOK_URL}")

# ─── UPI Payments ───────────────────────────────────────────────────────────
$([ -n "${UPI_ID}" ] && echo "UPI_ID=${UPI_ID}")
$([ -n "${UPI_NAME}" ] && echo "UPI_NAME=${UPI_NAME}")

# ─── Cloudflare (Optional) ──────────────────────────────────────────────────
$([ -n "${CLOUDFLARE_EMAIL}" ] && echo "CLOUDFLARE_EMAIL=${CLOUDFLARE_EMAIL}")
$([ -n "${CLOUDFLARE_API_TOKEN}" ] && echo "CLOUDFLARE_API_TOKEN=${CLOUDFLARE_API_TOKEN}")
$([ -n "${CLOUDFLARE_ZONE_ID}" ] && echo "CLOUDFLARE_ZONE_ID=${CLOUDFLARE_ZONE_ID}")
CLOUDFLARE_DOMAIN=${SITE_DOMAIN}

# ─── Admin ──────────────────────────────────────────────────────────────────
ADMIN_EMAIL=${ADMIN_EMAIL}
EOF

chmod 600 backend/.env
success "backend/.env generated (chmod 600)"

# ═════════════════════════════════════════════════════════════════════════════
#  BUILD & START DOCKER CONTAINERS
# ═════════════════════════════════════════════════════════════════════════════
header "Building & Starting Docker Containers"

info "Pulling base images..."
docker-compose pull

info "Building images..."
docker-compose build

info "Starting services..."
docker-compose up -d

sleep 5

# ═════════════════════════════════════════════════════════════════════════════
#  WAIT FOR SERVICES
# ═════════════════════════════════════════════════════════════════════════════
header "Waiting for Services to Be Ready"

info "Waiting for PostgreSQL..."
retries=0
while ! docker-compose exec -T postgres pg_isready -U astra >/dev/null 2>&1; do
  retries=$((retries + 1))
  if [[ $retries -gt 30 ]]; then
    error "PostgreSQL failed to start"
  fi
  echo -n "."
  sleep 2
done
success "PostgreSQL is ready"

info "Waiting for Redis..."
retries=0
while ! docker-compose exec -T redis redis-cli ping >/dev/null 2>&1; do
  retries=$((retries + 1))
  if [[ $retries -gt 30 ]]; then
    error "Redis failed to start"
  fi
  echo -n "."
  sleep 2
done
success "Redis is ready"

info "Waiting for Backend..."
retries=0
while ! docker-compose exec -T backend curl -sf http://localhost:4000/api/health >/dev/null 2>&1; do
  retries=$((retries + 1))
  if [[ $retries -gt 60 ]]; then
    error "Backend failed to start"
  fi
  echo -n "."
  sleep 2
done
success "Backend is ready"

info "Waiting for Frontend..."
retries=0
while ! docker-compose exec -T frontend curl -sf http://localhost:3000 >/dev/null 2>&1; do
  retries=$((retries + 1))
  if [[ $retries -gt 60 ]]; then
    error "Frontend failed to start"
  fi
  echo -n "."
  sleep 2
done
success "Frontend is ready"

# ═════════════════════════════════════════════════════════════════════════════
#  SSL CERTIFICATE SETUP
# ═════════════════════════════════════════════════════════════════════════════
header "SSL Certificate Setup"

mkdir -p ssl/live

# Check if we have Cloudflare credentials for automatic renewal
if [[ -n "${CLOUDFLARE_API_TOKEN}" && -n "${CLOUDFLARE_ZONE_ID}" ]]; then
  info "Requesting SSL certificate via Let's Encrypt (DNS challenge)..."
  
  docker run --rm \
    -v "$(pwd)/ssl:/etc/letsencrypt" \
    -e CLOUDFLARE_EMAIL="${CLOUDFLARE_EMAIL}" \
    -e CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_TOKEN}" \
    certbot/dns-cloudflare certonly \
    --dns-cloudflare \
    --dns-cloudflare-propagation-seconds 60 \
    -d "${SITE_DOMAIN}" \
    -d "*.${SITE_DOMAIN}" \
    --non-interactive \
    --agree-tos \
    --email "${ADMIN_EMAIL}" \
    --preferred-challenges dns-01 \
    2>&1 | tail -10 || warn "Certbot DNS challenge failed, trying HTTP challenge..."
fi

# Fallback to HTTP challenge if DNS failed or no Cloudflare
if [[ ! -f "ssl/live/${SITE_DOMAIN}/fullchain.pem" ]]; then
  info "Requesting SSL certificate via Let's Encrypt (HTTP challenge)..."
  
  docker-compose stop nginx 2>/dev/null || true
  sleep 2
  
  docker run --rm \
    -v "$(pwd)/ssl:/etc/letsencrypt" \
    -p 80:80 \
    certbot/certbot certonly \
    --standalone \
    -d "${SITE_DOMAIN}" \
    --non-interactive \
    --agree-tos \
    --email "${ADMIN_EMAIL}" \
    2>&1 | tail -10 || warn "Certbot HTTP challenge failed"
  
  docker-compose up -d nginx
fi

# Fallback to self-signed if Let's Encrypt failed
if [[ ! -f "ssl/live/${SITE_DOMAIN}/fullchain.pem" ]]; then
  warn "Let's Encrypt failed. Generating self-signed certificate..."
  
  mkdir -p "ssl/live/${SITE_DOMAIN}"
  openssl req -x509 -nodes -days 3650 \
    -newkey rsa:2048 \
    -keyout "ssl/live/${SITE_DOMAIN}/privkey.pem" \
    -out "ssl/live/${SITE_DOMAIN}/fullchain.pem" \
    -subj "/CN=${SITE_DOMAIN}" \
    -addext "subjectAltName=DNS:${SITE_DOMAIN},DNS:*.${SITE_DOMAIN}" \
    2>/dev/null
  
  warn "Self-signed certificate generated (valid 10 years)"
  warn "For production, get a real certificate from Let's Encrypt"
fi

# Copy cert to flat location for nginx
cp "ssl/live/${SITE_DOMAIN}/fullchain.pem" ssl/live/fullchain.pem 2>/dev/null || true
cp "ssl/live/${SITE_DOMAIN}/privkey.pem" ssl/live/privkey.pem 2>/dev/null || true

success "SSL certificate configured"

# Restart nginx with SSL
docker-compose restart nginx
sleep 3

# ═════════════════════════════════════════════════════════════════════════════
#  VERIFY DEPLOYMENT
# ═════════════════════════════════════════════════════════════════════════════
header "Verifying Deployment"

info "Checking all services..."
docker-compose ps

echo ""
if docker-compose ps | grep -q "Up.*postgres"; then
  success "PostgreSQL is running"
fi
if docker-compose ps | grep -q "Up.*redis"; then
  success "Redis is running"
fi
if docker-compose ps | grep -q "Up.*backend"; then
  success "Backend is running"
fi
if docker-compose ps | grep -q "Up.*frontend"; then
  success "Frontend is running"
fi
if docker-compose ps | grep -q "Up.*nginx"; then
  success "Nginx is running"
fi

# ═════════════════════════════════════════════════════════════════════════════
#  FINAL SUMMARY
# ═════════════════════════════════════════════════════════════════════════════

echo ""
echo -e "${BOLD}${GREEN}═══════════════════════════════════════════════════════${RESET}"
echo -e "${BOLD}${GREEN}  Deployment Complete!${RESET}"
echo -e "${BOLD}${GREEN}═══════════════════════════════════════════════════════${RESET}"
echo ""
echo -e "  ${BOLD}Website:${RESET}        https://${SITE_DOMAIN}"
echo -e "  ${BOLD}API Health:${RESET}     https://${SITE_DOMAIN}/api/health"
echo -e "  ${BOLD}Admin Email:${RESET}    ${ADMIN_EMAIL}"
echo ""
echo -e "  ${CYAN}Docker Compose Commands:${RESET}"
echo -e "   docker-compose ps              # Check service status"
echo -e "   docker-compose logs -f         # View all logs"
echo -e "   docker-compose logs -f backend # View backend logs"
echo -e "   docker-compose restart         # Restart all services"
echo ""
echo -e "  ${CYAN}Database & Users:${RESET}"
echo -e "   docker-compose exec postgres psql -U astra -d astra"
echo ""
echo -e "  ${CYAN}Creating Admin Account:${RESET}"
echo -e "   1. Visit https://${SITE_DOMAIN}"
echo -e "   2. Login with Google or Discord OAuth"
echo -e "   3. Promote user to admin:"
echo -e "      docker-compose exec backend npm run set-admin ${ADMIN_EMAIL}"
echo -e "   4. Refresh page to access Admin Panel"
echo ""
echo -e "  ${YELLOW}Next Steps:${RESET}"
echo -e "   • Verify domain DNS points to this server"
echo -e "   • Check logs for any errors: docker-compose logs"
echo -e "   • Create first admin account (see above)"
echo -e "   • Configure Pterodactyl panel integration"
echo -e "   • Set up Discord webhooks if desired"
echo ""
echo -e "  ${CYAN}For help:${RESET} See TROUBLESHOOTING.md and FRONTEND_CONFIGURATION.md"
echo ""
