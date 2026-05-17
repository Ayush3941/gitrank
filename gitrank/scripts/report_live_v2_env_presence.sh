#!/usr/bin/env sh
set -eu

repo_value="${GITHUB_REPOSITORY:-}"
inferred_repo_value="${INFERRED_GITHUB_REPOSITORY:-}"
root_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
default_env_file="$root_dir/.env"

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

emit_var_presence() {
  name=$1
  value=$2
  if [ -z "$value" ]; then
    printf '%s=unset\n' "$name"
    return 0
  fi
  if is_placeholder_value "$value"; then
    printf '%s=placeholder\n' "$name"
    return 0
  fi
  printf '%s=set\n' "$name"
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

if [ -n "$repo_value" ]; then
  if is_placeholder_value "$repo_value"; then
    printf 'GITHUB_REPOSITORY=placeholder\n'
  else
    printf 'GITHUB_REPOSITORY=set\n'
  fi
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
  GITHUB_CLIENT_ID \
  GITHUB_CLIENT_SECRET \
  GITRANK_ALLOW_OAUTH_WEB_TOKEN_BOOTSTRAP \
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
  emit_var_presence "$var_name" "$var_value"
done

token_candidate="${GITRANK_REPO_ADMIN_TOKEN:-${GITHUB_TOKEN:-${GH_TOKEN:-}}}"
app_id_candidate="${GITHUB_APP_ID:-${GITRANK_GITHUB_APP_ID:-}}"
app_installation_candidate="${GITHUB_APP_INSTALLATION_ID:-${GITRANK_GITHUB_APP_INSTALLATION_ID:-}}"
app_key_file_candidate="${GITHUB_APP_PRIVATE_KEY_FILE:-${GITRANK_GITHUB_APP_PRIVATE_KEY_FILE:-}}"
app_key_pem_candidate="${GITHUB_APP_PRIVATE_KEY_PEM:-${GITRANK_GITHUB_APP_PRIVATE_KEY_PEM:-}}"
oauth_client_id_candidate="${GITHUB_CLIENT_ID:-${GITHUB_OAUTH_WEB_CLIENT_ID:-}}"
oauth_client_secret_candidate="${GITHUB_CLIENT_SECRET:-${GITHUB_OAUTH_WEB_CLIENT_SECRET:-}}"
if [ -z "$oauth_client_id_candidate" ]; then
  oauth_client_id_candidate=$(load_env_var_from_file "$default_env_file" "GITHUB_CLIENT_ID" || true)
fi
if [ -z "$oauth_client_secret_candidate" ]; then
  oauth_client_secret_candidate=$(load_env_var_from_file "$default_env_file" "GITHUB_CLIENT_SECRET" || true)
fi

if is_placeholder_value "$token_candidate"; then
  token_candidate=
fi
if is_placeholder_value "$app_id_candidate"; then
  app_id_candidate=
fi
if is_placeholder_value "$app_installation_candidate"; then
  app_installation_candidate=
fi
if is_placeholder_value "$app_key_file_candidate"; then
  app_key_file_candidate=
fi
if is_placeholder_value "$app_key_pem_candidate"; then
  app_key_pem_candidate=
fi
if is_placeholder_value "$oauth_client_id_candidate"; then
  oauth_client_id_candidate=
fi
if is_placeholder_value "$oauth_client_secret_candidate"; then
  oauth_client_secret_candidate=
fi

has_app_bootstrap=false
if [ -n "$app_id_candidate" ] && [ -n "$app_installation_candidate" ]; then
  if [ -n "$app_key_file_candidate" ] || [ -n "$app_key_pem_candidate" ]; then
    has_app_bootstrap=true
  fi
fi
has_oauth_bootstrap=false
if [ -n "$oauth_client_id_candidate" ] && [ -n "$oauth_client_secret_candidate" ]; then
  has_oauth_bootstrap=true
fi

auth_mode=none
if [ -n "$token_candidate" ]; then
  auth_mode=token
elif [ "$has_app_bootstrap" = "true" ]; then
  auth_mode=app-bootstrap
elif [ "$has_oauth_bootstrap" = "true" ]; then
  auth_mode=oauth-web-bootstrap
fi

workflow_sync_credential_readiness=unavailable
if [ "$auth_mode" = "token" ]; then
  workflow_sync_credential_readiness=token-present
elif [ "$auth_mode" = "app-bootstrap" ]; then
  workflow_sync_credential_readiness=app-bootstrap-present
elif [ "$auth_mode" = "oauth-web-bootstrap" ]; then
  workflow_sync_credential_readiness=oauth-bootstrap-present
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
elif [ "$workflow_sync_credential_readiness" = "oauth-bootstrap-present" ]; then
  workflow_sync_execution_path=oauth-web-bootstrap
elif [ "$origin_push_access_readiness" = "available" ]; then
  workflow_sync_execution_path=git-push
fi

printf 'derived.auth_mode=%s\n' "$auth_mode"
printf 'derived.has_app_bootstrap=%s\n' "$has_app_bootstrap"
printf 'derived.has_oauth_bootstrap=%s\n' "$has_oauth_bootstrap"
printf 'derived.workflow_sync_credential_readiness=%s\n' "$workflow_sync_credential_readiness"
printf 'derived.origin_push_access_readiness=%s\n' "$origin_push_access_readiness"
printf 'derived.workflow_sync_execution_path=%s\n' "$workflow_sync_execution_path"
