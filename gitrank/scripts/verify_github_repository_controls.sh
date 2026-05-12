#!/usr/bin/env sh
set -eu

REPOSITORY="${GITHUB_REPOSITORY:-}"
TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-${GITRANK_REPO_ADMIN_TOKEN:-}}}"
API_BASE="${GITHUB_API_URL:-https://api.github.com}"
API_VERSION="${GITHUB_API_VERSION:-2026-03-10}"
TMP_ROOT="${TMPDIR:-/tmp}"

fail() {
  printf 'github repository controls verification failed: %s\n' "$1" >&2
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

[ -n "$TOKEN" ] || fail "GITHUB_TOKEN, GH_TOKEN, or GITRANK_REPO_ADMIN_TOKEN is required with repository administration/security read access"

require_command curl
require_command jq
mkdir -p "$TMP_ROOT"

OWNER=${REPOSITORY%%/*}
REPO=${REPOSITORY#*/}
API_STATUS=
API_BODY=
CONTROL_MODE=
REVIEW_COUNT=0
REQUIRED_CHECKS=0

github_get() {
  path=$1
  body_file="$TMP_ROOT/gitrank-github-controls.$$"
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

verify_branch_protection_payload() {
  REVIEW_COUNT=$(printf '%s' "$API_BODY" | jq -r '.required_pull_request_reviews.required_approving_review_count // 0')
  [ "$REVIEW_COUNT" -ge 1 ] || fail "branch protection must require at least one approving pull request review"

  REQUIRED_CHECKS=$(printf '%s' "$API_BODY" | jq -r '((.required_status_checks.contexts // []) | length) + ((.required_status_checks.checks // []) | length)')
  [ "$REQUIRED_CHECKS" -ge 1 ] || fail "branch protection must require at least one status check"

  ALLOW_FORCE_PUSHES=$(printf '%s' "$API_BODY" | jq -r '.allow_force_pushes.enabled // false')
  [ "$ALLOW_FORCE_PUSHES" = "false" ] || fail "branch protection must not allow force pushes"

  ALLOW_DELETIONS=$(printf '%s' "$API_BODY" | jq -r '.allow_deletions.enabled // false')
  [ "$ALLOW_DELETIONS" = "false" ] || fail "branch protection must not allow branch deletion"

  CONTROL_MODE="branch protection"
}

verify_ruleset_payload() {
  REVIEW_COUNT=$(printf '%s' "$API_BODY" | jq -r '[.[] | select(.type == "pull_request") | (.parameters.required_approving_review_count // 0)] | max // 0')
  [ "$REVIEW_COUNT" -ge 1 ] || fail "ruleset controls must require at least one approving pull request review"

  REQUIRED_CHECKS=$(printf '%s' "$API_BODY" | jq -r '[.[] | select(.type == "required_status_checks") | (.parameters.required_status_checks // [] | length)] | add // 0')
  [ "$REQUIRED_CHECKS" -ge 1 ] || fail "ruleset controls must require at least one status check"

  HAS_NON_FAST_FORWARD=$(printf '%s' "$API_BODY" | jq -r '[.[] | select(.type == "non_fast_forward")] | length')
  [ "$HAS_NON_FAST_FORWARD" -ge 1 ] || fail "ruleset controls must block force pushes (non_fast_forward rule missing)"

  HAS_DELETION_RULE=$(printf '%s' "$API_BODY" | jq -r '[.[] | select(.type == "deletion")] | length')
  [ "$HAS_DELETION_RULE" -ge 1 ] || fail "ruleset controls must block branch deletion (deletion rule missing)"

  CONTROL_MODE="rulesets"
}

github_get "/repos/$OWNER/$REPO"
expect_status 200 "repository metadata"

DEFAULT_BRANCH=$(printf '%s' "$API_BODY" | jq -r '.default_branch // empty')
[ -n "$DEFAULT_BRANCH" ] || fail "repository default branch is empty"
TARGET_BRANCH="${GITHUB_DEFAULT_BRANCH:-$DEFAULT_BRANCH}"

github_get "/repos/$OWNER/$REPO/branches/$TARGET_BRANCH/protection"
case "$API_STATUS" in
  200)
    verify_branch_protection_payload
    ;;
  404)
    github_get "/repos/$OWNER/$REPO/rules/branches/$TARGET_BRANCH"
    expect_status 200 "ruleset branch rules for $TARGET_BRANCH"
    verify_ruleset_payload
    ;;
  *)
    fail "branch protection lookup for $TARGET_BRANCH returned HTTP $API_STATUS"
    ;;
esac

github_get "/repos/$OWNER/$REPO/dependabot/alerts?per_page=1"
expect_status 200 "Dependabot alerts API"

github_get "/repos/$OWNER/$REPO/dependency-graph/sbom"
case "$API_STATUS" in
  200|201|202) ;;
  *) fail "dependency graph SBOM endpoint returned HTTP $API_STATUS" ;;
esac

printf 'GitHub repository controls verified for %s on %s.\n' "$REPOSITORY" "$TARGET_BRANCH"
printf '- control surface verified via: %s\n' "$CONTROL_MODE"
printf '- pull request review required: %s approval(s)\n' "$REVIEW_COUNT"
printf '- required status checks configured: %s\n' "$REQUIRED_CHECKS"
printf '- force pushes disabled\n'
printf '- branch deletions disabled\n'
printf '- Dependabot alerts API reachable\n'
printf '- dependency graph SBOM endpoint reachable\n'
