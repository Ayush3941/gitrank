#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICE_DIR="$ROOT_DIR/gitrank/services/github-ingestor/internal/service"
EXECUTOR_FILE="$SERVICE_DIR/executor.go"
GRAPHQL_BATCH_FILE="$SERVICE_DIR/graphql_batch.go"

fail() {
  printf 'ingestor strict-app-auth check failed: %s\n' "$1" >&2
  exit 1
}

[[ -d "$SERVICE_DIR" ]] || fail "missing github-ingestor service directory"
[[ -f "$EXECUTOR_FILE" ]] || fail "missing executor.go"
[[ -f "$GRAPHQL_BATCH_FILE" ]] || fail "missing graphql_batch.go"

if (cd "$ROOT_DIR" && rg -n -i "oauth" "$SERVICE_DIR" --glob "!**/*_test.go" >/dev/null); then
  fail "non-test ingestor service code still contains OAuth extraction references"
fi

if (cd "$ROOT_DIR" && rg -n 'graphqlTokenSource|graphQLClientForActor|graphqlClientFactory' "$SERVICE_DIR" --glob "!**/*_test.go" >/dev/null); then
  fail "legacy GraphQL actor-token wiring is still present in non-test ingestor service code"
fi

if (cd "$ROOT_DIR" && rg -n 'probeAllInstallations && fallbackClient' "$SERVICE_DIR" --glob "!**/*_test.go" >/dev/null); then
  fail "actor installation resolution still allows arbitrary global-installation fallback"
fi

if (cd "$ROOT_DIR" && rg -n 'probeAllInstallations|installationClientSupportsAuthoredPullRequests|ActiveInstallationIDs\(' "$SERVICE_DIR/graphql_batch.go" --glob "!**/*_test.go" >/dev/null); then
  fail "actor installation resolution must stay account-scoped without global-installation probing/search fallback"
fi

if (cd "$ROOT_DIR" && rg -n 'fetchPullRequests\([^)]*SyncRequestActor' "$SERVICE_DIR" --glob "!**/*_test.go" >/dev/null); then
  fail "fetchPullRequests still accepts actor-scoped credentials instead of strict app client flow"
fi

if (cd "$ROOT_DIR" && rg -n 'repositoryClient := e\.client' "$SERVICE_DIR/executor.go" --glob "!**/*_test.go" >/dev/null); then
  fail "installation sync still falls back to base executor client instead of requiring GitHub App installation client"
fi

auth_metric_constant_hits="$(
  cd "$ROOT_DIR" && rg -n 'fetchedMetricAuthInstallationClient = "auth_installation_client"' "$SERVICE_DIR/executor.go" --glob "!**/*_test.go" | wc -l | tr -d ' '
)"
if [[ -z "$auth_metric_constant_hits" || "$auth_metric_constant_hits" -lt 1 ]]; then
  fail "strict app-auth telemetry marker constant is missing from executor sync paths"
fi

auth_metric_usage_hits="$(
  cd "$ROOT_DIR" && rg -n 'fetchedMetricAuthInstallationClient|markAuthInstallationClient\(' "$SERVICE_DIR/executor.go" --glob "!**/*_test.go" | wc -l | tr -d ' '
)"
if [[ -z "$auth_metric_usage_hits" || "$auth_metric_usage_hits" -lt 8 ]]; then
  fail "strict app-auth telemetry marker usage is missing from one or more executor sync paths"
fi

if ! rg -q 'executorForStrictAppSyncActor\(' "$EXECUTOR_FILE"; then
  fail "strict app actor selector missing from executor sync paths"
fi

if ! rg -q 'executorForStrictAppSyncRequest\(' "$EXECUTOR_FILE"; then
  fail "strict app request selector missing from executor sync paths"
fi

if ! rg -q 'func \(e \*Executor\) executorForStrictAppSyncRequest' "$GRAPHQL_BATCH_FILE"; then
  fail "strict app request selector implementation missing"
fi

if ! rg -q 'strictAppRuntime[[:space:]]+bool' "$EXECUTOR_FILE"; then
  fail "executor strict-app runtime marker field is missing"
fi

if ! rg -q 'func \(e \*Executor\) ensureStrictGitHubAppRuntime\(\) error' "$EXECUTOR_FILE"; then
  fail "strict-app runtime guard helper is missing"
fi

strict_runtime_guard_hits="$(
  cd "$ROOT_DIR" && rg -n 'ensureStrictGitHubAppRuntime\(\)' "$SERVICE_DIR/executor.go" --glob "!**/*_test.go" | wc -l | tr -d ' '
)"
if [[ -z "$strict_runtime_guard_hits" || "$strict_runtime_guard_hits" -lt 8 ]]; then
  fail "strict-app runtime guard must be enforced across GitHub extraction fetch paths"
fi

strict_discovery_window_line="$(
  cd "$ROOT_DIR" && rg -n 'func \(e \*Executor\) discoverAuthoredPullRequestTargetsInWindow\(' "$SERVICE_DIR/executor.go" --glob "!**/*_test.go" | head -n 1 | cut -d: -f1
)"
if [[ -z "$strict_discovery_window_line" ]]; then
  fail "discoverAuthoredPullRequestTargetsInWindow() is missing"
fi
if ! sed -n "${strict_discovery_window_line},$((strict_discovery_window_line + 20))p" "$SERVICE_DIR/executor.go" \
  | rg -q 'if err := e\.ensureStrictGitHubAppRuntime\(\); err != nil'; then
  fail "discoverAuthoredPullRequestTargetsInWindow() must enforce strict app runtime before GitHub search calls"
fi

strict_discovery_broad_line="$(
  cd "$ROOT_DIR" && rg -n 'func \(e \*Executor\) discoverAuthoredPullRequestTargetsBroad\(' "$SERVICE_DIR/executor.go" --glob "!**/*_test.go" | head -n 1 | cut -d: -f1
)"
if [[ -z "$strict_discovery_broad_line" ]]; then
  fail "discoverAuthoredPullRequestTargetsBroad() is missing"
fi
if ! sed -n "${strict_discovery_broad_line},$((strict_discovery_broad_line + 20))p" "$SERVICE_DIR/executor.go" \
  | rg -q 'if err := e\.ensureStrictGitHubAppRuntime\(\); err != nil'; then
  fail "discoverAuthoredPullRequestTargetsBroad() must enforce strict app runtime before GitHub search calls"
fi

if ! rg -q 'func \(e \*Executor\) executorForUserSyncActor\(ctx context.Context, actor SyncRequestActor\) \(\*Executor, error\)' "$GRAPHQL_BATCH_FILE"; then
  fail "user sync actor selector must return strict installation runtime only (no credential-source fallback)"
fi

if rg -q 'unexpected credential source' "$GRAPHQL_BATCH_FILE"; then
  fail "credential-source fallback guard text should not exist in strict app selector implementation"
fi

if ! rg -q 'if installationID > 0' "$GRAPHQL_BATCH_FILE"; then
  fail "strict app request selector must prioritize explicit installation_id resolution"
fi

if ! rg -q 'return e.executorForStrictAppSyncActor' "$GRAPHQL_BATCH_FILE"; then
  fail "strict app request selector must fall back to actor-scoped installation resolution when installation_id is absent"
fi

printf 'ingestor strict-app-auth check passed\n'
