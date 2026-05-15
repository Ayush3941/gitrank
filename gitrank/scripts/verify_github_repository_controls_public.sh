#!/usr/bin/env sh
set -eu

REPOSITORY="${GITHUB_REPOSITORY:-}"
TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-${GITRANK_REPO_ADMIN_TOKEN:-}}}"
API_BASE="${GITHUB_API_URL:-https://api.github.com}"
WEB_BASE="${GITHUB_WEB_URL:-https://github.com}"
API_VERSION="${GITHUB_API_VERSION:-2026-03-10}"
API_TIMEOUT_SECONDS="${GITHUB_API_TIMEOUT_SECONDS:-30}"
REQUIRE_FULL_VERIFICATION="${REQUIRE_FULL_VERIFICATION:-false}"
TMP_ROOT="${TMPDIR:-/tmp}"
GITHUB_APP_ID="${GITHUB_APP_ID:-${GITRANK_GITHUB_APP_ID:-}}"
GITHUB_APP_INSTALLATION_ID="${GITHUB_APP_INSTALLATION_ID:-${GITRANK_GITHUB_APP_INSTALLATION_ID:-}}"
GITHUB_APP_PRIVATE_KEY_FILE="${GITHUB_APP_PRIVATE_KEY_FILE:-${GITRANK_GITHUB_APP_PRIVATE_KEY_FILE:-}}"
GITHUB_APP_PRIVATE_KEY_PEM="${GITHUB_APP_PRIVATE_KEY_PEM:-${GITRANK_GITHUB_APP_PRIVATE_KEY_PEM:-}}"

fail() {
  printf 'github repository controls public verification failed: %s\n' "$1" >&2
  exit 1
}

CONTROL_ERRORS=

