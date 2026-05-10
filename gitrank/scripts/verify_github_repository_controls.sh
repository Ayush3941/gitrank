#!/usr/bin/env sh
set -eu

REPOSITORY="${GITHUB_REPOSITORY:-Ayush3941/gitrank}"
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

case "$REPOSITORY" in
  */*) ;;
  *) fail "GITHUB_REPOSITORY must use owner/name form" ;;
esac

[ -n "${GITHUB_TOKEN:-}" ] || fail "GITHUB_TOKEN is required with repository administration/security read access"

require_command curl
require_command jq
mkdir -p "$TMP_ROOT"

OWNER=${REPOSITORY%%/*}
REPO=${REPOSITORY#*/}
API_STATUS=
API_BODY=

github_get() {
  path=$1
  body_file="$TMP_ROOT/gitrank-github-controls.$$"
  API_STATUS=$(curl -sS -L -o "$body_file" -w '%{http_code}' \
    -H 'Accept: application/vnd.github+json' \
    -H "Authorization: Bearer $GITHUB_TOKEN" \
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
TARGET_BRANCH="${GITHUB_DEFAULT_BRANCH:-$DEFAULT_BRANCH}"

github_get "/repos/$OWNER/$REPO/branches/$TARGET_BRANCH/protection"
if [ "$API_STATUS" != "200" ]; then
  fail "branch protection for $TARGET_BRANCH returned HTTP $API_STATUS; if using repository rulesets, verify an equivalent ruleset export manually"
fi

REVIEW_COUNT=$(printf '%s' "$API_BODY" | jq -r '.required_pull_request_reviews.required_approving_review_count // 0')
[ "$REVIEW_COUNT" -ge 1 ] || fail "branch protection must require at least one approving pull request review"

REQUIRED_CHECKS=$(printf '%s' "$API_BODY" | jq -r '((.required_status_checks.contexts // []) | length) + ((.required_status_checks.checks // []) | length)')
[ "$REQUIRED_CHECKS" -ge 1 ] || fail "branch protection must require at least one status check"

ALLOW_FORCE_PUSHES=$(printf '%s' "$API_BODY" | jq -r '.allow_force_pushes.enabled // false')
[ "$ALLOW_FORCE_PUSHES" = "false" ] || fail "branch protection must not allow force pushes"

ALLOW_DELETIONS=$(printf '%s' "$API_BODY" | jq -r '.allow_deletions.enabled // false')
[ "$ALLOW_DELETIONS" = "false" ] || fail "branch protection must not allow branch deletion"

github_get "/repos/$OWNER/$REPO/dependabot/alerts?per_page=1"
expect_status 200 "Dependabot alerts API"

github_get "/repos/$OWNER/$REPO/dependency-graph/sbom"
case "$API_STATUS" in
  200|201|202) ;;
  *) fail "dependency graph SBOM endpoint returned HTTP $API_STATUS" ;;
esac

printf 'GitHub repository controls verified for %s on %s.\n' "$REPOSITORY" "$TARGET_BRANCH"
printf '- pull request review required: %s approval(s)\n' "$REVIEW_COUNT"
printf '- required status checks configured: %s\n' "$REQUIRED_CHECKS"
printf '- force pushes disabled\n'
printf '- branch deletions disabled\n'
printf '- Dependabot alerts API reachable\n'
printf '- dependency graph SBOM endpoint reachable\n'
