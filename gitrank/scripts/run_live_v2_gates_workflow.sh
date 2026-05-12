#!/usr/bin/env sh
set -eu

REPOSITORY="${GITHUB_REPOSITORY:-}"
TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-}}"
API_BASE="${GITHUB_API_URL:-https://api.github.com}"
API_VERSION="${GITHUB_API_VERSION:-2026-03-10}"
WORKFLOW_FILE="${WORKFLOW_FILE:-verify-live-v2-gates.yml}"
TARGET_REF="${TARGET_REF:-main}"
TARGET_ENVIRONMENT="${TARGET_ENVIRONMENT:-staging}"
RUN_OBSERVABILITY="${RUN_OBSERVABILITY:-true}"
RUN_GITHUB_CONTROLS="${RUN_GITHUB_CONTROLS:-true}"
APPLY_GITHUB_CONTROLS="${APPLY_GITHUB_CONTROLS:-false}"
RUN_RELEASE_RENDER="${RUN_RELEASE_RENDER:-true}"
WAIT_FOR_COMPLETION="${WAIT_FOR_COMPLETION:-true}"
WAIT_TIMEOUT_SECONDS="${WAIT_TIMEOUT_SECONDS:-900}"
POLL_INTERVAL_SECONDS="${POLL_INTERVAL_SECONDS:-10}"
TMP_ROOT="${TMPDIR:-/tmp}"

fail() {
  printf 'live v2 workflow dispatch failed: %s\n' "$1" >&2
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
[ -n "$TOKEN" ] || fail "GITHUB_TOKEN or GH_TOKEN is required"

require_command curl
require_command jq
require_command date
require_command mktemp
mkdir -p "$TMP_ROOT"

OWNER=${REPOSITORY%%/*}
REPO=${REPOSITORY#*/}
API_STATUS=
API_BODY=

request_id="v2-live-$(date -u +%Y%m%dT%H%M%SZ)-$$"

json_request() {
  method=$1
  path=$2
  payload=${3:-}
  body_file="$TMP_ROOT/gitrank-live-v2-run.$$"
  if [ -n "$payload" ]; then
    API_STATUS=$(curl -sS -L -X "$method" -o "$body_file" -w '%{http_code}' \
      -H 'Accept: application/vnd.github+json' \
      -H "Authorization: Bearer $TOKEN" \
      -H "X-GitHub-Api-Version: $API_VERSION" \
      -H 'Content-Type: application/json' \
      --data "$payload" \
      "$API_BASE$path") || {
        rm -f "$body_file"
        fail "GitHub API request failed for $method $path"
      }
  else
    API_STATUS=$(curl -sS -L -X "$method" -o "$body_file" -w '%{http_code}' \
      -H 'Accept: application/vnd.github+json' \
      -H "Authorization: Bearer $TOKEN" \
      -H "X-GitHub-Api-Version: $API_VERSION" \
      "$API_BASE$path") || {
        rm -f "$body_file"
        fail "GitHub API request failed for $method $path"
      }
  fi
  API_BODY=$(cat "$body_file")
  rm -f "$body_file"
}

start_epoch=$(date -u +%s)

dispatch_payload=$(jq -n \
  --arg ref "$TARGET_REF" \
  --arg env "$TARGET_ENVIRONMENT" \
  --arg run_observability "$RUN_OBSERVABILITY" \
  --arg run_github_controls "$RUN_GITHUB_CONTROLS" \
  --arg apply_github_controls "$APPLY_GITHUB_CONTROLS" \
  --arg run_release_render "$RUN_RELEASE_RENDER" \
  --arg request_id "$request_id" \
  '{
    ref: $ref,
    inputs: {
      environment: $env,
      run_observability: $run_observability,
      run_github_controls: $run_github_controls,
      apply_github_controls: $apply_github_controls,
      run_release_render: $run_release_render,
      request_id: $request_id
    }
  }')

json_request POST "/repos/$OWNER/$REPO/actions/workflows/$WORKFLOW_FILE/dispatches" "$dispatch_payload"
case "$API_STATUS" in
  201|202|204) ;;
  *) fail "workflow dispatch returned HTTP $API_STATUS" ;;
esac

printf 'workflow dispatch accepted\n'
printf 'repository: %s\n' "$REPOSITORY"
printf 'workflow: %s\n' "$WORKFLOW_FILE"
printf 'request_id: %s\n' "$request_id"

if [ "$WAIT_FOR_COMPLETION" != "true" ]; then
  exit 0
fi

deadline=$((start_epoch + WAIT_TIMEOUT_SECONDS))
matched_run_id=
matched_run_url=
matched_status=
matched_conclusion=

while :; do
  now=$(date -u +%s)
  [ "$now" -le "$deadline" ] || fail "timed out waiting for workflow run"

  json_request GET "/repos/$OWNER/$REPO/actions/workflows/$WORKFLOW_FILE/runs?event=workflow_dispatch&per_page=20"
  [ "$API_STATUS" = "200" ] || fail "workflow runs query returned HTTP $API_STATUS"

  matched_run_json=$(printf '%s' "$API_BODY" | jq -c --arg start "$start_epoch" '
    .workflow_runs
    | map(select((.created_at | fromdateiso8601) >= ($start | tonumber)))
    | sort_by(.created_at)
    | reverse
    | .[0] // empty
  ')

  if [ -n "$matched_run_json" ] && [ "$matched_run_json" != "null" ]; then
    matched_run_id=$(printf '%s' "$matched_run_json" | jq -r '.id')
    matched_run_url=$(printf '%s' "$matched_run_json" | jq -r '.html_url')
    matched_status=$(printf '%s' "$matched_run_json" | jq -r '.status')
    matched_conclusion=$(printf '%s' "$matched_run_json" | jq -r '.conclusion // ""')

    printf 'run id: %s status: %s conclusion: %s\n' "$matched_run_id" "$matched_status" "$matched_conclusion"
    printf 'run url: %s\n' "$matched_run_url"

    case "$matched_status" in
      completed)
        if [ "$matched_conclusion" = "success" ]; then
          printf 'workflow run completed successfully\n'
          exit 0
        fi
        fail "workflow run completed with conclusion: $matched_conclusion ($matched_run_url)"
        ;;
    esac
  fi

  sleep "$POLL_INTERVAL_SECONDS"
done
