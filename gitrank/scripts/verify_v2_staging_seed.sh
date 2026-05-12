#!/usr/bin/env sh
set -eu

root_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"

image="${V2_STAGING_SEED_TEST_POSTGRES_IMAGE:-postgres:17-alpine}"
container_name="${V2_STAGING_SEED_TEST_CONTAINER:-gitrank-v2-staging-seed-test-$$}"
host_port="${V2_STAGING_SEED_TEST_PORT:-55434}"
db_name="${V2_STAGING_SEED_TEST_DB:-gitrank_v2_staging_seed_test}"
db_user="${V2_STAGING_SEED_TEST_USER:-postgres}"
db_password="${V2_STAGING_SEED_TEST_PASSWORD:-postgres}"
seed_user_id="b2000000-0000-4000-8000-000000000001"
seed_pr_id="b2000000-0000-4000-8000-000000000004"

cleanup() {
  docker rm -f "$container_name" >/dev/null 2>&1 || true
}

assert_true() {
  label="$1"
  sql="$2"
  result="$(psql "$database_url" -v ON_ERROR_STOP=1 -At -c "$sql")"
  if [ "$result" != "t" ]; then
    echo "assertion failed: $label" >&2
    echo "sql: $sql" >&2
    echo "result: $result" >&2
    exit 1
  fi
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

command -v docker >/dev/null 2>&1 || {
  echo "docker is required" >&2
  exit 1
}
command -v psql >/dev/null 2>&1 || {
  echo "psql is required" >&2
  exit 1
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
psql "$database_url" -v ON_ERROR_STOP=1 -f "$root_dir/deployments/seeds/v2_staging/001_synthetic_github_evidence.sql"

assert_true "v2 seed user exists" \
  "SELECT COUNT(*) = 1 FROM users WHERE id = '$seed_user_id'::uuid AND public_handle = 'v2-staging';"
assert_true "v2 seed public PR evidence exists" \
  "SELECT COUNT(*) = 1 FROM pull_requests WHERE id = '$seed_pr_id'::uuid AND number = 42 AND merged = TRUE;"
assert_true "v2 seed bounded file evidence exists" \
  "SELECT COUNT(*) = 3 FROM pull_request_files WHERE pull_request_id = '$seed_pr_id'::uuid AND patch <> '' AND feature_jsonb <> '{}'::jsonb;"
assert_true "v2 seed analysis evidence exists" \
  "SELECT COUNT(*) = 1 FROM contribution_analyses WHERE pull_request_id = '$seed_pr_id'::uuid AND analysis_source = 'deterministic';"
assert_true "v2 seed does not precompute score events" \
  "SELECT COUNT(*) = 0 FROM score_events WHERE user_id = '$seed_user_id'::uuid;"
assert_true "v2 seed does not precompute profile snapshots" \
  "SELECT COUNT(*) = 0 FROM profile_snapshots WHERE user_id = '$seed_user_id'::uuid;"

echo "v2 staging seed verification passed"
