#!/usr/bin/env sh
set -eu

REPOSITORY="${GITHUB_REPOSITORY:-}"
TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-${GITRANK_REPO_ADMIN_TOKEN:-}}}"
API_BASE="${GITHUB_API_URL:-https://api.github.com}"
API_VERSION="${GITHUB_API_VERSION:-2026-03-10}"
API_TIMEOUT_SECONDS="${GITHUB_API_TIMEOUT_SECONDS:-30}"
TMP_ROOT="${TMPDIR:-/tmp}"
APPLY_CONFIRMATION="${GITRANK_APPLY_REPOSITORY_CONTROLS:-}"
STATUS_CHECKS="${GITRANK_REQUIRED_STATUS_CHECKS:-}"
CONTROL_APPLY_MODE="${GITRANK_REPOSITORY_CONTROLS_MODE:-auto}"
RULESET_NAME="${GITRANK_REPOSITORY_RULESET_NAME:-GitRank V2 Repository Controls}"
GITHUB_APP_ID="${GITHUB_APP_ID:-${GITRANK_GITHUB_APP_ID:-}}"
GITHUB_APP_INSTALLATION_ID="${GITHUB_APP_INSTALLATION_ID:-${GITRANK_GITHUB_APP_INSTALLATION_ID:-}}"
GITHUB_APP_PRIVATE_KEY_FILE="${GITHUB_APP_PRIVATE_KEY_FILE:-${GITRANK_GITHUB_APP_PRIVATE_KEY_FILE:-}}"
GITHUB_APP_PRIVATE_KEY_PEM="${GITHUB_APP_PRIVATE_KEY_PEM:-${GITRANK_GITHUB_APP_PRIVATE_KEY_PEM:-}}"

fail() {
  printf 'github repository controls apply failed: %s\n' "$1" >&2
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

  token_file=$(mktemp "$TMP_ROOT/gitrank-github-controls-apply-token.XXXXXX")
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
  printf 'github controls apply: bootstrapped token via GitHub App installation credentials\n'
}

case "$REPOSITORY" in
  */*) ;;
  *) fail "GITHUB_REPOSITORY must use owner/name form (or run from a clone with GitHub origin remote)" ;;
esac

[ "$APPLY_CONFIRMATION" = "yes" ] || fail "set GITRANK_APPLY_REPOSITORY_CONTROLS=yes to allow live GitHub mutations"
[ -n "$STATUS_CHECKS" ] || fail "GITRANK_REQUIRED_STATUS_CHECKS is required; use exact check names from a recent successful PR"
case "$CONTROL_APPLY_MODE" in
  auto|branch-protection|ruleset) ;;
  *) fail "GITRANK_REPOSITORY_CONTROLS_MODE must be one of: auto, branch-protection, ruleset" ;;
esac

require_command curl
require_command jq
require_command mktemp
mkdir -p "$TMP_ROOT"
bootstrap_token_from_github_app || true
[ -n "$TOKEN" ] || fail "GITHUB_TOKEN, GH_TOKEN, or GITRANK_REPO_ADMIN_TOKEN is required with repository administration write access (or set GitHub App credentials)"

OWNER=${REPOSITORY%%/*}
REPO=${REPOSITORY#*/}
API_STATUS=
API_BODY=
APPLIED_CONTROL_SURFACE=
BRANCH_PROTECTION_ERROR=

github_request() {
  method=$1
  path=$2
  data_file=${3:-}
  body_file="$TMP_ROOT/gitrank-github-controls-apply.$$"
  if [ -n "$data_file" ]; then
    API_STATUS=$(curl -sS -L -X "$method" -o "$body_file" -w '%{http_code}' \
      --connect-timeout "$API_TIMEOUT_SECONDS" \
      --max-time "$API_TIMEOUT_SECONDS" \
      -H 'Accept: application/vnd.github+json' \
      -H "Authorization: Bearer $TOKEN" \
      -H "X-GitHub-Api-Version: $API_VERSION" \
      --data-binary "@$data_file" \
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

expect_status() {
  expected=$1
  context=$2
  [ "$API_STATUS" = "$expected" ] || fail "$context returned HTTP $API_STATUS"
}

api_error_summary() {
  message=$(printf '%s' "$API_BODY" | jq -r '.message // empty' 2>/dev/null || true)
  documentation_url=$(printf '%s' "$API_BODY" | jq -r '.documentation_url // empty' 2>/dev/null || true)
  if [ -n "$message" ] && [ -n "$documentation_url" ]; then
    printf 'HTTP %s: %s (%s)' "$API_STATUS" "$message" "$documentation_url"
    return 0
  fi
  if [ -n "$message" ]; then
    printf 'HTTP %s: %s' "$API_STATUS" "$message"
    return 0
  fi
  printf 'HTTP %s' "$API_STATUS"
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

checks_json=$(printf '%s' "$STATUS_CHECKS" | tr ',' '\n' | jq -R 'gsub("^\\s+|\\s+$"; "")' | jq -s 'map(select(length > 0))')
check_count=$(printf '%s' "$checks_json" | jq 'length')
[ "$check_count" -gt 0 ] || fail "GITRANK_REQUIRED_STATUS_CHECKS did not contain any check names"

verify_installation_repository_scope

github_request GET "/repos/$OWNER/$REPO"
expect_status 200 "repository metadata"
DEFAULT_BRANCH=$(printf '%s' "$API_BODY" | jq -r '.default_branch // empty')
[ -n "$DEFAULT_BRANCH" ] || fail "repository default branch is empty"
TARGET_BRANCH="${GITHUB_DEFAULT_BRANCH:-$DEFAULT_BRANCH}"

github_request PUT "/repos/$OWNER/$REPO/vulnerability-alerts"
expect_status 204 "enable vulnerability alerts and dependency graph"

payload_file="$TMP_ROOT/gitrank-branch-protection-payload.$$"
ruleset_payload_file="$TMP_ROOT/gitrank-ruleset-payload.$$"
trap 'rm -f "$payload_file" "$ruleset_payload_file"' EXIT
printf '%s' "$checks_json" | jq '{
  required_status_checks: {
    strict: true,
    contexts: .
  },
  enforce_admins: false,
  required_pull_request_reviews: {
    dismiss_stale_reviews: false,
    require_code_owner_reviews: false,
    required_approving_review_count: 1,
    require_last_push_approval: false
  },
  restrictions: null,
  required_linear_history: false,
  allow_force_pushes: false,
  allow_deletions: false,
  block_creations: false,
  required_conversation_resolution: false,
  lock_branch: false,
  allow_fork_syncing: true
}' >"$payload_file"

apply_branch_protection_controls() {
  github_request PUT "/repos/$OWNER/$REPO/branches/$TARGET_BRANCH/protection" "$payload_file"
  case "$API_STATUS" in
    200|201)
      APPLIED_CONTROL_SURFACE="branch protection"
      return 0
      ;;
    *)
      BRANCH_PROTECTION_ERROR=$(api_error_summary)
      return 1
      ;;
  esac
}

