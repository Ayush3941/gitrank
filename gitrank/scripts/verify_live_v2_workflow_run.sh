#!/usr/bin/env sh
set -eu

REPOSITORY="${GITHUB_REPOSITORY:-}"
TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-${GITRANK_REPO_ADMIN_TOKEN:-}}}"
API_BASE="${GITHUB_API_URL:-https://api.github.com}"
API_VERSION="${GITHUB_API_VERSION:-2026-03-10}"
API_TIMEOUT_SECONDS="${GITHUB_API_TIMEOUT_SECONDS:-30}"
WORKFLOW_RUN_ID="${WORKFLOW_RUN_ID:-}"
EXPECTED_WORKFLOW_NAME="${EXPECTED_WORKFLOW_NAME:-Verify Live V2 Gates}"
EXPECTED_WORKFLOW_PATH="${EXPECTED_WORKFLOW_PATH:-.github/workflows/verify-live-v2-gates.yml}"
EXPECTED_HEAD_BRANCH="${EXPECTED_HEAD_BRANCH:-}"
WORKFLOW_EVENT="${WORKFLOW_EVENT:-workflow_dispatch}"
WORKFLOW_RUN_SEARCH_PAGES="${WORKFLOW_RUN_SEARCH_PAGES:-10}"
WORKFLOW_RUN_ID_OUTPUT_FILE="${WORKFLOW_RUN_ID_OUTPUT_FILE:-}"
REQUIRE_GITHUB_CONTROLS="${REQUIRE_GITHUB_CONTROLS:-true}"
REQUIRE_OBSERVABILITY="${REQUIRE_OBSERVABILITY:-true}"
REQUIRE_RELEASE_RENDER="${REQUIRE_RELEASE_RENDER:-true}"
TMP_ROOT="${TMPDIR:-/tmp}"
GITHUB_APP_ID="${GITHUB_APP_ID:-${GITRANK_GITHUB_APP_ID:-}}"
GITHUB_APP_INSTALLATION_ID="${GITHUB_APP_INSTALLATION_ID:-${GITRANK_GITHUB_APP_INSTALLATION_ID:-}}"
GITHUB_APP_PRIVATE_KEY_FILE="${GITHUB_APP_PRIVATE_KEY_FILE:-${GITRANK_GITHUB_APP_PRIVATE_KEY_FILE:-}}"
GITHUB_APP_PRIVATE_KEY_PEM="${GITHUB_APP_PRIVATE_KEY_PEM:-${GITRANK_GITHUB_APP_PRIVATE_KEY_PEM:-}}"

fail() {
  printf 'live v2 workflow run verification failed: %s\n' "$1" >&2
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

  token_file=$(mktemp "$TMP_ROOT/gitrank-live-v2-workflow-run-token.XXXXXX")
  GITHUB_APP_ID="$GITHUB_APP_ID" \
  GITHUB_APP_INSTALLATION_ID="$GITHUB_APP_INSTALLATION_ID" \
  GITHUB_APP_PRIVATE_KEY_FILE="$GITHUB_APP_PRIVATE_KEY_FILE" \
  GITHUB_APP_PRIVATE_KEY_PEM="$GITHUB_APP_PRIVATE_KEY_PEM" \
  TOKEN_OUTPUT_FILE="$token_file" \
  "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)/create_github_app_installation_token.sh" >/dev/null
  TOKEN=$(cat "$token_file" 2>/dev/null || true)
  rm -f "$token_file"
  [ -n "$TOKEN" ] || fail "GitHub App token bootstrap succeeded but returned empty token"
  export GITHUB_TOKEN="$TOKEN"
  export GH_TOKEN="$TOKEN"
  export GITRANK_REPO_ADMIN_TOKEN="$TOKEN"
  printf 'live v2 workflow run verifier: bootstrapped token via GitHub App installation credentials\n'
}

case "$REPOSITORY" in
  */*) ;;
  *) fail "GITHUB_REPOSITORY must use owner/name form (or run from a clone with GitHub origin remote)" ;;
esac

require_command curl
require_command jq
require_command mktemp
mkdir -p "$TMP_ROOT"
bootstrap_token_from_github_app || true

OWNER=${REPOSITORY%%/*}
REPO=${REPOSITORY#*/}
API_STATUS=
API_BODY=

github_get() {
  path=$1
  body_file="$TMP_ROOT/gitrank-live-v2-workflow-run.$$"
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

is_rate_limited_response() {
  message=$(printf '%s' "$API_BODY" | jq -r '.message // empty' 2>/dev/null || true)
  case "$message" in
    *"API rate limit exceeded"*) return 0 ;;
    *) return 1 ;;
  esac
}

