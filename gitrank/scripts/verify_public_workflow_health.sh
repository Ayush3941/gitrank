#!/usr/bin/env sh
set -eu

REPOSITORY="${GITHUB_REPOSITORY:-}"
TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-${GITRANK_REPO_ADMIN_TOKEN:-}}}"
API_BASE="${GITHUB_API_URL:-https://api.github.com}"
API_VERSION="${GITHUB_API_VERSION:-2026-03-10}"
API_TIMEOUT_SECONDS="${GITHUB_API_TIMEOUT_SECONDS:-30}"
WORKFLOW_STATUS_BASE="${GITHUB_SERVER_URL:-https://github.com}"
WORKFLOW_EVENT="${WORKFLOW_EVENT:-push}"
WORKFLOW_BRANCH="${WORKFLOW_BRANCH:-}"
WORKFLOW_NAMES="${WORKFLOW_NAMES:-CI,Frontend CI,Secret Scan,CodeQL,Trivy Scan}"
RUNS_PER_PAGE="${RUNS_PER_PAGE:-100}"
MAX_PAGES="${MAX_PAGES:-5}"
TMP_ROOT="${TMPDIR:-/tmp}"
GITHUB_APP_ID="${GITHUB_APP_ID:-${GITRANK_GITHUB_APP_ID:-}}"
GITHUB_APP_INSTALLATION_ID="${GITHUB_APP_INSTALLATION_ID:-${GITRANK_GITHUB_APP_INSTALLATION_ID:-}}"
GITHUB_APP_PRIVATE_KEY_FILE="${GITHUB_APP_PRIVATE_KEY_FILE:-${GITRANK_GITHUB_APP_PRIVATE_KEY_FILE:-}}"
GITHUB_APP_PRIVATE_KEY_PEM="${GITHUB_APP_PRIVATE_KEY_PEM:-${GITRANK_GITHUB_APP_PRIVATE_KEY_PEM:-}}"

fail() {
  printf 'public workflow health verification failed: %s\n' "$1" >&2
  exit 1
}

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
LOCAL_WORKFLOW_DIR="$REPO_ROOT/.github/workflows"

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

is_positive_int() {
  value=$1
  case "$value" in
    ''|*[!0-9]*) return 1 ;;
    *) [ "$value" -gt 0 ] ;;
  esac
}

trim_spaces() {
  printf '%s' "$1" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//'
}

resolve_default_branch_from_git_remote_head() {
  [ -n "$WORKFLOW_BRANCH" ] && return 0
  command -v git >/dev/null 2>&1 || return 0
  remote_head_ref=$(git symbolic-ref -q --short refs/remotes/origin/HEAD 2>/dev/null || true)
  case "$remote_head_ref" in
    origin/*) WORKFLOW_BRANCH=${remote_head_ref#origin/} ;;
  esac
}

workflow_name_from_local_file() {
  workflow_file=$1
  name_line=$(awk '
    /^[[:space:]]*name:[[:space:]]*/ {
      sub(/^[[:space:]]*name:[[:space:]]*/, "", $0)
      sub(/[[:space:]]*#.*/, "", $0)
      print
      exit
    }
  ' "$workflow_file")
  printf '%s' "$name_line" | sed 's/^"//; s/"$//; s/^'\''//; s/'\''$//'
}

resolve_local_workflow_file_for_name() {
  wanted_name=$1
  [ -d "$LOCAL_WORKFLOW_DIR" ] || return 1
  for candidate in "$LOCAL_WORKFLOW_DIR"/*.yml "$LOCAL_WORKFLOW_DIR"/*.yaml; do
    [ -f "$candidate" ] || continue
    candidate_name=$(workflow_name_from_local_file "$candidate")
    [ "$candidate_name" = "$wanted_name" ] || continue
    printf '%s' "${candidate#"$REPO_ROOT"/}"
    return 0
  done
  return 1
}

url_encode() {
  printf '%s' "$1" | jq -sRr @uri
}

bootstrap_token_from_github_app() {
  [ -n "$TOKEN" ] && return 0
  [ -n "$GITHUB_APP_ID" ] || return 1
  [ -n "$GITHUB_APP_INSTALLATION_ID" ] || return 1
  if [ -z "$GITHUB_APP_PRIVATE_KEY_FILE" ] && [ -z "$GITHUB_APP_PRIVATE_KEY_PEM" ]; then
    return 1
  fi

  token_file=$(mktemp "$TMP_ROOT/gitrank-public-workflow-health-token.XXXXXX")
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
  printf 'public workflow health: bootstrapped token via GitHub App installation credentials\n'
}

verify_installation_repository_scope() {
  [ -n "$TOKEN" ] || return 0

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

resolve_repository_from_git_remote

case "$REPOSITORY" in
  */*) ;;
  *) fail "GITHUB_REPOSITORY must use owner/name form (or run from a clone with GitHub origin remote)" ;;
