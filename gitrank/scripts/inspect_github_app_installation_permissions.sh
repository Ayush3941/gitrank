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
  printf 'inspect github app installation permissions failed: %s\n' "$1" >&2
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

  token_file=$(mktemp "$TMP_ROOT/gitrank-inspect-app-perms-token.XXXXXX")
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
  printf 'inspect github app installation permissions: bootstrapped token via GitHub App installation credentials\n'
}

is_rate_limited_response() {
  message=$(printf '%s' "$API_BODY" | jq -r '.message // empty' 2>/dev/null || true)
  case "$message" in
    *"API rate limit exceeded"*) return 0 ;;
    *) return 1 ;;
  esac
}

resolve_repository_from_git_remote
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

github_get() {
  path=$1
  body_file="$TMP_ROOT/gitrank-inspect-app-perms.$$"
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

github_get "/installation"
case "$API_STATUS" in
  200) ;;
  401) fail "token is invalid or expired (HTTP 401 on /installation)" ;;
  403)
    if is_rate_limited_response; then
      fail "GitHub API rate limit exceeded (HTTP 403 on /installation)"
    fi
    fail "token is not a GitHub App installation token or lacks installation visibility (HTTP 403 on /installation)"
    ;;
  404) fail "token cannot access /installation (HTTP 404); likely not an installation token for this app/repo" ;;
  *) fail "unexpected HTTP $API_STATUS on /installation" ;;
esac

app_slug=$(printf '%s' "$API_BODY" | jq -r '.app_slug // empty')
installation_id=$(printf '%s' "$API_BODY" | jq -r '.id // empty')
target_type=$(printf '%s' "$API_BODY" | jq -r '.target_type // empty')
target_login=$(printf '%s' "$API_BODY" | jq -r '.account.login // empty')
repository_selection=$(printf '%s' "$API_BODY" | jq -r '.repository_selection // empty')
permissions_json=$(printf '%s' "$API_BODY" | jq -c '.permissions // {}')

[ -n "$installation_id" ] || fail "installation id missing in /installation response"

page=1
repo_count=0
repo_match=
while :; do
  github_get "/installation/repositories?per_page=100&page=$page"
  case "$API_STATUS" in
    200)
      if [ "$page" -eq 1 ]; then
        repo_count=$(printf '%s' "$API_BODY" | jq -r '.total_count // 0')
        case "$repo_count" in
          ''|*[!0-9]*) repo_count=0 ;;
        esac
      fi
      repo_match_candidate=$(printf '%s' "$API_BODY" | jq -c --arg repo "$REPOSITORY" '.repositories[]? | select(.full_name == $repo) | .')
      if [ -n "$repo_match_candidate" ]; then
        repo_match=$repo_match_candidate
        break
      fi
      page_repo_count=$(printf '%s' "$API_BODY" | jq -r '(.repositories | length) // 0')
      case "$page_repo_count" in
        ''|*[!0-9]*) page_repo_count=0 ;;
      esac
      if [ "$page_repo_count" -le 0 ]; then
        break
      fi
      if [ "$repo_count" -gt 0 ] && [ $((page * 100)) -ge "$repo_count" ]; then
        break
      fi
      page=$((page + 1))
      ;;
    401) fail "token is invalid or expired (HTTP 401 on /installation/repositories)" ;;
    403)
      if is_rate_limited_response; then
        fail "GitHub API rate limit exceeded (HTTP 403 on /installation/repositories)"
      fi
      fail "token lacks access to /installation/repositories (HTTP 403)"
      ;;
    404) fail "token cannot access /installation/repositories (HTTP 404)" ;;
    *) fail "unexpected HTTP $API_STATUS on /installation/repositories" ;;
  esac
done

printf 'github app installation permissions inspection complete\n'
printf 'repository: %s\n' "$REPOSITORY"
printf 'installation_id: %s\n' "$installation_id"
printf 'app_slug: %s\n' "${app_slug:-unknown}"
printf 'target: %s (%s)\n' "${target_login:-unknown}" "${target_type:-unknown}"
printf 'repository_selection: %s\n' "${repository_selection:-unknown}"
printf 'installation_repository_count: %s\n' "$repo_count"
printf 'installation_permissions:\n'
printf '%s\n' "$permissions_json" | jq -r 'to_entries | sort_by(.key)[] | "- " + .key + ": " + .value'

contents_perm=$(printf '%s' "$permissions_json" | jq -r '.contents // "none"')
admin_perm=$(printf '%s' "$permissions_json" | jq -r '.administration // "none"')
dependabot_perm=$(printf '%s' "$permissions_json" | jq -r '.dependabot_alerts // "none"')
workflows_perm=$(printf '%s' "$permissions_json" | jq -r 'if has("workflows") then .workflows elif has("workflow") then .workflow else "none" end')

has_contents_write=no
if [ "$contents_perm" = "write" ]; then
  has_contents_write=yes
fi

has_admin_write=no
if [ "$admin_perm" = "write" ]; then
  has_admin_write=yes
fi

has_dependabot_read=no
if [ "$dependabot_perm" = "read" ] || [ "$dependabot_perm" = "write" ]; then
  has_dependabot_read=yes
fi

has_workflows_write=no
if [ "$workflows_perm" = "write" ]; then
  has_workflows_write=yes
fi

can_sync_live_v2_workflow=no
if [ "$has_contents_write" = "yes" ] && [ "$has_workflows_write" = "yes" ]; then
  can_sync_live_v2_workflow=yes
fi

printf 'derived_capabilities:\n'
printf '- contents_write: %s\n' "$has_contents_write"
printf '- administration_write: %s\n' "$has_admin_write"
printf '- dependabot_alerts_read: %s\n' "$has_dependabot_read"
printf '- workflows_write: %s\n' "$has_workflows_write"
printf '- can_sync_live_v2_workflow_file: %s\n' "$can_sync_live_v2_workflow"

if [ -n "$repo_match" ]; then
  repo_permissions=$(printf '%s' "$repo_match" | jq -c '.permissions // {}')
  printf 'repository_match: found\n'
  printf 'repository_permissions:\n'
  printf '%s\n' "$repo_permissions" | jq -r 'to_entries | sort_by(.key)[] | "- " + .key + ": " + .value'
else
  printf 'repository_match: missing (%s not listed in /installation/repositories)\n' "$REPOSITORY"
  fail "installation token does not include repository $REPOSITORY"
fi
