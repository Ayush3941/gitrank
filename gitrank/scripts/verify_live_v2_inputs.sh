#!/usr/bin/env sh
set -eu

RUN_GITHUB_CONTROLS="${RUN_GITHUB_CONTROLS:-false}"
RUN_OBSERVABILITY="${RUN_OBSERVABILITY:-false}"
RUN_RELEASE_RENDER="${RUN_RELEASE_RENDER:-false}"
RUN_EVIDENCE_VALIDATION="${RUN_EVIDENCE_VALIDATION:-false}"

GITHUB_REPOSITORY="${GITHUB_REPOSITORY:-}"
GITHUB_TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-${GITRANK_REPO_ADMIN_TOKEN:-}}}"

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

fail() {
  printf 'live v2 input verification failed: %s\n' "$1" >&2
  exit 1
}

append_csv() {
  current=$1
  item=$2
  if [ -n "$current" ]; then
    printf '%s, %s' "$current" "$item"
  else
    printf '%s' "$item"
  fi
}

missing_vars=
missing_files=

ensure_non_empty() {
  name=$1
  value=$2
  if [ -z "$value" ]; then
    missing_vars=$(append_csv "$missing_vars" "$name")
  fi
}

ensure_file_non_empty() {
  name=$1
  value=$2
  if [ ! -s "$value" ]; then
    missing_files=$(append_csv "$missing_files" "$name")
  fi
}

if [ "$RUN_GITHUB_CONTROLS" = "true" ]; then
  ensure_non_empty GITHUB_REPOSITORY "$GITHUB_REPOSITORY"
  ensure_non_empty GITHUB_TOKEN_OR_GH_TOKEN_OR_GITRANK_REPO_ADMIN_TOKEN "$GITHUB_TOKEN"
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

if [ -n "$missing_vars" ]; then
  fail "missing required environment variables: $missing_vars"
fi

if [ -n "$missing_files" ]; then
  fail "required evidence files are missing or empty: $missing_files"
fi

printf 'live v2 input verification passed\n'
