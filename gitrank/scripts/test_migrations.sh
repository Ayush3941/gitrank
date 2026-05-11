#!/usr/bin/env sh
set -eu

root_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"

image="${MIGRATION_TEST_POSTGRES_IMAGE:-postgres:17-alpine}"
container_name="${MIGRATION_TEST_CONTAINER:-gitrank-migration-test-$$}"
host_port="${MIGRATION_TEST_PORT:-55432}"
db_name="${MIGRATION_TEST_DB:-gitrank_migration_test}"
db_user="${MIGRATION_TEST_USER:-postgres}"
db_password="${MIGRATION_TEST_PASSWORD:-postgres}"

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

query_scalar() {
  sql="$1"
  PGPASSWORD="$db_password" psql \
    -h 127.0.0.1 \
    -p "$host_port" \
    -U "$db_user" \
    -d "$db_name" \
    -Atqc "$sql"
}

assert_true() {
  description="$1"
  sql="$2"
  result="$(query_scalar "$sql")"
  if [ "$result" != "t" ]; then
    echo "assertion failed: $description" >&2
    echo "query: $sql" >&2
    echo "result: $result" >&2
    exit 1
  fi
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

DATABASE_URL="postgres://${db_user}:${db_password}@127.0.0.1:${host_port}/${db_name}?sslmode=disable" \
  "$root_dir/scripts/migrate.sh"

ALLOW_LOCAL_SEED=1 \
GITRANK_ENV=development \
DATABASE_URL="postgres://${db_user}:${db_password}@127.0.0.1:${host_port}/${db_name}?sslmode=disable" \
  "$root_dir/scripts/seed_local_dev.sh"

ALLOW_LOCAL_SEED=1 \
GITRANK_ENV=development \
DATABASE_URL="postgres://${db_user}:${db_password}@127.0.0.1:${host_port}/${db_name}?sslmode=disable" \
  "$root_dir/scripts/seed_local_dev.sh"

mkdir -p "$root_dir/.tmp" "$root_dir/.gocache"

assert_true "users table exists" \
  "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users');"
assert_true "github_installations table exists" \
  "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'github_installations');"
assert_true "github_webhook_deliveries table exists" \
  "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'github_webhook_deliveries');"
assert_true "auth_sessions table exists" \
  "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'auth_sessions');"
assert_true "user_profile_settings table exists" \
  "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_profile_settings');"
assert_true "user_repository_visibility table exists" \
  "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_repository_visibility');"
assert_true "score_replay_runs table exists" \
  "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'score_replay_runs');"
assert_true "score_snapshots table exists" \
  "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'score_snapshots');"
assert_true "scheduler_runtime_states table exists" \
  "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'scheduler_runtime_states');"
assert_true "scheduler_jobs table exists" \
  "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'scheduler_jobs');"
assert_true "scheduler_dead_letters table exists" \
  "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'scheduler_dead_letters');"
assert_true "scheduler_backfill_plans table exists" \
  "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'scheduler_backfill_plans');"
assert_true "scheduler_rate_limit_windows table exists" \
  "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'scheduler_rate_limit_windows');"
assert_true "scheduler_runtime_counters table exists" \
  "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'scheduler_runtime_counters');"
assert_true "scheduler_tick_scope_totals table exists" \
  "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'scheduler_tick_scope_totals');"
assert_true "quest_definitions table exists" \
  "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'quest_definitions');"
assert_true "user_quest_assignments table exists" \
  "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_quest_assignments');"
assert_true "user_quest_progress_events table exists" \
  "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_quest_progress_events');"
assert_true "user_quest_completion_events table exists" \
  "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_quest_completion_events');"
assert_true "user_quest_reward_grants table exists" \
  "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_quest_reward_grants');"
assert_true "quest_audit_events table exists" \
  "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'quest_audit_events');"
assert_true "webhook delivery persistence column exists" \
  "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'github_webhook_deliveries' AND column_name = 'github_installation_id');"
assert_true "auth session token hash column exists" \
  "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'auth_sessions' AND column_name = 'session_token_hash');"
assert_true "profile snapshot freshness columns exist" \
  "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profile_snapshots' AND column_name = 'refreshed_at');"
assert_true "score events replay column exists" \
  "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'score_events' AND column_name = 'replay_run_id');"
assert_true "local seed user exists exactly once" \
  "SELECT COUNT(*) = 1 FROM users WHERE id = '11111111-1111-1111-1111-111111111111'::uuid;"
assert_true "local seed repository exists exactly once" \
  "SELECT COUNT(*) = 1 FROM repositories WHERE id = '33333333-3333-3333-3333-333333333333'::uuid;"
assert_true "local seed profile snapshot exists exactly once" \
  "SELECT COUNT(*) = 1 FROM profile_snapshots WHERE id = '88888888-8888-8888-8888-888888888888'::uuid;"
assert_true "local seed score replay run exists exactly once" \
  "SELECT COUNT(*) = 1 FROM score_replay_runs WHERE id = '99999999-9999-9999-9999-999999999999'::uuid;"
assert_true "local seed score snapshot exists exactly once" \
  "SELECT COUNT(*) = 1 FROM score_snapshots WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;"
assert_true "public handle lookup index exists" \
  "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_users_public_handle_lower');"
assert_true "linked GitHub account ordering index exists" \
  "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_github_accounts_user_linked_at');"
assert_true "completed score replay lookup index exists" \
  "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_score_replay_runs_user_completed_created');"
assert_true "score event version lookup index exists" \
  "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_score_events_user_version_created');"
assert_true "user badge listing index exists" \
  "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_user_badges_user_awarded');"
assert_true "pull request review ordering index exists" \
  "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_pull_request_reviews_pr_submitted');"
assert_true "pull request author timeline index exists" \
  "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_pull_requests_author_timeline');"
assert_true "active installation repository index exists" \
  "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_installation_repositories_active_selected');"
assert_true "quest assignment user status index exists" \
  "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_user_quest_assignments_user_status');"
assert_true "quest progress assignment index exists" \
  "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_user_quest_progress_assignment_occurred');"
assert_true "quest reward user status index exists" \
  "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_user_quest_rewards_user_status');"
assert_true "quest audit action index exists" \
  "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_quest_audit_events_created_action');"

(
  cd "$root_dir/services/auth-service/internal/service"
  TMPDIR="$root_dir/.tmp" \
    GOCACHE="$root_dir/.gocache" \
    GITRANK_AUTH_DATABASE_URL="postgres://${db_user}:${db_password}@127.0.0.1:${host_port}/${db_name}?sslmode=disable" \
    go test ./...
)

(
  cd "$root_dir/packages/store"
  TMPDIR="$root_dir/.tmp" \
    GOCACHE="$root_dir/.gocache" \
    GITRANK_STORE_DATABASE_URL="postgres://${db_user}:${db_password}@127.0.0.1:${host_port}/${db_name}?sslmode=disable" \
    go test ./...
)

(
  cd "$root_dir/services/scoring-engine/internal/service"
  TMPDIR="$root_dir/.tmp" \
    GOCACHE="$root_dir/.gocache" \
    GITRANK_SCORING_DATABASE_URL="postgres://${db_user}:${db_password}@127.0.0.1:${host_port}/${db_name}?sslmode=disable" \
    go test ./...
)

(
  cd "$root_dir/services/github-ingestor/internal/service"
  TMPDIR="$root_dir/.tmp" \
    GOCACHE="$root_dir/.gocache" \
    GITRANK_INGESTOR_DATABASE_URL="postgres://${db_user}:${db_password}@127.0.0.1:${host_port}/${db_name}?sslmode=disable" \
    go test ./...
)

(
  cd "$root_dir/services/scheduler-worker/internal/service"
  TMPDIR="$root_dir/.tmp" \
    GOCACHE="$root_dir/.gocache" \
    GITRANK_SCHEDULER_DATABASE_URL="postgres://${db_user}:${db_password}@127.0.0.1:${host_port}/${db_name}?sslmode=disable" \
    go test ./...
)

echo "migration smoke test passed"
