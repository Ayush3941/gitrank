#!/usr/bin/env sh
set -eu

REPOSITORY="${GITHUB_REPOSITORY:-}"
TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-${GITRANK_REPO_ADMIN_TOKEN:-}}}"
API_BASE="${GITHUB_API_URL:-https://api.github.com}"
API_VERSION="${GITHUB_API_VERSION:-2026-03-10}"
TMP_ROOT="${TMPDIR:-/tmp}"
APPLY_CONFIRMATION="${GITRANK_APPLY_REPOSITORY_CONTROLS:-}"
EXPLICIT_STATUS_CHECKS="${GITRANK_REQUIRED_STATUS_CHECKS:-}"
GITHUB_APP_ID="${GITHUB_APP_ID:-${GITRANK_GITHUB_APP_ID:-}}"
GITHUB_APP_INSTALLATION_ID="${GITHUB_APP_INSTALLATION_ID:-${GITRANK_GITHUB_APP_INSTALLATION_ID:-}}"
GITHUB_APP_PRIVATE_KEY_FILE="${GITHUB_APP_PRIVATE_KEY_FILE:-${GITRANK_GITHUB_APP_PRIVATE_KEY_FILE:-}}"
GITHUB_APP_PRIVATE_KEY_PEM="${GITHUB_APP_PRIVATE_KEY_PEM:-${GITRANK_GITHUB_APP_PRIVATE_KEY_PEM:-}}"

fail() {
  printf 'github repository controls auto-apply failed: %s\n' "$1" >&2
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

  token_file=$(mktemp "$TMP_ROOT/gitrank-github-controls-auto-token.XXXXXX")
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
  printf 'github controls auto-apply: bootstrapped token via GitHub App installation credentials\n'
}

case "$REPOSITORY" in
  */*) ;;
  *) fail "GITHUB_REPOSITORY must use owner/name form (or run from a clone with GitHub origin remote)" ;;
esac

[ "$APPLY_CONFIRMATION" = "yes" ] || fail "set GITRANK_APPLY_REPOSITORY_CONTROLS=yes to allow live GitHub mutations"

require_command curl
require_command jq
require_command sed
require_command sort
require_command paste
require_command mktemp
mkdir -p "$TMP_ROOT"
bootstrap_token_from_github_app || true
[ -n "$TOKEN" ] || fail "GITHUB_TOKEN, GH_TOKEN, or GITRANK_REPO_ADMIN_TOKEN is required with repository administration write access (or set GitHub App credentials)"

OWNER=${REPOSITORY%%/*}
REPO=${REPOSITORY#*/}
API_STATUS=
API_BODY=

github_get() {
  path=$1
  body_file="$TMP_ROOT/gitrank-github-controls-auto.$$"
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

status_checks_csv=$EXPLICIT_STATUS_CHECKS

if [ -z "$status_checks_csv" ]; then
  github_get "/repos/$OWNER/$REPO"
  expect_status 200 "repository metadata"
  default_branch=$(printf '%s' "$API_BODY" | jq -r '.default_branch // empty')
  [ -n "$default_branch" ] || fail "repository default branch is empty"

  github_get "/repos/$OWNER/$REPO/branches/$default_branch"
  expect_status 200 "default branch metadata"
  default_sha=$(printf '%s' "$API_BODY" | jq -r '.commit.sha // empty')
  [ -n "$default_sha" ] || fail "default branch head SHA is empty"

  github_get "/repos/$OWNER/$REPO/commits/$default_sha/check-runs?per_page=100"
  expect_status 200 "check-runs list"
  check_runs_json=$API_BODY

  github_get "/repos/$OWNER/$REPO/commits/$default_sha/status"
  expect_status 200 "commit status contexts"
  status_context_json=$API_BODY

  checks_file=$(mktemp "$TMP_ROOT/gitrank-required-checks-auto.XXXXXX")
  trap 'rm -f "$checks_file"' EXIT
  {
    printf '%s' "$check_runs_json" | jq -r '.check_runs[]?.name // empty'
    printf '%s' "$status_context_json" | jq -r '.statuses[]?.context // empty'
  } | sed '/^$/d' | sort -u >"$checks_file"

  check_count=$(wc -l <"$checks_file" | tr -d ' ')
  [ "$check_count" -gt 0 ] || fail "no check contexts discovered from default branch head"
  status_checks_csv=$(paste -sd, "$checks_file")
fi

[ -n "$status_checks_csv" ] || fail "computed required status checks list was empty"

GITHUB_REPOSITORY="$REPOSITORY" \
GITHUB_TOKEN="$TOKEN" \
GITRANK_APPLY_REPOSITORY_CONTROLS="$APPLY_CONFIRMATION" \
GITRANK_REQUIRED_STATUS_CHECKS="$status_checks_csv" \
TMPDIR="$TMP_ROOT" \
"$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)/apply_github_repository_controls.sh"

printf 'auto-discovered or configured required checks applied: %s\n' "$(printf '%s' "$status_checks_csv" | awk -F',' '{print NF}')"
