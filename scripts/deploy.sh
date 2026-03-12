#!/usr/bin/env bash
set -euo pipefail

# ── Configuration ──────────────────────────────────────────────────────────
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
HEALTH_URL="${HEALTH_URL:-http://localhost/health}"
HEALTH_RETRIES=10
HEALTH_DELAY=5

# ── Colors ─────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[DEPLOY]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()  { echo -e "${RED}[ERROR]${NC} $1"; }

# ── Pre-flight checks ─────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
    err "docker is not installed"; exit 1
fi

if [ ! -f "$COMPOSE_FILE" ]; then
    err "Compose file not found: $COMPOSE_FILE"; exit 1
fi

if [ ! -f "backend/.env" ]; then
    err "backend/.env not found. Copy from .env.example and configure."; exit 1
fi

# ── Step 1: Database backup ───────────────────────────────────────────────
log "Creating database backup..."
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/db-$(date +%Y%m%d-%H%M%S).sql.gz"

if docker compose -f "$COMPOSE_FILE" ps postgres --status running -q 2>/dev/null | grep -q .; then
    docker compose -f "$COMPOSE_FILE" exec -T postgres \
        pg_dump -U "${POSTGRES_USER:-astra}" "${POSTGRES_DB:-astra}" | gzip > "$BACKUP_FILE"
    log "Backup saved: $BACKUP_FILE"
else
    warn "Postgres not running, skipping backup"
fi

# ── Step 2: Pull / build images ───────────────────────────────────────────
log "Building images..."
docker compose -f "$COMPOSE_FILE" build --parallel

# ── Step 3: Run database migrations ───────────────────────────────────────
log "Running database migrations..."
docker compose -f "$COMPOSE_FILE" up -d postgres redis
sleep 5  # Wait for DB to be ready

docker compose -f "$COMPOSE_FILE" run --rm backend \
    npx prisma migrate deploy

# ── Step 4: Rolling restart ───────────────────────────────────────────────
log "Starting services..."
docker compose -f "$COMPOSE_FILE" up -d --no-deps backend
sleep 3
docker compose -f "$COMPOSE_FILE" up -d --no-deps frontend
sleep 3
docker compose -f "$COMPOSE_FILE" up -d --no-deps nginx

# ── Step 5: Health check ──────────────────────────────────────────────────
log "Waiting for health check..."
for i in $(seq 1 $HEALTH_RETRIES); do
    if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
        log "Health check passed!"
        break
    fi
    if [ "$i" -eq "$HEALTH_RETRIES" ]; then
        err "Health check failed after $HEALTH_RETRIES attempts"
        warn "Check logs: docker compose -f $COMPOSE_FILE logs --tail=50"
        exit 1
    fi
    log "Attempt $i/$HEALTH_RETRIES — retrying in ${HEALTH_DELAY}s..."
    sleep "$HEALTH_DELAY"
done

# ── Step 6: Cleanup old backups (keep last 10) ────────────────────────────
BACKUP_COUNT=$(find "$BACKUP_DIR" -name "db-*.sql.gz" | wc -l)
if [ "$BACKUP_COUNT" -gt 10 ]; then
    log "Cleaning old backups (keeping last 10)..."
    find "$BACKUP_DIR" -name "db-*.sql.gz" -printf '%T@ %p\n' | sort -n | head -n -10 | awk '{print $2}' | xargs rm -f
fi

log "Deployment complete!"
docker compose -f "$COMPOSE_FILE" ps
