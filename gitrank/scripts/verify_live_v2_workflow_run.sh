#!/usr/bin/env sh
set -eu

REPOSITORY="${GITHUB_REPOSITORY:-}"
TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-${GITRANK_REPO_ADMIN_TOKEN:-}}}"
API_BASE="${GITHUB_API_URL:-https://api.github.com}"
API_VERSION="${GITHUB_API_VERSION:-2026-03-10}"
WORKFLOW_RUN_ID="${WORKFLOW_RUN_ID:-}"
EXPECTED_WORKFLOW_NAME="${EXPECTED_WORKFLOW_NAME:-Verify Live V2 Gates}"
REQUIRE_GITHUB_CONTROLS="${REQUIRE_GITHUB_CONTROLS:-true}"
REQUIRE_OBSERVABILITY="${REQUIRE_OBSERVABILITY:-true}"
REQUIRE_RELEASE_RENDER="${REQUIRE_RELEASE_RENDER:-true}"
TMP_ROOT="${TMPDIR:-/tmp}"

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

case "$REPOSITORY" in
  */*) ;;
  *) fail "GITHUB_REPOSITORY must use owner/name form (or run from a clone with GitHub origin remote)" ;;
esac

[ -n "$TOKEN" ] || fail "GITHUB_TOKEN, GH_TOKEN, or GITRANK_REPO_ADMIN_TOKEN is required"
[ -n "$WORKFLOW_RUN_ID" ] || fail "WORKFLOW_RUN_ID is required"

require_command curl
require_command jq
mkdir -p "$TMP_ROOT"

OWNER=${REPOSITORY%%/*}
REPO=${REPOSITORY#*/}
API_STATUS=
API_BODY=

github_get() {
  path=$1
  body_file="$TMP_ROOT/gitrank-live-v2-workflow-run.$$"
  API_STATUS=$(curl -sS -L -o "$body_file" -w '%{http_code}' \
    -H 'Accept: application/vnd.github+json' \
    -H "Authorization: Bearer $TOKEN" \
    -H "X-GitHub-Api-Version: $API_VERSION" \
    "$API_BASE$path") || {
      rm -f "$body_file"
      fail "GitHub API request failed for $path"
    }
  API_BODY=$(cat "$body_file")
  rm -f "$body_file"
}

expect_status() {
  expected=$1
  context=$2
  [ "$API_STATUS" = "$expected" ] || fail "$context returned HTTP $API_STATUS"
}

github_get "/repos/$OWNER/$REPO/actions/runs/$WORKFLOW_RUN_ID"
expect_status 200 "workflow run metadata"

run_name=$(printf '%s' "$API_BODY" | jq -r '.name // empty')
run_status=$(printf '%s' "$API_BODY" | jq -r '.status // empty')
run_conclusion=$(printf '%s' "$API_BODY" | jq -r '.conclusion // empty')
run_html_url=$(printf '%s' "$API_BODY" | jq -r '.html_url // empty')

[ -n "$run_name" ] || fail "workflow run name missing"
[ "$run_name" = "$EXPECTED_WORKFLOW_NAME" ] || fail "workflow run name mismatch: expected '$EXPECTED_WORKFLOW_NAME' got '$run_name'"
[ "$run_status" = "completed" ] || fail "workflow run status is not completed: $run_status"
[ "$run_conclusion" = "success" ] || fail "workflow run conclusion is not success: $run_conclusion"

jobs_json='[]'
page=1
while :; do
  github_get "/repos/$OWNER/$REPO/actions/runs/$WORKFLOW_RUN_ID/jobs?per_page=100&page=$page"
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
printf 'verify_github_controls: %s\n' "$github_controls_conclusion"
printf 'verify_live_observability: %s\n' "$observability_conclusion"
printf 'verify_release_render_overrides: %s\n' "$release_render_conclusion"
printf 'upload_render_artifact: %s\n' "$upload_artifact_conclusion"
