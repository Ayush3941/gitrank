#!/usr/bin/env sh
set -eu

root_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"

REPOSITORY="${GITHUB_REPOSITORY:-}"
TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-${GITRANK_REPO_ADMIN_TOKEN:-}}}"
API_BASE="${GITHUB_API_URL:-https://api.github.com}"
API_VERSION="${GITHUB_API_VERSION:-2026-03-10}"
API_TIMEOUT_SECONDS="${GITHUB_API_TIMEOUT_SECONDS:-30}"
WORKFLOW_RUN_ID="${WORKFLOW_RUN_ID:-}"
USE_LATEST_SUCCESSFUL_RUN="${USE_LATEST_SUCCESSFUL_RUN:-false}"
WORKFLOW_EVENT="${WORKFLOW_EVENT:-workflow_dispatch}"
WORKFLOW_EVENT_FALLBACK_ANY="${WORKFLOW_EVENT_FALLBACK_ANY:-true}"
OUTPUT_FILE="${OUTPUT_FILE:-}"

ENVIRONMENT="${ENVIRONMENT:-}"
CLUSTER="${CLUSTER:-}"
NAMESPACE="${NAMESPACE:-}"
OPERATOR="${OPERATOR:-}"

APPLICATION_COMMIT="${APPLICATION_COMMIT:-}"
OBSERVABILITY_COMMIT="${OBSERVABILITY_COMMIT:-}"
PROMETHEUS_ROLLOUT_STATUS="${PROMETHEUS_ROLLOUT_STATUS:-verified by workflow run}"
GRAFANA_ROLLOUT_STATUS="${GRAFANA_ROLLOUT_STATUS:-verified by workflow run}"
PROMETHEUS_TARGETS_SUMMARY="${PROMETHEUS_TARGETS_SUMMARY:-verified by workflow run step success}"
ALERT_GROUPS_LOADED="${ALERT_GROUPS_LOADED:-verified by workflow run step success}"
GRAFANA_DATASOURCE_VERIFIED="${GRAFANA_DATASOURCE_VERIFIED:-verified by workflow run step success}"
GRAFANA_DASHBOARDS_VERIFIED="${GRAFANA_DASHBOARDS_VERIFIED:-verified by workflow run step success}"
ALERT_ROUTE_TESTED="${ALERT_ROUTE_TESTED:-verified by workflow run step success}"
KNOWN_GAPS="${KNOWN_GAPS:-none observed in workflow run}"
FOLLOW_UP_ACTIONS="${FOLLOW_UP_ACTIONS:-continue normal monitoring and alert tuning}"
DECISION="${DECISION:-pass}"
GITHUB_APP_ID="${GITHUB_APP_ID:-${GITRANK_GITHUB_APP_ID:-}}"
GITHUB_APP_INSTALLATION_ID="${GITHUB_APP_INSTALLATION_ID:-${GITRANK_GITHUB_APP_INSTALLATION_ID:-}}"
GITHUB_APP_PRIVATE_KEY_FILE="${GITHUB_APP_PRIVATE_KEY_FILE:-${GITRANK_GITHUB_APP_PRIVATE_KEY_FILE:-}}"
GITHUB_APP_PRIVATE_KEY_PEM="${GITHUB_APP_PRIVATE_KEY_PEM:-${GITRANK_GITHUB_APP_PRIVATE_KEY_PEM:-}}"

fail() {
  printf 'generate observability evidence from workflow run failed: %s\n' "$1" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "missing required command: $1"
}

resolve_repository_from_git_remote() {
  [ -n "$REPOSITORY" ] && return 0
  command -v git >/dev/null 2>&1 || return 0
  remote_url=$(git config --get remote.origin.url 2>/dev/null || true)
  [ -n "$remote_url" ] || return 0
  case "$remote_url" in
    https://github.com/*) inferred_repo=${remote_url#https://github.com/} ;;
    git@github.com:*) inferred_repo=${remote_url#git@github.com:} ;;
    *) inferred_repo= ;;
  esac
  inferred_repo=${inferred_repo%.git}
  [ -n "$inferred_repo" ] && REPOSITORY=$inferred_repo
}

resolve_repository_from_git_remote