normalize_workflow_event_filter() {
  case "$WORKFLOW_EVENT" in
    any|all|\*)
      WORKFLOW_EVENT_FILTER=
      WORKFLOW_EVENT_DISPLAY=any
      ;;
    *)
      WORKFLOW_EVENT_FILTER=$WORKFLOW_EVENT
      if [ -n "$WORKFLOW_EVENT_FILTER" ]; then
        WORKFLOW_EVENT_DISPLAY=$WORKFLOW_EVENT_FILTER
      else
        WORKFLOW_EVENT_DISPLAY=any
      fi
      ;;
  esac
}

handle_read_access_error() {
  if [ "$API_STATUS" = "401" ] || [ "$API_STATUS" = "403" ]; then
    if [ "$API_STATUS" = "403" ] && is_rate_limited_response; then
      fail "workflow-run read hit GitHub API rate limit (HTTP 403); provide GITHUB_TOKEN, GH_TOKEN, GITRANK_REPO_ADMIN_TOKEN, or GitHub App credentials"
    fi
    if [ -z "$TOKEN" ]; then
      fail "workflow-run read requires authentication for this repository; set GITHUB_TOKEN, GH_TOKEN, or GITRANK_REPO_ADMIN_TOKEN"
    fi
    fail "workflow-run read denied for the provided token (HTTP $API_STATUS)"
  fi
}

resolve_workflow_run_id_if_needed() {
  if [ -n "$WORKFLOW_RUN_ID" ] && [ "$WORKFLOW_RUN_ID" != "latest" ]; then
    return 0
  fi

  page=1
  scanned_runs=0
  while [ "$page" -le "$WORKFLOW_RUN_SEARCH_PAGES" ]; do
    github_get "/repos/$OWNER/$REPO/actions/runs?per_page=100&page=$page"
    handle_read_access_error
    expect_status 200 "workflow run search page $page"

    matched_id=$(printf '%s' "$API_BODY" | jq -r --arg name "$EXPECTED_WORKFLOW_NAME" --arg event "$WORKFLOW_EVENT_FILTER" --arg workflow_path "$EXPECTED_WORKFLOW_PATH" '
      [
        .workflow_runs[]?
        | select(.name == $name)
        | select(($event | length) == 0 or .event == $event)
        | select(.status == "completed")
        | select(.conclusion == "success")
        | select((.path // "" | split("@")[0]) == $workflow_path)
      ]
      | sort_by(.created_at)
      | reverse
      | .[0].id // empty
    ')

    if [ -n "$matched_id" ]; then
      WORKFLOW_RUN_ID="$matched_id"
      printf 'resolved workflow run id: %s\n' "$WORKFLOW_RUN_ID"
      return 0
    fi

    page_count=$(printf '%s' "$API_BODY" | jq '.workflow_runs | length')
    scanned_runs=$((scanned_runs + page_count))
    [ "$page_count" -lt 100 ] && break
    page=$((page + 1))
  done

  remediation="dispatch the live-gates workflow (make run-live-v2-gates-workflow) or provide WORKFLOW_RUN_ID"
  if [ -n "$WORKFLOW_EVENT_FILTER" ]; then
    fail "no successful '$EXPECTED_WORKFLOW_NAME' workflow run found for event '$WORKFLOW_EVENT_FILTER' in the last $WORKFLOW_RUN_SEARCH_PAGES page(s) (scanned_runs=$scanned_runs; $remediation)"
  fi
  fail "no successful '$EXPECTED_WORKFLOW_NAME' workflow run found in the last $WORKFLOW_RUN_SEARCH_PAGES page(s) (scanned_runs=$scanned_runs; $remediation)"
}

normalize_workflow_event_filter
resolve_workflow_run_id_if_needed
[ -n "$WORKFLOW_RUN_ID" ] || fail "WORKFLOW_RUN_ID is required"

github_get "/repos/$OWNER/$REPO/actions/runs/$WORKFLOW_RUN_ID"
handle_read_access_error
expect_status 200 "workflow run metadata"

if [ -z "$TOKEN" ]; then
  printf 'workflow-run verifier using unauthenticated GitHub API access\n'
fi

run_name=$(printf '%s' "$API_BODY" | jq -r '.name // empty')
run_status=$(printf '%s' "$API_BODY" | jq -r '.status // empty')
run_conclusion=$(printf '%s' "$API_BODY" | jq -r '.conclusion // empty')
run_html_url=$(printf '%s' "$API_BODY" | jq -r '.html_url // empty')
run_event=$(printf '%s' "$API_BODY" | jq -r '.event // empty')
run_head_branch=$(printf '%s' "$API_BODY" | jq -r '.head_branch // empty')
run_path=$(printf '%s' "$API_BODY" | jq -r '.path // empty')
run_workflow_path=${run_path%%@*}

[ -n "$run_name" ] || fail "workflow run name missing"
[ "$run_name" = "$EXPECTED_WORKFLOW_NAME" ] || fail "workflow run name mismatch: expected '$EXPECTED_WORKFLOW_NAME' got '$run_name'"
[ "$run_status" = "completed" ] || fail "workflow run status is not completed: $run_status"
[ "$run_conclusion" = "success" ] || fail "workflow run conclusion is not success: $run_conclusion"
[ -n "$run_workflow_path" ] || fail "workflow run path is missing"
[ "$run_workflow_path" = "$EXPECTED_WORKFLOW_PATH" ] || fail "workflow run path mismatch: expected '$EXPECTED_WORKFLOW_PATH' got '$run_workflow_path'"
if [ -n "$WORKFLOW_EVENT_FILTER" ]; then
  [ "$run_event" = "$WORKFLOW_EVENT_FILTER" ] || fail "workflow run event mismatch: expected '$WORKFLOW_EVENT_FILTER' got '$run_event'"
fi
if [ -n "$EXPECTED_HEAD_BRANCH" ]; then
  [ "$run_head_branch" = "$EXPECTED_HEAD_BRANCH" ] || fail "workflow run head branch mismatch: expected '$EXPECTED_HEAD_BRANCH' got '$run_head_branch'"
fi

jobs_json='[]'
page=1
while :; do
  github_get "/repos/$OWNER/$REPO/actions/runs/$WORKFLOW_RUN_ID/jobs?per_page=100&page=$page"
  handle_read_access_error
  expect_status 200 "workflow run jobs page $page"
  page_jobs=$(printf '%s' "$API_BODY" | jq '.jobs // []')
  page_job_count=$(printf '%s' "$page_jobs" | jq 'length')
  jobs_json=$(jq -n --argjson a "$jobs_json" --argjson b "$page_jobs" '$a + $b')
  [ "$page_job_count" -lt 100 ] && break
  page=$((page + 1))
done

job_count=$(printf '%s' "$jobs_json" | jq 'length')
[ "$job_count" -gt 0 ] || fail "workflow run has no jobs"

step_conclusion() {
  step_name=$1
  conclusion=$(printf '%s' "$jobs_json" | jq -r --arg name "$step_name" '[.[]?.steps[]? | select(.name == $name) | .conclusion] | first // empty')
  [ -n "$conclusion" ] || fail "workflow step missing from run: $step_name"
  printf '%s' "$conclusion"
}

validate_step() {
  step_name=$1
  required=$2
  conclusion=$(step_conclusion "$step_name")
  case "$required" in
    true)
      [ "$conclusion" = "success" ] || fail "required step '$step_name' did not succeed (conclusion=$conclusion)"
      ;;
    false)
      case "$conclusion" in
        success|skipped) ;;
        *) fail "optional step '$step_name' had unexpected conclusion: $conclusion" ;;
      esac
      ;;
    *)
      fail "invalid required flag for step '$step_name': $required"
      ;;
  esac
  printf '%s\n' "$conclusion"
}

