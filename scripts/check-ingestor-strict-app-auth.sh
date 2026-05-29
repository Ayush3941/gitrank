#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICE_DIR="$ROOT_DIR/gitrank/services/github-ingestor/internal/service"
EXECUTOR_FILE="$SERVICE_DIR/executor.go"

fail() {
  printf 'ingestor strict-app-auth check failed: %s\n' "$1" >&2
  exit 1
}

[[ -d "$SERVICE_DIR" ]] || fail "missing github-ingestor service directory"
[[ -f "$EXECUTOR_FILE" ]] || fail "missing executor.go"

if (cd "$ROOT_DIR" && rg -n "oauth" "$SERVICE_DIR" --glob "!**/*_test.go" >/dev/null); then
  fail "non-test ingestor service code still contains OAuth extraction references"
fi

if ! rg -q 'executor\.graphqlTokenSource = nil' "$EXECUTOR_FILE"; then
  fail "executor default must disable GraphQL token source for strict app-only sync extraction"
fi

if (cd "$ROOT_DIR" && rg -n 'graphQLTokenSourceForActor\(' "$SERVICE_DIR" --glob "!**/*_test.go" >/dev/null); then
  fail "legacy OAuth-derived GraphQL token source helper is still present in non-test ingestor service code"
fi

if ! rg -q 'executorForStrictAppSyncActor\(' "$EXECUTOR_FILE"; then
  fail "strict app actor selector missing from executor sync paths"
fi

if ! rg -q 'executorForStrictAppSyncRequest\(' "$EXECUTOR_FILE"; then
  fail "strict app request selector missing from executor sync paths"
fi

printf 'ingestor strict-app-auth check passed\n'
