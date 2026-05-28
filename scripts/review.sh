#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

printf '[review.sh] running repo sync checks\n'
"$ROOT_DIR/scripts/check-repo-sync.sh"

printf '[review.sh] running targeted backend sync-state tests\n'
(
  cd "$ROOT_DIR/gitrank"
  go test ./services/github-ingestor/internal/service -run 'TestSyncFailureFetchedMetrics|TestUserSyncExecutionStatus'
)

printf '[review.sh] running targeted frontend sync-state tests\n'
(
  cd "$ROOT_DIR/frontend"
  npx vitest run \
    tests/sync-evidence.test.ts \
    tests/sync-runs-filter-normalization.test.ts \
    tests/account-api-sync-runs-normalization.test.ts \
    tests/sync-run-metrics-policy.test.ts \
    tests/sync-run-diagnostics.test.ts
)

printf '[review.sh] done\n'