add_control_error() {
  msg=$1
  if [ -n "$CONTROL_ERRORS" ]; then
    CONTROL_ERRORS="${CONTROL_ERRORS}; ${msg}"
  else
    CONTROL_ERRORS="$msg"
  fi
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

  token_file=$(mktemp "$TMP_ROOT/gitrank-controls-public-token.XXXXXX")
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
  printf 'github controls public verification: bootstrapped token via GitHub App installation credentials\n'
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

OWNER=${REPOSITORY%%/*}
REPO=${REPOSITORY#*/}
API_STATUS=
API_BODY=
WEB_STATUS=
WEB_BODY=

github_get() {
  path=$1
  body_file="$TMP_ROOT/gitrank-github-controls-public.$$"
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

github_web_get() {
  path=$1
  body_file="$TMP_ROOT/gitrank-github-controls-public-web.$$"
  WEB_STATUS=$(curl -sS -L -o "$body_file" -w '%{http_code}' \
    --connect-timeout "$API_TIMEOUT_SECONDS" \
    --max-time "$API_TIMEOUT_SECONDS" \
    "$WEB_BASE$path") || {
      rm -f "$body_file"
      fail "GitHub web request failed for $path"
    }
  WEB_BODY=$(cat "$body_file")
  rm -f "$body_file"
}

is_rate_limited_api_response() {
  [ "$API_STATUS" = "403" ] || return 1
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
    if is_rate_limited_api_response; then
      fail "$context hit GitHub API rate limit (HTTP 403); set GITHUB_TOKEN, GH_TOKEN, GITRANK_REPO_ADMIN_TOKEN, or GitHub App credentials"
    fi
    fail "$context returned HTTP $API_STATUS"
  fi
}

extract_react_embedded_json() {
  printf '%s' "$1" | awk '
    /<script type="application\/json" data-target="react-app.embeddedData">/ {
      sub(/^.*data-target="react-app.embeddedData">/, "")
      sub(/<\/script>.*/, "")
      print
      exit
    }
  '
}

load_public_rules_page_fallback() {
  github_web_get "/$OWNER/$REPO/rules"
  [ "$WEB_STATUS" = "200" ] || return 1
  rules_embedded_json=$(extract_react_embedded_json "$WEB_BODY")
  [ -n "$rules_embedded_json" ] || return 1

  FALLBACK_DEFAULT_BRANCH=$(printf '%s' "$rules_embedded_json" | jq -r '.payload.source.defaultBranch // empty' 2>/dev/null || true)
  [ -n "$FALLBACK_DEFAULT_BRANCH" ] || return 1

  FALLBACK_RULESETS_JSON=$(printf '%s' "$rules_embedded_json" | jq -c '.payload.rulesets // []' 2>/dev/null || printf '[]')
  FALLBACK_RULESET_COUNT=$(printf '%s' "$FALLBACK_RULESETS_JSON" | jq 'length')
  FALLBACK_RULES_PAGE_AVAILABLE=true
  return 0
}

load_public_branches_page_fallback() {
  branch_name=$1
  github_web_get "/$OWNER/$REPO/branches"
  [ "$WEB_STATUS" = "200" ] || return 1
  branches_embedded_json=$(extract_react_embedded_json "$WEB_BODY")
  [ -n "$branches_embedded_json" ] || return 1

  default_name=$(printf '%s' "$branches_embedded_json" | jq -r '.payload.branches.default.name // empty' 2>/dev/null || true)
  [ -n "$default_name" ] || return 1

  if [ "$default_name" != "$branch_name" ]; then
    return 1
  fi

  FALLBACK_BRANCH_PROTECTED=$(printf '%s' "$branches_embedded_json" | jq -r '.payload.branches.default.protectedByBranchProtections // false' 2>/dev/null || printf 'false')
  FALLBACK_BRANCH_RULESETS_PATH=$(printf '%s' "$branches_embedded_json" | jq -r '.payload.branches.default.rulesetsPath // empty' 2>/dev/null || true)
  FALLBACK_BRANCHES_PAGE_AVAILABLE=true
  return 0
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
  if [ "$REVIEW_COUNT" -lt 1 ]; then
    add_control_error "ruleset controls must require at least one approving pull request review"
  fi

  REQUIRED_CHECKS=$(printf '%s' "$rules_json" | jq -r '[.[] | select(.type == "required_status_checks") | (.parameters.required_status_checks // [] | length)] | add // 0')
  if [ "$REQUIRED_CHECKS" -lt 1 ]; then
    add_control_error "ruleset controls must require at least one status check"
  fi

  HAS_NON_FAST_FORWARD=$(printf '%s' "$rules_json" | jq -r '[.[] | select(.type == "non_fast_forward")] | length')
  if [ "$HAS_NON_FAST_FORWARD" -lt 1 ]; then
    add_control_error "ruleset controls must block force pushes (non_fast_forward rule missing)"
  fi

  HAS_DELETION_RULE=$(printf '%s' "$rules_json" | jq -r '[.[] | select(.type == "deletion")] | length')
  if [ "$HAS_DELETION_RULE" -lt 1 ]; then
    add_control_error "ruleset controls must block branch deletion (deletion rule missing)"
  fi

  CONTROL_MODE="rulesets"
  ALLOW_FORCE_PUSHES="false"
  ALLOW_DELETIONS="false"
}

probe_dependency_graph_sbom_authenticated() {
  github_get "/repos/$OWNER/$REPO/dependency-graph/sbom"
  case "$API_STATUS" in
    200|201|202)
      DEPENDENCY_GRAPH_STATUS="verified"
      return 0
      ;;
    404)
      github_get "/repos/$OWNER/$REPO/dependency-graph/sbom/generate-report"
      case "$API_STATUS" in
        200|201|202)
          DEPENDENCY_GRAPH_STATUS="verified"
          return 0
          ;;
        401)
          add_control_error "dependency graph SBOM generation denied (HTTP 401): token invalid or expired"
          DEPENDENCY_GRAPH_STATUS="denied"
          return 0
          ;;
        403)
          add_control_error "dependency graph SBOM generation denied (HTTP 403): missing dependency-graph/read scope"
          DEPENDENCY_GRAPH_STATUS="denied"
          return 0
          ;;
        404)
          add_control_error "dependency graph SBOM returned HTTP 404 on legacy and generate-report endpoints"
          DEPENDENCY_GRAPH_STATUS="not-found"
          return 0
          ;;
        *)
          add_control_error "dependency graph SBOM generation endpoint returned HTTP $API_STATUS"
          DEPENDENCY_GRAPH_STATUS="error"
          return 0
          ;;
      esac
      ;;
    401)
      add_control_error "dependency graph SBOM denied (HTTP 401): token invalid or expired"
      DEPENDENCY_GRAPH_STATUS="denied"
      ;;
    403)
      add_control_error "dependency graph SBOM denied (HTTP 403): missing dependency-graph/read scope"
      DEPENDENCY_GRAPH_STATUS="denied"
      ;;
    *)
      add_control_error "dependency graph SBOM endpoint returned HTTP $API_STATUS"
      DEPENDENCY_GRAPH_STATUS="error"
      ;;
  esac
}

