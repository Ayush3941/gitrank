#!/usr/bin/env sh
set -eu

RUN_GITHUB_CONTROLS="${RUN_GITHUB_CONTROLS:-false}"
RUN_OBSERVABILITY="${RUN_OBSERVABILITY:-false}"
RUN_RELEASE_RENDER="${RUN_RELEASE_RENDER:-false}"
RUN_EVIDENCE_VALIDATION="${RUN_EVIDENCE_VALIDATION:-false}"
RUN_WORKFLOW_EVIDENCE_PIPELINE="${RUN_WORKFLOW_EVIDENCE_PIPELINE:-false}"
RUN_ROLLBACK_RESTORE="${RUN_ROLLBACK_RESTORE:-false}"
DISPATCH_WORKFLOW="${DISPATCH_WORKFLOW:-false}"
RUN_REMOTE_WORKFLOW_SYNC="${RUN_REMOTE_WORKFLOW_SYNC:-false}"
AUTO_SYNC_REMOTE_WORKFLOW="${AUTO_SYNC_REMOTE_WORKFLOW:-false}"

GITHUB_REPOSITORY="${GITHUB_REPOSITORY:-}"
GITHUB_TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-${GITRANK_REPO_ADMIN_TOKEN:-}}}"
GITHUB_APP_ID="${GITHUB_APP_ID:-${GITRANK_GITHUB_APP_ID:-}}"
GITHUB_APP_INSTALLATION_ID="${GITHUB_APP_INSTALLATION_ID:-${GITRANK_GITHUB_APP_INSTALLATION_ID:-}}"
GITHUB_APP_PRIVATE_KEY_FILE="${GITHUB_APP_PRIVATE_KEY_FILE:-${GITRANK_GITHUB_APP_PRIVATE_KEY_FILE:-}}"
GITHUB_APP_PRIVATE_KEY_PEM="${GITHUB_APP_PRIVATE_KEY_PEM:-${GITRANK_GITHUB_APP_PRIVATE_KEY_PEM:-}}"

PROMETHEUS_BASE_URL="${PROMETHEUS_BASE_URL:-}"
GRAFANA_BASE_URL="${GRAFANA_BASE_URL:-}"
GRAFANA_API_TOKEN="${GRAFANA_API_TOKEN:-}"

K8S_ENVIRONMENT="${K8S_ENVIRONMENT:-}"
IMAGE_TAG="${IMAGE_TAG:-}"
IMAGE_REGISTRY_OWNER="${IMAGE_REGISTRY_OWNER:-}"
K8S_PUBLIC_BASE_URL="${K8S_PUBLIC_BASE_URL:-}"
K8S_API_BASE_URL="${K8S_API_BASE_URL:-}"
K8S_AUTH_COOKIE_DOMAIN="${K8S_AUTH_COOKIE_DOMAIN:-}"
K8S_GITHUB_OAUTH_REDIRECT_URL="${K8S_GITHUB_OAUTH_REDIRECT_URL:-}"
K8S_API_HOST="${K8S_API_HOST:-}"
K8S_AUTH_HOST="${K8S_AUTH_HOST:-}"
K8S_TLS_SECRET_NAME="${K8S_TLS_SECRET_NAME:-}"

OBS_EVIDENCE_FILE="${OBS_EVIDENCE_FILE:-}"
ROLLBACK_EVIDENCE_FILE="${ROLLBACK_EVIDENCE_FILE:-}"
RESTORE_EVIDENCE_FILE="${RESTORE_EVIDENCE_FILE:-}"

WORKFLOW_RUN_ID="${WORKFLOW_RUN_ID:-}"
WORKFLOW_EVENT="${WORKFLOW_EVENT:-workflow_dispatch}"
VERIFY_FROM_WORKFLOW="${VERIFY_FROM_WORKFLOW:-false}"
AUTO_GENERATE_OBSERVABILITY_EVIDENCE="${AUTO_GENERATE_OBSERVABILITY_EVIDENCE:-false}"
AUTO_GENERATE_ROLLBACK_RESTORE_EVIDENCE="${AUTO_GENERATE_ROLLBACK_RESTORE_EVIDENCE:-false}"
ENVIRONMENT="${ENVIRONMENT:-}"
CLUSTER="${CLUSTER:-}"
NAMESPACE="${NAMESPACE:-}"
OPERATOR="${OPERATOR:-}"

