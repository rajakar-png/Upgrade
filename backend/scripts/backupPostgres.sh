#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${BACKEND_DIR}/.env"

if [[ -z "${DATABASE_URL:-}" && -f "$ENV_FILE" ]]; then
  DATABASE_URL="$(grep -E '^DATABASE_URL=' "$ENV_FILE" | tail -n1 | cut -d'=' -f2-)"
fi

: "${DATABASE_URL:?DATABASE_URL is required (export it or define it in backend/.env)}"

BACKUP_DIR="${BACKUP_DIR:-${BACKEND_DIR}/data/backups}"
mkdir -p "$BACKUP_DIR"

STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_FILE="${BACKUP_DIR}/astranodes-predeploy-${STAMP}.sql"

if command -v pg_dump >/dev/null 2>&1; then
  pg_dump "$DATABASE_URL" > "$OUT_FILE"
  echo "[PG BACKUP] Backup created: ${OUT_FILE}"
  exit 0
fi

# Fallback: use pg_dump from local docker postgres container if available.
if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -qx "astranodes-postgres"; then
  DB_USER="$(node -e 'const u=new URL(process.argv[1]); console.log(decodeURIComponent(u.username||"postgres"))' "$DATABASE_URL")"
  DB_NAME="$(node -e 'const u=new URL(process.argv[1]); console.log((u.pathname||"/astranodes").replace(/^\//,"")||"astranodes")' "$DATABASE_URL")"
  DB_HOST="$(node -e 'const u=new URL(process.argv[1]); console.log((u.hostname||"localhost"))' "$DATABASE_URL")"

  if [[ "$DB_HOST" == "localhost" || "$DB_HOST" == "127.0.0.1" ]]; then
    docker exec -i astranodes-postgres pg_dump -U "$DB_USER" "$DB_NAME" > "$OUT_FILE"
    echo "[PG BACKUP] Backup created via docker container: ${OUT_FILE}"
    exit 0
  fi
fi

echo "[PG BACKUP] pg_dump is not installed and docker fallback is unavailable."
echo "[PG BACKUP] Install client tools: sudo apt-get update && sudo apt-get install -y postgresql-client"
exit 1
