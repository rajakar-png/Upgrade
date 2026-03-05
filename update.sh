#!/usr/bin/env bash
# =============================================================================
#  AstraNodes — Production Update Script
#  Run after deploying to apply code changes without losing your data.
#
#  Usage:  bash update.sh
#  What it does:
#    1. Pulls latest code from git
#    2. Syncs code to install directory (preserves .env, data, uploads)
#    3. Installs/updates backend + frontend dependencies
#    4. Runs ALL database migrations (safe — idempotent)
#    5. Rebuilds the React frontend
#    6. Copies frontend bundle to Nginx web root
#    7. Updates PM2 ecosystem config (cwd path)
#    8. Gracefully restarts the API via PM2
#    9. Reloads Nginx
#
#  Your database, .env files, and uploads are NEVER touched.
# =============================================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'
info()    { echo -e "${CYAN}[INFO]${RESET}  $*"; }
success() { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
err()     { echo -e "${RED}[ERROR]${RESET} $*" >&2; exit 1; }
header()  { echo -e "\n${BOLD}${CYAN}══ $* ══${RESET}"; }

# ── Banner ───────────────────────────────────────────────────────────────────
clear
echo -e "${BOLD}${CYAN}"
echo "  ╔═══════════════════════════════════════════╗"
echo "  ║      AstraNodes — Update Script           ║"
echo "  ╚═══════════════════════════════════════════╝"
echo -e "${RESET}"

# ── Resolve install directory ────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_FILE="${HOME}/.astranodes-deploy.conf"
DOMAIN=""

USE_CLOUDFLARE=""
USE_WWW=""
APP_PORT=""

if [[ -f "$CONFIG_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$CONFIG_FILE"
  APP_DIR="${APP_DIR:-/opt/astranodes}"
  DOMAIN="${DOMAIN:-}"
  USE_CLOUDFLARE="${USE_CLOUDFLARE:-no}"
  USE_WWW="${USE_WWW:-no}"
  APP_PORT="${APP_PORT:-4000}"
elif [[ -f "${SCRIPT_DIR}/backend/package.json" ]]; then
  APP_DIR="$SCRIPT_DIR"
else
  APP_DIR="/opt/astranodes"
fi

info "Install directory: ${APP_DIR}"
[[ -n "$DOMAIN" ]] && info "Domain: ${DOMAIN}"
[[ "$USE_CLOUDFLARE" == "yes" ]] && info "SSL mode: Cloudflare origin certificate" || info "SSL mode: Let's Encrypt"

[[ -d "$APP_DIR" ]] || err "App directory not found: ${APP_DIR}. Run deploy.sh first."
[[ -f "${APP_DIR}/backend/package.json" ]] || err "Backend not found at ${APP_DIR}/backend. Run deploy.sh first."
[[ -f "${APP_DIR}/backend/.env" ]] || err "Backend .env not found at ${APP_DIR}/backend/.env — API will not start. Run deploy.sh first."

# ── Pre-flight: Verify Node.js & PM2 ─────────────────────────────────────────
header "Pre-flight checks"

# Ensure Node.js >= 18 (required for ES modules, top-level await, etc.)
if command -v node &>/dev/null; then
  NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
  if [[ "$NODE_VER" -lt 18 ]]; then
    err "Node.js v18+ is required (found v${NODE_VER}). Please upgrade Node.js first."
  fi
  success "Node.js $(node -v) detected"
else
  err "Node.js not found. Install Node.js 18+ before running this script."
fi

# Ensure npm is available
command -v npm &>/dev/null || err "npm not found. Install Node.js 18+ before running this script."

# Warn if PM2 is not installed (non-fatal — user may manage process differently)
if ! command -v pm2 &>/dev/null; then
  warn "PM2 not found globally. Install with: npm install -g pm2"
  warn "The API will not be restarted automatically."
else
  success "PM2 $(pm2 -v 2>/dev/null || echo '?') detected"
fi

# ── Pre-flight: Backup database ──────────────────────────────────────────────
header "Backing up database"

DB_PATH="${DB_PATH:-${APP_DIR}/backend/data/astranodes.sqlite}"
if [[ -f "$DB_PATH" ]]; then
  BACKUP_DIR="${APP_DIR}/backend/data/backups"
  mkdir -p "$BACKUP_DIR"
  BACKUP_FILE="${BACKUP_DIR}/astranodes-$(date +%Y%m%d-%H%M%S).sqlite"
  cp "$DB_PATH" "$BACKUP_FILE"
  success "Database backed up to ${BACKUP_FILE}"
  # Keep only the last 5 backups
  ls -t "${BACKUP_DIR}"/astranodes-*.sqlite 2>/dev/null | tail -n +6 | xargs rm -f 2>/dev/null || true
else
  warn "No database found at ${DB_PATH} — skipping backup."
fi

# ── Git pull ─────────────────────────────────────────────────────────────────
header "Pulling latest code"

REPO_DIR="$SCRIPT_DIR"

if [[ -d "${REPO_DIR}/.git" ]]; then
  git -C "$REPO_DIR" fetch --all
  # Try fast-forward; fall back to merge if there are local commits
  if git -C "$REPO_DIR" pull --ff-only 2>/dev/null; then
    success "Code pulled (fast-forward) in ${REPO_DIR}"
  elif git -C "$REPO_DIR" pull --no-edit 2>/dev/null; then
    success "Code pulled (merge) in ${REPO_DIR}"
  else
    warn "git pull failed — continuing with existing code."
  fi
elif [[ -d "${APP_DIR}/.git" ]]; then
  REPO_DIR="$APP_DIR"
  git -C "$REPO_DIR" fetch --all
  git -C "$REPO_DIR" pull --ff-only || warn "git pull failed — continuing with existing code."
  success "Code pulled in ${REPO_DIR}"
else
  warn "No .git directory found in ${REPO_DIR} or ${APP_DIR} — skipping git pull."
fi

# ── Sync code to APP_DIR ─────────────────────────────────────────────────────
if [[ "$REPO_DIR" != "$APP_DIR" && -d "$REPO_DIR/backend" ]]; then
  header "Syncing code to install directory"
  rsync -a \
    --exclude='.git' \
    --exclude='backend/.env' \
    --exclude='backend/.env.*' \
    --exclude='backend/data/' \
    --exclude='backend/uploads/' \
    --exclude='backend/public/uploads/' \
    --exclude='backend/node_modules/' \
    --exclude='frontend/.env' \
    --exclude='frontend/.env.*' \
    --exclude='frontend/node_modules/' \
    --exclude='frontend/dist/' \
    --exclude='ecosystem.production.config.cjs' \
    "${REPO_DIR}/" "${APP_DIR}/"
  success "Code synced from ${REPO_DIR} → ${APP_DIR}"
fi

# ── Ensure required directories exist ─────────────────────────────────────────
header "Ensuring required directories"
mkdir -p "${APP_DIR}/backend/data"
mkdir -p "${APP_DIR}/backend/public/uploads/tickets"
mkdir -p /var/log/pm2 2>/dev/null || true
success "Directories verified"

# ── Backend dependencies ─────────────────────────────────────────────────────
header "Updating backend dependencies"
npm --prefix "${APP_DIR}/backend" install --omit=dev --quiet 2>&1 || {
  warn "npm install had warnings — retrying with full output..."
  npm --prefix "${APP_DIR}/backend" install --omit=dev
}
success "Backend dependencies updated"

# ── Database migrations ──────────────────────────────────────────────────────
header "Running database migrations"
info "Migrations are idempotent — safe to run on existing data."

MIGRATE_SCRIPTS=(
  migrate
  migrate-icons
  migrate-duration
  migrate-tickets
  upgrade-tickets
  migrate-frontpage
  migrate-oauth
)

MIGRATE_FAILED=0
for script in "${MIGRATE_SCRIPTS[@]}"; do
  if npm --prefix "${APP_DIR}/backend" run --if-present "$script" 2>&1; then
    success "${script} OK"
  else
    warn "${script} reported errors (may be safe — already applied)"
    MIGRATE_FAILED=$((MIGRATE_FAILED + 1))
  fi
done

if [[ $MIGRATE_FAILED -gt 0 ]]; then
  warn "${MIGRATE_FAILED} migration(s) had warnings — likely already applied."
fi

# ── Frontend dependencies ────────────────────────────────────────────────────
header "Updating frontend dependencies"
npm --prefix "${APP_DIR}/frontend" install --quiet 2>&1 || {
  warn "npm install had warnings — retrying with full output..."
  npm --prefix "${APP_DIR}/frontend" install
}
success "Frontend dependencies updated"

# ── Frontend build ───────────────────────────────────────────────────────────
header "Building React frontend"

# Ensure .env.production exists (required for VITE_API_URL / VITE_SOCKET_URL)
FRONTEND_ENV="${APP_DIR}/frontend/.env.production"
if [[ ! -f "$FRONTEND_ENV" ]]; then
  if [[ -n "$DOMAIN" ]]; then
    cat > "$FRONTEND_ENV" <<EOF
VITE_API_URL=https://${DOMAIN}/api
VITE_SOCKET_URL=https://${DOMAIN}
EOF
    success "Created frontend/.env.production (domain: ${DOMAIN})"
  else
    warn "frontend/.env.production missing and DOMAIN not found in config."
    warn "Frontend may use wrong API URL. Create it manually or re-run deploy.sh."
  fi
fi

npm --prefix "${APP_DIR}/frontend" run build || err "Frontend build failed! Check for compile errors."
success "Frontend built → ${APP_DIR}/frontend/dist"

# ── Copy frontend to web root ────────────────────────────────────────────────
WEB_ROOT="/var/www/astranodes"
if [[ -d "$WEB_ROOT" ]]; then
  rsync -a --delete "${APP_DIR}/frontend/dist/" "${WEB_ROOT}/"
  success "Frontend copied to ${WEB_ROOT}"
else
  mkdir -p "$WEB_ROOT"
  rsync -a --delete "${APP_DIR}/frontend/dist/" "${WEB_ROOT}/"
  success "Created ${WEB_ROOT} and copied frontend"
fi

# ── Update ecosystem config ──────────────────────────────────────────────────
# Use ecosystem.production.config.cjs (deploy.sh generates this; gitignored).
# Fall back to ecosystem.config.cjs (tracked template) if production file doesn't exist.
ECOSYSTEM="${APP_DIR}/ecosystem.production.config.cjs"
if [[ ! -f "$ECOSYSTEM" ]]; then
  # Production file not found — check for the template and create production copy
  if [[ -f "${APP_DIR}/ecosystem.config.cjs" ]]; then
    cp "${APP_DIR}/ecosystem.config.cjs" "$ECOSYSTEM"
    info "Created ecosystem.production.config.cjs from template"
  else
    ECOSYSTEM="${APP_DIR}/ecosystem.config.cjs"
    warn "No ecosystem.production.config.cjs found — using template"
  fi
fi

if [[ -f "$ECOSYSTEM" ]] && grep -q 'cwd:' "$ECOSYSTEM"; then
  sed -i "s|cwd:.*|cwd: \"${APP_DIR}/backend\",|" "$ECOSYSTEM"
  success "$(basename "$ECOSYSTEM") cwd updated to ${APP_DIR}/backend"
fi

# ── Restart API ──────────────────────────────────────────────────────────────
header "Restarting API"

if command -v pm2 &>/dev/null; then
  if pm2 list | grep -q "astranodes-api"; then
    pm2 reload astranodes-api --update-env
    success "API reloaded via PM2 (zero-downtime)"
  else
    warn "pm2 process 'astranodes-api' not found — starting fresh"
    cd "$APP_DIR"
    pm2 start "$ECOSYSTEM" --env production
    pm2 save
    success "API started with PM2"
  fi
else
  warn "PM2 not installed — restart your API manually."
fi

# ── Refresh Nginx config & SSL ───────────────────────────────────────────────
if command -v nginx &>/dev/null && [[ -n "$DOMAIN" ]] && [[ -n "$APP_PORT" ]]; then
  header "Refreshing Nginx configuration"

  WEB_ROOT="/var/www/astranodes"
  NGINX_CONF="/etc/nginx/sites-available/astranodes"

  if [[ "$USE_CLOUDFLARE" == "yes" ]]; then
    # ── Cloudflare mode: ensure origin cert exists & refresh Nginx config ──
    SSL_DIR="/etc/ssl/astranodes"
    mkdir -p "$SSL_DIR"

    # Check / renew self-signed origin cert (regenerate if missing or expiring within 30 days)
    if [[ ! -f "${SSL_DIR}/origin.pem" ]] || \
       ! openssl x509 -checkend 2592000 -noout -in "${SSL_DIR}/origin.pem" 2>/dev/null; then
      info "Generating / renewing self-signed origin certificate (Cloudflare mode)..."
      openssl req -x509 -nodes -days 3650 \
        -newkey rsa:2048 \
        -keyout "${SSL_DIR}/origin.key" \
        -out    "${SSL_DIR}/origin.pem" \
        -subj   "/CN=${DOMAIN}" \
        -addext "subjectAltName=DNS:${DOMAIN},DNS:*.${DOMAIN}" 2>/dev/null
      chmod 600 "${SSL_DIR}/origin.key"
      success "Origin cert created / renewed (valid 10 years)"
    else
      success "Origin cert still valid"
    fi

    # Regenerate Nginx config for Cloudflare SSL
    cat > "$NGINX_CONF" <<NGINXCONF
# AstraNodes — Nginx config for ${DOMAIN} (Cloudflare Origin)
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DOMAIN};

    ssl_certificate     ${SSL_DIR}/origin.pem;
    ssl_certificate_key ${SSL_DIR}/origin.key;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    # ── API reverse proxy ──────────────────────────────────────────────────
    location /api/ {
        proxy_pass         http://127.0.0.1:${APP_PORT}/api/;
        proxy_http_version 1.1;
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
        client_max_body_size 10M;
    }

    # ── Socket.io ──────────────────────────────────────────────────────────
    location /socket.io/ {
        proxy_pass         http://127.0.0.1:${APP_PORT}/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade    \$http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host       \$host;
        proxy_set_header   X-Real-IP  \$remote_addr;
        proxy_read_timeout 86400s;
    }

    # ── Uploaded files ─────────────────────────────────────────────────────
    # ^~ gives this prefix match priority over the static-asset regex below,
    # so /uploads/favicon.png is proxied to the backend (not served from root).
    location ^~ /uploads/ {
        proxy_pass       http://127.0.0.1:${APP_PORT}/uploads/;
        proxy_set_header Host \$host;
    }

    # ── Block direct access to SQLite DB ──────────────────────────────────
    location ~* \.sqlite3?\$ {
        deny all;
    }

    # ── Security headers ──────────────────────────────────────────────────
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # ── React SPA (frontend) ──────────────────────────────────────────────
    root  ${WEB_ROOT};
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2|woff|ttf|eot)\$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }
}
NGINXCONF

    ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/astranodes
    success "Nginx config refreshed (Cloudflare SSL)"

  else
    # ── Let's Encrypt mode: don't overwrite certbot-managed config ──
    # Certbot manages the Nginx config in this mode; just reload.
    info "Let's Encrypt mode — Nginx config managed by certbot (not overwritten)"

    # Patch /uploads/ location to use ^~ prefix if not already done.
    # This ensures uploaded assets (favicon, logo, background) are proxied to
    # the backend instead of being matched by the static-asset caching regex.
    if grep -q 'location /uploads/' "$NGINX_CONF" 2>/dev/null; then
      sed -i 's|location /uploads/|location ^~ /uploads/|g' "$NGINX_CONF"
      success "Patched /uploads/ location with ^~ prefix in existing Nginx config"
    fi
  fi

  # Validate and reload
  if nginx -t 2>/dev/null; then
    systemctl reload nginx
    success "Nginx reloaded"
  else
    warn "Nginx config test failed — not reloading. Run 'nginx -t' to diagnose."
  fi