probe_dependency_graph_sbom_public() {
  github_get "/repos/$OWNER/$REPO/dependency-graph/sbom"
  case "$API_STATUS" in
    200|201|202)
      DEPENDENCY_GRAPH_STATUS="public-verified"
      return 0
      ;;
    404)
      github_get "/repos/$OWNER/$REPO/dependency-graph/sbom/generate-report"
      case "$API_STATUS" in
        200|201|202) DEPENDENCY_GRAPH_STATUS="public-verified" ;;
        404) DEPENDENCY_GRAPH_STATUS="not-found" ;;
        403) DEPENDENCY_GRAPH_STATUS="rate-limited-or-forbidden" ;;
        *) DEPENDENCY_GRAPH_STATUS="unverified" ;;
      esac
      ;;
    403) DEPENDENCY_GRAPH_STATUS="rate-limited-or-forbidden" ;;
    *) DEPENDENCY_GRAPH_STATUS="unverified" ;;
  esac
}

probe_dependency_graph_html_public() {
  html_file=$(mktemp "$TMP_ROOT/gitrank-dependency-graph-html.XXXXXX")
  html_status=$(curl -sS -L -o "$html_file" -w '%{http_code}' \
    --connect-timeout "$API_TIMEOUT_SECONDS" \
    --max-time "$API_TIMEOUT_SECONDS" \
    "$WEB_BASE/$OWNER/$REPO/network/dependencies") || {
      rm -f "$html_file"
      DEPENDENCY_GRAPH_HTML_STATUS="request-failed"
      return 0
    }

  case "$html_status" in
    200)
      if rg -q "Dependency graph is disabled" "$html_file"; then
        DEPENDENCY_GRAPH_HTML_STATUS="disabled"
      elif rg -q "<title>Dependencies ·" "$html_file"; then
        DEPENDENCY_GRAPH_HTML_STATUS="page-present"
      else
        DEPENDENCY_GRAPH_HTML_STATUS="unknown-page-content"
      fi
      ;;
    404)
      DEPENDENCY_GRAPH_HTML_STATUS="not-found"
      ;;
    403)
      DEPENDENCY_GRAPH_HTML_STATUS="forbidden"
      ;;
    *)
      DEPENDENCY_GRAPH_HTML_STATUS="http-$html_status"
      ;;
  esac
  rm -f "$html_file"
}

FALLBACK_RULES_PAGE_AVAILABLE=false
FALLBACK_BRANCHES_PAGE_AVAILABLE=false
FALLBACK_DEFAULT_BRANCH=
FALLBACK_RULESETS_JSON='[]'
FALLBACK_RULESET_COUNT=0
FALLBACK_BRANCH_PROTECTED=false
FALLBACK_BRANCH_RULESETS_PATH=

github_get "/repos/$OWNER/$REPO"
if [ "$API_STATUS" = "200" ]; then
  DEFAULT_BRANCH=$(printf '%s' "$API_BODY" | jq -r '.default_branch // empty')
  [ -n "$DEFAULT_BRANCH" ] || fail "repository default branch is empty"
elif [ -z "$TOKEN" ] && is_rate_limited_api_response; then
  if ! load_public_rules_page_fallback; then
    fail "repository metadata hit GitHub API rate limit (HTTP 403) and public rules fallback failed; set GITHUB_TOKEN, GH_TOKEN, GITRANK_REPO_ADMIN_TOKEN, or GitHub App credentials"
  fi
  DEFAULT_BRANCH="$FALLBACK_DEFAULT_BRANCH"
else
  expect_status 200 "repository metadata"
fi

TARGET_BRANCH="${GITHUB_DEFAULT_BRANCH:-$DEFAULT_BRANCH}"

branch_metadata_source=api
github_get "/repos/$OWNER/$REPO/branches/$TARGET_BRANCH"
if [ "$API_STATUS" = "200" ]; then
  BRANCH_PROTECTED=$(printf '%s' "$API_BODY" | jq -r '.protected // false')
