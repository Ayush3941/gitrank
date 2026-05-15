#!/usr/bin/env sh
set -eu

REPOSITORY="${GITHUB_REPOSITORY:-}"
TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-${GITRANK_REPO_ADMIN_TOKEN:-}}}"
API_BASE="${GITHUB_API_URL:-https://api.github.com}"
API_VERSION="${GITHUB_API_VERSION:-2026-03-10}"
API_TIMEOUT_SECONDS="${GITHUB_API_TIMEOUT_SECONDS:-30}"
TARGET_BRANCH="${TARGET_BRANCH:-}"
WORKFLOW_FILE_PATH="${WORKFLOW_FILE_PATH:-.github/workflows/trivy.yml}"
IGNORE_FILE_PATH="${IGNORE_FILE_PATH:-.trivyignore.yaml}"
WAIT_FOR_TRIVY_SUCCESS="${WAIT_FOR_TRIVY_SUCCESS:-true}"
WAIT_TIMEOUT_SECONDS="${WAIT_TIMEOUT_SECONDS:-900}"
POLL_INTERVAL_SECONDS="${POLL_INTERVAL_SECONDS:-10}"
DRY_RUN="${DRY_RUN:-false}"
TMP_ROOT="${TMPDIR:-/tmp}"
GITHUB_APP_ID="${GITHUB_APP_ID:-${GITRANK_GITHUB_APP_ID:-}}"
GITHUB_APP_INSTALLATION_ID="${GITHUB_APP_INSTALLATION_ID:-${GITRANK_GITHUB_APP_INSTALLATION_ID:-}}"
GITHUB_APP_PRIVATE_KEY_FILE="${GITHUB_APP_PRIVATE_KEY_FILE:-${GITRANK_GITHUB_APP_PRIVATE_KEY_FILE:-}}"
GITHUB_APP_PRIVATE_KEY_PEM="${GITHUB_APP_PRIVATE_KEY_PEM:-${GITRANK_GITHUB_APP_PRIVATE_KEY_PEM:-}}"

fail() {
  printf 'sync remote trivy policy failed: %s\n' "$1" >&2
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

  token_file=$(mktemp "$TMP_ROOT/gitrank-sync-trivy-token.XXXXXX")
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
  printf 'sync remote trivy policy: bootstrapped token via GitHub App installation credentials\n'
}

case "$REPOSITORY" in
  */*) ;;
  *) fail "GITHUB_REPOSITORY must use owner/name form (or run from a clone with GitHub origin remote)" ;;
esac

require_command curl
require_command jq
require_command base64
require_command date
require_command mktemp
mkdir -p "$TMP_ROOT"
bootstrap_token_from_github_app || true
[ -n "$TOKEN" ] || fail "GITHUB_TOKEN, GH_TOKEN, or GITRANK_REPO_ADMIN_TOKEN is required (or set GitHub App credentials). If local commits already contain the Trivy policy updates, push them directly (for example: git push origin main)."

root_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
repo_dir="$(CDPATH= cd -- "$root_dir/.." && pwd)"
local_workflow_file="$repo_dir/$WORKFLOW_FILE_PATH"
local_ignore_file="$repo_dir/$IGNORE_FILE_PATH"

[ -s "$local_workflow_file" ] || fail "local file missing: $local_workflow_file"
[ -s "$local_ignore_file" ] || fail "local file missing: $local_ignore_file"
grep -q -- "--ignorefile .trivyignore.yaml" "$local_workflow_file" || fail "local trivy workflow missing --ignorefile .trivyignore.yaml"

OWNER=${REPOSITORY%%/*}
REPO=${REPOSITORY#*/}
API_STATUS=
API_BODY=

github_request() {
  method=$1
  path=$2
  payload=${3:-}
  body_file="$TMP_ROOT/gitrank-sync-trivy-policy.$$"
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

      github_request GET "/installation/repositories?per_page=100"
      case "$API_STATUS" in
        200)
          installation_repo_count=$(printf '%s' "$API_BODY" | jq -r '.total_count // (.repositories | length) // 0')
          repository_match=$(printf '%s' "$API_BODY" | jq -r --arg repo "$REPOSITORY" '.repositories[]? | select(.full_name == $repo) | .full_name' | head -n 1)
          if [ -z "$repository_match" ]; then
            fail "GitHub App installation scope mismatch: installation_id=${installation_id:-unknown} target=${installation_target:-unknown} repository_selection=${repository_selection:-unknown} does not include $REPOSITORY (visible_repos=$installation_repo_count); install the app on the repository owner or expand installation repository access"
          fi
          printf '%s\n' "- app installation repository scope: includes $REPOSITORY (selection=$repository_selection visible_repos=$installation_repo_count)"
          return 0
          ;;
        401) fail "github app installation repositories denied: token invalid or expired (HTTP 401 on /installation/repositories)" ;;
        403) fail "github app installation repositories denied: token lacks required permission/scope (HTTP 403 on /installation/repositories)" ;;
        404) fail "github app installation repositories unavailable (HTTP 404 on /installation/repositories)" ;;
        *) fail "github app installation repositories returned HTTP $API_STATUS" ;;
      esac
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

github_request GET "/repos/$OWNER/$REPO"
[ "$API_STATUS" = "200" ] || fail "repository metadata lookup returned HTTP $API_STATUS"

if [ -z "$TARGET_BRANCH" ]; then
  TARGET_BRANCH=$(printf '%s' "$API_BODY" | jq -r '.default_branch // empty')
