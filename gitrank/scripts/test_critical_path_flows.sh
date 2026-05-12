#!/usr/bin/env sh
set -eu

root_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"

image="${CRITICAL_PATH_TEST_POSTGRES_IMAGE:-postgres:17-alpine}"
container_name="${CRITICAL_PATH_TEST_CONTAINER:-gitrank-critical-path-test-$$}"
host_port="${CRITICAL_PATH_TEST_PORT:-55433}"
db_name="${CRITICAL_PATH_TEST_DB:-gitrank_critical_path_test}"
db_user="${CRITICAL_PATH_TEST_USER:-postgres}"
db_password="${CRITICAL_PATH_TEST_PASSWORD:-postgres}"

cleanup() {
  docker rm -f "$container_name" >/dev/null 2>&1 || true
}

wait_for_postgres() {
  attempt=0
  while [ "$attempt" -lt 30 ]; do
    if PGPASSWORD="$db_password" pg_isready -h 127.0.0.1 -p "$host_port" -U "$db_user" -d "$db_name" >/dev/null 2>&1; then
      return 0
    fi
    attempt=$((attempt + 1))
    sleep 1
  done
  return 1
}

run_go_test() {
  package="$1"
  pattern="$2"

  echo "running critical path tests: $package $pattern"
  TMPDIR="${TMPDIR:-$root_dir/.tmp}" \
  GOCACHE="${GOCACHE:-$root_dir/.gocache}" \
  GITRANK_AUTH_DATABASE_URL="$database_url" \
  GITRANK_INGESTOR_DATABASE_URL="$database_url" \
  GITRANK_SCORING_DATABASE_URL="$database_url" \
  GITRANK_PROFILE_DATABASE_URL="$database_url" \
  GITRANK_SCHEDULER_DATABASE_URL="$database_url" \
  GITRANK_ANALYZER_DATABASE_URL="$database_url" \
  GITRANK_STORE_DATABASE_URL="$database_url" \
    go test "$package" -run "$pattern" -count=1
}

trap cleanup EXIT INT TERM
cleanup

docker run -d \
  --rm \
  --name "$container_name" \
  -e POSTGRES_DB="$db_name" \
  -e POSTGRES_USER="$db_user" \
  -e POSTGRES_PASSWORD="$db_password" \
  -p "127.0.0.1:${host_port}:5432" \
  "$image" >/dev/null

if ! wait_for_postgres; then
  docker logs "$container_name" >&2 || true
  echo "postgres did not become ready in time" >&2
  exit 1
fi

database_url="postgres://${db_user}:${db_password}@127.0.0.1:${host_port}/${db_name}?sslmode=disable"

DATABASE_URL="$database_url" "$root_dir/scripts/migrate.sh"

cd "$root_dir"
mkdir -p "${TMPDIR:-$root_dir/.tmp}" "${GOCACHE:-$root_dir/.gocache}"

run_go_test ./packages/githubapi 'Test(BuildAuthorizeURL|ExchangeUserAccessToken)$'
run_go_test ./packages/authkit 'Test(StateTokenRoundTrip|SameSiteAndCookies)$'
run_go_test ./services/api-gateway/internal/httpapi 'Test(SyncRouteDefaultsToAuthenticatedGitHubLogin|PublicProfileRoutePassesThroughPublicProfileContract)$'
run_go_test ./services/github-ingestor/internal/httpapi 'TestWebhookAcceptedAndDeduplicated$'
run_go_test ./services/github-ingestor/internal/service 'Test(PersistWebhookNormalizesEntitiesIdempotently|ExecutorSyncRepositoryFetchesAndPersistsBoundedRepositoryData|ExecutorSyncUserFetchesOwnedRepositoriesAndAuthoredPullRequests|ExecutorSyncPullRequestFetchesAndPersistsBoundedPullRequestData)$'
run_go_test ./services/pr-analyzer/internal/httpapi 'TestAnalyzePullRequestReturnsValidatedEnvelope$'
run_go_test ./services/pr-analyzer/internal/analyzer 'TestStoreSavePullRequestAnalysisUpsertsLatestArtifact$'
run_go_test ./services/scheduler-worker/internal/service 'TestRunNextExecutesAnalysisPullRequestJobAndCompletes$'
run_go_test ./services/scoring-engine/internal/scoring 'TestScoreMergedSecurityContribution$'
run_go_test ./services/scoring-engine/internal/service 'TestReplayUserPersistsLedgerAndSnapshot$'
run_go_test ./services/profile-service/internal/service 'Test(RefreshProfileByUserIDPersistsFreshSnapshot|MaterializePullRequestReportPersistsIdempotentSnapshot|MaterializeQuestBoardPersistsQuestEvidenceAndRewards)$'
run_go_test ./services/scheduler-worker/internal/service 'TestRunNextExecutesProfileRefreshJobAndCompletes$'
run_go_test ./services/scheduler-worker/internal/service 'TestRunNextExecutesPullRequestReportMaterializationJobAndCompletes$'
run_go_test ./services/scheduler-worker/internal/service 'TestRunNextExecutesPullRequestGradeJobAndCompletes$'
run_go_test ./services/profile-service/internal/service 'TestPublicResponseFiltersHiddenRepositories$'

echo "critical path flow tests passed"
