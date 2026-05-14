#!/usr/bin/env sh
set -eu

REPOSITORY="${GITHUB_REPOSITORY:-}"
TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-${GITRANK_REPO_ADMIN_TOKEN:-}}}"
API_BASE="${GITHUB_API_URL:-https://api.github.com}"
API_VERSION="${GITHUB_API_VERSION:-2026-03-10}"
API_TIMEOUT_SECONDS="${GITHUB_API_TIMEOUT_SECONDS:-30}"
TARGET_BRANCH="${TARGET_BRANCH:-}"
WORKFLOW_FILE_PATH="${WORKFLOW_FILE_PATH:-.github/workflows/verify-live-v2-gates.yml}"
TMP_ROOT="${TMPDIR:-/tmp}"
GITHUB_APP_ID="${GITHUB_APP_ID:-${GITRANK_GITHUB_APP_ID:-}}"
GITHUB_APP_INSTALLATION_ID="${GITHUB_APP_INSTALLATION_ID:-${GITRANK_GITHUB_APP_INSTALLATION_ID:-}}"
GITHUB_APP_PRIVATE_KEY_FILE="${GITHUB_APP_PRIVATE_KEY_FILE:-${GITRANK_GITHUB_APP_PRIVATE_KEY_FILE:-}}"
GITHUB_APP_PRIVATE_KEY_PEM="${GITHUB_APP_PRIVATE_KEY_PEM:-${GITRANK_GITHUB_APP_PRIVATE_KEY_PEM:-}}"

fail() {
  printf 'verify remote live-v2 workflow sync failed: %s\n' "$1" >&2
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

bootstrap_token_from_github_app() {
  [ -n "$TOKEN" ] && return 0
  [ -n "$GITHUB_APP_ID" ] || return 1
  [ -n "$GITHUB_APP_INSTALLATION_ID" ] || return 1
  if [ -z "$GITHUB_APP_PRIVATE_KEY_FILE" ] && [ -z "$GITHUB_APP_PRIVATE_KEY_PEM" ]; then
    return 1
  fi

  token_file=$(mktemp "$TMP_ROOT/gitrank-verify-live-v2-workflow-sync-token.XXXXXX")
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
  printf 'verify remote live-v2 workflow sync: bootstrapped token via GitHub App installation credentials\n'
}

is_rate_limited_response() {
  message=$(printf '%s' "$API_BODY" | jq -r '.message // empty' 2>/dev/null || true)
  case "$message" in
    *"API rate limit exceeded"*) return 0 ;;
    *) return 1 ;;
  esac
}

resolve_repository_from_git_remote

case "$REPOSITORY" in
  */*) ;;
  *) fail "GITHUB_REPOSITORY must use owner/name form (or run from a clone with GitHub origin remote)" ;;
esac

require_command curl
require_command jq
require_command base64
require_command mktemp
mkdir -p "$TMP_ROOT"
bootstrap_token_from_github_app || true

root_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
repo_dir="$(CDPATH= cd -- "$root_dir/.." && pwd)"
local_workflow_file="$repo_dir/$WORKFLOW_FILE_PATH"
[ -s "$local_workflow_file" ] || fail "local file missing: $local_workflow_file"

OWNER=${REPOSITORY%%/*}
REPO=${REPOSITORY#*/}
API_STATUS=
API_BODY=

github_get() {
  path=$1
  body_file="$TMP_ROOT/gitrank-verify-live-v2-workflow-sync.$$"
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

github_get "/repos/$OWNER/$REPO"
case "$API_STATUS" in
  200) ;;
  401) fail "repository metadata lookup requires authentication; set GITHUB_TOKEN, GH_TOKEN, GITRANK_REPO_ADMIN_TOKEN, or GitHub App credentials" ;;
  403)
    if is_rate_limited_response; then
      fail "repository metadata hit GitHub API rate limit (HTTP 403); provide token or GitHub App credentials"
    fi
    fail "repository metadata lookup denied (HTTP 403)"
    ;;
  404) fail "repository not found or inaccessible: $REPOSITORY" ;;
  *) fail "repository metadata lookup returned HTTP $API_STATUS" ;;
esac

if [ -z "$TARGET_BRANCH" ]; then
  TARGET_BRANCH=$(printf '%s' "$API_BODY" | jq -r '.default_branch // empty')
fi
[ -n "$TARGET_BRANCH" ] || fail "unable to resolve target branch"

github_get "/repos/$OWNER/$REPO/contents/$WORKFLOW_FILE_PATH?ref=$TARGET_BRANCH"
case "$API_STATUS" in
  200) ;;
  401) fail "remote workflow contents lookup requires authentication" ;;
  403)
    if is_rate_limited_response; then
      fail "remote workflow contents lookup hit GitHub API rate limit (HTTP 403); provide token or GitHub App credentials"
    fi
    fail "remote workflow contents lookup denied (HTTP 403)"
    ;;
  404) fail "remote workflow file is missing on $REPOSITORY@$TARGET_BRANCH: $WORKFLOW_FILE_PATH (run make sync-remote-live-v2-workflow)" ;;
  *) fail "remote workflow contents lookup returned HTTP $API_STATUS" ;;
esac

remote_encoding=$(printf '%s' "$API_BODY" | jq -r '.encoding // empty')
[ "$remote_encoding" = "base64" ] || fail "unexpected remote contents encoding: $remote_encoding"
remote_content_base64=$(printf '%s' "$API_BODY" | jq -r '.content // empty' | tr -d '\n')
remote_content=$(printf '%s' "$remote_content_base64" | base64 -d 2>/dev/null || true)
local_content=$(cat "$local_workflow_file")

[ "$remote_content" = "$local_content" ] || fail "remote workflow content drift detected for $WORKFLOW_FILE_PATH on $REPOSITORY@$TARGET_BRANCH (run make sync-remote-live-v2-workflow)"

printf 'remote live-v2 workflow sync verification passed\n'
printf 'repository: %s\n' "$REPOSITORY"
printf 'branch: %s\n' "$TARGET_BRANCH"
printf 'path: %s\n' "$WORKFLOW_FILE_PATH"