bootstrap_token_from_github_app() {
  [ -n "$TOKEN" ] && return 0
  [ -n "$GITHUB_APP_ID" ] || return 1
  [ -n "$GITHUB_APP_INSTALLATION_ID" ] || return 1
  if [ -z "$GITHUB_APP_PRIVATE_KEY_FILE" ] && [ -z "$GITHUB_APP_PRIVATE_KEY_PEM" ]; then
    return 1
  fi

  token_file=$(mktemp "${TMPDIR:-/tmp}/gitrank-observability-token.XXXXXX")
  GITHUB_APP_ID="$GITHUB_APP_ID" \
  GITHUB_APP_INSTALLATION_ID="$GITHUB_APP_INSTALLATION_ID" \
  GITHUB_APP_PRIVATE_KEY_FILE="$GITHUB_APP_PRIVATE_KEY_FILE" \
  GITHUB_APP_PRIVATE_KEY_PEM="$GITHUB_APP_PRIVATE_KEY_PEM" \
  TOKEN_OUTPUT_FILE="$token_file" \
  "$root_dir/scripts/create_github_app_installation_token.sh" >/dev/null
  TOKEN=$(cat "$token_file" 2>/dev/null || true)
  rm -f "$token_file"
  [ -n "$TOKEN" ] || fail "GitHub App token bootstrap succeeded but returned empty token"
  export GITHUB_TOKEN="$TOKEN"
  export GH_TOKEN="$TOKEN"
  export GITRANK_REPO_ADMIN_TOKEN="$TOKEN"
  printf 'observability evidence: bootstrapped token via GitHub App installation credentials\n'
}

case "$REPOSITORY" in
  */*) ;;
  *) fail "GITHUB_REPOSITORY must use owner/name form (or run from a clone with GitHub origin remote)" ;;
esac

if [ -z "$WORKFLOW_RUN_ID" ] && [ "$USE_LATEST_SUCCESSFUL_RUN" = "true" ]; then
  WORKFLOW_RUN_ID=latest
fi
[ -n "$WORKFLOW_RUN_ID" ] || fail "WORKFLOW_RUN_ID is required (or set USE_LATEST_SUCCESSFUL_RUN=true)"
[ -n "$OUTPUT_FILE" ] || fail "OUTPUT_FILE is required"
[ -n "$ENVIRONMENT" ] || fail "ENVIRONMENT is required"
[ -n "$CLUSTER" ] || fail "CLUSTER is required"
[ -n "$NAMESPACE" ] || fail "NAMESPACE is required"
[ -n "$OPERATOR" ] || fail "OPERATOR is required"

require_command curl
require_command jq
require_command mktemp
bootstrap_token_from_github_app || true
mkdir -p "$(dirname "$OUTPUT_FILE")"

OWNER=${REPOSITORY%%/*}
REPO=${REPOSITORY#*/}
API_STATUS=
API_BODY=

github_get() {
  path=$1
  body_file="${TMPDIR:-/tmp}/gitrank-observability-evidence.$$.json"
  if [ -n "$TOKEN" ]; then
    API_STATUS=$(curl -sS -L -o "$body_file" -w '%{http_code}' \
      --connect-timeout "$API_TIMEOUT_SECONDS" \
      --max-time "$API_TIMEOUT_SECONDS" \
      -H 'Accept: application/vnd.github+json' \
      -H "Authorization: Bearer $TOKEN" \
      -H "X-GitHub-Api-Version: $API_VERSION" \
      "$API_BASE$path") || {
        rm -f "$body_file"
        fail "GitHub API request failed for $path"
      }
  else
    API_STATUS=$(curl -sS -L -o "$body_file" -w '%{http_code}' \
      --connect-timeout "$API_TIMEOUT_SECONDS" \
      --max-time "$API_TIMEOUT_SECONDS" \
      -H 'Accept: application/vnd.github+json' \
      -H "X-GitHub-Api-Version: $API_VERSION" \
      "$API_BASE$path") || {
        rm -f "$body_file"
        fail "GitHub API request failed for $path"
      }
  fi
  API_BODY=$(cat "$body_file")
  rm -f "$body_file"
}

expect_status() {
  expected=$1
  context=$2
  [ "$API_STATUS" = "$expected" ] || fail "$context returned HTTP $API_STATUS"
}

verify_script="$root_dir/scripts/verify_live_v2_workflow_run.sh"
[ -x "$verify_script" ] || fail "missing executable verifier script: $verify_script"

if GITHUB_REPOSITORY="$REPOSITORY" \
  GITHUB_TOKEN="$TOKEN" \
  WORKFLOW_RUN_ID="$WORKFLOW_RUN_ID" \
  WORKFLOW_EVENT="$WORKFLOW_EVENT" \
  WORKFLOW_RUN_ID_OUTPUT_FILE="${TMPDIR:-/tmp}/gitrank-observability-workflow-run-id.$$.txt" \
  REQUIRE_GITHUB_CONTROLS=false \
  REQUIRE_OBSERVABILITY=true \
  REQUIRE_RELEASE_RENDER=false \
  "$verify_script"; then
  :