ROLLBACK_STARTING_COMMIT="${ROLLBACK_STARTING_COMMIT:-${STARTING_COMMIT:-}}"
ROLLBACK_CANDIDATE_COMMIT="${ROLLBACK_CANDIDATE_COMMIT:-${CANDIDATE_COMMIT:-}}"
ROLLBACK_TARGET_REVISION="${ROLLBACK_TARGET_REVISION:-}"
ROLLBACK_DATABASE_BACKUP_MARKER="${ROLLBACK_DATABASE_BACKUP_MARKER:-${DATABASE_BACKUP_MARKER:-}}"
ROLLBACK_WORKFLOW_RUN_URL="${ROLLBACK_WORKFLOW_RUN_URL:-${WORKFLOW_RUN_URL:-}}"
ROLLBACK_HISTORY_CAPTURED="${ROLLBACK_HISTORY_CAPTURED:-}"
ROLLBACK_MODE="${ROLLBACK_MODE:-${ROLLBACK_COMMAND_OR_WORKFLOW_MODE:-}}"
ROLLBACK_STATUS_RESULTS="${ROLLBACK_STATUS_RESULTS:-}"
ROLLBACK_CRITICAL_PRODUCT_CHECKS="${ROLLBACK_CRITICAL_PRODUCT_CHECKS:-${CRITICAL_PRODUCT_CHECKS:-}}"
ROLLBACK_OBSERVED_ERRORS="${ROLLBACK_OBSERVED_ERRORS:-${OBSERVED_ERRORS:-none observed}}"
ROLLBACK_FOLLOW_UP_ACTIONS="${ROLLBACK_FOLLOW_UP_ACTIONS:-${FOLLOW_UP_ACTIONS:-none}}"
ROLLBACK_DECISION="${ROLLBACK_DECISION:-${DECISION:-pass}}"

RESTORE_SOURCE="${RESTORE_SOURCE:-}"
RESTORE_TARGET="${RESTORE_TARGET:-}"
RESTORE_BACKUP_IDENTIFIER="${RESTORE_BACKUP_IDENTIFIER:-${BACKUP_IDENTIFIER:-}}"
RESTORE_START_TIMESTAMP="${RESTORE_START_TIMESTAMP:-}"
RESTORE_COMPLETION_TIMESTAMP="${RESTORE_COMPLETION_TIMESTAMP:-}"
RESTORE_COMMAND_OR_WORKFLOW="${RESTORE_COMMAND_OR_WORKFLOW:-}"
RESTORE_SCHEMA_MIGRATION_STATE="${RESTORE_SCHEMA_MIGRATION_STATE:-${SCHEMA_MIGRATION_STATE:-}}"
RESTORE_CRITICAL_PRODUCT_CHECKS="${RESTORE_CRITICAL_PRODUCT_CHECKS:-${CRITICAL_PRODUCT_CHECKS:-}}"
RESTORE_OBSERVED_ERRORS="${RESTORE_OBSERVED_ERRORS:-${OBSERVED_ERRORS:-none observed}}"
RESTORE_FOLLOW_UP_ACTIONS="${RESTORE_FOLLOW_UP_ACTIONS:-${FOLLOW_UP_ACTIONS:-none}}"
RESTORE_DECISION="${RESTORE_DECISION:-${DECISION:-pass}}"

fail() {
  printf 'live v2 input verification failed: %s\n' "$1" >&2
  exit 1
}

resolve_repository_from_git_remote() {
  [ -n "$GITHUB_REPOSITORY" ] && return 0
  command -v git >/dev/null 2>&1 || return 0
  remote_url=$(git config --get remote.origin.url 2>/dev/null || true)
  [ -n "$remote_url" ] || return 0
  case "$remote_url" in
    https://github.com/*) inferred_repo=${remote_url#https://github.com/} ;;
    git@github.com:*) inferred_repo=${remote_url#git@github.com:} ;;
    *) inferred_repo= ;;
  esac
  inferred_repo=${inferred_repo%.git}
  [ -n "$inferred_repo" ] && GITHUB_REPOSITORY=$inferred_repo
}

resolve_repository_from_git_remote

script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
template_env_file="$(CDPATH= cd -- "$script_dir/.." && pwd)/.env.v2-live-gates.example"

add_missing_unique() {
  current=$1
  item=$2
  if printf '%s\n' "$current" | grep -Fx -- "$item" >/dev/null 2>&1; then
    printf '%s' "$current"
  else
    if [ -n "$current" ]; then
      printf '%s\n%s' "$current" "$item"
    else
      printf '%s' "$item"
    fi
  fi
}

