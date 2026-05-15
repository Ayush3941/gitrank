#!/usr/bin/env sh
set -eu

REPOSITORY="${GITHUB_REPOSITORY:-}"
TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-${GITRANK_REPO_ADMIN_TOKEN:-}}}"
API_BASE="${GITHUB_API_URL:-https://api.github.com}"
API_VERSION="${GITHUB_API_VERSION:-2026-03-10}"
API_TIMEOUT_SECONDS="${GITHUB_API_TIMEOUT_SECONDS:-30}"
TARGET_WORKFLOW_FILE="${TARGET_WORKFLOW_FILE:-verify-live-v2-gates.yml}"
REQUIRE_WORKFLOW_SYNC_CAPABILITY="${REQUIRE_WORKFLOW_SYNC_CAPABILITY:-false}"
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
if [ -z "$TOKEN" ]; then
  if [ "$REQUIRE_WORKFLOW_SYNC_CAPABILITY" = "true" ]; then
    fail "GITHUB_TOKEN, GH_TOKEN, or GITRANK_REPO_ADMIN_TOKEN is required (or set GitHub App credentials); workflow sync also requires workflow-file write capability (workflow scope for classic PAT or workflows:write for GitHub App)"
  fi
  fail "GITHUB_TOKEN, GH_TOKEN, or GITRANK_REPO_ADMIN_TOKEN is required (or set GitHub App credentials)"
fi

OWNER=${REPOSITORY%%/*}
REPO=${REPOSITORY#*/}
API_STATUS=
API_BODY=
LAST_CONTEXT=
LAST_HEADERS=

github_get() {
  path=$1
  context=$2
  LAST_CONTEXT=$context
  body_file="$TMP_ROOT/gitrank-live-github-access.$$"
  headers_file="$TMP_ROOT/gitrank-live-github-access-headers.$$"
  API_STATUS=$(curl -sS -L -D "$headers_file" -o "$body_file" -w '%{http_code}' \
    --connect-timeout "$API_TIMEOUT_SECONDS" \
    --max-time "$API_TIMEOUT_SECONDS" \
    -H 'Accept: application/vnd.github+json' \
    -H "Authorization: Bearer $TOKEN" \
    -H "X-GitHub-Api-Version: $API_VERSION" \
    "$API_BASE$path") || {
      rm -f "$body_file"
      rm -f "$headers_file"
      fail "GitHub API request failed for $context"
    }
  API_BODY=$(cat "$body_file")
  LAST_HEADERS=$(cat "$headers_file")
  rm -f "$body_file"
  rm -f "$headers_file"
}

is_rate_limited_response() {
  message=$(printf '%s' "$API_BODY" | jq -r '.message // empty' 2>/dev/null || true)
  case "$message" in
    *"API rate limit exceeded"*) return 0 ;;
    *) return 1 ;;
  esac
}

is_integration_permission_error() {
  message=$(printf '%s' "$API_BODY" | jq -r '.message // empty' 2>/dev/null || true)
  case "$message" in
    *"Resource not accessible by integration"*) return 0 ;;
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
        if is_integration_permission_error; then
          fail "$LAST_CONTEXT denied: resource not accessible by integration (HTTP 403); ensure the GitHub App installation has required repository permissions, or use an admin token (run make inspect-github-app-installation-permissions)"
        fi
        fail "$LAST_CONTEXT denied: token lacks required permission/scope (HTTP 403)"
        ;;
      404)
        case "$LAST_CONTEXT" in
          "workflow metadata ("*)
            fail "$LAST_CONTEXT missing on default branch (HTTP 404); run make sync-remote-live-v2-workflow"
            ;;
          *)
            fail "$LAST_CONTEXT denied: endpoint/resource unavailable for this token or repo (HTTP 404)"
            ;;
        esac
        ;;
      *) fail "$LAST_CONTEXT returned HTTP $API_STATUS" ;;
    esac
  }
}

verify_dependency_graph_sbom() {
  github_get "/repos/$OWNER/$REPO/dependency-graph/sbom" "dependency graph SBOM (legacy endpoint)"
  case "$API_STATUS" in
    200|201|202) return 0 ;;
    404)
      github_get "/repos/$OWNER/$REPO/dependency-graph/sbom/generate-report" "dependency graph SBOM generation"
      case "$API_STATUS" in
        200|201|202) return 0 ;;
        401) fail "dependency graph SBOM generation denied: token invalid or expired (HTTP 401)" ;;
        403)
          if is_rate_limited_response; then
            fail "dependency graph SBOM generation hit GitHub API rate limit (HTTP 403); retry with token/App credentials that have remaining quota"
          fi
          if is_integration_permission_error; then
            fail "dependency graph SBOM generation denied: resource not accessible by integration (HTTP 403); ensure GitHub App installation permissions include dependency graph access, or use an admin token (run make inspect-github-app-installation-permissions)"
          fi
          fail "dependency graph SBOM generation denied: token lacks required permission/scope (HTTP 403)"
          ;;
        404) fail "dependency graph SBOM unavailable for this repo/token (HTTP 404 on legacy and generate-report endpoints)" ;;
        *) fail "dependency graph SBOM generation returned HTTP $API_STATUS" ;;
      esac
      ;;
    401) fail "dependency graph SBOM denied: token invalid or expired (HTTP 401)" ;;
    403)
      if is_rate_limited_response; then
        fail "dependency graph SBOM hit GitHub API rate limit (HTTP 403); retry with token/App credentials that have remaining quota"
      fi
      if is_integration_permission_error; then
        fail "dependency graph SBOM denied: resource not accessible by integration (HTTP 403); ensure GitHub App installation permissions include dependency graph access, or use an admin token (run make inspect-github-app-installation-permissions)"
      fi
      fail "dependency graph SBOM denied: token lacks required permission/scope (HTTP 403)"
      ;;
    *) fail "dependency graph SBOM returned HTTP $API_STATUS" ;;
  esac
}

