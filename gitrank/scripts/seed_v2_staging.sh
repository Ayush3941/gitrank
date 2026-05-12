#!/usr/bin/env sh
set -eu

fail() {
  echo "v2 staging seed failed: $1" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "$1 is required"
}

require_env() {
  eval "value=\${$1:-}"
  [ -n "$value" ] || fail "$1 is required"
}

curl_json() {
  method="$1"
  url="$2"
  body="${3:-}"
  if [ -n "$body" ]; then
    curl -fsS -X "$method" "$url" \
      -H "Content-Type: application/json" \
      --data "$body"
  else
    curl -fsS -X "$method" "$url"
  fi
}

require_contains() {
  value="$1"
  needle="$2"
  label="$3"
  printf '%s' "$value" | grep -F "$needle" >/dev/null 2>&1 || fail "$label did not contain $needle"
}

root_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
seed_file="$root_dir/deployments/seeds/v2_staging/001_synthetic_github_evidence.sql"

require_command psql
require_command curl
require_command grep
require_env DATABASE_URL
require_env SCORING_ENGINE_BASE_URL

case "${GITRANK_ENV:-}" in
  staging)
    ;;
  development)
    [ "${ALLOW_V2_STAGING_SEED_IN_DEVELOPMENT:-}" = "1" ] || fail "set ALLOW_V2_STAGING_SEED_IN_DEVELOPMENT=1 to run the staging seed in development"
    ;;
  *)
    fail "GITRANK_ENV must be staging"
    ;;
esac

[ "${ALLOW_V2_STAGING_SEED:-}" = "1" ] || fail "set ALLOW_V2_STAGING_SEED=1 to confirm staging seed application"

if [ "${RUN_MIGRATIONS:-0}" = "1" ]; then
  "$root_dir/scripts/migrate.sh"
fi

seed_user_id="${V2_STAGING_SEED_USER_ID:-b2000000-0000-4000-8000-000000000001}"
seed_handle="${V2_STAGING_SEED_HANDLE:-v2-staging}"
seed_owner="${V2_STAGING_SEED_OWNER:-v2-staging}"
seed_repo="${V2_STAGING_SEED_REPO:-realtime-evidence}"
seed_pr_number="${V2_STAGING_SEED_PR_NUMBER:-42}"
read_api_base="${API_GATEWAY_BASE_URL:-${GITRANK_API_BASE_URL:-${PROFILE_SERVICE_BASE_URL:-}}}"

[ -f "$seed_file" ] || fail "seed SQL not found at $seed_file"
[ -n "$read_api_base" ] || fail "set API_GATEWAY_BASE_URL, GITRANK_API_BASE_URL, or PROFILE_SERVICE_BASE_URL for read API verification"

echo "applying V2 staging evidence seed: $seed_file"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$seed_file"

echo "replaying deterministic score ledger through scoring-engine"
score_response="$(curl_json POST "${SCORING_ENGINE_BASE_URL%/}/v1/score/users/$seed_user_id/replay" '{"trigger_type":"backfill"}')"
require_contains "$score_response" '"events":' "score replay response"
require_contains "$score_response" '"snapshot":' "score replay response"

echo "verifying persisted score events through scoring-engine"
events_response="$(curl_json GET "${SCORING_ENGINE_BASE_URL%/}/v1/score/users/$seed_user_id/events")"
require_contains "$events_response" '"score_version":' "score events response"
require_contains "$events_response" "$seed_repo" "score events response"

echo "verifying public profile through read API"
profile_response="$(curl_json GET "${read_api_base%/}/v1/users/$seed_handle")"
require_contains "$profile_response" "$seed_handle" "public profile response"
require_contains "$profile_response" '"score_history":' "public profile response"

echo "verifying PR battle report through read API"
report_response="$(curl_json GET "${read_api_base%/}/v1/pr/$seed_owner/$seed_repo/$seed_pr_number/report")"
require_contains "$report_response" '"evidence_state":' "PR report response"
require_contains "$report_response" "$seed_repo" "PR report response"

echo "v2 staging seed completed"
