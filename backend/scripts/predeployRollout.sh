#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: bash scripts/predeployRollout.sh [--skip-restart]

Runs the standard predeploy sequence:
1) backup-postgres
2) migrate-up
3) restart-service (unless --skip-restart)
4) smoke-check
EOF
}

SKIP_RESTART="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-restart)
      SKIP_RESTART="true"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[ROLLOUT] Unknown argument: $1"
      usage
      exit 1
      ;;
  esac
done

echo "[ROLLOUT] Starting predeploy sequence"

echo "[ROLLOUT] Step 1/4: backup-postgres"
npm run backup-postgres

echo "[ROLLOUT] Step 2/4: migrate-up"
npm run migrate-up

if [[ "$SKIP_RESTART" == "true" ]]; then
  echo "[ROLLOUT] Step 3/4: restart-service skipped (--skip-restart)"
else
  echo "[ROLLOUT] Step 3/4: restart-service"
  npm run restart-service
fi

echo "[ROLLOUT] Step 4/4: smoke-check"
npm run smoke-check

echo "[ROLLOUT] Predeploy sequence completed successfully"