missing_vars=
missing_files=

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

ensure_non_empty() {
  name=$1
  value=$2
  if is_placeholder_value "$value"; then
    missing_vars=$(add_missing_unique "$missing_vars" "$name")
  fi
}

ensure_file_non_empty() {
  name=$1
  value=$2
  if [ ! -s "$value" ]; then
    missing_files=$(add_missing_unique "$missing_files" "$name")
  fi
}

ensure_remote_workflow_sync_access() {
  if [ "$RUN_REMOTE_WORKFLOW_SYNC" != "true" ]; then
    return 0
  fi

  ensure_non_empty GITHUB_REPOSITORY "$GITHUB_REPOSITORY"

  if [ "$AUTO_SYNC_REMOTE_WORKFLOW" != "true" ]; then
    return 0
  fi

  if [ -n "$GITHUB_TOKEN" ]; then
    return 0
  fi

  has_app_bootstrap=false
  if [ -n "$GITHUB_APP_ID" ] && [ -n "$GITHUB_APP_INSTALLATION_ID" ]; then
    if [ -n "$GITHUB_APP_PRIVATE_KEY_FILE" ] || [ -n "$GITHUB_APP_PRIVATE_KEY_PEM" ]; then
      has_app_bootstrap=true
    fi
  fi
  if [ "$has_app_bootstrap" = "true" ]; then
    return 0
  fi

  if [ ! -x "$script_dir/verify_origin_push_access.sh" ]; then
    fail "remote workflow sync preflight requires token/App credentials or executable verify_origin_push_access.sh"
  fi

  push_probe_log=$(mktemp "${TMPDIR:-/tmp}/gitrank-live-v2-inputs-origin-push.XXXXXX")
  if "$script_dir/verify_origin_push_access.sh" >"$push_probe_log" 2>&1; then
    rm -f "$push_probe_log"
    return 0
  fi
  push_summary=$(grep -E 'origin push access verification (failed|passed)' "$push_probe_log" | tail -n 1 2>/dev/null || true)
  if [ -z "$push_summary" ]; then
    push_summary=$(tail -n 1 "$push_probe_log" 2>/dev/null || true)
  fi
  rm -f "$push_probe_log"
  if [ -z "$push_summary" ]; then
    push_summary="origin push access probe failed (no output captured)"
  fi
  fail "remote workflow sync preflight requires token/App credentials or successful origin push access. $push_summary"
}

if [ "$RUN_GITHUB_CONTROLS" = "true" ]; then
  ensure_non_empty GITHUB_REPOSITORY "$GITHUB_REPOSITORY"
  if [ -z "$GITHUB_TOKEN" ]; then
    has_app_bootstrap=false
    if [ -n "$GITHUB_APP_ID" ] && [ -n "$GITHUB_APP_INSTALLATION_ID" ]; then
      if [ -n "$GITHUB_APP_PRIVATE_KEY_FILE" ] || [ -n "$GITHUB_APP_PRIVATE_KEY_PEM" ]; then
        has_app_bootstrap=true
      fi
    fi
    if [ "$has_app_bootstrap" != "true" ]; then
      ensure_non_empty GITHUB_TOKEN_OR_GH_TOKEN_OR_GITRANK_REPO_ADMIN_TOKEN "$GITHUB_TOKEN"
      ensure_non_empty GITHUB_APP_ID_OR_GITRANK_GITHUB_APP_ID "$GITHUB_APP_ID"
      ensure_non_empty GITHUB_APP_INSTALLATION_ID_OR_GITRANK_GITHUB_APP_INSTALLATION_ID "$GITHUB_APP_INSTALLATION_ID"
      if [ -z "$GITHUB_APP_PRIVATE_KEY_FILE" ] && [ -z "$GITHUB_APP_PRIVATE_KEY_PEM" ]; then
        ensure_non_empty GITHUB_APP_PRIVATE_KEY_FILE_OR_PEM "$GITHUB_APP_PRIVATE_KEY_PEM"
      fi
    fi
  fi
fi

ensure_remote_workflow_sync_access

