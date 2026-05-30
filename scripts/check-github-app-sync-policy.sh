#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_MANIFEST="$ROOT_DIR/gitrank/services/api-gateway/internal/app/manifest.go"
INGESTOR_MANIFEST="$ROOT_DIR/gitrank/services/github-ingestor/internal/app/manifest.go"
API_SYNC_FILE="$ROOT_DIR/gitrank/services/api-gateway/internal/httpapi/sync.go"
INGESTOR_ROUTER_FILE="$ROOT_DIR/gitrank/services/github-ingestor/internal/httpapi/router.go"

fail() {
  printf 'github app sync policy check failed: %s\n' "$1" >&2
  exit 1
}

if ! command -v rg >/dev/null 2>&1; then
  fail "rg is required"
fi

[[ -f "$API_MANIFEST" ]] || fail "missing file: $API_MANIFEST"
[[ -f "$INGESTOR_MANIFEST" ]] || fail "missing file: $INGESTOR_MANIFEST"
[[ -f "$API_SYNC_FILE" ]] || fail "missing file: $API_SYNC_FILE"
[[ -f "$INGESTOR_ROUTER_FILE" ]] || fail "missing file: $INGESTOR_ROUTER_FILE"

if ! rg -q 'GitHub App installation token for sync, OAuth user token only for identity/login' "$API_MANIFEST"; then
  fail "api-gateway manifest no longer documents strict sync auth policy"
fi

if ! rg -q 'GitHub App installation token for sync, OAuth user token only for sign-in/session identity' "$INGESTOR_MANIFEST"; then
  fail "github-ingestor manifest no longer documents strict sync auth policy"
fi

if ! rg -q 'githubSyncStatus := dependencyStatusFromError\(cfg.ValidateGitHubApp\(\)\)' "$API_MANIFEST"; then
  fail "api-gateway manifest missing ValidateGitHubApp status derivation"
fi

if ! rg -q 'githubSyncStatus := dependencyStatusFromError\(cfg.ValidateGitHubApp\(\)\)' "$INGESTOR_MANIFEST"; then
  fail "github-ingestor manifest missing ValidateGitHubApp status derivation"
fi

if ! rg -q 'authenticated github login is required for user sync' "$API_SYNC_FILE"; then
  fail "api-gateway user sync path no longer enforces authenticated-login ownership"
fi

if ! rg -q 'req.User = normalizeUserSyncLogin\(req.User, actor.GitHubLogin\)' "$INGESTOR_ROUTER_FILE"; then
  fail "github-ingestor user sync routes no longer normalize user payloads against actor login"
fi

if ! rg -q 'func normalizeUserSyncLogin\(' "$INGESTOR_ROUTER_FILE"; then
  fail "github-ingestor user sync login normalization helper is missing"
fi

if ! rg -q '"user_sync_actor_mismatch"' "$INGESTOR_ROUTER_FILE"; then
  fail "github-ingestor sync execution error mapping must expose user_sync_actor_mismatch"
fi

printf 'github app sync policy check passed\n'
