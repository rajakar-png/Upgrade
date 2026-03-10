# Staging Rollout Checklist (Postgres)

This checklist executes the 1-3 production-hardening path safely on staging first.

## 1) Apply migration + restart + smoke checks

1. Update code on staging host.
2. Run the full predeploy sequence from `backend/`:
   - npm run predeploy-rollout

Equivalent expanded steps:
- npm run backup-postgres
- npm run migrate-up
- npm run restart-service
- npm run smoke-check

## 2) Merge policy and CI enforcement

1. Open a pull request for every backend change.
2. Require GitHub Actions workflow backend-ci to pass before merge.
3. Disallow direct pushes to main through branch protection rules.
4. Apply branch protection (GitHub CLI example):
    - gh api -X PUT repos/moredifferentx/astra/branches/main/protection --input - <<'JSON'
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
5. Or run the repo helper from project root:
    - bash apply-branch-protection.sh

Minimum required status checks:
- backend-ci / test-and-verify-postgres

## 3) Pre-production cutover snapshot

Immediately before production switch:

1. On production host:
   - cd backend
   - npm run backup-postgres
2. Save the output backup path and timestamp in your deploy notes.
3. Proceed with:
   - npm run migrate-up
   - service restart
   - npm run smoke-check

## Rollback note

If a release must be reverted:

1. Roll back app code to previous release.
2. Optionally roll back the latest schema migration:
   - npm run migrate-down
3. Restore latest SQL backup if required.
