#!/usr/bin/env sh
set -eu

REPOSITORY="${GITHUB_REPOSITORY:-}"
TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-${GITRANK_REPO_ADMIN_TOKEN:-}}}"
API_BASE="${GITHUB_API_URL:-https://api.github.com}"
API_VERSION="${GITHUB_API_VERSION:-2026-03-10}"
API_TIMEOUT_SECONDS="${GITHUB_API_TIMEOUT_SECONDS:-30}"
TMP_ROOT="${TMPDIR:-/tmp}"
GITHUB_APP_ID="${GITHUB_APP_ID:-${GITRANK_GITHUB_APP_ID:-}}"
GITHUB_APP_INSTALLATION_ID="${GITHUB_APP_INSTALLATION_ID:-${GITRANK_GITHUB_APP_INSTALLATION_ID:-}}"
GITHUB_APP_PRIVATE_KEY_FILE="${GITHUB_APP_PRIVATE_KEY_FILE:-${GITRANK_GITHUB_APP_PRIVATE_KEY_FILE:-}}"
GITHUB_APP_PRIVATE_KEY_PEM="${GITHUB_APP_PRIVATE_KEY_PEM:-${GITRANK_GITHUB_APP_PRIVATE_KEY_PEM:-}}"

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

bootstrap_token_from_github_app() {
  [ -n "$TOKEN" ] && return 0
  [ -n "$GITHUB_APP_ID" ] || return 1
  [ -n "$GITHUB_APP_INSTALLATION_ID" ] || return 1
  if [ -z "$GITHUB_APP_PRIVATE_KEY_FILE" ] && [ -z "$GITHUB_APP_PRIVATE_KEY_PEM" ]; then
    return 1
  fi

  token_file=$(mktemp "$TMP_ROOT/gitrank-github-controls-verify-token.XXXXXX")
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
  printf 'github controls verification: bootstrapped token via GitHub App installation credentials\n'
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
[ -n "$TOKEN" ] || fail "GITHUB_TOKEN, GH_TOKEN, or GITRANK_REPO_ADMIN_TOKEN is required with repository administration/security read access (or set GitHub App credentials)"

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
    --connect-timeout "$API_TIMEOUT_SECONDS" \
    --max-time "$API_TIMEOUT_SECONDS" \
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
      fail "$context hit GitHub API rate limit (HTTP 403); retry with token/App credentials that have remaining quota"
    fi
    fail "$context returned HTTP $API_STATUS"
  fi
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

rules_json_from_api_body() {
  printf '%s' "$API_BODY" | jq -c '
    def flatten_rulesets(xs):
      [
        xs[]?
        | if (type == "object" and has("rules")) then
            .rules[]?
          else
            .
          end
      ];

    if type == "array" then
      if ((.[0]? | type) == "object") and (.[0]? | has("type")) then
        .
      else
        flatten_rulesets(.)
      end
    elif type == "object" then
      if has("rules") then
        (.rules // [])
      elif has("type") then
        [.]
      else
        []
      end
    else
      []
    end
  '
}

verify_ruleset_payload() {
  rules_json=$1
  REVIEW_COUNT=$(printf '%s' "$rules_json" | jq -r '[.[] | select(.type == "pull_request") | (.parameters.required_approving_review_count // 0)] | max // 0')
  [ "$REVIEW_COUNT" -ge 1 ] || fail "ruleset controls must require at least one approving pull request review"

  REQUIRED_CHECKS=$(printf '%s' "$rules_json" | jq -r '[.[] | select(.type == "required_status_checks") | (.parameters.required_status_checks // [] | length)] | add // 0')
  [ "$REQUIRED_CHECKS" -ge 1 ] || fail "ruleset controls must require at least one status check"

  HAS_NON_FAST_FORWARD=$(printf '%s' "$rules_json" | jq -r '[.[] | select(.type == "non_fast_forward")] | length')
  [ "$HAS_NON_FAST_FORWARD" -ge 1 ] || fail "ruleset controls must block force pushes (non_fast_forward rule missing)"

  HAS_DELETION_RULE=$(printf '%s' "$rules_json" | jq -r '[.[] | select(.type == "deletion")] | length')
  [ "$HAS_DELETION_RULE" -ge 1 ] || fail "ruleset controls must block branch deletion (deletion rule missing)"

  CONTROL_MODE="rulesets"
}

verify_dependency_graph_sbom() {
  github_get "/repos/$OWNER/$REPO/dependency-graph/sbom"
  case "$API_STATUS" in
    200|201|202) return 0 ;;
    404)
      github_get "/repos/$OWNER/$REPO/dependency-graph/sbom/generate-report"
      case "$API_STATUS" in
        200|201|202) return 0 ;;
        *) fail "dependency graph SBOM generation endpoint returned HTTP $API_STATUS" ;;
      esac
      ;;
    *) fail "dependency graph SBOM endpoint returned HTTP $API_STATUS" ;;
  esac
}