else
  # Nginx not installed or domain/port unknown — try a simple reload
  if command -v nginx &>/dev/null && systemctl is-active --quiet nginx; then
    if nginx -t 2>/dev/null; then
      systemctl reload nginx
      success "Nginx reloaded"
    else
      warn "Nginx config test failed — not reloading. Run 'nginx -t' to diagnose."
    fi
  fi
fi

# ── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}═══════════════════════════════════════════${RESET}"
echo -e "${BOLD}${GREEN}  Update complete!${RESET}"
echo -e "${BOLD}${GREEN}═══════════════════════════════════════════${RESET}"
echo ""
[[ -n "$DOMAIN" ]] && echo -e "  ${BOLD}Site:${RESET}      https://${DOMAIN}"
echo -e "  ${BOLD}API logs:${RESET}  pm2 logs astranodes-api --lines 50"
echo -e "  ${BOLD}Status:${RESET}    pm2 status"
[[ -n "$DOMAIN" ]] && echo -e "  ${BOLD}Health:${RESET}    curl -s https://${DOMAIN}/api/health"
echo ""
echo -e "  ${CYAN}Tip:${RESET} If you changed backend/.env variables, restart with: pm2 restart astranodes-api --update-env"
echo ""

# ── Post-update health check ──────────────────────────────────────────────────
if command -v pm2 &>/dev/null && pm2 list 2>/dev/null | grep -q "astranodes-api"; then
  sleep 3
  if pm2 list 2>/dev/null | grep -q "online"; then
    success "API process is online"
  else
    warn "API process may not be running correctly. Check: pm2 logs astranodes-api"
  fi
fi

if [[ -n "$DOMAIN" ]]; then
  API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "https://${DOMAIN}/api/health" 2>/dev/null || echo "000")
  if [[ "$API_STATUS" == "200" ]]; then
    success "Health check passed (HTTP ${API_STATUS})"
  elif [[ "$API_STATUS" == "000" ]]; then
    warn "Health check timed out — API may still be starting up."
  else
    warn "Health check returned HTTP ${API_STATUS} — check API logs."
  fi
fi
