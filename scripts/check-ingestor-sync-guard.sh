#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROUTER_FILE="$ROOT_DIR/gitrank/services/github-ingestor/internal/httpapi/router.go"

fail() {
  printf 'ingestor sync guard check failed: %s\n' "$1" >&2
  exit 1
}

if ! command -v rg >/dev/null 2>&1; then
  fail "rg is required"
fi

[[ -f "$ROUTER_FILE" ]] || fail "missing router file: $ROUTER_FILE"

if ! rg -q 'syncConfigError := cfg.ValidateGitHubApp\(\)' "$ROUTER_FILE"; then
  fail "router missing ValidateGitHubApp sync guard source"
fi

if ! rg -q 'if syncModeRequiresGitHubApp\(mode\) && syncConfigError != nil \{' "$ROUTER_FILE"; then
  fail "registerSyncRoute missing runtime guard for GitHub App sync config"
fi

if ! rg -q 'func writeSyncConfigUnavailable\(w http.ResponseWriter, r \*http.Request\)' "$ROUTER_FILE"; then
  fail "sync_config_unavailable writer helper missing"
fi

if ! rg -q 'sync_config_unavailable' "$ROUTER_FILE"; then
  fail "sync_config_unavailable error code missing in ingestor router"
fi

printf 'ingestor sync guard check passed\n'