github_controls_conclusion=$(validate_step "Verify GitHub controls" "$REQUIRE_GITHUB_CONTROLS")
observability_conclusion=$(validate_step "Verify live observability" "$REQUIRE_OBSERVABILITY")
release_render_conclusion=$(validate_step "Verify release render overrides" "$REQUIRE_RELEASE_RENDER")
upload_artifact_conclusion=$(validate_step "Upload render artifact" "$REQUIRE_RELEASE_RENDER")

printf 'live v2 workflow run verification passed\n'
printf 'run_id: %s\n' "$WORKFLOW_RUN_ID"
printf 'run_url: %s\n' "$run_html_url"
printf 'event_filter: %s\n' "$WORKFLOW_EVENT_DISPLAY"
printf 'verify_github_controls: %s\n' "$github_controls_conclusion"
printf 'verify_live_observability: %s\n' "$observability_conclusion"
printf 'verify_release_render_overrides: %s\n' "$release_render_conclusion"
printf 'upload_render_artifact: %s\n' "$upload_artifact_conclusion"

if [ -n "$WORKFLOW_RUN_ID_OUTPUT_FILE" ]; then
  mkdir -p "$(dirname "$WORKFLOW_RUN_ID_OUTPUT_FILE")"
  umask 077
  printf '%s\n' "$WORKFLOW_RUN_ID" >"$WORKFLOW_RUN_ID_OUTPUT_FILE"
  printf 'workflow_run_id_file: %s\n' "$WORKFLOW_RUN_ID_OUTPUT_FILE"
fi
