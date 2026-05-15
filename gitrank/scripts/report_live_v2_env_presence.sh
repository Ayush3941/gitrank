#!/usr/bin/env sh
set -eu

repo_value="${GITHUB_REPOSITORY:-}"
inferred_repo_value="${INFERRED_GITHUB_REPOSITORY:-}"

if [ -n "$repo_value" ]; then
  printf 'GITHUB_REPOSITORY=set\n'
elif [ -n "$inferred_repo_value" ]; then
  printf 'GITHUB_REPOSITORY=set(inferred:%s)\n' "$inferred_repo_value"
else
  printf 'GITHUB_REPOSITORY=unset\n'
fi

for var_name in \
  GITRANK_REPO_ADMIN_TOKEN \
  GITHUB_TOKEN \
  GH_TOKEN \
  GITHUB_APP_ID \
  GITHUB_APP_INSTALLATION_ID \
  GITHUB_APP_PRIVATE_KEY_FILE \
  GITHUB_APP_PRIVATE_KEY_PEM \
  GITRANK_GITHUB_APP_ID \
  GITRANK_GITHUB_APP_INSTALLATION_ID \
  GITRANK_GITHUB_APP_PRIVATE_KEY_FILE \
  GITRANK_GITHUB_APP_PRIVATE_KEY_PEM \
  PROMETHEUS_BASE_URL \
  GRAFANA_BASE_URL \
  GRAFANA_API_TOKEN \
  OBS_EVIDENCE_FILE \
  ROLLBACK_EVIDENCE_FILE \
  RESTORE_EVIDENCE_FILE \
  IMAGE_TAG \
  IMAGE_REGISTRY_OWNER \
  REQUIRE_ENV_SPECIFIC_K8S_OVERRIDES \
  STAGING_K8S_PUBLIC_BASE_URL \
  PRODUCTION_K8S_PUBLIC_BASE_URL \
  STAGING_K8S_API_BASE_URL \
  PRODUCTION_K8S_API_BASE_URL \
  STAGING_K8S_AUTH_COOKIE_DOMAIN \
  PRODUCTION_K8S_AUTH_COOKIE_DOMAIN \
  STAGING_K8S_GITHUB_OAUTH_REDIRECT_URL \
  PRODUCTION_K8S_GITHUB_OAUTH_REDIRECT_URL \
  STAGING_K8S_API_HOST \
  PRODUCTION_K8S_API_HOST \
  STAGING_K8S_AUTH_HOST \
  PRODUCTION_K8S_AUTH_HOST \
  STAGING_K8S_TLS_SECRET_NAME \
  PRODUCTION_K8S_TLS_SECRET_NAME
do
  eval var_value="\${$var_name-}"
  if [ -n "$var_value" ]; then
    printf '%s=set\n' "$var_name"
  else
    printf '%s=unset\n' "$var_name"
  fi
done

token_candidate="${GITRANK_REPO_ADMIN_TOKEN:-${GITHUB_TOKEN:-${GH_TOKEN:-}}}"
app_id_candidate="${GITHUB_APP_ID:-${GITRANK_GITHUB_APP_ID:-}}"
app_installation_candidate="${GITHUB_APP_INSTALLATION_ID:-${GITRANK_GITHUB_APP_INSTALLATION_ID:-}}"
app_key_file_candidate="${GITHUB_APP_PRIVATE_KEY_FILE:-${GITRANK_GITHUB_APP_PRIVATE_KEY_FILE:-}}"
app_key_pem_candidate="${GITHUB_APP_PRIVATE_KEY_PEM:-${GITRANK_GITHUB_APP_PRIVATE_KEY_PEM:-}}"

has_app_bootstrap=false
if [ -n "$app_id_candidate" ] && [ -n "$app_installation_candidate" ]; then
  if [ -n "$app_key_file_candidate" ] || [ -n "$app_key_pem_candidate" ]; then
    has_app_bootstrap=true
  fi
fi

auth_mode=none
if [ -n "$token_candidate" ]; then
  auth_mode=token
elif [ "$has_app_bootstrap" = "true" ]; then
  auth_mode=app-bootstrap
fi

workflow_sync_credential_readiness=unavailable
if [ "$auth_mode" = "token" ]; then
  workflow_sync_credential_readiness=token-present
elif [ "$auth_mode" = "app-bootstrap" ]; then
  workflow_sync_credential_readiness=app-bootstrap-present
fi

origin_push_access_readiness=unknown
origin_push_probe_script="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)/verify_origin_push_access.sh"
if [ -x "$origin_push_probe_script" ]; then
  origin_push_probe_log=$(mktemp "${TMPDIR:-/tmp}/gitrank-env-origin-push.XXXXXX")
  if "$origin_push_probe_script" >"$origin_push_probe_log" 2>&1; then
    origin_push_access_readiness=available
  else
    origin_push_access_readiness=unavailable
  fi
  rm -f "$origin_push_probe_log"
fi

workflow_sync_execution_path=unavailable
if [ "$workflow_sync_credential_readiness" = "token-present" ] || [ "$workflow_sync_credential_readiness" = "app-bootstrap-present" ]; then
  workflow_sync_execution_path=token-or-app
elif [ "$origin_push_access_readiness" = "available" ]; then
  workflow_sync_execution_path=git-push
fi

printf 'derived.auth_mode=%s\n' "$auth_mode"
printf 'derived.has_app_bootstrap=%s\n' "$has_app_bootstrap"
printf 'derived.workflow_sync_credential_readiness=%s\n' "$workflow_sync_credential_readiness"
printf 'derived.origin_push_access_readiness=%s\n' "$origin_push_access_readiness"
printf 'derived.workflow_sync_execution_path=%s\n' "$workflow_sync_execution_path"
