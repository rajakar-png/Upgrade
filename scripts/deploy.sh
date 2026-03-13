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

# Ensure critical values always exist (including when reusing saved config)
if [[ -z "${POSTGRES_PASSWORD:-}" ]]; then
  POSTGRES_PASSWORD=$(openssl rand -base64 32 2>/dev/null | tr -d '/+=' | head -c 32)
  warn "POSTGRES_PASSWORD was missing in saved config. Generated a new secure value."
fi
if [[ ${#POSTGRES_PASSWORD} -lt 16 ]]; then
  error "POSTGRES_PASSWORD must be at least 16 characters."
fi

if [[ -z "${JWT_SECRET:-}" ]]; then
  JWT_SECRET=$(openssl rand -base64 48 2>/dev/null | tr -d '/+=' | head -c 48)
  warn "JWT_SECRET was missing in saved config. Generated a new secure value."
fi
if [[ ${#JWT_SECRET} -lt 32 ]]; then
  error "JWT_SECRET must be at least 32 characters."
fi

if [[ -z "${SITE_DOMAIN:-}" ]]; then
  ask SITE_DOMAIN "Domain name (e.g. astranodes.cloud)"
fi
if [[ -z "${ADMIN_EMAIL:-}" ]]; then
  ask ADMIN_EMAIL "Admin email (for Let's Encrypt and alerts)"
fi

# These are required by backend env validation at startup
if [[ -z "${PTERODACTYL_URL:-}" ]]; then
  ask PTERODACTYL_URL "Pterodactyl panel URL (e.g. https://panel.example.com)"
fi
if [[ -z "${PTERODACTYL_API_KEY:-}" ]]; then
  ask PTERODACTYL_API_KEY "Pterodactyl admin API key"
fi

# Public ports (allow overrides via environment or existing shell values)
HTTP_PORT="${HTTP_PORT:-80}"
HTTPS_PORT="${HTTPS_PORT:-443}"
HOST_BIND="${HOST_BIND:-0.0.0.0}"
USE_HOST_NGINX_PROXY="no"
HOST_PROXY_CONFIGURED="no"

# Prefer a single edge proxy: Docker nginx on public 80/443.
# If host nginx owns these ports, stop it to avoid split-routing failures.
if command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet nginx; then
  if command -v lsof >/dev/null 2>&1; then
    if lsof -iTCP:80 -sTCP:LISTEN -P -n >/dev/null 2>&1 || lsof -iTCP:443 -sTCP:LISTEN -P -n >/dev/null 2>&1; then
      warn "Host nginx is using 80/443. Stopping host nginx so Docker nginx can serve ${SITE_DOMAIN} directly."
      systemctl stop nginx 2>/dev/null || true
      systemctl disable nginx 2>/dev/null || true
    fi
  fi
fi

# Always keep Docker nginx publicly bound unless explicit host-proxy mode is enabled later.
HTTP_PORT="80"
HTTPS_PORT="443"
HOST_BIND="0.0.0.0"

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
echo -e "  ${BOLD}Frontend port:${RESET}    ${HTTP_PORT} (HTTP), ${HTTPS_PORT} (HTTPS)"
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

# ── Check Docker ──────────────────────────────────────────────────────────────
info "Checking Docker installation..."

# Try to find docker in standard locations
DOCKER_CMD=""
for docker_path in /usr/bin/docker /usr/local/bin/docker /snap/bin/docker /opt/docker/bin/docker; do
  if [[ -x "$docker_path" ]]; then
    DOCKER_CMD="$docker_path"
    break
  fi
done

# Fallback to command lookup
if [[ -z "$DOCKER_CMD" ]]; then
  DOCKER_CMD=$(command -v docker 2>/dev/null || echo "")
fi

if [[ -z "$DOCKER_CMD" ]]; then
  error "❌ Docker is not installed or not in PATH.
  
  Please install Docker:
  - Ubuntu/Debian: sudo apt-get install docker.io docker-compose
  - Snap: sudo snap install docker
  - Official: https://docs.docker.com/engine/install/
  
  After installing, you may need to:
  1. Add user to docker group: sudo usermod -aG docker \$USER
  2. Log out and back in, or run: newgrp docker
  3. Verify: docker --version"
fi

# Test Docker works
if ! $DOCKER_CMD --version >/dev/null 2>&1; then
  error "❌ Docker is installed but not working. Try:
  - sudo usermod -aG docker \$USER
  - newgrp docker
  - Test: docker --version"
fi

success "Docker is available: $($DOCKER_CMD --version)"

# ── Check Docker Compose ──────────────────────────────────────────────────────
info "Checking Docker Compose installation..."

DOCKER_COMPOSE_CMD=""

# Try docker compose (new version)
if $DOCKER_CMD compose version >/dev/null 2>&1; then
  DOCKER_COMPOSE_CMD="$DOCKER_CMD compose"
  success "Docker Compose (integrated): $($DOCKER_CMD compose version | head -1)"
# Try standalone docker-compose
elif command -v docker-compose &>/dev/null; then
  DOCKER_COMPOSE_CMD="docker-compose"
  success "Docker Compose (standalone): $(docker-compose --version)"
# Try to install docker-compose
else
  warn "Docker Compose not found. Attempting to install..."
  
  if command -v pip3 &>/dev/null; then
    info "Installing docker-compose via pip3..."
    if pip3 install --user docker-compose >/dev/null 2>&1; then
      DOCKER_COMPOSE_CMD="$HOME/.local/bin/docker-compose"
      success "Docker Compose installed: $($DOCKER_COMPOSE_CMD --version)"
    else
      error "Failed to install docker-compose via pip3"
    fi
  elif command -v pip &>/dev/null; then
    info "Installing docker-compose via pip..."
    if pip install --user docker-compose >/dev/null 2>&1; then
      DOCKER_COMPOSE_CMD="$HOME/.local/bin/docker-compose"
      success "Docker Compose installed: $($DOCKER_COMPOSE_CMD --version)"
    else
      error "Failed to install docker-compose via pip"
    fi
  else
    error "❌ Docker Compose is not installed and pip is not available.
  
  Please install Docker Compose:
  - Ubuntu/Debian: sudo apt-get install docker-compose
  - Snap: sudo snap install docker
  - pip: pip install docker-compose
  - Or download: https://docs.docker.com/compose/install/"
  fi
fi

# ── Setup docker-compose wrapper function ──────────────────────────────────
# This function ensures docker-compose works whether we have standalone or integrated version
docker-compose() {
  if command -v docker &>/dev/null && docker compose version >/dev/null 2>&1; then
    # Using "docker compose" (integrated)
    docker compose "$@"
  else
    # Using standalone docker-compose
    command docker-compose "$@"
  fi
}

export -f docker-compose

success "✅ Docker and Docker Compose are available"

# Warn if a host-level nginx is active while using standard web ports
if [[ "${HTTP_PORT}" == "80" || "${HTTPS_PORT}" == "443" ]]; then
  if command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet nginx; then
    warn "Host nginx service is active. It may serve ${SITE_DOMAIN} instead of Docker nginx if ports 80/443 are occupied."
  fi
fi

# ═════════════════════════════════════════════════════════════════════════════
#  GENERATE .env FILE
# ═════════════════════════════════════════════════════════════════════════════
header "Generating Configuration Files"

if [[ "$USE_HOST_NGINX_PROXY" == "yes" || "$HTTPS_PORT" == "443" ]]; then
  FRONTEND_URL="https://${SITE_DOMAIN}"
  OAUTH_CALLBACK_URL="https://${SITE_DOMAIN}"
else
  FRONTEND_URL="https://${SITE_DOMAIN}:${HTTPS_PORT}"
  OAUTH_CALLBACK_URL="https://${SITE_DOMAIN}:${HTTPS_PORT}"
  warn "Using non-standard HTTPS port ${HTTPS_PORT}. Public URL will be ${FRONTEND_URL}"
fi

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

# Also create root .env for docker-compose to load environment variables
cat > .env <<EOF
POSTGRES_USER=astra
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=astra
HTTP_PORT=${HTTP_PORT}
HTTPS_PORT=${HTTPS_PORT}
HOST_BIND=${HOST_BIND}
EOF

chmod 600 .env
success ".env generated in root (chmod 600)"

# ═════════════════════════════════════════════════════════════════════════════
#  BUILD & START DOCKER CONTAINERS
# ═════════════════════════════════════════════════════════════════════════════
header "Building & Starting Docker Containers"

info "Pulling base images..."
docker-compose pull

info "Building images (this may take 5-10 minutes first time)..."
if ! docker-compose build; then
  error "Failed to build Docker images. Check logs above for details."
fi

info "Starting core services (PostgreSQL, Redis)..."
docker-compose up -d postgres redis

sleep 10  # Give containers time to start

# ═════════════════════════════════════════════════════════════════════════════
#  WAIT FOR SERVICES
# ═════════════════════════════════════════════════════════════════════════════
header "Waiting for Services to Be Ready"

info "Waiting for PostgreSQL..."
retries=0
while ! docker-compose exec -T postgres pg_isready -U astra >/dev/null 2>&1; do
  retries=$((retries + 1))
  if [[ $retries -gt 40 ]]; then
    error "PostgreSQL failed to start after 80 seconds.
  
Check logs:
  docker-compose logs postgres
  docker-compose logs -f"
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
    error "Redis failed to start after 60 seconds.
  
Check logs:
  docker-compose logs redis"
  fi
  echo -n "."
  sleep 2
done
success "Redis is ready"

info "Reconciling PostgreSQL role/password/database for backend..."
DB_ADMIN_ROLE=""
for candidate in "${POSTGRES_USER:-astra}" postgres; do
  if docker-compose exec -T postgres psql -U "$candidate" -d postgres -c "SELECT 1" >/dev/null 2>&1; then
    DB_ADMIN_ROLE="$candidate"
    break
  fi
done

if [[ -z "$DB_ADMIN_ROLE" ]]; then
  for candidate in "${POSTGRES_USER:-astra}" postgres; do
    if docker-compose exec -T postgres psql -U "$candidate" -d template1 -c "SELECT 1" >/dev/null 2>&1; then
      DB_ADMIN_ROLE="$candidate"
      break
    fi
  done
fi

if [[ -z "$DB_ADMIN_ROLE" ]]; then
  error "Unable to find a PostgreSQL admin role to reconcile credentials.

Check logs:
  docker-compose logs postgres"
fi

ESCAPED_DB_PASS=$(printf "%s" "$POSTGRES_PASSWORD" | sed "s/'/''/g")
if ! docker-compose exec -T postgres psql -U "$DB_ADMIN_ROLE" -d postgres -v ON_ERROR_STOP=1 <<SQL
SELECT 'CREATE ROLE astra LOGIN PASSWORD ''' || '${ESCAPED_DB_PASS}' || ''''
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'astra')\gexec
ALTER ROLE astra WITH LOGIN PASSWORD '${ESCAPED_DB_PASS}';
SELECT 'CREATE DATABASE astra OWNER astra'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'astra')\gexec
GRANT ALL PRIVILEGES ON DATABASE astra TO astra;
SQL
then
  error "Failed to reconcile PostgreSQL role/database credentials.

Check logs:
  docker-compose logs postgres"
fi
success "PostgreSQL credentials synchronized for backend"

info "Running Prisma migrations..."
if ! docker-compose run --rm --no-deps backend npm run prisma:migrate; then
  error "Prisma migrations failed.

Check logs:
  docker-compose logs postgres
  docker-compose run --rm --no-deps backend npm run prisma:migrate"
fi
success "Prisma migrations applied"

info "Starting app services (Backend, Frontend)..."
if ! docker-compose up -d backend frontend; then
  warn "Backend/Frontend reported unhealthy during initial start. Continuing with readiness checks..."
fi

info "Starting reverse proxy (Nginx)..."
if ! docker-compose up -d nginx; then
  warn "Nginx start deferred until app services become healthy. Will retry later."
fi

info "Waiting for Backend to build and start (this may take a few minutes)..."
retries=0
while true; do
  # Check if container is running first
  if ! docker-compose ps backend | grep -q "Up"; then
    docker-compose logs backend | tail -20
    retries=$((retries + 1))
    if [[ $retries -gt 120 ]]; then
      error "Backend container failed to start after 4 minutes.
  
Check build logs:
  docker-compose logs backend"
    fi
    echo -n "."
    sleep 2
    continue
  fi
  
  # Try to reach health endpoint
  if docker-compose exec -T backend wget -qO- http://localhost:4000/api/health >/dev/null 2>&1; then
    break
  fi
  
  retries=$((retries + 1))
  if [[ $retries -gt 120 ]]; then
    docker-compose logs backend | tail -80
    error "Backend health check failed after 4 minutes.
  
Check application logs:
  docker-compose logs backend"
  fi
  echo -n "."
  sleep 2
done
success "Backend is ready"

info "Waiting for Frontend to build and start (this may take a few minutes)..."
retries=0
while true; do
  # Check if container is running first
  if ! docker-compose ps frontend | grep -q "Up"; then
    docker-compose logs frontend | tail -20
    retries=$((retries + 1))
    if [[ $retries -gt 120 ]]; then
      error "Frontend container failed to start after 4 minutes.
  
Check build logs:
  docker-compose logs frontend"
    fi
    echo -n "."
    sleep 2
    continue
  fi
  
  # Try to reach health check
  if docker-compose exec -T frontend wget -qO- http://localhost:3000 >/dev/null 2>&1; then
    break
  fi
  
  retries=$((retries + 1))
  if [[ $retries -gt 120 ]]; then
    error "Frontend health check failed after 4 minutes.
  
Check application logs:
  docker-compose logs frontend"
  fi
  echo -n "."
  sleep 2
done
success "Frontend is ready"

# Ensure nginx is up after app services become healthy
if ! docker-compose ps nginx | grep -q "Up"; then
  info "Retrying Nginx startup now that app services are ready..."
  docker-compose up -d nginx
fi

# Host-nginx proxy configuration is applied after SSL setup, once cert files exist.

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
# nginx.conf expects these exact filenames
cp "ssl/live/${SITE_DOMAIN}/fullchain.pem" ssl/live/cert.pem 2>/dev/null || true
cp "ssl/live/${SITE_DOMAIN}/privkey.pem" ssl/live/key.pem 2>/dev/null || true

# If host-nginx proxy mode is enabled, configure host nginx to proxy domain to Docker nginx.
if [[ "$USE_HOST_NGINX_PROXY" == "yes" ]]; then
  info "Configuring host nginx reverse proxy for ${SITE_DOMAIN} -> 127.0.0.1:${HTTP_PORT}"
  HOST_NGINX_SITE="/etc/nginx/sites-available/astranodes-${SITE_DOMAIN}.conf"
  SSL_CERT_PATH="$(pwd)/ssl/live/cert.pem"
  SSL_KEY_PATH="$(pwd)/ssl/live/key.pem"

  cat > "$HOST_NGINX_SITE" <<EOF
server {
    listen 80;
    server_name ${SITE_DOMAIN} www.${SITE_DOMAIN};
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ${SITE_DOMAIN} www.${SITE_DOMAIN};

    ssl_certificate ${SSL_CERT_PATH};
    ssl_certificate_key ${SSL_KEY_PATH};

    location / {
        proxy_pass http://127.0.0.1:${HTTP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

  # Avoid default host nginx vhost taking precedence over the project domain.
  rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
  ln -sf "$HOST_NGINX_SITE" "/etc/nginx/sites-enabled/astranodes-${SITE_DOMAIN}.conf"
  if nginx -t >/dev/null 2>&1; then
    systemctl reload nginx
    success "Host nginx proxy enabled for ${SITE_DOMAIN}"
    HOST_PROXY_CONFIGURED="yes"
  else
    warn "Host nginx config test failed. Showing nginx -t output:"
    nginx -t || true
    HOST_PROXY_CONFIGURED="no"
  fi
fi

success "SSL certificate configured"

# Restart nginx with SSL
docker-compose restart nginx
sleep 3

# If host-nginx proxy mode failed, force a reliable fallback: stop host nginx and bind Docker nginx to 80/443.
if [[ "$USE_HOST_NGINX_PROXY" == "yes" && "$HOST_PROXY_CONFIGURED" != "yes" ]]; then
  warn "Host nginx proxy mode failed. Falling back to Docker nginx on standard ports 80/443."

  if command -v systemctl >/dev/null 2>&1; then
    systemctl stop nginx 2>/dev/null || true
    systemctl disable nginx 2>/dev/null || true
  fi

  HTTP_PORT="80"
  HTTPS_PORT="443"
  HOST_BIND="0.0.0.0"

  # Update compose env ports for immediate recreate
  cat > .env <<EOF
POSTGRES_USER=astra
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=astra
HTTP_PORT=${HTTP_PORT}
HTTPS_PORT=${HTTPS_PORT}
HOST_BIND=${HOST_BIND}
EOF

  docker-compose up -d --force-recreate nginx
  sleep 3
fi

# Nginx may be "health: starting" for a short time; wait up to 60s for it to be up
retries=0
while true; do
  if docker-compose ps nginx | tail -n +2 | grep -qE "Up|running"; then
    break
  fi
  retries=$((retries + 1))
  if [[ $retries -gt 30 ]]; then
    docker-compose logs nginx | tail -80
    error "Nginx failed to start after SSL setup. Check nginx logs above."
  fi
  sleep 2
done

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
if docker-compose ps nginx | tail -n +2 | grep -qE "Up|running"; then
  success "Nginx is running"
else
  error "Nginx is not running. Deployment cannot continue."
fi

# Detect if domain is being served by host Ubuntu nginx instead of container stack
if command -v curl >/dev/null 2>&1; then
  DOMAIN_SERVER_HEADER=$(curl -skI "https://${SITE_DOMAIN}" 2>/dev/null | grep -i '^server:' || true)
  if echo "$DOMAIN_SERVER_HEADER" | grep -qi 'nginx/1.18.0 (Ubuntu)'; then
    warn "${SITE_DOMAIN} is currently served by host Ubuntu nginx (${DOMAIN_SERVER_HEADER})."
    warn "If site returns 500, update host nginx vhost to reverse proxy to 127.0.0.1:${HTTP_PORT} or stop host nginx."
  fi
fi

# End-to-end reachability checks:
# 1) Strict local checks (reliable) to validate deployed stack.
# 2) Public-domain checks are informative warnings to avoid false failures during DNS/CDN propagation.
if command -v curl >/dev/null 2>&1; then
  info "Verifying local website endpoint through Nginx..."
  retries=0
  while ! curl -ksSf "http://127.0.0.1:${HTTP_PORT}/" >/dev/null 2>&1; do
    retries=$((retries + 1))
    if [[ $retries -gt 20 ]]; then
      docker-compose logs nginx | tail -80
      error "Local website check failed at http://127.0.0.1:${HTTP_PORT}/.

Check:
  docker-compose logs nginx
  docker-compose ps"
    fi
    sleep 2
  done
  success "Local website endpoint is reachable"

  info "Verifying local API health endpoint through Nginx..."
  retries=0
  while ! curl -ksSf "http://127.0.0.1:${HTTP_PORT}/api/health" >/dev/null 2>&1; do
    retries=$((retries + 1))
    if [[ $retries -gt 20 ]]; then
      docker-compose logs backend | tail -80
      docker-compose logs nginx | tail -80
      error "Local API health check failed at http://127.0.0.1:${HTTP_PORT}/api/health.

Check:
  docker-compose logs backend
  docker-compose logs nginx"
    fi
    sleep 2
  done
  success "Local API health endpoint is reachable"

  info "Checking public website URL..."
  if curl -ksSf "${FRONTEND_URL}" >/dev/null 2>&1; then
    success "Public website URL is reachable: ${FRONTEND_URL}"
  else
    warn "Public website URL check failed: ${FRONTEND_URL}"
    warn "Stack is running locally; domain may still be affected by DNS/CDN/host-proxy routing."
  fi

  info "Checking public API health URL..."
  if curl -ksSf "${FRONTEND_URL}/api/health" >/dev/null 2>&1; then
    success "Public API health URL is reachable"
  else
    warn "Public API health check failed: ${FRONTEND_URL}/api/health"
  fi

  if [[ "$USE_HOST_NGINX_PROXY" == "yes" ]]; then
    info "Verifying host nginx proxy path on loopback..."
    if curl -ksSf --resolve "${SITE_DOMAIN}:443:127.0.0.1" "https://${SITE_DOMAIN}/api/health" >/dev/null 2>&1; then
      success "Host nginx loopback proxy is reachable"
    else
      warn "Host nginx loopback proxy check failed for https://${SITE_DOMAIN}/api/health"
      warn "Run: nginx -t && systemctl status nginx --no-pager"
    fi
  fi
fi

# ═════════════════════════════════════════════════════════════════════════════
#  FINAL SUMMARY
# ═════════════════════════════════════════════════════════════════════════════

echo ""
echo -e "${BOLD}${GREEN}═══════════════════════════════════════════════════════${RESET}"
echo -e "${BOLD}${GREEN}  Deployment Complete!${RESET}"
echo -e "${BOLD}${GREEN}═══════════════════════════════════════════════════════${RESET}"
echo ""
echo -e "  ${BOLD}Website:${RESET}        ${FRONTEND_URL}"
echo -e "  ${BOLD}API Health:${RESET}     ${FRONTEND_URL}/api/health"
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
echo -e "   1. Visit ${FRONTEND_URL}"
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