if [ "$RUN_WORKFLOW_EVIDENCE_PIPELINE" = "true" ] && [ "$DISPATCH_WORKFLOW" = "true" ]; then
  ensure_non_empty GITHUB_REPOSITORY "$GITHUB_REPOSITORY"
  if [ -z "$GITHUB_TOKEN" ]; then
    has_app_bootstrap=false
    if [ -n "$GITHUB_APP_ID" ] && [ -n "$GITHUB_APP_INSTALLATION_ID" ]; then
      if [ -n "$GITHUB_APP_PRIVATE_KEY_FILE" ] || [ -n "$GITHUB_APP_PRIVATE_KEY_PEM" ]; then
        has_app_bootstrap=true
      fi
    fi
    if [ "$has_app_bootstrap" != "true" ]; then
      ensure_non_empty GITHUB_TOKEN_OR_GH_TOKEN_OR_GITRANK_REPO_ADMIN_TOKEN "$GITHUB_TOKEN"
      ensure_non_empty GITHUB_APP_ID_OR_GITRANK_GITHUB_APP_ID "$GITHUB_APP_ID"
      ensure_non_empty GITHUB_APP_INSTALLATION_ID_OR_GITRANK_GITHUB_APP_INSTALLATION_ID "$GITHUB_APP_INSTALLATION_ID"
      if [ -z "$GITHUB_APP_PRIVATE_KEY_FILE" ] && [ -z "$GITHUB_APP_PRIVATE_KEY_PEM" ]; then
        ensure_non_empty GITHUB_APP_PRIVATE_KEY_FILE_OR_PEM "$GITHUB_APP_PRIVATE_KEY_PEM"
      fi
    fi
  fi
fi

if [ "$RUN_OBSERVABILITY" = "true" ]; then
  ensure_non_empty PROMETHEUS_BASE_URL "$PROMETHEUS_BASE_URL"
  ensure_non_empty GRAFANA_BASE_URL "$GRAFANA_BASE_URL"
  ensure_non_empty GRAFANA_API_TOKEN "$GRAFANA_API_TOKEN"
fi

if [ "$RUN_RELEASE_RENDER" = "true" ]; then
  ensure_non_empty K8S_ENVIRONMENT "$K8S_ENVIRONMENT"
  ensure_non_empty IMAGE_TAG "$IMAGE_TAG"
  ensure_non_empty IMAGE_REGISTRY_OWNER "$IMAGE_REGISTRY_OWNER"
  ensure_non_empty K8S_PUBLIC_BASE_URL "$K8S_PUBLIC_BASE_URL"
  ensure_non_empty K8S_API_BASE_URL "$K8S_API_BASE_URL"
  ensure_non_empty K8S_AUTH_COOKIE_DOMAIN "$K8S_AUTH_COOKIE_DOMAIN"
  ensure_non_empty K8S_GITHUB_OAUTH_REDIRECT_URL "$K8S_GITHUB_OAUTH_REDIRECT_URL"
  ensure_non_empty K8S_API_HOST "$K8S_API_HOST"
  ensure_non_empty K8S_AUTH_HOST "$K8S_AUTH_HOST"
  ensure_non_empty K8S_TLS_SECRET_NAME "$K8S_TLS_SECRET_NAME"
fi

if [ "$RUN_EVIDENCE_VALIDATION" = "true" ]; then
  ensure_non_empty OBS_EVIDENCE_FILE "$OBS_EVIDENCE_FILE"
  ensure_non_empty ROLLBACK_EVIDENCE_FILE "$ROLLBACK_EVIDENCE_FILE"
  ensure_non_empty RESTORE_EVIDENCE_FILE "$RESTORE_EVIDENCE_FILE"
  if [ -n "$OBS_EVIDENCE_FILE" ]; then
    ensure_file_non_empty OBS_EVIDENCE_FILE "$OBS_EVIDENCE_FILE"
  fi
  if [ -n "$ROLLBACK_EVIDENCE_FILE" ]; then
    ensure_file_non_empty ROLLBACK_EVIDENCE_FILE "$ROLLBACK_EVIDENCE_FILE"
  fi
  if [ -n "$RESTORE_EVIDENCE_FILE" ]; then
    ensure_file_non_empty RESTORE_EVIDENCE_FILE "$RESTORE_EVIDENCE_FILE"
  fi
fi

