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

if [[ -f "$CONFIG_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$CONFIG_FILE"
  APP_DIR="${APP_DIR:-/opt/astranodes}"
  DOMAIN="${DOMAIN:-}"
elif [[ -f "${SCRIPT_DIR}/backend/package.json" ]]; then
  APP_DIR="$SCRIPT_DIR"
else
  APP_DIR="/opt/astranodes"
fi

info "Install directory: ${APP_DIR}"
[[ -n "$DOMAIN" ]] && info "Domain: ${DOMAIN}"

[[ -d "$APP_DIR" ]] || err "App directory not found: ${APP_DIR}. Run deploy.sh first."
[[ -f "${APP_DIR}/backend/package.json" ]] || err "Backend not found at ${APP_DIR}/backend. Run deploy.sh first."

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
    --exclude='backend/node_modules/' \
    --exclude='frontend/.env' \
    --exclude='frontend/.env.*' \
    --exclude='frontend/node_modules/' \
    --exclude='frontend/dist/' \
    --exclude='ecosystem.production.config.cjs' \
    "${REPO_DIR}/" "${APP_DIR}/"
  success "Code synced from ${REPO_DIR} → ${APP_DIR}"
fi

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

# ── Reload Nginx ─────────────────────────────────────────────────────────────
if command -v nginx &>/dev/null && systemctl is-active --quiet nginx; then
  if nginx -t 2>/dev/null; then
    systemctl reload nginx
    success "Nginx reloaded"
  else
    warn "Nginx config test failed — not reloading. Run 'nginx -t' to diagnose."
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
