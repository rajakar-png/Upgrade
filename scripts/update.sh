#!/usr/bin/env bash

set -euo pipefail

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
header()  { echo -e "\n${BOLD}${CYAN}== $* ==${RESET}"; }

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR" || exit 1

SKIP_GIT="no"
if [[ "${1:-}" == "--skip-git" ]]; then
  SKIP_GIT="yes"
fi

docker-compose() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    docker compose "$@"
  elif command -v docker-compose >/dev/null 2>&1; then
    command docker-compose "$@"
  else
    error "Docker Compose is not available. Install docker compose or docker-compose first."
  fi
}

wait_for_postgres() {
  local retries=0
  while ! docker-compose exec -T postgres pg_isready -U "${POSTGRES_USER:-astra}" >/dev/null 2>&1; do
    retries=$((retries + 1))
    if [[ $retries -gt 45 ]]; then
      error "PostgreSQL did not become ready in time. Check: docker compose logs postgres"
    fi
    sleep 2
  done
}

wait_for_redis() {
  local retries=0
  while ! docker-compose exec -T redis redis-cli ping >/dev/null 2>&1; do
    retries=$((retries + 1))
    if [[ $retries -gt 45 ]]; then
      error "Redis did not become ready in time. Check: docker compose logs redis"
    fi
    sleep 2
  done
}

resolve_db_admin_role() {
  local candidate
  for candidate in "${POSTGRES_USER:-astra}" astra postgres; do
    if docker-compose exec -T postgres psql -U "$candidate" -d postgres -c "SELECT 1" >/dev/null 2>&1; then
      echo "$candidate"
      return 0
    fi
  done

  for candidate in "${POSTGRES_USER:-astra}" astra postgres; do
    if docker-compose exec -T postgres psql -U "$candidate" -d template1 -c "SELECT 1" >/dev/null 2>&1; then
      echo "$candidate"
      return 0
    fi
  done

  return 1
}