if [ "$RUN_WORKFLOW_EVIDENCE_PIPELINE" = "true" ]; then
  if [ "$VERIFY_FROM_WORKFLOW" = "true" ] || [ "$AUTO_GENERATE_OBSERVABILITY_EVIDENCE" = "true" ]; then
    if [ -z "$WORKFLOW_RUN_ID" ]; then
      # latest run resolution path is intentionally supported.
      ensure_non_empty WORKFLOW_EVENT "$WORKFLOW_EVENT"
    fi
  fi
  if [ "$AUTO_GENERATE_OBSERVABILITY_EVIDENCE" = "true" ]; then
    ensure_non_empty ENVIRONMENT "$ENVIRONMENT"
    ensure_non_empty CLUSTER "$CLUSTER"
    ensure_non_empty NAMESPACE "$NAMESPACE"
    ensure_non_empty OPERATOR "$OPERATOR"
  fi
fi

if [ "$RUN_ROLLBACK_RESTORE" = "true" ] && [ "$AUTO_GENERATE_ROLLBACK_RESTORE_EVIDENCE" = "true" ]; then
  ensure_non_empty ENVIRONMENT "$ENVIRONMENT"
  ensure_non_empty CLUSTER "$CLUSTER"
  ensure_non_empty NAMESPACE "$NAMESPACE"
  ensure_non_empty OPERATOR "$OPERATOR"

  ensure_non_empty ROLLBACK_STARTING_COMMIT "$ROLLBACK_STARTING_COMMIT"
  ensure_non_empty ROLLBACK_CANDIDATE_COMMIT "$ROLLBACK_CANDIDATE_COMMIT"
  ensure_non_empty ROLLBACK_TARGET_REVISION "$ROLLBACK_TARGET_REVISION"
  ensure_non_empty ROLLBACK_DATABASE_BACKUP_MARKER "$ROLLBACK_DATABASE_BACKUP_MARKER"
  ensure_non_empty ROLLBACK_WORKFLOW_RUN_URL "$ROLLBACK_WORKFLOW_RUN_URL"
  ensure_non_empty ROLLBACK_HISTORY_CAPTURED "$ROLLBACK_HISTORY_CAPTURED"
  ensure_non_empty ROLLBACK_MODE "$ROLLBACK_MODE"
  ensure_non_empty ROLLBACK_STATUS_RESULTS "$ROLLBACK_STATUS_RESULTS"
  ensure_non_empty ROLLBACK_CRITICAL_PRODUCT_CHECKS "$ROLLBACK_CRITICAL_PRODUCT_CHECKS"
  ensure_non_empty ROLLBACK_OBSERVED_ERRORS "$ROLLBACK_OBSERVED_ERRORS"
  ensure_non_empty ROLLBACK_FOLLOW_UP_ACTIONS "$ROLLBACK_FOLLOW_UP_ACTIONS"
  ensure_non_empty ROLLBACK_DECISION "$ROLLBACK_DECISION"

  ensure_non_empty RESTORE_SOURCE "$RESTORE_SOURCE"
  ensure_non_empty RESTORE_TARGET "$RESTORE_TARGET"
  ensure_non_empty RESTORE_BACKUP_IDENTIFIER "$RESTORE_BACKUP_IDENTIFIER"
  ensure_non_empty RESTORE_START_TIMESTAMP "$RESTORE_START_TIMESTAMP"
  ensure_non_empty RESTORE_COMPLETION_TIMESTAMP "$RESTORE_COMPLETION_TIMESTAMP"
  ensure_non_empty RESTORE_COMMAND_OR_WORKFLOW "$RESTORE_COMMAND_OR_WORKFLOW"
  ensure_non_empty RESTORE_SCHEMA_MIGRATION_STATE "$RESTORE_SCHEMA_MIGRATION_STATE"
  ensure_non_empty RESTORE_CRITICAL_PRODUCT_CHECKS "$RESTORE_CRITICAL_PRODUCT_CHECKS"
  ensure_non_empty RESTORE_OBSERVED_ERRORS "$RESTORE_OBSERVED_ERRORS"
  ensure_non_empty RESTORE_FOLLOW_UP_ACTIONS "$RESTORE_FOLLOW_UP_ACTIONS"
  ensure_non_empty RESTORE_DECISION "$RESTORE_DECISION"
fi

if [ -n "$missing_vars" ]; then
  guidance=""
  if [ -f "$template_env_file" ]; then
    guidance="
hint: copy $template_env_file to a local untracked env file and fill the required values"
  fi
  fail "missing required environment variables:
$missing_vars$guidance"
fi

if [ -n "$missing_files" ]; then
  fail "required evidence files are missing or empty:
$missing_files"
fi

printf 'live v2 input verification passed\n'
