#!/usr/bin/env sh
set -eu

REPOSITORY="${GITHUB_REPOSITORY:-}"
TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-}}"
API_BASE="${GITHUB_API_URL:-https://api.github.com}"
API_VERSION="${GITHUB_API_VERSION:-2026-03-10}"
TMP_ROOT="${TMPDIR:-/tmp}"

fail() {
  printf 'github required-status-check discovery failed: %s\n' "$1" >&2
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
mkdir -p "$TMP_ROOT"

OWNER=${REPOSITORY%%/*}
REPO=${REPOSITORY#*/}
API_STATUS=
API_BODY=

github_get() {
  path=$1
  body_file="$TMP_ROOT/gitrank-github-check-discovery.$$"
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

github_get "/repos/$OWNER/$REPO"
expect_status 200 "repository metadata"

DEFAULT_BRANCH=$(printf '%s' "$API_BODY" | jq -r '.default_branch // empty')
[ -n "$DEFAULT_BRANCH" ] || fail "repository default branch is empty"

github_get "/repos/$OWNER/$REPO/branches/$DEFAULT_BRANCH"
expect_status 200 "default branch metadata"

DEFAULT_SHA=$(printf '%s' "$API_BODY" | jq -r '.commit.sha // empty')
[ -n "$DEFAULT_SHA" ] || fail "default branch head SHA is empty"

github_get "/repos/$OWNER/$REPO/commits/$DEFAULT_SHA/check-runs?per_page=100"
expect_status 200 "check-runs list"
CHECK_RUNS_JSON=$API_BODY

github_get "/repos/$OWNER/$REPO/commits/$DEFAULT_SHA/status"
expect_status 200 "commit status contexts"
STATUS_CONTEXT_JSON=$API_BODY

TMP_CHECKS_FILE="$TMP_ROOT/gitrank-required-checks.$$"
trap 'rm -f "$TMP_CHECKS_FILE"' EXIT
{
  printf '%s' "$CHECK_RUNS_JSON" | jq -r '.check_runs[]?.name // empty'
  printf '%s' "$STATUS_CONTEXT_JSON" | jq -r '.statuses[]?.context // empty'
} | sed '/^$/d' | sort -u >"$TMP_CHECKS_FILE"

CHECK_COUNT=$(wc -l <"$TMP_CHECKS_FILE" | tr -d ' ')
[ "$CHECK_COUNT" -gt 0 ] || fail "no check contexts discovered from default branch head"

CSV_CONTEXTS=$(paste -sd, "$TMP_CHECKS_FILE")

printf 'Repository: %s\n' "$REPOSITORY"
printf 'Default branch: %s\n' "$DEFAULT_BRANCH"
printf 'Head SHA: %s\n' "$DEFAULT_SHA"
printf 'Discovered checks (%s):\n' "$CHECK_COUNT"
cat "$TMP_CHECKS_FILE"
printf '\n'
printf 'Suggested GITRANK_REQUIRED_STATUS_CHECKS value:\n'
printf '%s\n' "$CSV_CONTEXTS"
printf '\n'
printf 'Review the list before apply. Keep only required merge-gate checks.\n'
