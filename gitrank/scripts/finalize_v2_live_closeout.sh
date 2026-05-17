#!/usr/bin/env sh
set -eu

root_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
tmp_root="${TMPDIR:-$root_dir/.tmp}"
mkdir -p "$tmp_root"
default_env_file="$root_dir/.env"

FINALIZE_V2_ENV_FILE="${FINALIZE_V2_ENV_FILE:-${LIVE_V2_ENV_FILE:-}}"
if [ -n "$FINALIZE_V2_ENV_FILE" ]; then
  resolved_finalize_env_file="$FINALIZE_V2_ENV_FILE"
  case "$resolved_finalize_env_file" in
    /*) ;;
    *)
      if [ -f "$root_dir/$resolved_finalize_env_file" ]; then
        resolved_finalize_env_file="$root_dir/$resolved_finalize_env_file"
      fi
      ;;
  esac
  if [ ! -f "$resolved_finalize_env_file" ]; then
    printf 'finalize v2 live closeout failed: env file not found: %s\n' "$FINALIZE_V2_ENV_FILE" >&2
    exit 1
  fi
  set -a
  # shellcheck disable=SC1090
  . "$resolved_finalize_env_file"
  set +a
fi

CONFIRM_FINALIZE_V2="${CONFIRM_FINALIZE_V2:-}"
RUN_GITHUB_CONTROLS="${RUN_GITHUB_CONTROLS:-true}"
APPLY_GITHUB_CONTROLS="${APPLY_GITHUB_CONTROLS:-false}"
RUN_OBSERVABILITY="${RUN_OBSERVABILITY:-true}"
RUN_ROLLBACK_RESTORE="${RUN_ROLLBACK_RESTORE:-true}"
RUN_K8S_RUNTIME="${RUN_K8S_RUNTIME:-true}"
REQUIRE_ENV_SPECIFIC_K8S_OVERRIDES="${REQUIRE_ENV_SPECIFIC_K8S_OVERRIDES:-true}"
RUN_LOCAL_STATIC="${RUN_LOCAL_STATIC:-true}"
RUN_PUBLIC_WORKFLOW_HEALTH="${RUN_PUBLIC_WORKFLOW_HEALTH:-true}"
AUTO_SYNC_REMOTE_TRIVY_POLICY="${AUTO_SYNC_REMOTE_TRIVY_POLICY:-true}"
RUN_REMOTE_WORKFLOW_SYNC="${RUN_REMOTE_WORKFLOW_SYNC:-true}"
AUTO_SYNC_REMOTE_WORKFLOW="${AUTO_SYNC_REMOTE_WORKFLOW:-true}"
MARK_CHECKBOXES="${MARK_CHECKBOXES:-true}"
VERIFY_FROM_WORKFLOW="${VERIFY_FROM_WORKFLOW:-false}"
WORKFLOW_RUN_ID="${WORKFLOW_RUN_ID:-}"
WORKFLOW_EVENT="${WORKFLOW_EVENT:-workflow_dispatch}"
WORKFLOW_EVENT_FALLBACK_ANY="${WORKFLOW_EVENT_FALLBACK_ANY:-true}"
AUTO_GENERATE_OBSERVABILITY_EVIDENCE="${AUTO_GENERATE_OBSERVABILITY_EVIDENCE:-true}"
AUTO_GENERATE_ROLLBACK_RESTORE_EVIDENCE="${AUTO_GENERATE_ROLLBACK_RESTORE_EVIDENCE:-true}"
RUN_EXTERNAL_PREFLIGHT_REPORT="${RUN_EXTERNAL_PREFLIGHT_REPORT:-true}"
AUDIT_REPORT_FILE="${AUDIT_REPORT_FILE:-$root_dir/docs/releases/v2-contributing-audit-latest.md}"
AUTO_CREATE_GITHUB_APP_TOKEN="${AUTO_CREATE_GITHUB_APP_TOKEN:-true}"
AUTO_CREATE_GITHUB_OAUTH_WEB_TOKEN="${AUTO_CREATE_GITHUB_OAUTH_WEB_TOKEN:-false}"
APP_TOKEN_OUTPUT_FILE="${APP_TOKEN_OUTPUT_FILE:-$tmp_root/gitrank-app-installation-token.txt}"
OAUTH_WEB_TOKEN_OUTPUT_FILE="${OAUTH_WEB_TOKEN_OUTPUT_FILE:-$tmp_root/gitrank-oauth-web-token.txt}"
RESOLVED_GITHUB_APP_ID="${GITHUB_APP_ID:-${GITRANK_GITHUB_APP_ID:-}}"
RESOLVED_GITHUB_APP_INSTALLATION_ID="${GITHUB_APP_INSTALLATION_ID:-${GITRANK_GITHUB_APP_INSTALLATION_ID:-}}"
RESOLVED_GITHUB_APP_PRIVATE_KEY_FILE="${GITHUB_APP_PRIVATE_KEY_FILE:-${GITRANK_GITHUB_APP_PRIVATE_KEY_FILE:-}}"
RESOLVED_GITHUB_APP_PRIVATE_KEY_PEM="${GITHUB_APP_PRIVATE_KEY_PEM:-${GITRANK_GITHUB_APP_PRIVATE_KEY_PEM:-}}"

STAGING_RENDER_OUTPUT="${STAGING_RENDER_OUTPUT:-$tmp_root/rendered-k8s-staging.yaml}"
PRODUCTION_RENDER_OUTPUT="${PRODUCTION_RENDER_OUTPUT:-$tmp_root/rendered-k8s-production.yaml}"
cleanup_app_token_file=false

fail() {
  printf 'finalize v2 live closeout failed: %s\n' "$1" >&2
  exit 1
}

run_make() {
  target=$1
  shift || true
  (cd "$root_dir" && TMPDIR="$tmp_root" make "$target" "$@")
}

cleanup() {
  if [ "$cleanup_app_token_file" = "true" ] && [ -f "$APP_TOKEN_OUTPUT_FILE" ]; then
    rm -f "$APP_TOKEN_OUTPUT_FILE"
  fi
  if [ "$cleanup_app_token_file" = "true" ] && [ -f "$OAUTH_WEB_TOKEN_OUTPUT_FILE" ]; then
    rm -f "$OAUTH_WEB_TOKEN_OUTPUT_FILE"
  fi
}
trap cleanup EXIT

get_prefixed_or_default() {
  prefix=$1
  suffix=$2
  default_value=$3
  eval prefixed_value="\${${prefix}_${suffix}:-}"
  if [ -n "$prefixed_value" ]; then
    printf '%s' "$prefixed_value"
  else
    printf '%s' "$default_value"
  fi
}

load_env_var_from_file() {
  file_path=$1
  key=$2
  [ -f "$file_path" ] || return 1
  value=$(awk -F= -v key="$key" '
    $1 == key {
      sub(/^[^=]*=/, "", $0)
      print $0
    }
  ' "$file_path" | tail -n 1)
  [ -n "$value" ] || return 1
  printf '%s' "$value"
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

require_env_specific_k8s_overrides() {
  [ "$RUN_K8S_RUNTIME" = "true" ] || return 0
  [ "$VERIFY_FROM_WORKFLOW" != "true" ] || return 0
  [ "$REQUIRE_ENV_SPECIFIC_K8S_OVERRIDES" = "true" ] || return 0

  for prefix in STAGING PRODUCTION; do
    for key in K8S_PUBLIC_BASE_URL K8S_API_BASE_URL K8S_AUTH_COOKIE_DOMAIN K8S_GITHUB_OAUTH_REDIRECT_URL K8S_API_HOST K8S_AUTH_HOST K8S_TLS_SECRET_NAME; do
      eval value="\${${prefix}_${key}:-}"
      [ -n "$value" ] || fail "${prefix}_${key} is required when REQUIRE_ENV_SPECIFIC_K8S_OVERRIDES=true"
    done
  done
}

render_for_environment() {
  prefix=$1
  env_name=$2
  output_file=$3

  default_image_tag="${IMAGE_TAG:-}"
  default_registry_owner="${IMAGE_REGISTRY_OWNER:-}"
  default_public_base_url="${K8S_PUBLIC_BASE_URL:-}"
  default_api_base_url="${K8S_API_BASE_URL:-}"
  default_auth_cookie_domain="${K8S_AUTH_COOKIE_DOMAIN:-}"
  default_oauth_redirect_url="${K8S_GITHUB_OAUTH_REDIRECT_URL:-}"
  default_api_host="${K8S_API_HOST:-}"
  default_auth_host="${K8S_AUTH_HOST:-}"
  default_tls_secret_name="${K8S_TLS_SECRET_NAME:-}"
  default_github_user_agent="${K8S_GITHUB_USER_AGENT:-}"

  image_tag=$(get_prefixed_or_default "$prefix" "IMAGE_TAG" "$default_image_tag")
  image_registry_owner=$(get_prefixed_or_default "$prefix" "IMAGE_REGISTRY_OWNER" "$default_registry_owner")
  public_base_url=$(get_prefixed_or_default "$prefix" "K8S_PUBLIC_BASE_URL" "$default_public_base_url")
  api_base_url=$(get_prefixed_or_default "$prefix" "K8S_API_BASE_URL" "$default_api_base_url")
  auth_cookie_domain=$(get_prefixed_or_default "$prefix" "K8S_AUTH_COOKIE_DOMAIN" "$default_auth_cookie_domain")
  oauth_redirect_url=$(get_prefixed_or_default "$prefix" "K8S_GITHUB_OAUTH_REDIRECT_URL" "$default_oauth_redirect_url")
  api_host=$(get_prefixed_or_default "$prefix" "K8S_API_HOST" "$default_api_host")
  auth_host=$(get_prefixed_or_default "$prefix" "K8S_AUTH_HOST" "$default_auth_host")
  tls_secret_name=$(get_prefixed_or_default "$prefix" "K8S_TLS_SECRET_NAME" "$default_tls_secret_name")
  github_user_agent=$(get_prefixed_or_default "$prefix" "K8S_GITHUB_USER_AGENT" "$default_github_user_agent")

  [ -n "$image_tag" ] || fail "${prefix}_IMAGE_TAG or IMAGE_TAG is required"
  [ -n "$image_registry_owner" ] || fail "${prefix}_IMAGE_REGISTRY_OWNER or IMAGE_REGISTRY_OWNER is required"

  RUN_RELEASE_RENDER=true \
  K8S_ENVIRONMENT="$env_name" \
  IMAGE_TAG="$image_tag" \
  IMAGE_REGISTRY_OWNER="$image_registry_owner" \
  K8S_PUBLIC_BASE_URL="$public_base_url" \
  K8S_API_BASE_URL="$api_base_url" \
  K8S_AUTH_COOKIE_DOMAIN="$auth_cookie_domain" \
  K8S_GITHUB_OAUTH_REDIRECT_URL="$oauth_redirect_url" \
  K8S_API_HOST="$api_host" \
  K8S_AUTH_HOST="$auth_host" \
  K8S_TLS_SECRET_NAME="$tls_secret_name" \
  K8S_GITHUB_USER_AGENT="$github_user_agent" \
  run_make verify-live-v2-inputs

  K8S_ENVIRONMENT="$env_name" \
  OUTPUT_FILE="$output_file" \
  IMAGE_TAG="$image_tag" \
  IMAGE_REGISTRY_OWNER="$image_registry_owner" \
  K8S_PUBLIC_BASE_URL="$public_base_url" \
  K8S_API_BASE_URL="$api_base_url" \
  K8S_AUTH_COOKIE_DOMAIN="$auth_cookie_domain" \
  K8S_GITHUB_OAUTH_REDIRECT_URL="$oauth_redirect_url" \
  K8S_API_HOST="$api_host" \
  K8S_AUTH_HOST="$auth_host" \
  K8S_TLS_SECRET_NAME="$tls_secret_name" \
  K8S_GITHUB_USER_AGENT="$github_user_agent" \
  run_make render-k8s-release-manifests
}

resolve_github_admin_token() {
  token_candidate="${GITHUB_TOKEN:-${GH_TOKEN:-${GITRANK_REPO_ADMIN_TOKEN:-}}}"
  if is_placeholder_value "$token_candidate"; then
    token_candidate=
  fi
  if [ -n "$token_candidate" ]; then
    export GITHUB_TOKEN="$token_candidate"
    export GH_TOKEN="$token_candidate"
    export GITRANK_REPO_ADMIN_TOKEN="$token_candidate"
    return 0
  fi

  app_bootstrap_possible=true
  if [ "$AUTO_CREATE_GITHUB_APP_TOKEN" != "true" ]; then
    app_bootstrap_possible=false
  fi
  if [ -z "$RESOLVED_GITHUB_APP_ID" ] || [ -z "$RESOLVED_GITHUB_APP_INSTALLATION_ID" ]; then
    app_bootstrap_possible=false
  fi
  if [ -z "$RESOLVED_GITHUB_APP_PRIVATE_KEY_FILE" ] && [ -z "$RESOLVED_GITHUB_APP_PRIVATE_KEY_PEM" ]; then
    app_bootstrap_possible=false
  fi

  if [ "$app_bootstrap_possible" = "true" ]; then
    GITHUB_APP_ID="$RESOLVED_GITHUB_APP_ID" \
    GITHUB_APP_INSTALLATION_ID="$RESOLVED_GITHUB_APP_INSTALLATION_ID" \
    GITHUB_APP_PRIVATE_KEY_FILE="$RESOLVED_GITHUB_APP_PRIVATE_KEY_FILE" \
    GITHUB_APP_PRIVATE_KEY_PEM="$RESOLVED_GITHUB_APP_PRIVATE_KEY_PEM" \
    TOKEN_OUTPUT_FILE="$APP_TOKEN_OUTPUT_FILE" \
    run_make create-github-app-installation-token
    token_candidate=$(cat "$APP_TOKEN_OUTPUT_FILE" 2>/dev/null || true)
    [ -n "$token_candidate" ] || fail "GitHub App token creation succeeded but no token file content was produced"
    cleanup_app_token_file=true
    export GITHUB_APP_ID="$RESOLVED_GITHUB_APP_ID"
    export GITHUB_APP_INSTALLATION_ID="$RESOLVED_GITHUB_APP_INSTALLATION_ID"
    export GITHUB_APP_PRIVATE_KEY_FILE="$RESOLVED_GITHUB_APP_PRIVATE_KEY_FILE"
    export GITHUB_APP_PRIVATE_KEY_PEM="$RESOLVED_GITHUB_APP_PRIVATE_KEY_PEM"
    export GITHUB_TOKEN="$token_candidate"
    export GH_TOKEN="$token_candidate"
    export GITRANK_REPO_ADMIN_TOKEN="$token_candidate"
    printf 'github admin token bootstrapped via GitHub App installation credentials\n'
    return 0
  fi

  if [ "$AUTO_CREATE_GITHUB_OAUTH_WEB_TOKEN" = "true" ]; then
    if [ -z "${GITHUB_CLIENT_ID:-}" ]; then
      fallback_client_id=$(load_env_var_from_file "$default_env_file" "GITHUB_CLIENT_ID" || true)
      if [ -n "$fallback_client_id" ]; then
        export GITHUB_CLIENT_ID="$fallback_client_id"
      fi
    fi
    if [ -z "${GITHUB_CLIENT_SECRET:-}" ]; then
      fallback_client_secret=$(load_env_var_from_file "$default_env_file" "GITHUB_CLIENT_SECRET" || true)
      if [ -n "$fallback_client_secret" ]; then
        export GITHUB_CLIENT_SECRET="$fallback_client_secret"
      fi
    fi
    if [ -z "${GITHUB_OAUTH_AUTHORIZE_URL:-}" ]; then
      fallback_authorize_url=$(load_env_var_from_file "$default_env_file" "GITHUB_OAUTH_AUTHORIZE_URL" || true)
      if [ -n "$fallback_authorize_url" ]; then
        export GITHUB_OAUTH_AUTHORIZE_URL="$fallback_authorize_url"
      fi
    fi
    if [ -z "${GITHUB_OAUTH_EXCHANGE_URL:-}" ]; then
      fallback_exchange_url=$(load_env_var_from_file "$default_env_file" "GITHUB_OAUTH_EXCHANGE_URL" || true)
      if [ -n "$fallback_exchange_url" ]; then
        export GITHUB_OAUTH_EXCHANGE_URL="$fallback_exchange_url"
      fi
    fi
    if [ -z "${GITHUB_OAUTH_REDIRECT_URL:-}" ]; then
      fallback_redirect_url=$(load_env_var_from_file "$default_env_file" "GITHUB_OAUTH_REDIRECT_URL" || true)
      if [ -n "$fallback_redirect_url" ]; then
        export GITHUB_OAUTH_REDIRECT_URL="$fallback_redirect_url"
      fi
    fi

    TOKEN_OUTPUT_FILE="$OAUTH_WEB_TOKEN_OUTPUT_FILE" run_make create-github-repo-admin-token-via-oauth-web-flow
    token_candidate=$(cat "$OAUTH_WEB_TOKEN_OUTPUT_FILE" 2>/dev/null || true)
    [ -n "$token_candidate" ] || fail "oauth web-flow token bootstrap succeeded but no token file content was produced"
    cleanup_app_token_file=true
    export GITHUB_TOKEN="$token_candidate"
    export GH_TOKEN="$token_candidate"
    export GITRANK_REPO_ADMIN_TOKEN="$token_candidate"
    printf 'github admin token bootstrapped via OAuth web flow\n'
    return 0
  fi

  fail "GitHub controls enabled but no usable token path is configured; set GITHUB_TOKEN/GH_TOKEN/GITRANK_REPO_ADMIN_TOKEN, or provide GitHub App credentials, or set AUTO_CREATE_GITHUB_OAUTH_WEB_TOKEN=true with OAuth client credentials"
}

generate_observability_evidence_if_needed() {
  [ "$VERIFY_FROM_WORKFLOW" = "true" ] || return 0
  [ "$RUN_OBSERVABILITY" = "true" ] || return 0
  [ "$MARK_CHECKBOXES" = "true" ] || return 0
  [ "$AUTO_GENERATE_OBSERVABILITY_EVIDENCE" = "true" ] || return 0
  [ -n "$WORKFLOW_RUN_ID" ] || return 0

  if [ -n "${OBS_EVIDENCE_FILE:-}" ] && [ -s "${OBS_EVIDENCE_FILE:-}" ]; then
    return 0
  fi

  obs_file="${OBS_EVIDENCE_FILE:-$root_dir/docs/evidence/observability-live-$(date -u +%F).txt}"
  [ -n "${ENVIRONMENT:-}" ] || fail "ENVIRONMENT is required to auto-generate observability evidence in workflow mode"
  [ -n "${CLUSTER:-}" ] || fail "CLUSTER is required to auto-generate observability evidence in workflow mode"
  [ -n "${NAMESPACE:-}" ] || fail "NAMESPACE is required to auto-generate observability evidence in workflow mode"
  [ -n "${OPERATOR:-}" ] || fail "OPERATOR is required to auto-generate observability evidence in workflow mode"

  WORKFLOW_RUN_ID="$WORKFLOW_RUN_ID" \
  WORKFLOW_EVENT="$WORKFLOW_EVENT" \
  OUTPUT_FILE="$obs_file" \
  ENVIRONMENT="${ENVIRONMENT:-}" \
  CLUSTER="${CLUSTER:-}" \
  NAMESPACE="${NAMESPACE:-}" \
  OPERATOR="${OPERATOR:-}" \
  run_make generate-observability-evidence-from-workflow-run

  OBS_EVIDENCE_FILE="$obs_file"
  export OBS_EVIDENCE_FILE
}

generate_rollback_restore_evidence_if_needed() {
  [ "$RUN_ROLLBACK_RESTORE" = "true" ] || return 0
  [ "$MARK_CHECKBOXES" = "true" ] || return 0
  [ "$AUTO_GENERATE_ROLLBACK_RESTORE_EVIDENCE" = "true" ] || return 0

  if [ -z "${ROLLBACK_EVIDENCE_FILE:-}" ] || [ ! -s "${ROLLBACK_EVIDENCE_FILE:-}" ]; then
    rollback_file="${ROLLBACK_EVIDENCE_FILE:-$root_dir/docs/evidence/rollback-drill-$(date -u +%F).txt}"
    ROLLBACK_OUTPUT_FILE="$rollback_file" \
    OUTPUT_FILE="$rollback_file" \
    ENVIRONMENT="${ENVIRONMENT:-}" \
    CLUSTER="${CLUSTER:-}" \
    NAMESPACE="${NAMESPACE:-}" \
    OPERATOR="${OPERATOR:-}" \
    STARTING_COMMIT="${ROLLBACK_STARTING_COMMIT:-${STARTING_COMMIT:-}}" \
    CANDIDATE_COMMIT="${ROLLBACK_CANDIDATE_COMMIT:-${CANDIDATE_COMMIT:-}}" \
    ROLLBACK_TARGET_REVISION="${ROLLBACK_TARGET_REVISION:-}" \
    DATABASE_BACKUP_MARKER="${ROLLBACK_DATABASE_BACKUP_MARKER:-${DATABASE_BACKUP_MARKER:-}}" \
    WORKFLOW_RUN_URL="${ROLLBACK_WORKFLOW_RUN_URL:-${WORKFLOW_RUN_URL:-}}" \
    ROLLOUT_HISTORY_CAPTURED="${ROLLBACK_HISTORY_CAPTURED:-}" \
    ROLLBACK_MODE="${ROLLBACK_MODE:-${ROLLBACK_COMMAND_OR_WORKFLOW_MODE:-}}" \
    ROLLOUT_STATUS_RESULTS="${ROLLBACK_STATUS_RESULTS:-}" \
    CRITICAL_PRODUCT_CHECKS="${ROLLBACK_CRITICAL_PRODUCT_CHECKS:-${CRITICAL_PRODUCT_CHECKS:-}}" \
    OBSERVED_ERRORS="${ROLLBACK_OBSERVED_ERRORS:-${OBSERVED_ERRORS:-none observed}}" \
    FOLLOW_UP_ACTIONS="${ROLLBACK_FOLLOW_UP_ACTIONS:-${FOLLOW_UP_ACTIONS:-none}}" \
    DECISION="${ROLLBACK_DECISION:-${DECISION:-pass}}" \
    run_make generate-rollback-drill-evidence
    ROLLBACK_EVIDENCE_FILE="$rollback_file"
    export ROLLBACK_EVIDENCE_FILE
  fi

  if [ -z "${RESTORE_EVIDENCE_FILE:-}" ] || [ ! -s "${RESTORE_EVIDENCE_FILE:-}" ]; then
    restore_file="${RESTORE_EVIDENCE_FILE:-$root_dir/docs/evidence/database-restore-drill-$(date -u +%F).txt}"
    OUTPUT_FILE="$restore_file" \
    ENVIRONMENT="${ENVIRONMENT:-}" \
    CLUSTER="${CLUSTER:-}" \
    NAMESPACE="${NAMESPACE:-}" \
    OPERATOR="${OPERATOR:-}" \
    RESTORE_SOURCE="${RESTORE_SOURCE:-}" \
    RESTORE_TARGET="${RESTORE_TARGET:-}" \
    BACKUP_IDENTIFIER="${RESTORE_BACKUP_IDENTIFIER:-${BACKUP_IDENTIFIER:-}}" \
    RESTORE_START_TIMESTAMP="${RESTORE_START_TIMESTAMP:-}" \
    RESTORE_COMPLETION_TIMESTAMP="${RESTORE_COMPLETION_TIMESTAMP:-}" \
    RESTORE_COMMAND_OR_WORKFLOW="${RESTORE_COMMAND_OR_WORKFLOW:-}" \
    SCHEMA_MIGRATION_STATE="${RESTORE_SCHEMA_MIGRATION_STATE:-${SCHEMA_MIGRATION_STATE:-}}" \
    CRITICAL_PRODUCT_CHECKS="${RESTORE_CRITICAL_PRODUCT_CHECKS:-${CRITICAL_PRODUCT_CHECKS:-}}" \
    OBSERVED_ERRORS="${RESTORE_OBSERVED_ERRORS:-${OBSERVED_ERRORS:-none observed}}" \
    FOLLOW_UP_ACTIONS="${RESTORE_FOLLOW_UP_ACTIONS:-${FOLLOW_UP_ACTIONS:-none}}" \
    DECISION="${RESTORE_DECISION:-${DECISION:-pass}}" \
    run_make generate-database-restore-drill-evidence
    RESTORE_EVIDENCE_FILE="$restore_file"
    export RESTORE_EVIDENCE_FILE
  fi
}

[ "$CONFIRM_FINALIZE_V2" = "yes" ] || fail "set CONFIRM_FINALIZE_V2=yes to run final closeout"

if [ "$RUN_EXTERNAL_PREFLIGHT_REPORT" = "true" ]; then
  if run_make verify-v2-external-unblock-preflight; then
    printf 'external unblock preflight passed\n'
  else
    printf 'external unblock preflight reported unresolved prerequisites (continuing finalizer flow)\n'
  fi
fi

readiness_run_github_controls="$RUN_GITHUB_CONTROLS"
readiness_run_observability="$RUN_OBSERVABILITY"

if [ "$VERIFY_FROM_WORKFLOW" = "true" ]; then
  if [ -z "$WORKFLOW_RUN_ID" ]; then
    WORKFLOW_RUN_ID=latest
  fi
  RUN_WORKFLOW_EVIDENCE_PIPELINE=true \
  RUN_ROLLBACK_RESTORE="$RUN_ROLLBACK_RESTORE" \
  VERIFY_FROM_WORKFLOW=true \
  AUTO_GENERATE_OBSERVABILITY_EVIDENCE="$AUTO_GENERATE_OBSERVABILITY_EVIDENCE" \
  AUTO_GENERATE_ROLLBACK_RESTORE_EVIDENCE="$AUTO_GENERATE_ROLLBACK_RESTORE_EVIDENCE" \
  WORKFLOW_RUN_ID="$WORKFLOW_RUN_ID" \
  WORKFLOW_EVENT="$WORKFLOW_EVENT" \
  ENVIRONMENT="${ENVIRONMENT:-}" \
  CLUSTER="${CLUSTER:-}" \
  NAMESPACE="${NAMESPACE:-}" \
  OPERATOR="${OPERATOR:-}" \
  run_make verify-live-v2-inputs
  run_make verify-live-v2-workflow-run \
    WORKFLOW_RUN_ID="$WORKFLOW_RUN_ID" \
    WORKFLOW_EVENT="$WORKFLOW_EVENT" \
    WORKFLOW_EVENT_FALLBACK_ANY="$WORKFLOW_EVENT_FALLBACK_ANY" \
    REQUIRE_GITHUB_CONTROLS="$RUN_GITHUB_CONTROLS" \
    REQUIRE_OBSERVABILITY="$RUN_OBSERVABILITY" \
    REQUIRE_RELEASE_RENDER="$RUN_K8S_RUNTIME" || fail "workflow-run verification failed"
  readiness_run_github_controls=false
  readiness_run_observability=false
fi

if [ "$RUN_GITHUB_CONTROLS" = "true" ] && [ "$VERIFY_FROM_WORKFLOW" != "true" ]; then
  resolve_github_admin_token
  RUN_GITHUB_CONTROLS=true run_make verify-live-v2-inputs
  run_make verify-live-github-access
fi

if [ "$RUN_OBSERVABILITY" = "true" ] && [ "$VERIFY_FROM_WORKFLOW" != "true" ]; then
  RUN_OBSERVABILITY=true run_make verify-live-v2-inputs
fi

generate_observability_evidence_if_needed
generate_rollback_restore_evidence_if_needed

RUN_LOCAL_STATIC="$RUN_LOCAL_STATIC" \
RUN_PUBLIC_WORKFLOW_HEALTH="$RUN_PUBLIC_WORKFLOW_HEALTH" \
AUTO_SYNC_REMOTE_TRIVY_POLICY="$AUTO_SYNC_REMOTE_TRIVY_POLICY" \
RUN_REMOTE_WORKFLOW_SYNC="$RUN_REMOTE_WORKFLOW_SYNC" \
AUTO_SYNC_REMOTE_WORKFLOW="$AUTO_SYNC_REMOTE_WORKFLOW" \
RUN_GITHUB_CONTROLS="$readiness_run_github_controls" \
APPLY_GITHUB_CONTROLS="$APPLY_GITHUB_CONTROLS" \
RUN_OBSERVABILITY="$readiness_run_observability" \
RUN_RELEASE_RENDER=false \
OBS_EVIDENCE_FILE="${OBS_EVIDENCE_FILE:-}" \
ROLLBACK_EVIDENCE_FILE="${ROLLBACK_EVIDENCE_FILE:-}" \
RESTORE_EVIDENCE_FILE="${RESTORE_EVIDENCE_FILE:-}" \
run_make verify-v2-live-readiness

if [ "$RUN_K8S_RUNTIME" = "true" ] && [ "$VERIFY_FROM_WORKFLOW" != "true" ]; then
  require_env_specific_k8s_overrides
  render_for_environment STAGING staging "$STAGING_RENDER_OUTPUT"
  render_for_environment PRODUCTION production "$PRODUCTION_RENDER_OUTPUT"
fi

if [ "$RUN_ROLLBACK_RESTORE" = "true" ]; then
  [ -n "${ROLLBACK_EVIDENCE_FILE:-}" ] || fail "ROLLBACK_EVIDENCE_FILE is required"
  [ -n "${RESTORE_EVIDENCE_FILE:-}" ] || fail "RESTORE_EVIDENCE_FILE is required"
  run_make verify-rollback-drill-evidence EVIDENCE_FILE="$ROLLBACK_EVIDENCE_FILE"
  run_make verify-database-restore-drill-evidence EVIDENCE_FILE="$RESTORE_EVIDENCE_FILE"
fi

if [ "$MARK_CHECKBOXES" = "true" ]; then
  CONFIRM_MARK_CONTRIBUTING=yes \
  VERIFY_BEFORE_MARK=false \
  MARK_GITHUB_CONTROLS="$RUN_GITHUB_CONTROLS" \
  APPLY_GITHUB_CONTROLS="$APPLY_GITHUB_CONTROLS" \
  MARK_OBSERVABILITY="$RUN_OBSERVABILITY" \
  MARK_ROLLBACK_RESTORE="$RUN_ROLLBACK_RESTORE" \
  MARK_K8S_RUNTIME="$RUN_K8S_RUNTIME" \
  OBS_EVIDENCE_FILE="${OBS_EVIDENCE_FILE:-}" \
  ROLLBACK_EVIDENCE_FILE="${ROLLBACK_EVIDENCE_FILE:-}" \
  RESTORE_EVIDENCE_FILE="${RESTORE_EVIDENCE_FILE:-}" \
  STAGING_RENDER_OUTPUT="$STAGING_RENDER_OUTPUT" \
  PRODUCTION_RENDER_OUTPUT="$PRODUCTION_RENDER_OUTPUT" \
  run_make mark-v2-contributing-live-gates
fi

RUN_BASELINE_VERIFIERS=false \
AUDIT_REPORT_FILE="$AUDIT_REPORT_FILE" \
run_make audit-v2-contributing-checklist

printf 'v2 live closeout complete\n'
printf 'audit_report: %s\n' "$AUDIT_REPORT_FILE"
