#!/usr/bin/env sh
set -eu

REPOSITORY="${GITHUB_REPOSITORY:-}"
TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-${GITRANK_REPO_ADMIN_TOKEN:-}}}"
API_BASE="${GITHUB_API_URL:-https://api.github.com}"
API_VERSION="${GITHUB_API_VERSION:-2026-03-10}"
API_TIMEOUT_SECONDS="${GITHUB_API_TIMEOUT_SECONDS:-30}"
TARGET_BRANCH="${TARGET_BRANCH:-}"
WORKFLOW_FILE_PATH="${WORKFLOW_FILE_PATH:-.github/workflows/verify-live-v2-gates.yml}"
DRY_RUN="${DRY_RUN:-false}"
TMP_ROOT="${TMPDIR:-/tmp}"
GITHUB_APP_ID="${GITHUB_APP_ID:-${GITRANK_GITHUB_APP_ID:-}}"
GITHUB_APP_INSTALLATION_ID="${GITHUB_APP_INSTALLATION_ID:-${GITRANK_GITHUB_APP_INSTALLATION_ID:-}}"
GITHUB_APP_PRIVATE_KEY_FILE="${GITHUB_APP_PRIVATE_KEY_FILE:-${GITRANK_GITHUB_APP_PRIVATE_KEY_FILE:-}}"
GITHUB_APP_PRIVATE_KEY_PEM="${GITHUB_APP_PRIVATE_KEY_PEM:-${GITRANK_GITHUB_APP_PRIVATE_KEY_PEM:-}}"

fail() {
  printf 'sync remote live-v2 workflow failed: %s\n' "$1" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "missing required command: $1"
}

is_placeholder_value() {
  value=$1
  case "$value" in
    ""|OWNER/REPO|replace-me*|changeme*|*your-env.example*|*YYYY-MM-DD*|*your-cluster*|*your-name*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

resolve_repository_from_git_remote() {
  if is_placeholder_value "$REPOSITORY"; then
    REPOSITORY=
  fi
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

  token_file=$(mktemp "$TMP_ROOT/gitrank-sync-live-v2-workflow-token.XXXXXX")
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
  printf 'sync remote live-v2 workflow: bootstrapped token via GitHub App installation credentials\n'
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
[ -n "$TOKEN" ] || fail "GITHUB_TOKEN, GH_TOKEN, or GITRANK_REPO_ADMIN_TOKEN is required (or set GitHub App credentials). If local commits already contain the workflow update, push them directly (for example: git push origin main)."

root_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
repo_dir="$(CDPATH= cd -- "$root_dir/.." && pwd)"
local_workflow_file="$repo_dir/$WORKFLOW_FILE_PATH"
[ -s "$local_workflow_file" ] || fail "local file missing: $local_workflow_file"

OWNER=${REPOSITORY%%/*}
REPO=${REPOSITORY#*/}
API_STATUS=
API_BODY=

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

is_workflow_scope_error() {
  message=$(printf '%s' "$API_BODY" | jq -r '.message // empty' 2>/dev/null || true)
  case "$message" in
    *"refusing to allow"*".github/workflows"*|*"workflows scope"*|*"workflows:write"*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

handle_sync_http_error() {
  context=$1
  case "$API_STATUS" in
    401)
      fail "$context denied: token invalid or expired (HTTP 401)"
      ;;
    403)
      if is_rate_limited_response; then
        fail "$context hit GitHub API rate limit (HTTP 403); retry with token/App credentials that have remaining quota"
      fi
      if is_workflow_scope_error; then
        fail "$context denied: token/App lacks workflow write scope for .github/workflows updates (HTTP 403); use a PAT with workflow scope or an App installation token with workflows:write"
      fi
      if is_integration_permission_error; then
        fail "$context denied: resource not accessible by integration (HTTP 403); ensure GitHub App installation permissions include repository contents write and workflows write, or use an admin token"
      fi
      fail "$context denied: token lacks required permission/scope (HTTP 403)"
      ;;
    404)
      fail "$context missing or inaccessible (HTTP 404)"
      ;;
    *)
      fail "$context returned HTTP $API_STATUS"
      ;;
  esac
}

