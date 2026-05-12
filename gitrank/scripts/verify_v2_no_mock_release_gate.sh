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
  "  /v1/profile/users/{user_id}/pr-reports/backfill:" \
  "  /v1/pr/{owner}/{repo}/{number}/report:" \
  "  /v1/pr/{owner}/{repo}/{number}/report/materialize:" \
  "  /v1/me/account/export:" \
  "  /v1/leaderboard:" \
  "  /v1/leaderboard/materialize:"; do
  require_contains "$openapi" "$path" "critical production route OpenAPI entry"
done

critical_flows="$root_dir/scripts/test_critical_path_flows.sh"
for test_name in \
  "ExecutorSyncUserFetchesOwnedRepositoriesAndAuthoredPullRequests" \
  "ExecutorSyncPullRequestFetchesAndPersistsBoundedPullRequestData" \
  "ReplayUserPersistsLedgerAndSnapshot" \
  "RefreshProfileByUserIDPersistsFreshSnapshot" \
  "MaterializePullRequestReportPersistsIdempotentSnapshot" \
  "MaterializeQuestBoardPersistsQuestEvidenceAndRewards" \
  "LeaderboardMaterializesSeasonSnapshotsAndRankMovements" \
  "RunNextExecutesProfileRefreshJobAndCompletes" \
  "RunNextExecutesPullRequestReportMaterializationJobAndCompletes" \
  "RunNextExecutesPullRequestReportBackfillJobAndCompletes" \
  "RunNextExecutesUserHistoryBackfillJobAndCompletes" \
  "RunNextExecutesLeaderboardMaterializationJobAndCompletes" \
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

k8s_deployments="$root_dir/deployments/k8s/base/deployments.yaml"
require_contains "$k8s_deployments" "name: scheduler-job-worker" "external scheduler worker deployment"
require_contains "$k8s_deployments" "value: worker" "scheduler worker run mode"
require_contains "$k8s_deployments" "value: api" "scheduler API run mode"

live_workflow_verifier="$root_dir/scripts/verify_live_v2_workflow.sh"
[ -x "$live_workflow_verifier" ] || fail "live V2 workflow verifier script is missing or not executable"
TMPDIR="${TMPDIR:-$root_dir/.tmp}" "$live_workflow_verifier"

for file in \
  "$root_dir/scripts/verify_live_observability.sh" \
  "$root_dir/scripts/verify_github_repository_controls.sh" \
  "$root_dir/scripts/apply_github_repository_controls_auto.sh" \
  "$root_dir/scripts/render_k8s_release_manifests.sh" \
  "$root_dir/docs/evidence/observability-live-template.txt" \
  "$root_dir/docs/evidence/rollback-drill-template.txt" \
  "$root_dir/docs/evidence/database-restore-drill-template.txt"; do
  [ -s "$file" ] || fail "required live-gate artifact is missing: $file"
done

echo "v2 no-mock release gate passed"