elif [ -z "$TOKEN" ] && is_rate_limited_api_response; then
  if load_public_branches_page_fallback "$TARGET_BRANCH"; then
    BRANCH_PROTECTED="$FALLBACK_BRANCH_PROTECTED"
    branch_metadata_source=web
  else
    fail "default branch metadata hit GitHub API rate limit (HTTP 403) and public branches fallback failed; set GITHUB_TOKEN, GH_TOKEN, GITRANK_REPO_ADMIN_TOKEN, or GitHub App credentials"
  fi
else
  expect_status 200 "default branch metadata"
  BRANCH_PROTECTED=$(printf '%s' "$API_BODY" | jq -r '.protected // false')
fi

REQUIRED_CHECKS=0
REVIEW_COUNT="unknown"
ALLOW_FORCE_PUSHES="unknown"
ALLOW_DELETIONS="unknown"
CONTROL_MODE="unknown"

verification_mode="public-partial"
DEPENDABOT_STATUS="unverified"
DEPENDENCY_GRAPH_STATUS="unverified"
DEPENDENCY_GRAPH_HTML_STATUS="not-run"

if [ "$BRANCH_PROTECTED" = "true" ]; then
  if [ "$branch_metadata_source" = "api" ]; then
    REQUIRED_CHECKS=$(printf '%s' "$API_BODY" | jq -r '((.protection.required_status_checks.contexts // []) | length) + ((.protection.required_status_checks.checks // []) | length)')
    if [ "$REQUIRED_CHECKS" -lt 1 ]; then
      add_control_error "protected branch does not expose any required status checks"
    fi
  else
    REQUIRED_CHECKS="unknown"
  fi
  CONTROL_MODE="branch protection"
else
  rules_loaded_from_fallback=false
  if [ "$FALLBACK_RULES_PAGE_AVAILABLE" = "true" ] && [ "$FALLBACK_RULESET_COUNT" -ge 0 ]; then
    rules_loaded_from_fallback=true
    if [ "$FALLBACK_RULESET_COUNT" -le 0 ]; then
      add_control_error "default branch is neither protected nor covered by branch rulesets"
    else
      rules_json="$FALLBACK_RULESETS_JSON"
      verify_ruleset_payload "$rules_json"
    fi
  fi

  if [ "$rules_loaded_from_fallback" = "false" ]; then
    github_get "/repos/$OWNER/$REPO/rules/branches/$TARGET_BRANCH"
    case "$API_STATUS" in
      200)
        rules_json=$(rules_json_from_api_body)
        rules_count=$(printf '%s' "$rules_json" | jq 'length')
        if [ "$rules_count" -le 0 ]; then
          add_control_error "branch rules endpoint returned no effective rules for $TARGET_BRANCH"
        else
          verify_ruleset_payload "$rules_json"
        fi
        ;;
      404)
        add_control_error "default branch is neither protected nor covered by branch rulesets"
        ;;
      *)
        if [ "$API_STATUS" = "403" ]; then
          message=$(printf '%s' "$API_BODY" | jq -r '.message // empty' 2>/dev/null || true)
          case "$message" in
            *"API rate limit exceeded"*)
              add_control_error "branch rules lookup for $TARGET_BRANCH hit GitHub API rate limit (HTTP 403); set GITHUB_TOKEN, GH_TOKEN, GITRANK_REPO_ADMIN_TOKEN, or GitHub App credentials"
              ;;
            *)
              add_control_error "branch rules lookup for $TARGET_BRANCH returned HTTP 403"
              ;;
          esac
        else
          add_control_error "branch rules lookup for $TARGET_BRANCH returned HTTP $API_STATUS"
        fi
        ;;
    esac
  fi
fi

