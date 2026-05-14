#!/usr/bin/env sh
set -eu

REPOSITORY="${GITHUB_REPOSITORY:-}"
TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-}}"
API_BASE="${GITHUB_API_URL:-https://api.github.com}"
API_VERSION="${GITHUB_API_VERSION:-2026-03-10}"
API_TIMEOUT_SECONDS="${GITHUB_API_TIMEOUT_SECONDS:-30}"
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

require_command curl
require_command jq
mkdir -p "$TMP_ROOT"

OWNER=${REPOSITORY%%/*}
REPO=${REPOSITORY#*/}
API_STATUS=
API_BODY=
AUTH_MODE=authenticated
DISCOVERY_SOURCE=default-branch-head

github_get() {
  path=$1
  body_file="$TMP_ROOT/gitrank-github-check-discovery.$$"
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
    AUTH_MODE=unauthenticated
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
TMP_RUN_SHAS_FILE="$TMP_ROOT/gitrank-required-checks-runs.$$"
trap 'rm -f "$TMP_CHECKS_FILE" "$TMP_RUN_SHAS_FILE"' EXIT
{
  printf '%s' "$CHECK_RUNS_JSON" | jq -r '.check_runs[]?.name // empty'
  printf '%s' "$STATUS_CONTEXT_JSON" | jq -r '.statuses[]?.context // empty'
} | sed '/^$/d' | sort -u >"$TMP_CHECKS_FILE"

CHECK_COUNT=$(wc -l <"$TMP_CHECKS_FILE" | tr -d ' ')
if [ "$CHECK_COUNT" -eq 0 ]; then
  DISCOVERY_SOURCE=recent-successful-runs
  github_get "/repos/$OWNER/$REPO/actions/runs?branch=$DEFAULT_BRANCH&status=completed&per_page=30"
  expect_status 200 "recent workflow runs list"
  printf '%s' "$API_BODY" | jq -r '
    .workflow_runs[]?
    | select(.conclusion == "success")
    | .head_sha // empty
  ' | sed '/^$/d' | awk '!seen[$0]++' | sed -n '1,10p' >"$TMP_RUN_SHAS_FILE"

  while IFS= read -r sha; do
    [ -n "$sha" ] || continue
    github_get "/repos/$OWNER/$REPO/commits/$sha/check-runs?per_page=100"
    [ "$API_STATUS" = "200" ] || continue
    printf '%s' "$API_BODY" | jq -r '.check_runs[]?.name // empty' >>"$TMP_CHECKS_FILE"

    github_get "/repos/$OWNER/$REPO/commits/$sha/status"
    [ "$API_STATUS" = "200" ] || continue
    printf '%s' "$API_BODY" | jq -r '.statuses[]?.context // empty' >>"$TMP_CHECKS_FILE"
  done <"$TMP_RUN_SHAS_FILE"

  tmp_compact_file="$TMP_ROOT/gitrank-required-checks-compact.$$"
  sed '/^$/d' "$TMP_CHECKS_FILE" >"$tmp_compact_file"
  mv "$tmp_compact_file" "$TMP_CHECKS_FILE"
  sort -u "$TMP_CHECKS_FILE" -o "$TMP_CHECKS_FILE"
  CHECK_COUNT=$(wc -l <"$TMP_CHECKS_FILE" | tr -d ' ')
fi

[ "$CHECK_COUNT" -gt 0 ] || fail "no check contexts discovered from default branch head or recent successful runs"

CSV_CONTEXTS=$(paste -sd, "$TMP_CHECKS_FILE")

printf 'Repository: %s\n' "$REPOSITORY"
printf 'Auth mode: %s\n' "$AUTH_MODE"
printf 'Discovery source: %s\n' "$DISCOVERY_SOURCE"
printf 'Default branch: %s\n' "$DEFAULT_BRANCH"
printf 'Head SHA: %s\n' "$DEFAULT_SHA"
printf 'Discovered checks (%s):\n' "$CHECK_COUNT"
cat "$TMP_CHECKS_FILE"
printf '\n'
printf 'Suggested GITRANK_REQUIRED_STATUS_CHECKS value:\n'
printf '%s\n' "$CSV_CONTEXTS"
printf '\n'
printf 'Review the list before apply. Keep only required merge-gate checks.\n'