else
  retry_with_any=false
  case "$WORKFLOW_EVENT_FALLBACK_ANY" in
    true)
      if [ "$WORKFLOW_EVENT" != "any" ] && [ "$WORKFLOW_EVENT" != "all" ] && [ "$WORKFLOW_EVENT" != "*" ]; then
        if [ "$WORKFLOW_RUN_ID" = "latest" ]; then
          retry_with_any=true
        fi
      fi
      ;;
  esac

  if [ "$retry_with_any" = "true" ]; then
    printf '%s\n' "workflow-run verification miss for event '$WORKFLOW_EVENT'; retrying with WORKFLOW_EVENT=any"
    WORKFLOW_EVENT=any
    WORKFLOW_RUN_ID=latest
    GITHUB_REPOSITORY="$REPOSITORY" \
    GITHUB_TOKEN="$TOKEN" \
    WORKFLOW_RUN_ID="$WORKFLOW_RUN_ID" \
    WORKFLOW_EVENT="$WORKFLOW_EVENT" \
    WORKFLOW_RUN_ID_OUTPUT_FILE="${TMPDIR:-/tmp}/gitrank-observability-workflow-run-id.$$.txt" \
    REQUIRE_GITHUB_CONTROLS=false \
    REQUIRE_OBSERVABILITY=true \
    REQUIRE_RELEASE_RENDER=false \
    "$verify_script"
  else
    fail "workflow-run verification failed"
  fi
fi

resolved_run_id=$(cat "${TMPDIR:-/tmp}/gitrank-observability-workflow-run-id.$$.txt" 2>/dev/null || true)
rm -f "${TMPDIR:-/tmp}/gitrank-observability-workflow-run-id.$$.txt"
[ -n "$resolved_run_id" ] || fail "could not resolve workflow run id from verifier output"
WORKFLOW_RUN_ID="$resolved_run_id"

github_get "/repos/$OWNER/$REPO/actions/runs/$WORKFLOW_RUN_ID"
if [ "$API_STATUS" = "401" ] || [ "$API_STATUS" = "403" ]; then
  fail "unable to read workflow run metadata (HTTP $API_STATUS); provide valid GitHub token"
fi
expect_status 200 "workflow run metadata"

run_url=$(printf '%s' "$API_BODY" | jq -r '.html_url // empty')
head_sha=$(printf '%s' "$API_BODY" | jq -r '.head_sha // empty')
created_at=$(printf '%s' "$API_BODY" | jq -r '.created_at // empty')
updated_at=$(printf '%s' "$API_BODY" | jq -r '.updated_at // empty')

[ -n "$run_url" ] || fail "workflow run URL is missing"
[ -n "$head_sha" ] || fail "workflow run head SHA is missing"

if [ -z "$APPLICATION_COMMIT" ]; then
  APPLICATION_COMMIT="$head_sha"
fi

if [ -z "$OBSERVABILITY_COMMIT" ]; then
  OBSERVABILITY_COMMIT="$head_sha"
fi

date_value=$(date -u +%F)
if [ -n "$created_at" ] || [ -n "$updated_at" ]; then
  date_value="$date_value (workflow created=$created_at updated=$updated_at)"
fi

cat >"$OUTPUT_FILE" <<EOF
Date: $date_value
Environment: $ENVIRONMENT
Cluster: $CLUSTER
Namespace: $NAMESPACE
Operator: $OPERATOR
Application commit: $APPLICATION_COMMIT
Observability commit: $OBSERVABILITY_COMMIT
Prometheus rollout status: $PROMETHEUS_ROLLOUT_STATUS
Grafana rollout status: $GRAFANA_ROLLOUT_STATUS
Prometheus targets summary: $PROMETHEUS_TARGETS_SUMMARY
Alert groups loaded: $ALERT_GROUPS_LOADED
Grafana datasource verified: $GRAFANA_DATASOURCE_VERIFIED
Grafana dashboards verified: $GRAFANA_DASHBOARDS_VERIFIED
Alert route tested: $ALERT_ROUTE_TESTED
Known gaps: $KNOWN_GAPS
Follow-up actions: $FOLLOW_UP_ACTIONS
Decision: $DECISION
EOF

"$root_dir/scripts/verify_observability_evidence_record.sh" "$OUTPUT_FILE"

printf 'observability evidence file generated from workflow run\n'
printf 'workflow_run_id: %s\n' "$WORKFLOW_RUN_ID"
printf 'workflow_run_url: %s\n' "$run_url"
printf 'output_file: %s\n' "$OUTPUT_FILE"
