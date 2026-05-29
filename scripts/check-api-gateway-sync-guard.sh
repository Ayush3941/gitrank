#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROUTER_FILE="$ROOT_DIR/gitrank/services/api-gateway/internal/httpapi/router.go"

fail() {
  printf 'api-gateway sync guard check failed: %s\n' "$1" >&2
  exit 1
}

if ! command -v rg >/dev/null 2>&1; then
  fail "rg is required"
fi

[[ -f "$ROUTER_FILE" ]] || fail "missing router file: $ROUTER_FILE"

required_guarded_paths=(
  "/v1/sync"
  "/v1/sync/repository/execute"
  "/v1/sync/user/execute"
  "/v1/sync/installation/execute"
  "/v1/sync/pull-request/execute"
  "/v1/sync/review/execute"
  "/v1/sync/issue/execute"
  "/v1/sync/commit/execute"
)

for path in "${required_guarded_paths[@]}"; do
  pattern="mux.Handle\\(\"${path}\", sessionAuth\\.Middleware\\(withSyncRuntimeGuard\\(syncConfigError,"
  if ! rg -q "$pattern" "$ROUTER_FILE"; then
    fail "route is missing withSyncRuntimeGuard wrapper: $path"
  fi
done

if rg -q 'mux.Handle\("/v1/sync/runs", sessionAuth\.Middleware\(withSyncRuntimeGuard\(syncConfigError,' "$ROUTER_FILE"; then
  fail "/v1/sync/runs must remain readable for diagnostics and should not be guard-wrapped"
fi

if ! rg -q '^func withSyncRuntimeGuard\(syncConfigError error, next http\.Handler\) http\.Handler' "$ROUTER_FILE"; then
  fail "withSyncRuntimeGuard helper is missing"
fi

printf 'api-gateway sync guard check passed\n'
