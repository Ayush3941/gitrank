#!/usr/bin/env sh
set -eu

REPOSITORY="${GITHUB_REPOSITORY:-}"
TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-${GITRANK_REPO_ADMIN_TOKEN:-}}}"
API_BASE="${GITHUB_API_URL:-https://api.github.com}"
API_VERSION="${GITHUB_API_VERSION:-2026-03-10}"
TARGET_WORKFLOW_FILE="${TARGET_WORKFLOW_FILE:-verify-live-v2-gates.yml}"
TMP_ROOT="${TMPDIR:-/tmp}"
GITHUB_APP_ID="${GITHUB_APP_ID:-${GITRANK_GITHUB_APP_ID:-}}"
GITHUB_APP_INSTALLATION_ID="${GITHUB_APP_INSTALLATION_ID:-${GITRANK_GITHUB_APP_INSTALLATION_ID:-}}"
GITHUB_APP_PRIVATE_KEY_FILE="${GITHUB_APP_PRIVATE_KEY_FILE:-${GITRANK_GITHUB_APP_PRIVATE_KEY_FILE:-}}"
GITHUB_APP_PRIVATE_KEY_PEM="${GITHUB_APP_PRIVATE_KEY_PEM:-${GITRANK_GITHUB_APP_PRIVATE_KEY_PEM:-}}"

fail() {
  printf 'live github access verification failed: %s\n' "$1" >&2
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

  token_file=$(mktemp "$TMP_ROOT/gitrank-live-github-access-token.XXXXXX")
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
  printf 'live github access: bootstrapped token via GitHub App installation credentials\n'
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
[ -n "$TOKEN" ] || fail "GITHUB_TOKEN, GH_TOKEN, or GITRANK_REPO_ADMIN_TOKEN is required (or set GitHub App credentials)"

OWNER=${REPOSITORY%%/*}
REPO=${REPOSITORY#*/}
API_STATUS=
API_BODY=
LAST_CONTEXT=

github_get() {
  path=$1
  context=$2
  LAST_CONTEXT=$context
  body_file="$TMP_ROOT/gitrank-live-github-access.$$"
  API_STATUS=$(curl -sS -L -o "$body_file" -w '%{http_code}' \
    -H 'Accept: application/vnd.github+json' \
    -H "Authorization: Bearer $TOKEN" \
    -H "X-GitHub-Api-Version: $API_VERSION" \
    "$API_BASE$path") || {
      rm -f "$body_file"
      fail "GitHub API request failed for $context"
    }
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

expect_200() {
  [ "$API_STATUS" = "200" ] || {
    case "$API_STATUS" in
      401) fail "$LAST_CONTEXT denied: token invalid or expired (HTTP 401)" ;;
      403)
        if is_rate_limited_response; then
          fail "$LAST_CONTEXT hit GitHub API rate limit (HTTP 403); retry with token/App credentials that have remaining quota"
        fi
        fail "$LAST_CONTEXT denied: token lacks required permission/scope (HTTP 403)"
        ;;
      404) fail "$LAST_CONTEXT denied: endpoint/resource unavailable for this token or repo (HTTP 404)" ;;
      *) fail "$LAST_CONTEXT returned HTTP $API_STATUS" ;;
    esac
  }
}

github_get "/repos/$OWNER/$REPO" "repository metadata"
expect_200
default_branch=$(printf '%s' "$API_BODY" | jq -r '.default_branch // empty')
[ -n "$default_branch" ] || fail "repository default branch is empty"

github_get "/repos/$OWNER/$REPO/actions/workflows/$TARGET_WORKFLOW_FILE" "workflow metadata ($TARGET_WORKFLOW_FILE)"
expect_200

github_get "/repos/$OWNER/$REPO/actions/runs?per_page=1" "workflow runs list"
expect_200

github_get "/repos/$OWNER/$REPO/branches/$default_branch/protection" "branch protection metadata"
expect_200

github_get "/repos/$OWNER/$REPO/dependabot/alerts?per_page=1" "Dependabot alerts API"
expect_200

github_get "/repos/$OWNER/$REPO/dependency-graph/sbom" "dependency graph SBOM"
case "$API_STATUS" in
  200|201|202) ;;
  401) fail "dependency graph SBOM denied: token invalid or expired (HTTP 401)" ;;
  403)
    if is_rate_limited_response; then
      fail "dependency graph SBOM hit GitHub API rate limit (HTTP 403); retry with token/App credentials that have remaining quota"
    fi
    fail "dependency graph SBOM denied: token lacks required permission/scope (HTTP 403)"
    ;;
  404) fail "dependency graph SBOM unavailable for this repo/token (HTTP 404)" ;;
  *) fail "dependency graph SBOM returned HTTP $API_STATUS" ;;
esac

printf 'live github access verification passed for %s\n' "$REPOSITORY"
printf '- default branch: %s\n' "$default_branch"
printf '- branch protection read: ok\n'
printf '- dependabot alerts read: ok\n'
printf '- dependency graph SBOM read: ok\n'
printf '- workflow metadata/read access: ok (%s)\n' "$TARGET_WORKFLOW_FILE"