github_request() {
  method=$1
  path=$2
  payload=${3:-}
  body_file="$TMP_ROOT/gitrank-sync-live-v2-workflow.$$"
  if [ -n "$payload" ]; then
    API_STATUS=$(curl -sS -L -X "$method" -o "$body_file" -w '%{http_code}' \
      --connect-timeout "$API_TIMEOUT_SECONDS" \
      --max-time "$API_TIMEOUT_SECONDS" \
      -H 'Accept: application/vnd.github+json' \
      -H "Authorization: Bearer $TOKEN" \
      -H "X-GitHub-Api-Version: $API_VERSION" \
      -H 'Content-Type: application/json' \
      --data "$payload" \
      "$API_BASE$path") || {
        rm -f "$body_file"
        fail "GitHub API request failed for $method $path"
      }
  else
    API_STATUS=$(curl -sS -L -X "$method" -o "$body_file" -w '%{http_code}' \
      --connect-timeout "$API_TIMEOUT_SECONDS" \
      --max-time "$API_TIMEOUT_SECONDS" \
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

verify_installation_repository_scope() {
  github_request GET "/installation"
  case "$API_STATUS" in
    200)
      installation_id=$(printf '%s' "$API_BODY" | jq -r '.id // empty')
      installation_target=$(printf '%s' "$API_BODY" | jq -r '.account.login // .target_id // "unknown"')
      repository_selection=$(printf '%s' "$API_BODY" | jq -r '.repository_selection // "unknown"')
      page=1
      installation_repo_count=0
      repository_match=
      while :; do
        github_request GET "/installation/repositories?per_page=100&page=$page"
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
          403)
            if is_rate_limited_response; then
              fail "github app installation repositories hit GitHub API rate limit (HTTP 403)"
            fi
            if is_integration_permission_error; then
              fail "github app installation repositories denied: resource not accessible by integration (HTTP 403 on /installation/repositories)"
            fi
            fail "github app installation repositories denied: token lacks required permission/scope (HTTP 403)"
            ;;
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

verify_installation_repository_scope

github_request GET "/repos/$OWNER/$REPO"
[ "$API_STATUS" = "200" ] || handle_sync_http_error "repository metadata lookup"

if [ -z "$TARGET_BRANCH" ]; then
  TARGET_BRANCH=$(printf '%s' "$API_BODY" | jq -r '.default_branch // empty')
fi
[ -n "$TARGET_BRANCH" ] || fail "unable to resolve target branch"

local_content=$(cat "$local_workflow_file")
local_content_base64=$(base64 <"$local_workflow_file" | tr -d '\n')

github_request GET "/repos/$OWNER/$REPO/contents/$WORKFLOW_FILE_PATH?ref=$TARGET_BRANCH"
case "$API_STATUS" in
  200)
    remote_sha=$(printf '%s' "$API_BODY" | jq -r '.sha // empty')
    remote_base64=$(printf '%s' "$API_BODY" | jq -r '.content // empty')
    remote_content=$(printf '%s' "$remote_base64" | tr -d '\n' | base64 -d 2>/dev/null || true)
    if [ "$remote_content" = "$local_content" ]; then
      printf 'remote live-v2 workflow already in sync for %s on %s\n' "$REPOSITORY" "$TARGET_BRANCH"
      exit 0
    fi
    if [ "$DRY_RUN" = "true" ]; then
      printf 'dry-run: would update %s on %s\n' "$WORKFLOW_FILE_PATH" "$TARGET_BRANCH"
      exit 0
    fi
    payload=$(jq -n \
      --arg message "ci(live-gates): sync verify-live-v2 workflow" \
      --arg content "$local_content_base64" \
      --arg branch "$TARGET_BRANCH" \
      --arg sha "$remote_sha" \
      '{message: $message, content: $content, branch: $branch, sha: $sha}')
    github_request PUT "/repos/$OWNER/$REPO/contents/$WORKFLOW_FILE_PATH" "$payload"
    case "$API_STATUS" in
      200|201) printf 'updated: %s on %s\n' "$WORKFLOW_FILE_PATH" "$TARGET_BRANCH" ;;
      409) fail "conflict updating workflow file (possible branch protection or stale SHA): $API_BODY" ;;
      *) handle_sync_http_error "update workflow file $WORKFLOW_FILE_PATH on $TARGET_BRANCH" ;;
    esac
    ;;
  404)
    if [ "$DRY_RUN" = "true" ]; then
      printf 'dry-run: would create %s on %s\n' "$WORKFLOW_FILE_PATH" "$TARGET_BRANCH"
      exit 0
    fi
    payload=$(jq -n \
      --arg message "ci(live-gates): add verify-live-v2 workflow" \
      --arg content "$local_content_base64" \
      --arg branch "$TARGET_BRANCH" \
      '{message: $message, content: $content, branch: $branch}')
    github_request PUT "/repos/$OWNER/$REPO/contents/$WORKFLOW_FILE_PATH" "$payload"
    case "$API_STATUS" in
      200|201) printf 'created: %s on %s\n' "$WORKFLOW_FILE_PATH" "$TARGET_BRANCH" ;;
      409) fail "conflict creating workflow file (possible branch protection): $API_BODY" ;;
      *) handle_sync_http_error "create workflow file $WORKFLOW_FILE_PATH on $TARGET_BRANCH" ;;
    esac
    ;;
  *) handle_sync_http_error "contents lookup for $WORKFLOW_FILE_PATH on $TARGET_BRANCH" ;;
esac

printf 'sync remote live-v2 workflow complete\n'
