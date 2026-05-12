#!/usr/bin/env sh
set -eu

root_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"

RUN_LOCAL_STATIC="${RUN_LOCAL_STATIC:-true}"
RUN_GITHUB_CONTROLS="${RUN_GITHUB_CONTROLS:-false}"
APPLY_GITHUB_CONTROLS="${APPLY_GITHUB_CONTROLS:-false}"
RUN_OBSERVABILITY="${RUN_OBSERVABILITY:-false}"
RUN_RELEASE_RENDER="${RUN_RELEASE_RENDER:-false}"

fail() {
  printf 'v2 live readiness verification failed: %s\n' "$1" >&2
  exit 1
}

run_make() {
  target=$1
  shift || true
  (cd "$root_dir" && TMPDIR="${TMPDIR:-$root_dir/.tmp}" make "$target" "$@")
}

if [ "$RUN_LOCAL_STATIC" = "true" ]; then
  run_make verify-v2-no-mock-release-gate
  run_make verify-live-v2-workflow
  run_make verify-observability-manifests
  run_make verify-rollback-procedure
  run_make verify-k8s-autoscaling
  run_make verify-secret-policy
fi

if [ "$RUN_GITHUB_CONTROLS" = "true" ]; then
  if [ "$APPLY_GITHUB_CONTROLS" = "true" ]; then
    export GITRANK_APPLY_REPOSITORY_CONTROLS=yes
    run_make apply-github-repository-controls-auto
  fi
  run_make verify-github-repository-controls
fi

if [ "$RUN_OBSERVABILITY" = "true" ]; then
  run_make verify-live-observability
fi

if [ -n "${OBS_EVIDENCE_FILE:-}" ]; then
  run_make verify-observability-evidence EVIDENCE_FILE="$OBS_EVIDENCE_FILE"
fi

if [ -n "${ROLLBACK_EVIDENCE_FILE:-}" ]; then
  run_make verify-rollback-drill-evidence EVIDENCE_FILE="$ROLLBACK_EVIDENCE_FILE"
fi

if [ -n "${RESTORE_EVIDENCE_FILE:-}" ]; then
  run_make verify-database-restore-drill-evidence EVIDENCE_FILE="$RESTORE_EVIDENCE_FILE"
fi

if [ "$RUN_RELEASE_RENDER" = "true" ]; then
  [ -n "${K8S_ENVIRONMENT:-}" ] || fail "K8S_ENVIRONMENT is required when RUN_RELEASE_RENDER=true"
  [ -n "${OUTPUT_FILE:-}" ] || fail "OUTPUT_FILE is required when RUN_RELEASE_RENDER=true"
  run_make render-k8s-release-manifests K8S_ENVIRONMENT="$K8S_ENVIRONMENT" OUTPUT_FILE="$OUTPUT_FILE"
fi

printf 'v2 live readiness verification passed\n'