verify_installation_repository_scope() {
  github_get "/installation" "github app installation metadata"
  case "$API_STATUS" in
    200)
      installation_id=$(printf '%s' "$API_BODY" | jq -r '.id // empty')
      installation_target=$(printf '%s' "$API_BODY" | jq -r '.account.login // .target_id // "unknown"')
      repository_selection=$(printf '%s' "$API_BODY" | jq -r '.repository_selection // "unknown"')
      page=1
      installation_repo_count=0
      repository_match=
      while :; do
        github_get "/installation/repositories?per_page=100&page=$page" "github app installation repositories list (page $page)"
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
          401)
            fail "github app installation repositories denied: token invalid or expired (HTTP 401 on /installation/repositories)"
            ;;
          403)
            if is_rate_limited_response; then
              fail "github app installation repositories hit GitHub API rate limit (HTTP 403)"
            fi
            if is_integration_permission_error; then
              fail "github app installation repositories denied: resource not accessible by integration (HTTP 403 on /installation/repositories)"
            fi
            fail "github app installation repositories denied: token lacks required permission/scope (HTTP 403)"
            ;;
          404)
            fail "github app installation repositories unavailable (HTTP 404 on /installation/repositories)"
            ;;
          *)
            fail "github app installation repositories returned HTTP $API_STATUS"
            ;;
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
    401)
      fail "github app installation metadata denied: token invalid or expired (HTTP 401 on /installation)"
      ;;
    403)
      if is_rate_limited_response; then
        fail "github app installation metadata hit GitHub API rate limit (HTTP 403)"
      fi
      # Keep PAT/OAuth compatibility when GitHub blocks /installation for non-app tokens.
      return 0
      ;;
    *)
      return 0
      ;;
  esac
}

probe_workflow_sync_capability() {
  github_get "/installation" "github app installation permissions"
  case "$API_STATUS" in
    200)
      permissions_json=$(printf '%s' "$API_BODY" | jq -c '.permissions // {}')
      contents_perm=$(printf '%s' "$permissions_json" | jq -r '.contents // "none"')
      workflows_perm=$(printf '%s' "$permissions_json" | jq -r 'if has("workflows") then .workflows elif has("workflow") then .workflow else "none" end')
      if [ "$contents_perm" != "write" ]; then
        fail "workflow sync capability check failed: GitHub App installation contents permission is '$contents_perm' (requires write)"
      fi
      if [ "$workflows_perm" != "write" ]; then
        fail "workflow sync capability check failed: GitHub App installation workflows permission is '$workflows_perm' (requires write)"
      fi
      printf '- workflow sync write capability: ok (GitHub App installation contents=write workflows=write)\n'
      return 0
      ;;
    401)
      fail "workflow sync capability check denied: token invalid or expired (HTTP 401 on /installation)"
      ;;
    403)
      if is_rate_limited_response; then
        fail "workflow sync capability check hit GitHub API rate limit (HTTP 403 on /installation)"
      fi
      if is_integration_permission_error; then
        fail "workflow sync capability check denied: resource not accessible by integration (HTTP 403 on /installation)"
      fi
      fail "workflow sync capability check denied (HTTP 403 on /installation)"
      ;;
    404)
      # Likely not an app installation token. Fall back to OAuth scope header when present.
      oauth_scopes=$(printf '%s\n' "$LAST_HEADERS" | awk 'BEGIN{IGNORECASE=1} /^x-oauth-scopes:/{sub(/\r$/,""); sub(/^[^:]*:[[:space:]]*/, ""); print; exit}')
      if [ -n "$oauth_scopes" ]; then
        if printf '%s' "$oauth_scopes" | tr ',' '\n' | rg -q '^[[:space:]]*workflow[[:space:]]*$'; then
          printf '%s\n' "- workflow sync scope check: workflow scope present (\`x-oauth-scopes: $oauth_scopes\`)"
        else
          fail "workflow sync capability check failed: token scopes do not include workflow (\`x-oauth-scopes: $oauth_scopes\`)"
        fi
      else
        printf '%s\n' "- workflow sync scope check: unable to confirm via scopes header (token may be fine-grained); ensure workflow-file updates are allowed"
      fi
      return 0
      ;;
    *)
      fail "workflow sync capability check returned HTTP $API_STATUS on /installation"
      ;;
  esac
}

verify_installation_repository_scope

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

verify_dependency_graph_sbom

if [ "$REQUIRE_WORKFLOW_SYNC_CAPABILITY" = "true" ]; then
  probe_workflow_sync_capability
fi

printf 'live github access verification passed for %s\n' "$REPOSITORY"
printf '- default branch: %s\n' "$default_branch"
printf '- branch protection read: ok\n'
printf '- dependabot alerts read: ok\n'
printf '- dependency graph SBOM read: ok\n'
printf '- workflow metadata/read access: ok (%s)\n' "$TARGET_WORKFLOW_FILE"