if [ -n "$TOKEN" ]; then
  if [ "$CONTROL_MODE" = "branch protection" ]; then
    github_get "/repos/$OWNER/$REPO/branches/$TARGET_BRANCH/protection"
    if [ "$API_STATUS" = "200" ]; then
      REVIEW_COUNT=$(printf '%s' "$API_BODY" | jq -r '.required_pull_request_reviews.required_approving_review_count // 0')
      if [ "$REVIEW_COUNT" -lt 1 ]; then
        add_control_error "branch protection must require at least one approving pull request review"
      fi

      ALLOW_FORCE_PUSHES=$(printf '%s' "$API_BODY" | jq -r '.allow_force_pushes.enabled // false')
      if [ "$ALLOW_FORCE_PUSHES" != "false" ]; then
        add_control_error "branch protection must not allow force pushes"
      fi

      ALLOW_DELETIONS=$(printf '%s' "$API_BODY" | jq -r '.allow_deletions.enabled // false')
      if [ "$ALLOW_DELETIONS" != "false" ]; then
        add_control_error "branch protection must not allow branch deletions"
      fi
    else
      add_control_error "branch protection metadata returned HTTP $API_STATUS"
    fi
  fi

  github_get "/repos/$OWNER/$REPO/dependabot/alerts?per_page=1"
  case "$API_STATUS" in
    200) DEPENDABOT_STATUS="verified" ;;
    401) add_control_error "Dependabot alerts API denied (HTTP 401): token invalid or expired"; DEPENDABOT_STATUS="denied" ;;
    403) add_control_error "Dependabot alerts API denied (HTTP 403): missing security-events/read or insufficient scope"; DEPENDABOT_STATUS="denied" ;;
    404) add_control_error "Dependabot alerts API unavailable (HTTP 404)"; DEPENDABOT_STATUS="unavailable" ;;
    *) add_control_error "Dependabot alerts API returned HTTP $API_STATUS"; DEPENDABOT_STATUS="error" ;;
  esac

  probe_dependency_graph_sbom_authenticated
  verification_mode="full-authenticated"
else
  DEPENDABOT_STATUS="requires-token"
  probe_dependency_graph_sbom_public
  case "$DEPENDENCY_GRAPH_STATUS" in
    not-found|unverified|rate-limited-or-forbidden)
      probe_dependency_graph_html_public
      case "$DEPENDENCY_GRAPH_HTML_STATUS" in
        disabled)
          add_control_error "dependency graph appears disabled in public repository UI"
          DEPENDENCY_GRAPH_STATUS="public-ui-disabled"
          ;;
        page-present)
          if [ "$DEPENDENCY_GRAPH_STATUS" = "unverified" ] || [ "$DEPENDENCY_GRAPH_STATUS" = "not-found" ]; then
            DEPENDENCY_GRAPH_STATUS="public-ui-visible"
          fi
          ;;
      esac
      ;;
  esac
fi

if [ "$REQUIRE_FULL_VERIFICATION" = "true" ] && [ "$TOKEN" = "" ]; then
  add_control_error "full verification requested but no token provided"
fi

if [ -n "$CONTROL_ERRORS" ]; then
  fail "$CONTROL_ERRORS (verification_mode=$verification_mode dependabot_status=$DEPENDABOT_STATUS dependency_graph_status=$DEPENDENCY_GRAPH_STATUS)"
fi

printf 'GitHub repository controls public verification passed for %s on %s.\n' "$REPOSITORY" "$TARGET_BRANCH"
printf '- verification mode: %s\n' "$verification_mode"
printf '- control surface verified via: %s\n' "$CONTROL_MODE"
printf '- default branch protected: %s\n' "$BRANCH_PROTECTED"
if [ "$branch_metadata_source" != "api" ]; then
  printf '- branch metadata source: %s\n' "$branch_metadata_source"
fi
printf '- required status checks discovered: %s\n' "$REQUIRED_CHECKS"
printf '- required PR approvals: %s\n' "$REVIEW_COUNT"
printf '- force pushes disabled: %s\n' "$ALLOW_FORCE_PUSHES"
printf '- branch deletions disabled: %s\n' "$ALLOW_DELETIONS"
printf '- dependabot alerts API: %s\n' "$DEPENDABOT_STATUS"
printf '- dependency graph SBOM endpoint: %s\n' "$DEPENDENCY_GRAPH_STATUS"
if [ -z "$TOKEN" ]; then
  printf '- dependency graph public UI probe: %s\n' "$DEPENDENCY_GRAPH_HTML_STATUS"
fi
if [ -z "$TOKEN" ]; then
  printf 'note: run full verification with token for dependabot/dependency graph and full branch policy checks\n'
fi
