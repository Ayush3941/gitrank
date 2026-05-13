#!/usr/bin/env sh
set -eu

REPOSITORY="${GITHUB_REPOSITORY:-}"
TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-${GITRANK_REPO_ADMIN_TOKEN:-}}}"
API_BASE="${GITHUB_API_URL:-https://api.github.com}"
API_VERSION="${GITHUB_API_VERSION:-2026-03-10}"
WORKFLOW_EVENT="${WORKFLOW_EVENT:-push}"
WORKFLOW_BRANCH="${WORKFLOW_BRANCH:-}"
WORKFLOW_NAMES="${WORKFLOW_NAMES:-CI,Frontend CI,Secret Scan,CodeQL,Trivy Scan}"
RUNS_PER_PAGE="${RUNS_PER_PAGE:-100}"
MAX_PAGES="${MAX_PAGES:-5}"
TMP_ROOT="${TMPDIR:-/tmp}"

fail() {
  printf 'public workflow health verification failed: %s\n' "$1" >&2
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

is_positive_int() {
  value=$1
  case "$value" in
    ''|*[!0-9]*) return 1 ;;
    *) [ "$value" -gt 0 ] ;;
  esac
}

trim_spaces() {
  printf '%s' "$1" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//'
}

resolve_repository_from_git_remote

case "$REPOSITORY" in
  */*) ;;
  *) fail "GITHUB_REPOSITORY must use owner/name form (or run from a clone with GitHub origin remote)" ;;
esac

is_positive_int "$RUNS_PER_PAGE" || fail "RUNS_PER_PAGE must be a positive integer"
is_positive_int "$MAX_PAGES" || fail "MAX_PAGES must be a positive integer"

require_command curl
require_command jq
mkdir -p "$TMP_ROOT"

OWNER=${REPOSITORY%%/*}
REPO=${REPOSITORY#*/}
API_STATUS=
API_BODY=

github_get() {
  path=$1
  body_file="$TMP_ROOT/gitrank-workflow-health.$$"
  if [ -n "$TOKEN" ]; then
    API_STATUS=$(curl -sS -L -o "$body_file" -w '%{http_code}' \
      -H 'Accept: application/vnd.github+json' \
      -H "Authorization: Bearer $TOKEN" \
      -H "X-GitHub-Api-Version: $API_VERSION" \
      "$API_BASE$path") || {
        rm -f "$body_file"
        fail "GitHub API request failed for $path"
      }
  else
    API_STATUS=$(curl -sS -L -o "$body_file" -w '%{http_code}' \
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

github_get "/repos/$OWNER/$REPO"
expect_status 200 "repository metadata"

if [ -z "$WORKFLOW_BRANCH" ]; then
  WORKFLOW_BRANCH=$(printf '%s' "$API_BODY" | jq -r '.default_branch // empty')
fi
[ -n "$WORKFLOW_BRANCH" ] || fail "unable to resolve workflow branch"

runs_file="$TMP_ROOT/gitrank-workflow-health-runs.$$"
: >"$runs_file"
trap 'rm -f "$runs_file"' EXIT HUP INT TERM

page=1
while [ "$page" -le "$MAX_PAGES" ]; do
  github_get "/repos/$OWNER/$REPO/actions/runs?branch=$WORKFLOW_BRANCH&event=$WORKFLOW_EVENT&per_page=$RUNS_PER_PAGE&page=$page"
  expect_status 200 "workflow run list page $page"
  page_count=$(printf '%s' "$API_BODY" | jq '.workflow_runs | length')
  page_runs=$(printf '%s' "$API_BODY" | jq -c '.workflow_runs[]?')
  if [ -n "$page_runs" ]; then
    printf '%s\n' "$page_runs" >>"$runs_file"
  fi
  [ "$page_count" -lt "$RUNS_PER_PAGE" ] && break
  page=$((page + 1))
done

total_runs=$(awk 'END { print NR + 0 }' "$runs_file")
[ "$total_runs" -gt 0 ] || fail "no workflow runs found for branch '$WORKFLOW_BRANCH' and event '$WORKFLOW_EVENT'"

workflow_count=0
failed_workflow_count=0
missing_workflow_count=0

old_ifs=$IFS
IFS=','
for raw_workflow_name in $WORKFLOW_NAMES; do
  workflow_name=$(trim_spaces "$raw_workflow_name")
  [ -n "$workflow_name" ] || continue
  workflow_count=$((workflow_count + 1))

  latest_run=$(jq -s -c --arg name "$workflow_name" '
    [
      .[]?
      | select(.name == $name)
    ]
    | sort_by(.created_at)
    | reverse
    | .[0] // empty
  ' "$runs_file")

  if [ -z "$latest_run" ]; then
    missing_workflow_count=$((missing_workflow_count + 1))
    printf 'workflow missing: %s (no matching run in the last %s page(s))\n' "$workflow_name" "$MAX_PAGES" >&2
    continue
  fi

  run_id=$(printf '%s' "$latest_run" | jq -r '.id // empty')
  run_status=$(printf '%s' "$latest_run" | jq -r '.status // empty')
  run_conclusion=$(printf '%s' "$latest_run" | jq -r '.conclusion // empty')
  run_created_at=$(printf '%s' "$latest_run" | jq -r '.created_at // empty')
  run_url=$(printf '%s' "$latest_run" | jq -r '.html_url // empty')

  [ -n "$run_id" ] || fail "workflow '$workflow_name' latest run is missing id"

  if [ "$run_status" = "completed" ] && [ "$run_conclusion" = "success" ]; then
    printf 'workflow ok: %s (run_id=%s created_at=%s)\n' "$workflow_name" "$run_id" "$run_created_at"
    continue
  fi

  failed_workflow_count=$((failed_workflow_count + 1))
  printf 'workflow unhealthy: %s status=%s conclusion=%s run_id=%s url=%s\n' \
    "$workflow_name" "$run_status" "$run_conclusion" "$run_id" "$run_url" >&2

  github_get "/repos/$OWNER/$REPO/actions/runs/$run_id/jobs?per_page=100"
  if [ "$API_STATUS" = "200" ]; then
    failing_jobs=$(printf '%s' "$API_BODY" | jq -r '
      [
        .jobs[]?
        | select((.conclusion // "null") != "success")
        | "- " + .name + " (" + ((.conclusion // .status // "unknown")) + ")"
      ]
      | unique
      | .[]
    ')
    if [ -n "$failing_jobs" ]; then
      printf 'failing jobs for %s:\n%s\n' "$workflow_name" "$failing_jobs" >&2
    fi
  fi
done
IFS=$old_ifs

[ "$workflow_count" -gt 0 ] || fail "WORKFLOW_NAMES resolved to an empty set"

if [ "$missing_workflow_count" -gt 0 ] || [ "$failed_workflow_count" -gt 0 ]; then
  fail "checked $workflow_count workflow(s): missing=$missing_workflow_count unhealthy=$failed_workflow_count"
fi

printf 'public workflow health verification passed for %s (%s/%s)\n' "$REPOSITORY" "$WORKFLOW_EVENT" "$WORKFLOW_BRANCH"