apply_ruleset_controls() {
  printf '%s' "$checks_json" | jq \
    --arg ruleset_name "$RULESET_NAME" \
    --arg target_ref "refs/heads/$TARGET_BRANCH" \
    '{
      name: $ruleset_name,
      target: "branch",
      enforcement: "active",
      conditions: {
        ref_name: {
          include: [$target_ref],
          exclude: []
        }
      },
      rules: [
        {
          type: "pull_request",
          parameters: {
            allowed_merge_methods: ["merge", "squash", "rebase"],
            dismiss_stale_reviews_on_push: false,
            require_code_owner_review: false,
            require_last_push_approval: false,
            required_approving_review_count: 1,
            required_review_thread_resolution: false
          }
        },
        {
          type: "required_status_checks",
          parameters: {
            required_status_checks: (map({ context: . })),
            strict_required_status_checks_policy: true,
            do_not_enforce_on_create: false
          }
        },
        { type: "non_fast_forward" },
        { type: "deletion" }
      ]
    }' >"$ruleset_payload_file"

  github_request GET "/repos/$OWNER/$REPO/rulesets?per_page=100"
  expect_status 200 "list repository rulesets"
  existing_ruleset_id=$(printf '%s' "$API_BODY" | jq -r \
    --arg ruleset_name "$RULESET_NAME" \
    --arg target_ref "refs/heads/$TARGET_BRANCH" \
    '[.[]?
      | select((.target // "") == "branch")
      | select((.name // "") == $ruleset_name)
      | select(any((.conditions.ref_name.include // []); . == $target_ref))
    ][0].id // empty')

  if [ -n "$existing_ruleset_id" ]; then
    github_request PUT "/repos/$OWNER/$REPO/rulesets/$existing_ruleset_id" "$ruleset_payload_file"
    case "$API_STATUS" in
      200|201) ;;
      *) fail "update repository ruleset for $TARGET_BRANCH failed ($(api_error_summary))" ;;
    esac
  else
    github_request POST "/repos/$OWNER/$REPO/rulesets" "$ruleset_payload_file"
    case "$API_STATUS" in
      200|201) ;;
      *) fail "create repository ruleset for $TARGET_BRANCH failed ($(api_error_summary))" ;;
    esac
  fi

  APPLIED_CONTROL_SURFACE="ruleset"
}

case "$CONTROL_APPLY_MODE" in
  branch-protection)
    apply_branch_protection_controls || fail "update branch protection for $TARGET_BRANCH failed ($BRANCH_PROTECTION_ERROR)"
    ;;
  ruleset)
    apply_ruleset_controls
    ;;
  auto)
    if ! apply_branch_protection_controls; then
      case "$API_STATUS" in
        401|403)
          fail "update branch protection for $TARGET_BRANCH failed ($BRANCH_PROTECTION_ERROR)"
          ;;
      esac
      printf 'github controls apply: branch-protection update failed (%s); falling back to repository ruleset mode\n' "$BRANCH_PROTECTION_ERROR"
      apply_ruleset_controls
    fi
    ;;
esac

printf 'GitHub repository controls applied for %s on %s.\n' "$REPOSITORY" "$TARGET_BRANCH"
printf '- vulnerability alerts and dependency graph requested\n'
printf '- control surface applied via: %s\n' "$APPLIED_CONTROL_SURFACE"
printf '- pull request review required: 1 approval\n'
printf '- required status checks configured: %s\n' "$check_count"
printf '- force pushes disabled\n'
printf '- branch deletions disabled\n'
printf 'Run make verify-github-repository-controls with the same token to prove the live state.\n'