verify_installation_repository_scope() {
  github_get "/installation"
  case "$API_STATUS" in
    200)
      installation_id=$(printf '%s' "$API_BODY" | jq -r '.id // empty')
      installation_target=$(printf '%s' "$API_BODY" | jq -r '.account.login // .target_id // "unknown"')
      repository_selection=$(printf '%s' "$API_BODY" | jq -r '.repository_selection // "unknown"')
      page=1
      installation_repo_count=0
      repository_match=
      while :; do
        github_get "/installation/repositories?per_page=100&page=$page"
        case "$API_STATUS" in
          200)
            if [ "$page" -eq 1 ]; then
              installation_repo_count=$(printf '%s' "$API_BODY" | jq -r '.total_count // (.repositories | length) // 0')
              case "$installation_repo_count" in
                ''|*[!0-9]*) installation_repo_count=0 ;;
              esac
            fi
            repository_match=$(printf '%s' "$API_BODY" | jq -r --arg repo "$REPOSITORY" '.repositories[]? | select(.full_name == $repo) | .full_name' | head -n 1)
            if [ -n "$repository_match" ]; then
              break
            fi
            page_repo_count=$(printf '%s' "$API_BODY" | jq -r '(.repositories | length) // 0')
            case "$page_repo_count" in
              ''|*[!0-9]*) page_repo_count=0 ;;
            esac
            if [ "$page_repo_count" -le 0 ]; then
              break
            fi
            if [ "$installation_repo_count" -gt 0 ] && [ $((page * 100)) -ge "$installation_repo_count" ]; then
              break
            fi
            page=$((page + 1))
            ;;
          401) fail "github app installation repositories denied: token invalid or expired (HTTP 401 on /installation/repositories)" ;;
          403) fail "github app installation repositories denied: token lacks required permission/scope (HTTP 403 on /installation/repositories)" ;;
          404) fail "github app installation repositories unavailable (HTTP 404 on /installation/repositories)" ;;
          *) fail "github app installation repositories returned HTTP $API_STATUS" ;;
        esac
      done
      if [ -z "$repository_match" ]; then
        fail "GitHub App installation scope mismatch: installation_id=${installation_id:-unknown} target=${installation_target:-unknown} repository_selection=${repository_selection:-unknown} does not include $REPOSITORY (visible_repos=$installation_repo_count); install the app on the repository owner or expand installation repository access"
      fi
      printf '%s\n' "- app installation repository scope: includes $REPOSITORY (selection=$repository_selection visible_repos=$installation_repo_count)"
      return 0
      ;;
    404)
      # Non-installation tokens (PAT/OAuth/fine-grained) won't expose /installation.
      return 0
      ;;
    *)
      return 0
      ;;
  esac
}

verify_installation_repository_scope

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
    rules_json=$(rules_json_from_api_body)
    rules_count=$(printf '%s' "$rules_json" | jq 'length')
    [ "$rules_count" -gt 0 ] || fail "ruleset branch rules for $TARGET_BRANCH returned no effective rules"
    verify_ruleset_payload "$rules_json"
    ;;
  403)
    if is_rate_limited_response; then
      fail "branch protection lookup for $TARGET_BRANCH hit GitHub API rate limit (HTTP 403); retry with token/App credentials that have remaining quota"
    fi
    fail "branch protection lookup for $TARGET_BRANCH denied (HTTP 403); verify repository administration read permissions"
    ;;
  *)
    fail "branch protection lookup for $TARGET_BRANCH returned HTTP $API_STATUS"
    ;;
esac

github_get "/repos/$OWNER/$REPO/dependabot/alerts?per_page=1"
expect_status 200 "Dependabot alerts API"

verify_dependency_graph_sbom

printf 'GitHub repository controls verified for %s on %s.\n' "$REPOSITORY" "$TARGET_BRANCH"
printf '- control surface verified via: %s\n' "$CONTROL_MODE"
printf '- pull request review required: %s approval(s)\n' "$REVIEW_COUNT"
printf '- required status checks configured: %s\n' "$REQUIRED_CHECKS"
printf '- force pushes disabled\n'
printf '- branch deletions disabled\n'
printf '- Dependabot alerts API reachable\n'
printf '- dependency graph SBOM endpoint reachable\n'
