#!/usr/bin/env sh
set -eu

REPOSITORY="${GITHUB_REPOSITORY:-}"
TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-${GITRANK_REPO_ADMIN_TOKEN:-}}}"
API_BASE="${GITHUB_API_URL:-https://api.github.com}"
API_VERSION="${GITHUB_API_VERSION:-2026-03-10}"
REQUIRE_FULL_VERIFICATION="${REQUIRE_FULL_VERIFICATION:-false}"
TMP_ROOT="${TMPDIR:-/tmp}"

fail() {
  printf 'github repository controls public verification failed: %s\n' "$1" >&2
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

github_get() {
  path=$1
  body_file="$TMP_ROOT/gitrank-github-controls-public.$$"
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

DEFAULT_BRANCH=$(printf '%s' "$API_BODY" | jq -r '.default_branch // empty')
[ -n "$DEFAULT_BRANCH" ] || fail "repository default branch is empty"
TARGET_BRANCH="${GITHUB_DEFAULT_BRANCH:-$DEFAULT_BRANCH}"

github_get "/repos/$OWNER/$REPO/branches/$TARGET_BRANCH"
expect_status 200 "default branch metadata"

BRANCH_PROTECTED=$(printf '%s' "$API_BODY" | jq -r '.protected // false')
[ "$BRANCH_PROTECTED" = "true" ] || fail "default branch is not protected"

REQUIRED_CHECKS=$(printf '%s' "$API_BODY" | jq -r '((.protection.required_status_checks.contexts // []) | length) + ((.protection.required_status_checks.checks // []) | length)')
[ "$REQUIRED_CHECKS" -ge 1 ] || fail "protected branch does not expose any required status checks"

verification_mode="public-partial"
REVIEW_COUNT="unknown"
ALLOW_FORCE_PUSHES="unknown"
ALLOW_DELETIONS="unknown"
DEPENDABOT_STATUS="unverified"
DEPENDENCY_GRAPH_STATUS="unverified"

if [ -n "$TOKEN" ]; then
  github_get "/repos/$OWNER/$REPO/branches/$TARGET_BRANCH/protection"
  expect_status 200 "branch protection metadata"

  REVIEW_COUNT=$(printf '%s' "$API_BODY" | jq -r '.required_pull_request_reviews.required_approving_review_count // 0')
  [ "$REVIEW_COUNT" -ge 1 ] || fail "branch protection must require at least one approving pull request review"

  ALLOW_FORCE_PUSHES=$(printf '%s' "$API_BODY" | jq -r '.allow_force_pushes.enabled // false')
  [ "$ALLOW_FORCE_PUSHES" = "false" ] || fail "branch protection must not allow force pushes"

  ALLOW_DELETIONS=$(printf '%s' "$API_BODY" | jq -r '.allow_deletions.enabled // false')
  [ "$ALLOW_DELETIONS" = "false" ] || fail "branch protection must not allow branch deletions"

  github_get "/repos/$OWNER/$REPO/dependabot/alerts?per_page=1"
  expect_status 200 "Dependabot alerts API"
  DEPENDABOT_STATUS="verified"

  github_get "/repos/$OWNER/$REPO/dependency-graph/sbom"
  case "$API_STATUS" in
    200|201|202) ;;
    *) fail "dependency graph SBOM endpoint returned HTTP $API_STATUS" ;;
  esac
  DEPENDENCY_GRAPH_STATUS="verified"
  verification_mode="full-authenticated"
fi

if [ "$REQUIRE_FULL_VERIFICATION" = "true" ] && [ "$TOKEN" = "" ]; then
  fail "full verification requested but no token provided"
fi

printf 'GitHub repository controls public verification passed for %s on %s.\n' "$REPOSITORY" "$TARGET_BRANCH"
printf '- verification mode: %s\n' "$verification_mode"
printf '- default branch protected: %s\n' "$BRANCH_PROTECTED"
printf '- required status checks discovered: %s\n' "$REQUIRED_CHECKS"
printf '- required PR approvals: %s\n' "$REVIEW_COUNT"
printf '- force pushes disabled: %s\n' "$ALLOW_FORCE_PUSHES"
printf '- branch deletions disabled: %s\n' "$ALLOW_DELETIONS"
printf '- dependabot alerts API: %s\n' "$DEPENDABOT_STATUS"
printf '- dependency graph SBOM endpoint: %s\n' "$DEPENDENCY_GRAPH_STATUS"
if [ -z "$TOKEN" ]; then
  printf 'note: run full verification with token for dependabot/dependency graph and full branch policy checks\n'
fi