esac

is_positive_int "$RUNS_PER_PAGE" || fail "RUNS_PER_PAGE must be a positive integer"
is_positive_int "$MAX_PAGES" || fail "MAX_PAGES must be a positive integer"

require_command curl
require_command jq
require_command base64
require_command mktemp
mkdir -p "$TMP_ROOT"
bootstrap_token_from_github_app || true

OWNER=${REPOSITORY%%/*}
REPO=${REPOSITORY#*/}
API_STATUS=
API_BODY=

github_get() {
  path=$1
  body_file="$TMP_ROOT/gitrank-workflow-health.$$"
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

verify_installation_repository_scope

is_rate_limit_403() {
  [ "$API_STATUS" = "403" ] || return 1
  message=$(printf '%s' "$API_BODY" | jq -r '.message // empty' 2>/dev/null || true)
  case "$message" in
    *"API rate limit exceeded"*) return 0 ;;
  esac
  return 1
}

expect_status() {
  expected=$1
  context=$2
  if [ "$API_STATUS" != "$expected" ]; then
    if is_rate_limit_403; then
      fail "$context hit GitHub API rate limit (HTTP 403); set GITHUB_TOKEN, GH_TOKEN, GITRANK_REPO_ADMIN_TOKEN, or GitHub App credentials"
    fi
    fail "$context returned HTTP $API_STATUS"
  fi
}

verify_workflow_health_via_badges() {
  badge_branch=$1

  workflow_count=0
  failed_workflow_count=0
  missing_workflow_count=0

  old_ifs=$IFS
  IFS=','
  for raw_workflow_name in $WORKFLOW_NAMES; do
    workflow_name=$(trim_spaces "$raw_workflow_name")
    [ -n "$workflow_name" ] || continue
    workflow_count=$((workflow_count + 1))

    workflow_file=$(resolve_local_workflow_file_for_name "$workflow_name" || true)
    if [ -z "$workflow_file" ]; then
      missing_workflow_count=$((missing_workflow_count + 1))
      printf 'workflow missing: %s (no local workflow file matched by name)\n' "$workflow_name" >&2
      continue
    fi

    query="event=$(url_encode "$WORKFLOW_EVENT")"
    if [ -n "$badge_branch" ]; then
      query="$query&branch=$(url_encode "$badge_branch")"
    fi

    badge_url="$WORKFLOW_STATUS_BASE/$OWNER/$REPO/actions/workflows/$workflow_file/badge.svg?$query"
    badge_svg=$(curl -sS -L \
      --connect-timeout "$API_TIMEOUT_SECONDS" \
      --max-time "$API_TIMEOUT_SECONDS" \
      "$badge_url") || fail "failed to fetch workflow badge for '$workflow_name'"

    badge_status=$(printf '%s' "$badge_svg" | sed -n 's:.*<title>[^<]* - \([^<]*\)</title>.*:\1:p' | head -n 1)
    badge_status=$(printf '%s' "$badge_status" | tr '[:upper:]' '[:lower:]')

    case "$badge_status" in
      passing|success)
        printf 'workflow ok: %s (badge=%s)\n' "$workflow_name" "$badge_status"
        ;;
      failing|failed|failure|error)
        failed_workflow_count=$((failed_workflow_count + 1))
        printf 'workflow unhealthy: %s (badge=%s url=%s)\n' "$workflow_name" "$badge_status" "$badge_url" >&2
        ;;
      "")
        missing_workflow_count=$((missing_workflow_count + 1))
        printf 'workflow missing: %s (badge did not expose a status title)\n' "$workflow_name" >&2
        ;;
      *)
        missing_workflow_count=$((missing_workflow_count + 1))
        printf 'workflow unknown: %s (badge=%s url=%s)\n' "$workflow_name" "$badge_status" "$badge_url" >&2
        ;;
    esac
  done
  IFS=$old_ifs

  [ "$workflow_count" -gt 0 ] || fail "WORKFLOW_NAMES resolved to an empty set"

  if [ "$missing_workflow_count" -gt 0 ] || [ "$failed_workflow_count" -gt 0 ]; then
    fail "checked $workflow_count workflow(s) via badges: missing=$missing_workflow_count unhealthy=$failed_workflow_count"
  fi

  if [ -n "$badge_branch" ]; then
    printf 'public workflow health verification passed for %s (%s/%s) via badges\n' "$REPOSITORY" "$WORKFLOW_EVENT" "$badge_branch"
  else
    printf 'public workflow health verification passed for %s (%s/all-branches) via badges\n' "$REPOSITORY" "$WORKFLOW_EVENT"
  fi
}