reconcile_postgres_credentials() {
  local admin_role="$1"
  local target_role="$2"
  local target_db="$3"

  [[ "$target_role" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]] || error "POSTGRES_USER has invalid format: $target_role"
  [[ "$target_db" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]] || error "POSTGRES_DB has invalid format: $target_db"

  local escaped_db_pass
  escaped_db_pass=$(printf "%s" "$POSTGRES_PASSWORD" | sed "s/'/''/g")

  docker-compose exec -T postgres psql -U "$admin_role" -d postgres -v ON_ERROR_STOP=1 <<SQL
SELECT 'CREATE ROLE ${target_role} LOGIN PASSWORD ''' || '${escaped_db_pass}' || ''''
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${target_role}')\gexec
ALTER ROLE ${target_role} WITH LOGIN PASSWORD '${escaped_db_pass}';
SELECT 'CREATE DATABASE ${target_db} OWNER ${target_role}'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = '${target_db}')\gexec
GRANT ALL PRIVILEGES ON DATABASE ${target_db} TO ${target_role};
SQL
}

header "AstraNodes Safe Update"

[[ -f .env ]] || error "Missing root .env file at $ROOT_DIR/.env"
[[ -f backend/.env ]] || error "Missing backend/.env file"
[[ -f docker-compose.yml ]] || error "Missing docker-compose.yml file"

# shellcheck disable=SC1091
set -a
source ./.env
set +a

POSTGRES_USER="${POSTGRES_USER:-astra}"
POSTGRES_DB="${POSTGRES_DB:-astra}"

if [[ -z "${POSTGRES_PASSWORD:-}" ]]; then
  error "POSTGRES_PASSWORD is missing in .env"
fi

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="backend/data/backups"
BACKUP_FILE="${BACKUP_DIR}/postgres_${POSTGRES_DB}_${TIMESTAMP}.sql.gz"
FULL_BACKUP_FILE="${BACKUP_DIR}/postgres_cluster_${TIMESTAMP}.sql.gz"
UPLOADS_BACKUP_FILE="${BACKUP_DIR}/uploads_${TIMESTAMP}.tar.gz"
ENV_BACKUP_DIR="${BACKUP_DIR}/env_${TIMESTAMP}"
DB_ADMIN_ROLE=""

header "1/8 Prepare Database Access"
mkdir -p "$BACKUP_DIR"

info "Ensuring PostgreSQL container is running..."
docker-compose up -d postgres >/dev/null
wait_for_postgres

DB_ADMIN_ROLE="$(resolve_db_admin_role || true)"
[[ -n "$DB_ADMIN_ROLE" ]] || error "Unable to detect PostgreSQL admin role. Check: docker compose logs postgres"
success "PostgreSQL ready (admin role detected: ${DB_ADMIN_ROLE})"

header "2/8 Backup PostgreSQL"

info "Creating backup at ${BACKUP_FILE}"
docker-compose exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-acl \
  | gzip > "$BACKUP_FILE"

info "Creating full cluster fallback backup at ${FULL_BACKUP_FILE}"
docker-compose exec -T postgres pg_dumpall -U "$DB_ADMIN_ROLE" | gzip > "$FULL_BACKUP_FILE"

success "Database backup completed"

header "3/8 Backup Uploads and Env Files"
info "Backing up uploads volume to ${UPLOADS_BACKUP_FILE}"
docker-compose run --rm --no-deps backend sh -lc 'mkdir -p /tmp/uploads && tar -czf - -C /app/uploads .' > "$UPLOADS_BACKUP_FILE"

mkdir -p "$ENV_BACKUP_DIR"
cp -f .env "$ENV_BACKUP_DIR/.env"
cp -f backend/.env "$ENV_BACKUP_DIR/backend.env"
success "Uploads and environment backups completed"

header "4/8 Pull Latest Code"
if [[ "$SKIP_GIT" == "yes" ]]; then
  warn "Skipping git pull because --skip-git was provided"
elif command -v git >/dev/null 2>&1; then
  CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")"
  if [[ -n "$CURRENT_BRANCH" ]]; then
    info "Updating branch ${CURRENT_BRANCH}"
    git fetch --all --prune
    git pull --rebase --autostash
    success "Repository updated"
  else
    warn "Git branch could not be detected. Skipping git pull."
  fi
else
  warn "Git not found. Skipping git pull."
fi

header "5/8 Pull and Build Images"
docker-compose pull
docker-compose build backend frontend nginx
success "Docker images are ready"

header "6/8 Start Core Services"
docker-compose up -d postgres redis
wait_for_postgres
wait_for_redis
success "PostgreSQL and Redis are running"

header "7/8 Reconcile Database Credentials"
info "Ensuring role/database credentials are synchronized without touching existing data"
reconcile_postgres_credentials "$DB_ADMIN_ROLE" "$POSTGRES_USER" "$POSTGRES_DB"
success "PostgreSQL credentials synchronized"

header "8/8 Apply Database Migrations and Restart Stack"
if ! docker-compose run --rm --no-deps backend npm run prisma:migrate; then
  warn "First migration attempt failed. Retrying once..."
  docker-compose run --rm --no-deps backend npm run prisma:migrate
fi
success "Prisma migrations applied"

docker-compose up -d --remove-orphans

HTTP_PORT="${HTTP_PORT:-80}"
info "Checking API health through nginx on http://127.0.0.1:${HTTP_PORT}/api/health"
if command -v curl >/dev/null 2>&1 && curl -fsS "http://127.0.0.1:${HTTP_PORT}/api/health" >/dev/null 2>&1; then
  success "API health check passed"
else
  warn "API health check did not pass immediately. Inspect with: docker compose logs --tail=100 backend nginx"
fi

echo ""
success "Update complete without deleting Docker volumes."
echo "Backup file: ${BACKUP_FILE}"
echo "Full cluster backup: ${FULL_BACKUP_FILE}"
echo "Uploads backup: ${UPLOADS_BACKUP_FILE}"
echo "Env backup dir: ${ENV_BACKUP_DIR}"
echo "To restore: gunzip -c ${BACKUP_FILE} | docker compose exec -T -e PGPASSWORD=\"${POSTGRES_PASSWORD}\" postgres psql -U ${POSTGRES_USER} -d ${POSTGRES_DB}"
echo "To restore uploads: docker compose run --rm --no-deps backend sh -lc 'rm -rf /app/uploads/* && tar -xzf - -C /app/uploads' < ${UPLOADS_BACKUP_FILE}"
