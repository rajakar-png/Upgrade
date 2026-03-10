#!/usr/bin/env bash
set -euo pipefail

if command -v pm2 >/dev/null 2>&1; then
  if pm2 describe astranodes-backend >/dev/null 2>&1; then
    pm2 reload astranodes-backend
    echo "[RESTART] Reloaded pm2 process: astranodes-backend"
    exit 0
  fi
fi

if command -v systemctl >/dev/null 2>&1; then
  if systemctl list-unit-files | grep -q '^astranodes-backend\.service'; then
    sudo systemctl restart astranodes-backend
    echo "[RESTART] Restarted systemd service: astranodes-backend"
    exit 0
  fi
fi

echo "[RESTART] No managed backend service found."
echo "[RESTART] Use one of the following:"
echo "  1) pm2 start src/server.js --name astranodes-backend && pm2 save"
echo "  2) npm start"
exit 1
