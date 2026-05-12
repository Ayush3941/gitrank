#!/usr/bin/env sh
set -eu

root_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"

test -x "$root_dir/scripts/test_critical_path_flows.sh"

require_test() {
  label="$1"
  pattern="$2"
  path="$3"

  if command -v rg >/dev/null 2>&1; then
    found="$(rg -n "$pattern" "$root_dir/$path" || true)"
  else
    found="$(grep -R -n -- "$pattern" "$root_dir/$path" || true)"
  fi

  if [ -z "$found" ]; then
    echo "missing critical-path test: $label" >&2
    echo "pattern: $pattern" >&2
    echo "path: $path" >&2
    exit 1
  fi
}

require_test "GitHub OAuth authorize URL" "func TestBuildAuthorizeURL" "packages/githubapi"
require_test "OAuth token exchange" "func TestExchangeUserAccessToken" "packages/githubapi"
require_test "OAuth state CSRF token round trip" "func TestStateTokenRoundTrip" "packages/authkit"
require_test "secure auth cookie behavior" "func TestSameSiteAndCookies" "packages/authkit"
require_test "API gateway authenticated sync route" "func TestSyncRouteDefaultsToAuthenticatedGitHubLogin" "services/api-gateway/internal/httpapi"
require_test "repository sync execution" "func TestExecutorSyncRepositoryFetchesAndPersistsBoundedRepositoryData" "services/github-ingestor/internal/service"
require_test "pull request sync execution" "func TestExecutorSyncPullRequestFetchesAndPersistsBoundedPullRequestData" "services/github-ingestor/internal/service"
require_test "webhook accept and dedupe" "func TestWebhookAcceptedAndDeduplicated" "services/github-ingestor/internal/httpapi"
require_test "webhook persistence idempotency" "func TestPersistWebhookNormalizesEntitiesIdempotently" "services/github-ingestor/internal/service"
require_test "PR analyzer validated envelope" "func TestAnalyzePullRequestReturnsValidatedEnvelope" "services/pr-analyzer/internal/httpapi"
require_test "PR analyzer persisted artifact" "func TestStoreSavePullRequestAnalysisUpsertsLatestArtifact" "services/pr-analyzer/internal/analyzer"
require_test "scheduler analysis execution" "func TestRunNextExecutesAnalysisPullRequestJobAndCompletes" "services/scheduler-worker/internal/service"
require_test "deterministic scoring" "func TestScoreMergedSecurityContribution" "services/scoring-engine/internal/scoring"
require_test "scoring replay ledger" "func TestReplayUserPersistsLedgerAndSnapshot" "services/scoring-engine/internal/service"
require_test "profile refresh persistence" "func TestRefreshProfileByUserIDPersistsFreshSnapshot" "services/profile-service/internal/service"
require_test "PR report materialization persistence" "func TestMaterializePullRequestReportPersistsIdempotentSnapshot" "services/profile-service/internal/service"
require_test "quest materialization persistence" "func TestMaterializeQuestBoardPersistsQuestEvidenceAndRewards" "services/profile-service/internal/service"
require_test "leaderboard season materialization persistence" "func TestLeaderboardMaterializesSeasonSnapshotsAndRankMovements" "services/profile-service/internal/service"
require_test "scheduler profile refresh execution" "func TestRunNextExecutesProfileRefreshJobAndCompletes" "services/scheduler-worker/internal/service"
require_test "scheduler PR report materialization execution" "func TestRunNextExecutesPullRequestReportMaterializationJobAndCompletes" "services/scheduler-worker/internal/service"
require_test "scheduler PR report backfill execution" "func TestRunNextExecutesPullRequestReportBackfillJobAndCompletes" "services/scheduler-worker/internal/service"
require_test "scheduler user history backfill pipeline execution" "func TestRunNextExecutesUserHistoryBackfillJobAndCompletes" "services/scheduler-worker/internal/service"
require_test "scheduler leaderboard materialization execution" "func TestRunNextExecutesLeaderboardMaterializationJobAndCompletes" "services/scheduler-worker/internal/service"
require_test "scheduler PR grading pipeline execution" "func TestRunNextExecutesPullRequestGradeJobAndCompletes" "services/scheduler-worker/internal/service"
require_test "public profile projection" "func TestPublicResponseFiltersHiddenRepositories" "services/profile-service/internal/service"
require_test "public profile API contract" "func TestPublicProfileRoutePassesThroughPublicProfileContract" "services/api-gateway/internal/httpapi"

echo "critical path test coverage map verified"
