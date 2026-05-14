#!/usr/bin/env sh
set -eu

root_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"

RUN_LOCAL_STATIC="${RUN_LOCAL_STATIC:-true}"
RUN_GITHUB_CONTROLS="${RUN_GITHUB_CONTROLS:-false}"
APPLY_GITHUB_CONTROLS="${APPLY_GITHUB_CONTROLS:-false}"
RUN_OBSERVABILITY="${RUN_OBSERVABILITY:-false}"
RUN_RELEASE_RENDER="${RUN_RELEASE_RENDER:-false}"
RUN_INPUT_PREFLIGHT="${RUN_INPUT_PREFLIGHT:-true}"
RUN_PUBLIC_WORKFLOW_HEALTH="${RUN_PUBLIC_WORKFLOW_HEALTH:-false}"
AUTO_SYNC_REMOTE_TRIVY_POLICY="${AUTO_SYNC_REMOTE_TRIVY_POLICY:-false}"

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
  run_make verify-contributing-checked-file-refs
  run_make verify-v2-unresolved-checklist-scope
  run_make verify-live-v2-workflow
  run_make verify-observability-manifests
  run_make verify-rollback-procedure
  run_make verify-k8s-autoscaling
  run_make verify-secret-policy
  run_make verify-finalize-v2-closeout-env-aliases
fi

if [ "$RUN_PUBLIC_WORKFLOW_HEALTH" = "true" ]; then
  if run_make verify-public-workflow-health; then
    :
  else
    if [ "$AUTO_SYNC_REMOTE_TRIVY_POLICY" = "true" ]; then
      token_candidate="${GITHUB_TOKEN:-${GH_TOKEN:-${GITRANK_REPO_ADMIN_TOKEN:-}}}"
      [ -n "$token_candidate" ] || fail "public workflow health failed and AUTO_SYNC_REMOTE_TRIVY_POLICY=true, but no admin token is set"
      run_make sync-remote-trivy-policy
      run_make verify-public-workflow-health
    else
      fail "public workflow health gate failed (set AUTO_SYNC_REMOTE_TRIVY_POLICY=true to attempt automated Trivy policy sync)"
    fi
  fi
fi

if [ "$RUN_GITHUB_CONTROLS" = "true" ]; then
  if [ "$RUN_INPUT_PREFLIGHT" = "true" ]; then
    RUN_GITHUB_CONTROLS=true run_make verify-live-v2-inputs
  fi
  run_make verify-live-github-access
  if [ "$APPLY_GITHUB_CONTROLS" = "true" ]; then
    export GITRANK_APPLY_REPOSITORY_CONTROLS=yes
    run_make apply-github-repository-controls-auto
  fi
  run_make verify-github-repository-controls
fi

if [ "$RUN_OBSERVABILITY" = "true" ]; then
  if [ "$RUN_INPUT_PREFLIGHT" = "true" ]; then
    RUN_OBSERVABILITY=true run_make verify-live-v2-inputs
  fi
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
  if [ "$RUN_INPUT_PREFLIGHT" = "true" ]; then
    RUN_RELEASE_RENDER=true run_make verify-live-v2-inputs
  fi
  [ -n "${K8S_ENVIRONMENT:-}" ] || fail "K8S_ENVIRONMENT is required when RUN_RELEASE_RENDER=true"
  [ -n "${OUTPUT_FILE:-}" ] || fail "OUTPUT_FILE is required when RUN_RELEASE_RENDER=true"
  run_make render-k8s-release-manifests K8S_ENVIRONMENT="$K8S_ENVIRONMENT" OUTPUT_FILE="$OUTPUT_FILE"
fi

printf 'v2 live readiness verification passed\n'