diagnose_trivy_remote_policy() {
  branch_name=$1
  [ -n "$branch_name" ] || branch_name=$WORKFLOW_BRANCH

  github_get "/repos/$OWNER/$REPO/contents/.github/workflows/trivy.yml?ref=$branch_name"
  case "$API_STATUS" in
    200)
      trivy_workflow_base64=$(printf '%s' "$API_BODY" | jq -r '.content // empty')
      trivy_workflow_content=$(printf '%s' "$trivy_workflow_base64" | tr -d '\n' | base64 -d 2>/dev/null || true)
      if [ -z "$trivy_workflow_content" ]; then
        printf 'hint: unable to decode remote .github/workflows/trivy.yml for branch %s\n' "$branch_name" >&2
      elif ! printf '%s' "$trivy_workflow_content" | grep -q -- "--ignorefile .trivyignore.yaml"; then
        printf 'hint: remote .github/workflows/trivy.yml on %s is missing --ignorefile .trivyignore.yaml in Trivy scan commands\n' "$branch_name" >&2
      fi
      ;;
    404)
      printf 'hint: remote .github/workflows/trivy.yml is missing on %s\n' "$branch_name" >&2
      ;;
    *)
      printf 'hint: unable to read remote .github/workflows/trivy.yml on %s (HTTP %s)\n' "$branch_name" "$API_STATUS" >&2
      ;;
  esac

  github_get "/repos/$OWNER/$REPO/contents/.trivyignore.yaml?ref=$branch_name"
  case "$API_STATUS" in
    200)
      trivy_ignore_base64=$(printf '%s' "$API_BODY" | jq -r '.content // empty')
      trivy_ignore_content=$(printf '%s' "$trivy_ignore_base64" | tr -d '\n' | base64 -d 2>/dev/null || true)
      if [ -z "$trivy_ignore_content" ]; then
        printf 'hint: remote .trivyignore.yaml exists on %s but is empty\n' "$branch_name" >&2
      fi
      ;;
    404)
      printf 'hint: remote .trivyignore.yaml is missing on %s\n' "$branch_name" >&2
      ;;
    *)
      printf 'hint: unable to read remote .trivyignore.yaml on %s (HTTP %s)\n' "$branch_name" "$API_STATUS" >&2
      ;;
  esac
}

resolve_default_branch_from_git_remote_head

if [ -z "$WORKFLOW_BRANCH" ]; then
  github_get "/repos/$OWNER/$REPO"
  if [ "$API_STATUS" = "200" ]; then
    WORKFLOW_BRANCH=$(printf '%s' "$API_BODY" | jq -r '.default_branch // empty')
  elif is_rate_limit_403; then
    if [ -n "$TOKEN" ]; then
      fail "repository metadata hit GitHub API rate limit (HTTP 403) even with token; check token scope and current rate limits"
    fi
    printf 'public workflow health: repository metadata is rate-limited without token; continuing with all-branch workflow checks\n' >&2
    WORKFLOW_BRANCH="*"
  else
    fail "repository metadata returned HTTP $API_STATUS"
  fi
fi
[ -n "$WORKFLOW_BRANCH" ] || fail "unable to resolve workflow branch"
branch_filter="$WORKFLOW_BRANCH"
if [ "$WORKFLOW_BRANCH" = "*" ] || [ "$WORKFLOW_BRANCH" = "any" ]; then
  branch_filter=""
fi

github_get "/repos/$OWNER/$REPO/actions/workflows?per_page=100"
if [ "$API_STATUS" = "200" ]; then
  workflows_json=$API_BODY
elif is_rate_limit_403 && [ -z "$TOKEN" ]; then
  printf 'public workflow health: workflow list is rate-limited without token; falling back to badge checks\n' >&2
  verify_workflow_health_via_badges "$branch_filter"
  exit 0
else
  expect_status 200 "repository workflows list"
fi

workflow_count=0
failed_workflow_count=0
missing_workflow_count=0

