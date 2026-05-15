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
DISCOVERY_SOURCE=recent-successful-pull-request-runs

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

is_rate_limited_response() {
  message=$(printf '%s' "$API_BODY" | jq -r '.message // empty' 2>/dev/null || true)
  case "$message" in
    *"API rate limit exceeded"*) return 0 ;;
    *) return 1 ;;
  esac
}

expect_status() {
  expected=$1
  context=$2
  if [ "$API_STATUS" != "$expected" ]; then
    if [ "$API_STATUS" = "403" ] && is_rate_limited_response; then
      fail "$context hit GitHub API rate limit (HTTP 403); set GITHUB_TOKEN or GH_TOKEN for higher quota"
    fi
    fail "$context returned HTTP $API_STATUS"
  fi
}

github_get "/repos/$OWNER/$REPO"
expect_status 200 "repository metadata"

DEFAULT_BRANCH=$(printf '%s' "$API_BODY" | jq -r '.default_branch // empty')
[ -n "$DEFAULT_BRANCH" ] || fail "repository default branch is empty"

TMP_CHECKS_FILE="$TMP_ROOT/gitrank-required-checks.$$"
TMP_RUN_SHAS_FILE="$TMP_ROOT/gitrank-required-checks-runs.$$"
TMP_COMPACT_FILE="$TMP_ROOT/gitrank-required-checks-compact.$$"
TMP_RUN_SHAS_COMPACT_FILE="$TMP_ROOT/gitrank-required-checks-runs-compact.$$"
trap 'rm -f "$TMP_CHECKS_FILE" "$TMP_RUN_SHAS_FILE" "$TMP_COMPACT_FILE" "$TMP_RUN_SHAS_COMPACT_FILE"' EXIT
: >"$TMP_CHECKS_FILE"

append_checks_for_sha() {
  sha=$1
  [ -n "$sha" ] || return 0
  github_get "/repos/$OWNER/$REPO/commits/$sha/check-runs?per_page=100"
  [ "$API_STATUS" = "200" ] || return 0
  printf '%s' "$API_BODY" | jq -r '.check_runs[]?.name // empty' >>"$TMP_CHECKS_FILE"

  github_get "/repos/$OWNER/$REPO/commits/$sha/status"
  [ "$API_STATUS" = "200" ] || return 0
  printf '%s' "$API_BODY" | jq -r '.statuses[]?.context // empty' >>"$TMP_CHECKS_FILE"
}

append_successful_run_shas_for_event() {
  event_name=$1
  github_get "/repos/$OWNER/$REPO/actions/runs?event=$event_name&status=completed&per_page=50"
  case "$API_STATUS" in
    200)
      printf '%s' "$API_BODY" | jq -r '
        .workflow_runs[]?
        | select(.conclusion == "success")
        | .head_sha // empty
      ' >>"$TMP_RUN_SHAS_FILE"
      ;;
    422)
      # Older API variants may reject some event filters; ignore and continue.
      ;;
    *)
      expect_status 200 "successful $event_name workflow runs list"
      ;;
  esac
}

: >"$TMP_RUN_SHAS_FILE"
append_successful_run_shas_for_event pull_request
append_successful_run_shas_for_event pull_request_target
sed '/^$/d' "$TMP_RUN_SHAS_FILE" | awk '!seen[$0]++' | sed -n '1,10p' >"$TMP_RUN_SHAS_COMPACT_FILE"
mv "$TMP_RUN_SHAS_COMPACT_FILE" "$TMP_RUN_SHAS_FILE"

while IFS= read -r sha; do
  append_checks_for_sha "$sha"
done <"$TMP_RUN_SHAS_FILE"

sed '/^$/d' "$TMP_CHECKS_FILE" >"$TMP_COMPACT_FILE"
mv "$TMP_COMPACT_FILE" "$TMP_CHECKS_FILE"
sort -u "$TMP_CHECKS_FILE" -o "$TMP_CHECKS_FILE"

CHECK_COUNT=$(wc -l <"$TMP_CHECKS_FILE" | tr -d ' ')
if [ "$CHECK_COUNT" -eq 0 ]; then
  DISCOVERY_SOURCE=default-branch-head

  github_get "/repos/$OWNER/$REPO/branches/$DEFAULT_BRANCH"
  expect_status 200 "default branch metadata"
  default_sha=$(printf '%s' "$API_BODY" | jq -r '.commit.sha // empty')
  [ -n "$default_sha" ] || fail "default branch head SHA is empty"
  DEFAULT_SHA=$default_sha
  append_checks_for_sha "$default_sha"

  sed '/^$/d' "$TMP_CHECKS_FILE" >"$TMP_COMPACT_FILE"
  mv "$TMP_COMPACT_FILE" "$TMP_CHECKS_FILE"
  sort -u "$TMP_CHECKS_FILE" -o "$TMP_CHECKS_FILE"
  CHECK_COUNT=$(wc -l <"$TMP_CHECKS_FILE" | tr -d ' ')
fi

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
    append_checks_for_sha "$sha"
  done <"$TMP_RUN_SHAS_FILE"

  sed '/^$/d' "$TMP_CHECKS_FILE" >"$TMP_COMPACT_FILE"
  mv "$TMP_COMPACT_FILE" "$TMP_CHECKS_FILE"
  sort -u "$TMP_CHECKS_FILE" -o "$TMP_CHECKS_FILE"
  CHECK_COUNT=$(wc -l <"$TMP_CHECKS_FILE" | tr -d ' ')
fi

[ "$CHECK_COUNT" -gt 0 ] || fail "no check contexts discovered from successful pull_request runs, default branch head, or recent successful runs"

if [ "$DISCOVERY_SOURCE" = "default-branch-head" ] && [ -z "${DEFAULT_SHA:-}" ]; then
  DEFAULT_SHA=unknown
fi

CSV_CONTEXTS=$(paste -sd, "$TMP_CHECKS_FILE")

printf 'Repository: %s\n' "$REPOSITORY"
printf 'Auth mode: %s\n' "$AUTH_MODE"
printf 'Discovery source: %s\n' "$DISCOVERY_SOURCE"
printf 'Default branch: %s\n' "$DEFAULT_BRANCH"
printf 'Head SHA: %s\n' "${DEFAULT_SHA:-n/a}"
printf 'Discovered checks (%s):\n' "$CHECK_COUNT"
cat "$TMP_CHECKS_FILE"
printf '\n'
printf 'Suggested GITRANK_REQUIRED_STATUS_CHECKS value:\n'
printf '%s\n' "$CSV_CONTEXTS"
printf '\n'
printf 'Review the list before apply. Keep only required merge-gate checks.\n'
