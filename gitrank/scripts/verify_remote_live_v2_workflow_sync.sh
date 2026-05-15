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

infer_default_branch_from_local_git() {
  command -v git >/dev/null 2>&1 || return 1
  remote_head=$(git symbolic-ref --quiet refs/remotes/origin/HEAD 2>/dev/null || true)
  case "$remote_head" in
    refs/remotes/origin/*) printf '%s' "${remote_head##refs/remotes/origin/}" ;;
    *) return 1 ;;
  esac
}

build_local_workflow_state() {
  local_commit=unknown
  local_dirty=unknown
  if command -v git >/dev/null 2>&1; then
    local_commit=$(git -C "$repo_dir" log -n1 --pretty=format:%H -- "$WORKFLOW_FILE_PATH" 2>/dev/null || true)
    [ -n "$local_commit" ] || local_commit=unknown
    if git -C "$repo_dir" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
      if git -C "$repo_dir" diff --quiet -- "$WORKFLOW_FILE_PATH" >/dev/null 2>&1 && \
         git -C "$repo_dir" diff --cached --quiet -- "$WORKFLOW_FILE_PATH" >/dev/null 2>&1; then
        local_dirty=no
      else
        local_dirty=yes
      fi
    fi
  fi
  printf 'local_commit=%s local_dirty=%s' "$local_commit" "$local_dirty"
}

verify_via_raw_public_fallback() {
  reason=$1
  candidate_branches=

  add_candidate_branch() {
    branch=$1
    [ -n "$branch" ] || return 0
    case " $candidate_branches " in
      *" $branch "*) ;;
      *)
        if [ -n "$candidate_branches" ]; then
          candidate_branches="$candidate_branches $branch"
        else
          candidate_branches="$branch"
        fi
        ;;
    esac
  }

  if [ -n "$TARGET_BRANCH" ]; then
    add_candidate_branch "$TARGET_BRANCH"
  else
    inferred_branch=$(infer_default_branch_from_local_git || true)
    add_candidate_branch "$inferred_branch"
    add_candidate_branch main
    add_candidate_branch master
  fi

  [ -n "$candidate_branches" ] || fail "unable to determine candidate branch for raw fallback"

  raw_body_file="$TMP_ROOT/gitrank-verify-live-v2-workflow-sync-raw.$$"
  found_branch=

  for branch in $candidate_branches; do
    raw_url="https://raw.githubusercontent.com/$OWNER/$REPO/$branch/$WORKFLOW_FILE_PATH"
    raw_status=$(curl -sS -L -o "$raw_body_file" -w '%{http_code}' \
      --connect-timeout "$API_TIMEOUT_SECONDS" \
      --max-time "$API_TIMEOUT_SECONDS" \
      "$raw_url") || {
        rm -f "$raw_body_file"
        fail "raw workflow fallback request failed for branch '$branch' ($reason)"
      }

    case "$raw_status" in
      200)
        found_branch="$branch"
        break
        ;;
      404)
        ;;
      403|429)
        rm -f "$raw_body_file"
        fail "raw workflow fallback hit rate limit or access restriction (HTTP $raw_status); provide token or GitHub App credentials"
        ;;
      *)
        rm -f "$raw_body_file"
        fail "raw workflow fallback returned unexpected HTTP $raw_status for branch '$branch'"
        ;;
    esac
  done

  if [ -z "$found_branch" ]; then
    rm -f "$raw_body_file"
    fail "remote workflow file is missing on $REPOSITORY for candidate branch(es): $candidate_branches (or repository is private/inaccessible); run make sync-remote-live-v2-workflow"
  fi

  remote_content=$(cat "$raw_body_file")
  rm -f "$raw_body_file"

  if [ "$remote_content" != "$local_content" ]; then
    raw_view_url="https://raw.githubusercontent.com/$OWNER/$REPO/$found_branch/$WORKFLOW_FILE_PATH"
    fail "remote workflow content drift detected via raw fallback for $WORKFLOW_FILE_PATH on $REPOSITORY@$found_branch (remote_url=$raw_view_url; $local_workflow_state; sync by pushing the local branch to origin (for example: git push origin main) or run make sync-remote-live-v2-workflow with token/App credentials)"
  fi

  printf 'remote live-v2 workflow sync verification passed (raw public fallback)\n'
  printf 'repository: %s\n' "$REPOSITORY"
  printf 'branch: %s\n' "$found_branch"
  printf 'path: %s\n' "$WORKFLOW_FILE_PATH"
  exit 0
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
local_content=$(cat "$local_workflow_file")
local_workflow_state=$(build_local_workflow_state)

OWNER=${REPOSITORY%%/*}
REPO=${REPOSITORY#*/}
API_STATUS=
API_BODY=

if [ -z "$TOKEN" ]; then
  verify_via_raw_public_fallback "no token available"
fi

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
      verify_via_raw_public_fallback "GitHub API rate limit on repository metadata"
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
      verify_via_raw_public_fallback "GitHub API rate limit on workflow contents lookup"
    fi
    fail "remote workflow contents lookup denied (HTTP 403)"
    ;;
  404) fail "remote workflow file is missing on $REPOSITORY@$TARGET_BRANCH: $WORKFLOW_FILE_PATH (run make sync-remote-live-v2-workflow)" ;;
  *) fail "remote workflow contents lookup returned HTTP $API_STATUS" ;;
esac

remote_encoding=$(printf '%s' "$API_BODY" | jq -r '.encoding // empty')
[ "$remote_encoding" = "base64" ] || fail "unexpected remote contents encoding: $remote_encoding"
remote_blob_sha=$(printf '%s' "$API_BODY" | jq -r '.sha // empty')
if [ -z "$remote_blob_sha" ]; then
  remote_blob_sha=unknown
fi
remote_content_base64=$(printf '%s' "$API_BODY" | jq -r '.content // empty' | tr -d '\n')
remote_content=$(printf '%s' "$remote_content_base64" | base64 -d 2>/dev/null || true)

if [ "$remote_content" != "$local_content" ]; then
  remote_view_url="https://github.com/$OWNER/$REPO/blob/$TARGET_BRANCH/$WORKFLOW_FILE_PATH"
  fail "remote workflow content drift detected for $WORKFLOW_FILE_PATH on $REPOSITORY@$TARGET_BRANCH (remote_url=$remote_view_url; remote_blob_sha=$remote_blob_sha; $local_workflow_state; sync by pushing the local branch to origin (for example: git push origin main) or run make sync-remote-live-v2-workflow)"
fi

printf 'remote live-v2 workflow sync verification passed\n'
printf 'repository: %s\n' "$REPOSITORY"
printf 'branch: %s\n' "$TARGET_BRANCH"
printf 'path: %s\n' "$WORKFLOW_FILE_PATH"