old_ifs=$IFS
IFS=','
for raw_workflow_name in $WORKFLOW_NAMES; do
  workflow_name=$(trim_spaces "$raw_workflow_name")
  [ -n "$workflow_name" ] || continue
  workflow_count=$((workflow_count + 1))

  workflow_id=$(printf '%s' "$workflows_json" | jq -r --arg name "$workflow_name" '
    [
      .workflows[]?
      | select(.name == $name)
    ]
    | sort_by(.updated_at // .created_at // "")
    | reverse
    | .[0].id // empty
  ')

  if [ -z "$workflow_id" ]; then
    missing_workflow_count=$((missing_workflow_count + 1))
    printf 'workflow missing: %s (workflow not found in repository workflow list)\n' "$workflow_name" >&2
    continue
  fi

  if [ -n "$branch_filter" ]; then
    github_get "/repos/$OWNER/$REPO/actions/workflows/$workflow_id/runs?branch=$branch_filter&event=$WORKFLOW_EVENT&per_page=1"
  else
    github_get "/repos/$OWNER/$REPO/actions/workflows/$workflow_id/runs?event=$WORKFLOW_EVENT&per_page=1"
  fi
  expect_status 200 "workflow run list for $workflow_name"
  latest_run=$(printf '%s' "$API_BODY" | jq -c '.workflow_runs[0] // empty')
  if [ -z "$latest_run" ]; then
    missing_workflow_count=$((missing_workflow_count + 1))
    if [ -n "$branch_filter" ]; then
      printf 'workflow missing: %s (no %s run found on branch %s)\n' "$workflow_name" "$WORKFLOW_EVENT" "$branch_filter" >&2
    else
      printf 'workflow missing: %s (no %s run found)\n' "$workflow_name" "$WORKFLOW_EVENT" >&2
    fi
    continue
  fi

  run_id=$(printf '%s' "$latest_run" | jq -r '.id // empty')
  run_status=$(printf '%s' "$latest_run" | jq -r '.status // empty')
  run_conclusion=$(printf '%s' "$latest_run" | jq -r '.conclusion // empty')
  run_created_at=$(printf '%s' "$latest_run" | jq -r '.created_at // empty')
  run_url=$(printf '%s' "$latest_run" | jq -r '.html_url // empty')

  [ -n "$run_id" ] || fail "workflow '$workflow_name' latest run is missing id"

  if [ "$run_status" = "completed" ] && [ "$run_conclusion" = "success" ]; then
    printf 'workflow ok: %s (run_id=%s created_at=%s)\n' "$workflow_name" "$run_id" "$run_created_at"
    continue
  fi

  failed_workflow_count=$((failed_workflow_count + 1))
  printf 'workflow unhealthy: %s status=%s conclusion=%s run_id=%s url=%s\n' \
    "$workflow_name" "$run_status" "$run_conclusion" "$run_id" "$run_url" >&2

  github_get "/repos/$OWNER/$REPO/actions/runs/$run_id/jobs?per_page=100"
  if [ "$API_STATUS" = "200" ]; then
    failing_jobs=$(printf '%s' "$API_BODY" | jq -r '
      [
        .jobs[]?
        | select((.conclusion // "null") != "success")
        | "- " + .name + " (" + ((.conclusion // .status // "unknown")) + ")"
      ]
      | unique
      | .[]
    ')
    if [ -n "$failing_jobs" ]; then
      printf 'failing jobs for %s:\n%s\n' "$workflow_name" "$failing_jobs" >&2
    fi
  fi

  if [ "$workflow_name" = "Trivy Scan" ]; then
    run_head_branch=$(printf '%s' "$latest_run" | jq -r '.head_branch // empty')
    diagnose_trivy_remote_policy "$run_head_branch"
    printf 'hint: verify .github/workflows/trivy.yml includes --ignorefile .trivyignore.yaml for fs/image scans and that .trivyignore.yaml exists at repo root\n' >&2
    printf 'hint: if remote policy files drifted, run GITRANK_REPO_ADMIN_TOKEN=... make sync-remote-trivy-policy\n' >&2
  fi
done
IFS=$old_ifs

[ "$workflow_count" -gt 0 ] || fail "WORKFLOW_NAMES resolved to an empty set"

if [ "$missing_workflow_count" -gt 0 ] || [ "$failed_workflow_count" -gt 0 ]; then
  fail "checked $workflow_count workflow(s): missing=$missing_workflow_count unhealthy=$failed_workflow_count"
fi

if [ -n "$branch_filter" ]; then
  printf 'public workflow health verification passed for %s (%s/%s)\n' "$REPOSITORY" "$WORKFLOW_EVENT" "$branch_filter"
else
  printf 'public workflow health verification passed for %s (%s/all-branches)\n' "$REPOSITORY" "$WORKFLOW_EVENT"
fi
