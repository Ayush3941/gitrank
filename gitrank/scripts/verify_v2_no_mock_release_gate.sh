#!/usr/bin/env sh
set -eu

root_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
repo_dir="$(CDPATH= cd -- "$root_dir/.." && pwd)"

fail() {
  echo "v2 no-mock release gate failed: $1" >&2
  exit 1
}

require_contains() {
  file="$1"
  needle="$2"
  description="$3"
  if ! grep -Fq "$needle" "$file"; then
    fail "$description missing from $file"
  fi
}

if [ ! -d "$repo_dir/frontend/node_modules" ]; then
  fail "frontend dependencies are missing; run npm ci in frontend before the release gate"
fi
(cd "$repo_dir/frontend" && npm run check:no-production-mocks)

openapi="$root_dir/docs/openapi.yaml"
for path in \
  "  /v1/sync:" \
  "  /v1/sync/repository/execute:" \
  "  /v1/sync/installation/execute:" \
  "  /v1/me/quests:" \
  "  /v1/pr/{owner}/{repo}/{number}/report:" \
  "  /v1/me/account/export:" \
  "  /v1/leaderboard:"; do
  require_contains "$openapi" "$path" "critical production route OpenAPI entry"
done

critical_flows="$root_dir/scripts/test_critical_path_flows.sh"
for test_name in \
  "ExecutorSyncUserFetchesOwnedRepositoriesAndAuthoredPullRequests" \
  "ExecutorSyncPullRequestFetchesAndPersistsBoundedPullRequestData" \
  "ReplayUserPersistsLedgerAndSnapshot" \
  "RefreshProfileByUserIDPersistsFreshSnapshot" \
  "RunNextExecutesProfileRefreshJobAndCompletes" \
  "RunNextExecutesPullRequestGradeJobAndCompletes" \
  "PublicResponseFiltersHiddenRepositories"; do
  require_contains "$critical_flows" "$test_name" "critical worker/profile flow verification"
done

frontend_smoke="$repo_dir/frontend/tests/live-fixture-render.test.tsx"
for smoke_name in \
  "renders dashboard from profile and quest BFF fixtures" \
  "renders PR battle report from the live PR report fixture route" \
  "renders leaderboard from the live leaderboard fixture route" \
  "renders settings from the authenticated profile fixture"; do
  require_contains "$frontend_smoke" "$smoke_name" "live fixture smoke coverage"
done

echo "v2 no-mock release gate passed"