fi
[ -n "$TARGET_BRANCH" ] || fail "unable to resolve target branch"

updated_any=false
start_epoch=$(date -u +%s)

sync_file() {
  path=$1
  local_file=$2
  commit_message=$3

  local_content=$(cat "$local_file")
  local_content_base64=$(base64 <"$local_file" | tr -d '\n')

  github_request GET "/repos/$OWNER/$REPO/contents/$path?ref=$TARGET_BRANCH"
  case "$API_STATUS" in
    200)
      remote_sha=$(printf '%s' "$API_BODY" | jq -r '.sha // empty')
      remote_base64=$(printf '%s' "$API_BODY" | jq -r '.content // empty')
      remote_content=$(printf '%s' "$remote_base64" | tr -d '\n' | base64 -d 2>/dev/null || true)
      if [ "$remote_content" = "$local_content" ]; then
        printf 'up-to-date: %s on %s\n' "$path" "$TARGET_BRANCH"
        return 0
      fi
      if [ "$DRY_RUN" = "true" ]; then
        printf 'dry-run: would update %s on %s\n' "$path" "$TARGET_BRANCH"
        return 0
      fi
      payload=$(jq -n \
        --arg message "$commit_message" \
        --arg content "$local_content_base64" \
        --arg branch "$TARGET_BRANCH" \
        --arg sha "$remote_sha" \
        '{message: $message, content: $content, branch: $branch, sha: $sha}')
      github_request PUT "/repos/$OWNER/$REPO/contents/$path" "$payload"
      case "$API_STATUS" in
        200|201)
          updated_any=true
          printf 'updated: %s on %s\n' "$path" "$TARGET_BRANCH"
          ;;
        409)
          fail "conflict updating $path (possible branch protection or stale SHA): $API_BODY"
          ;;
        *)
          fail "update for $path returned HTTP $API_STATUS"
          ;;
      esac
      ;;
    404)
      if [ "$DRY_RUN" = "true" ]; then
        printf 'dry-run: would create %s on %s\n' "$path" "$TARGET_BRANCH"
        return 0
      fi
      payload=$(jq -n \
        --arg message "$commit_message" \
        --arg content "$local_content_base64" \
        --arg branch "$TARGET_BRANCH" \
        '{message: $message, content: $content, branch: $branch}')
      github_request PUT "/repos/$OWNER/$REPO/contents/$path" "$payload"
      case "$API_STATUS" in
        200|201)
          updated_any=true
          printf 'created: %s on %s\n' "$path" "$TARGET_BRANCH"
          ;;
        409)
          fail "conflict creating $path (possible branch protection): $API_BODY"
          ;;
        *)
          fail "create for $path returned HTTP $API_STATUS"
          ;;
      esac
      ;;
    *)
      fail "contents lookup for $path returned HTTP $API_STATUS"
      ;;
  esac
}

sync_file "$WORKFLOW_FILE_PATH" "$local_workflow_file" "fix(ci): sync trivy workflow policy"
sync_file "$IGNORE_FILE_PATH" "$local_ignore_file" "fix(ci): add trivy ignore policy file"

if [ "$DRY_RUN" = "true" ]; then
  printf 'dry-run complete\n'
  exit 0
fi

if [ "$updated_any" != "true" ]; then
  printf 'remote trivy policy already in sync for %s on %s\n' "$REPOSITORY" "$TARGET_BRANCH"
  exit 0
fi

if [ "$WAIT_FOR_TRIVY_SUCCESS" != "true" ]; then
  printf 'sync complete (not waiting for Trivy workflow)\n'
  exit 0
fi

deadline=$((start_epoch + WAIT_TIMEOUT_SECONDS))
found_run=false

while :; do
  now=$(date -u +%s)
  [ "$now" -le "$deadline" ] || fail "timed out waiting for Trivy Scan workflow run"

  github_request GET "/repos/$OWNER/$REPO/actions/runs?branch=$TARGET_BRANCH&event=push&per_page=50"
  [ "$API_STATUS" = "200" ] || fail "workflow run lookup returned HTTP $API_STATUS"

  matched_run=$(printf '%s' "$API_BODY" | jq -c --arg start "$start_epoch" '
    [
      .workflow_runs[]?
      | select(.name == "Trivy Scan")
      | select((.created_at | fromdateiso8601) >= ($start | tonumber))
    ]
    | sort_by(.created_at)
    | reverse
    | .[0] // empty
  ')

  if [ -n "$matched_run" ] && [ "$matched_run" != "null" ]; then
    found_run=true
    run_id=$(printf '%s' "$matched_run" | jq -r '.id')
    run_status=$(printf '%s' "$matched_run" | jq -r '.status')
    run_conclusion=$(printf '%s' "$matched_run" | jq -r '.conclusion // ""')
    run_url=$(printf '%s' "$matched_run" | jq -r '.html_url // ""')
    printf 'trivy run id: %s status: %s conclusion: %s\n' "$run_id" "$run_status" "$run_conclusion"
    [ -n "$run_url" ] && printf 'trivy run url: %s\n' "$run_url"
    if [ "$run_status" = "completed" ]; then
      [ "$run_conclusion" = "success" ] || fail "Trivy Scan completed with conclusion=$run_conclusion"
      printf 'Trivy Scan succeeded after policy sync\n'
      exit 0
    fi
  fi

  sleep "$POLL_INTERVAL_SECONDS"
done

[ "$found_run" = "true" ] || fail "no Trivy Scan run found after sync"
