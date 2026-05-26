#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

fail() {
  printf 'doc env var reference check failed: %s\n' "$1" >&2
  exit 1
}

if ! command -v rg >/dev/null 2>&1; then
  fail "rg is required"
fi
if ! command -v sed >/dev/null 2>&1; then
  fail "sed is required"
fi
if ! command -v sort >/dev/null 2>&1; then
  fail "sort is required"
fi

known_vars_file="$(mktemp "${TMPDIR:-/tmp}/gitrank-known-env-vars.XXXXXX")"
referenced_vars_file="$(mktemp "${TMPDIR:-/tmp}/gitrank-doc-env-vars.XXXXXX")"
trap 'rm -f "$known_vars_file" "$referenced_vars_file"' EXIT

collect_known_vars() {
  local env_file
  for env_file in \
    "$ROOT_DIR/gitrank/.env.example" \
    "$ROOT_DIR/gitrank/.env.v2-live-gates.example"; do
    [[ -f "$env_file" ]] || continue
    rg -n -o '^[[:space:]]*#?[[:space:]]*[A-Z][A-Z0-9_]*=' "$env_file" \
      | sed -E 's/^([^:]+:)?[0-9]+:[[:space:]]*#?[[:space:]]*([A-Z][A-Z0-9_]*)=$/\2/'
  done

  cd "$ROOT_DIR"
  rg -n -o '(export[[:space:]]+)?[A-Z][A-Z0-9_]*=' scripts gitrank/scripts --glob '*.sh' \
    | sed -E 's/^([^:]+:)?[0-9]+:(export[[:space:]]+)?([A-Z][A-Z0-9_]*)=$/\3/'
  rg -n -o '\$\{[A-Z][A-Z0-9_]*([}:][^}]*)?\}' scripts gitrank/scripts --glob '*.sh' \
    | sed -E 's/^([^:]+:)?[0-9]+:\$\{([A-Z][A-Z0-9_]*).*/\2/'
  rg -n -o '\$[A-Z][A-Z0-9_]+' scripts gitrank/scripts --glob '*.sh' \
    | sed -E 's/^([^:]+:)?[0-9]+:\$([A-Z][A-Z0-9_]+)/\2/'

  # Deployment/workflow-scoped env keys that are referenced in docs and
  # verified by dedicated checks but are not part of runtime .env examples.
  printf '%s\n' \
    GRAFANA_ADMIN_USER \
    GRAFANA_ADMIN_PASSWORD \
    KUBE_CONFIG_B64
}

is_envish_var() {
  local var="$1"
  [[ "$var" =~ ^[A-Z][A-Z0-9_]*$ ]] || return 1
  [[ "$var" == *_ ]] && return 1
  case "$var" in
    AI_*|API_*|AUTH_*|DATABASE_URL|REDIS_URL|GITHUB_*|GITRANK_*|GEMINI_*|PROFILE_*|SCORING_*|OTEL_*|JOB_*|SCHEDULER_*|NEXT_PUBLIC_*|K8S_*|STAGING_*|PRODUCTION_*|IMAGE_*|PROMETHEUS_*|GRAFANA_*|WORKFLOW_*|VERIFY_*|CONFIRM_*|RUN_*|AUTO_*|WAIVE_*|LIVE_*|FINALIZE_*|AUDIT_*|OBS_*|ROLLBACK_*|RESTORE_*|ALLOW_LOCAL_SEED|INTERNAL_*|PR_ANALYZER_*|SCORING_ENGINE_*|PROFILE_SERVICE_*|GITHUB_INGESTOR_*|AUTH_SERVICE_*|SCHEDULER_WORKER_*|GH_TOKEN|GOCACHE|TMPDIR|KUBE_CONFIG_B64|INSTALLATION_ID|NAMESPACE|CLUSTER|OPERATOR)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

collect_known_vars | sort -u >"$known_vars_file"

cd "$ROOT_DIR"
rg -n -o --glob '*.md' '\$\{[A-Z][A-Z0-9_]*\}|\$[A-Z][A-Z0-9_]*|`[A-Z][A-Z0-9_]{2,}`' \
  | while IFS= read -r match; do
    token="${match#*:}"
    token="${token#*:}"
    token="${token#*:}"
    token="${token#\$\{}"
    token="${token#\$}"
    token="${token#\`}"
    token="${token%\`}"
    token="${token%\}}"
    if is_envish_var "$token"; then
      printf '%s\n' "$token"
    fi
  done | sort -u >"$referenced_vars_file"

missing=0
while IFS= read -r var; do
  [[ -z "$var" ]] && continue
  if ! rg -qx -- "$var" "$known_vars_file"; then
    printf 'unknown env variable referenced in markdown: %s\n' "$var" >&2
    missing=1
  fi
done <"$referenced_vars_file"

if [[ "$missing" -ne 0 ]]; then
  fail "markdown env variable references are out of sync with env examples/scripts"
fi

printf 'doc env var reference check passed\n'
