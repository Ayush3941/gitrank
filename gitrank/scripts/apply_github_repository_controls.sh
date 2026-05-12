#!/usr/bin/env sh
set -eu

REPOSITORY="${GITHUB_REPOSITORY:-}"
TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-}}"
API_BASE="${GITHUB_API_URL:-https://api.github.com}"
API_VERSION="${GITHUB_API_VERSION:-2026-03-10}"
TMP_ROOT="${TMPDIR:-/tmp}"
APPLY_CONFIRMATION="${GITRANK_APPLY_REPOSITORY_CONTROLS:-}"
STATUS_CHECKS="${GITRANK_REQUIRED_STATUS_CHECKS:-}"

fail() {
  printf 'github repository controls apply failed: %s\n' "$1" >&2
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

[ -n "$TOKEN" ] || fail "GITHUB_TOKEN or GH_TOKEN is required with repository administration write access"
[ "$APPLY_CONFIRMATION" = "yes" ] || fail "set GITRANK_APPLY_REPOSITORY_CONTROLS=yes to allow live GitHub mutations"
[ -n "$STATUS_CHECKS" ] || fail "GITRANK_REQUIRED_STATUS_CHECKS is required; use exact check names from a recent successful PR"

require_command curl
require_command jq
mkdir -p "$TMP_ROOT"

OWNER=${REPOSITORY%%/*}
REPO=${REPOSITORY#*/}
API_STATUS=
API_BODY=

github_request() {
  method=$1
  path=$2
  data_file=${3:-}
  body_file="$TMP_ROOT/gitrank-github-controls-apply.$$"
  if [ -n "$data_file" ]; then
    API_STATUS=$(curl -sS -L -X "$method" -o "$body_file" -w '%{http_code}' \
      -H 'Accept: application/vnd.github+json' \
      -H "Authorization: Bearer $TOKEN" \
      -H "X-GitHub-Api-Version: $API_VERSION" \
      --data-binary "@$data_file" \
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

expect_status() {
  expected=$1
  context=$2
  [ "$API_STATUS" = "$expected" ] || fail "$context returned HTTP $API_STATUS"
}

checks_json=$(printf '%s' "$STATUS_CHECKS" | tr ',' '\n' | jq -R 'gsub("^\\s+|\\s+$"; "")' | jq -s 'map(select(length > 0))')
check_count=$(printf '%s' "$checks_json" | jq 'length')
[ "$check_count" -gt 0 ] || fail "GITRANK_REQUIRED_STATUS_CHECKS did not contain any check names"

github_request GET "/repos/$OWNER/$REPO"
expect_status 200 "repository metadata"
DEFAULT_BRANCH=$(printf '%s' "$API_BODY" | jq -r '.default_branch // empty')
[ -n "$DEFAULT_BRANCH" ] || fail "repository default branch is empty"
TARGET_BRANCH="${GITHUB_DEFAULT_BRANCH:-$DEFAULT_BRANCH}"

github_request PUT "/repos/$OWNER/$REPO/vulnerability-alerts"
expect_status 204 "enable vulnerability alerts and dependency graph"

payload_file="$TMP_ROOT/gitrank-branch-protection-payload.$$"
trap 'rm -f "$payload_file"' EXIT
printf '%s' "$checks_json" | jq '{
  required_status_checks: {
    strict: true,
    contexts: .
  },
  enforce_admins: false,
  required_pull_request_reviews: {
    dismiss_stale_reviews: false,
    require_code_owner_reviews: false,
    required_approving_review_count: 1,
    require_last_push_approval: false
  },
  restrictions: null,
  required_linear_history: false,
  allow_force_pushes: false,
  allow_deletions: false,
  block_creations: false,
  required_conversation_resolution: false,
  lock_branch: false,
  allow_fork_syncing: true
}' >"$payload_file"

github_request PUT "/repos/$OWNER/$REPO/branches/$TARGET_BRANCH/protection" "$payload_file"
case "$API_STATUS" in
  200|201) ;;
  *) fail "update branch protection for $TARGET_BRANCH returned HTTP $API_STATUS" ;;
esac

printf 'GitHub repository controls applied for %s on %s.\n' "$REPOSITORY" "$TARGET_BRANCH"
printf '- vulnerability alerts and dependency graph requested\n'
printf '- pull request review required: 1 approval\n'
printf '- required status checks configured: %s\n' "$check_count"
printf '- force pushes disabled\n'
printf '- branch deletions disabled\n'
printf 'Run make verify-github-repository-controls with the same token to prove the live state.\n'
