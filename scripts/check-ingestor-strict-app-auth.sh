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

if (cd "$ROOT_DIR" && rg -n -i "oauth" "$SERVICE_DIR" --glob "!**/*_test.go" >/dev/null); then
  fail "non-test ingestor service code still contains OAuth extraction references"
fi

if (cd "$ROOT_DIR" && rg -n 'graphqlTokenSource|graphQLClientForActor|graphqlClientFactory' "$SERVICE_DIR" --glob "!**/*_test.go" >/dev/null); then
  fail "legacy GraphQL actor-token wiring is still present in non-test ingestor service code"
fi

if (cd "$ROOT_DIR" && rg -n 'probeAllInstallations && fallbackClient' "$SERVICE_DIR" --glob "!**/*_test.go" >/dev/null); then
  fail "actor installation resolution still allows arbitrary global-installation fallback"
fi

if (cd "$ROOT_DIR" && rg -n 'fetchPullRequests\([^)]*SyncRequestActor' "$SERVICE_DIR" --glob "!**/*_test.go" >/dev/null); then
  fail "fetchPullRequests still accepts actor-scoped credentials instead of strict app client flow"
fi

if (cd "$ROOT_DIR" && rg -n 'repositoryClient := e\.client' "$SERVICE_DIR/executor.go" --glob "!**/*_test.go" >/dev/null); then
  fail "installation sync still falls back to base executor client instead of requiring GitHub App installation client"
fi

auth_metric_hits="$(
  cd "$ROOT_DIR" && rg -n '"auth_installation_client"' "$SERVICE_DIR/executor.go" --glob "!**/*_test.go" | wc -l | tr -d ' '
)"
if [[ -z "$auth_metric_hits" || "$auth_metric_hits" -lt 6 ]]; then
  fail "strict app-auth telemetry marker auth_installation_client is missing from one or more sync execution paths"
fi

if ! rg -q 'executorForStrictAppSyncActor\(' "$EXECUTOR_FILE"; then
  fail "strict app actor selector missing from executor sync paths"
fi

if ! rg -q 'executorForStrictAppSyncRequest\(' "$EXECUTOR_FILE"; then
  fail "strict app request selector missing from executor sync paths"
fi

printf 'ingestor strict-app-auth check passed\n'
