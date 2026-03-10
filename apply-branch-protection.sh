#!/usr/bin/env bash
set -euo pipefail

OWNER="${1:-moredifferentx}"
REPO="${2:-astra}"
BRANCH="${3:-main}"

if ! command -v gh >/dev/null 2>&1; then
  echo "[BRANCH PROTECTION] GitHub CLI is required: https://cli.github.com/"
  exit 1
fi

echo "[BRANCH PROTECTION] Applying protection to ${OWNER}/${REPO}:${BRANCH}"

gh api -X PUT "repos/${OWNER}/${REPO}/branches/${BRANCH}/protection" --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "checks": [
      { "context": "backend-ci / test-and-verify-postgres" }
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "require_last_push_approval": false
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_linear_history": false,
  "lock_branch": false,
  "allow_fork_syncing": true
}
JSON

echo "[BRANCH PROTECTION] Done"
