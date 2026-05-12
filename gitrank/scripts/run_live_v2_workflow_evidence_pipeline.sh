#!/usr/bin/env sh
set -eu

root_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
tmp_root="${TMPDIR:-$root_dir/.tmp}"
mkdir -p "$tmp_root"

CONFIRM_RUN_LIVE_V2_PIPELINE="${CONFIRM_RUN_LIVE_V2_PIPELINE:-}"
DISPATCH_WORKFLOW="${DISPATCH_WORKFLOW:-true}"
VERIFY_WORKFLOW_RUN="${VERIFY_WORKFLOW_RUN:-true}"
GENERATE_OBSERVABILITY_EVIDENCE="${GENERATE_OBSERVABILITY_EVIDENCE:-true}"
USE_LATEST_SUCCESSFUL_RUN="${USE_LATEST_SUCCESSFUL_RUN:-false}"

WORKFLOW_RUN_ID="${WORKFLOW_RUN_ID:-}"
WORKFLOW_RUN_ID_FILE="${WORKFLOW_RUN_ID_FILE:-$tmp_root/live-v2-workflow-run-id.txt}"
WORKFLOW_EVENT="${WORKFLOW_EVENT:-workflow_dispatch}"

RUN_GITHUB_CONTROLS="${RUN_GITHUB_CONTROLS:-true}"
RUN_OBSERVABILITY="${RUN_OBSERVABILITY:-true}"
RUN_RELEASE_RENDER="${RUN_RELEASE_RENDER:-true}"
APPLY_GITHUB_CONTROLS="${APPLY_GITHUB_CONTROLS:-false}"

OBS_EVIDENCE_FILE="${OBS_EVIDENCE_FILE:-$root_dir/docs/evidence/observability-live-$(date -u +%F).txt}"

fail() {
  printf 'live v2 workflow evidence pipeline failed: %s\n' "$1" >&2
  exit 1
}

run_make() {
  target=$1
  shift || true
  (cd "$root_dir" && TMPDIR="$tmp_root" make "$target" "$@")
}

[ "$CONFIRM_RUN_LIVE_V2_PIPELINE" = "yes" ] || fail "set CONFIRM_RUN_LIVE_V2_PIPELINE=yes to run this pipeline"

if [ "$DISPATCH_WORKFLOW" = "true" ]; then
  WORKFLOW_RUN_ID_OUTPUT_FILE="$WORKFLOW_RUN_ID_FILE" \
  RUN_GITHUB_CONTROLS="$RUN_GITHUB_CONTROLS" \
  RUN_OBSERVABILITY="$RUN_OBSERVABILITY" \
  RUN_RELEASE_RENDER="$RUN_RELEASE_RENDER" \
  APPLY_GITHUB_CONTROLS="$APPLY_GITHUB_CONTROLS" \
  WAIT_FOR_COMPLETION=true \
  run_make run-live-v2-gates-workflow
fi

if [ -z "$WORKFLOW_RUN_ID" ] && [ -s "$WORKFLOW_RUN_ID_FILE" ]; then
  WORKFLOW_RUN_ID=$(cat "$WORKFLOW_RUN_ID_FILE")
fi

if [ -z "$WORKFLOW_RUN_ID" ] && [ "$USE_LATEST_SUCCESSFUL_RUN" = "true" ]; then
  WORKFLOW_RUN_ID=latest
fi

if [ "$VERIFY_WORKFLOW_RUN" = "true" ]; then
  [ -n "$WORKFLOW_RUN_ID" ] || fail "WORKFLOW_RUN_ID is required when VERIFY_WORKFLOW_RUN=true"
  WORKFLOW_RUN_ID_OUTPUT_FILE="$WORKFLOW_RUN_ID_FILE" \
  WORKFLOW_RUN_ID="$WORKFLOW_RUN_ID" \
  WORKFLOW_EVENT="$WORKFLOW_EVENT" \
  REQUIRE_GITHUB_CONTROLS="$RUN_GITHUB_CONTROLS" \
  REQUIRE_OBSERVABILITY="$RUN_OBSERVABILITY" \
  REQUIRE_RELEASE_RENDER="$RUN_RELEASE_RENDER" \
  run_make verify-live-v2-workflow-run
  WORKFLOW_RUN_ID=$(cat "$WORKFLOW_RUN_ID_FILE")
fi

if [ "$GENERATE_OBSERVABILITY_EVIDENCE" = "true" ] && [ "$RUN_OBSERVABILITY" = "true" ]; then
  [ -n "$WORKFLOW_RUN_ID" ] || fail "WORKFLOW_RUN_ID is required to generate observability evidence"
  [ -n "${ENVIRONMENT:-}" ] || fail "ENVIRONMENT is required when GENERATE_OBSERVABILITY_EVIDENCE=true"
  [ -n "${CLUSTER:-}" ] || fail "CLUSTER is required when GENERATE_OBSERVABILITY_EVIDENCE=true"
  [ -n "${NAMESPACE:-}" ] || fail "NAMESPACE is required when GENERATE_OBSERVABILITY_EVIDENCE=true"
  [ -n "${OPERATOR:-}" ] || fail "OPERATOR is required when GENERATE_OBSERVABILITY_EVIDENCE=true"

  WORKFLOW_RUN_ID="$WORKFLOW_RUN_ID" \
  WORKFLOW_EVENT="$WORKFLOW_EVENT" \
  OUTPUT_FILE="$OBS_EVIDENCE_FILE" \
  ENVIRONMENT="${ENVIRONMENT:-}" \
  CLUSTER="${CLUSTER:-}" \
  NAMESPACE="${NAMESPACE:-}" \
  OPERATOR="${OPERATOR:-}" \
  run_make generate-observability-evidence-from-workflow-run
fi

printf 'live v2 workflow evidence pipeline complete\n'
printf 'workflow_run_id: %s\n' "${WORKFLOW_RUN_ID:-unset}"
printf 'workflow_run_id_file: %s\n' "$WORKFLOW_RUN_ID_FILE"
if [ "$GENERATE_OBSERVABILITY_EVIDENCE" = "true" ] && [ "$RUN_OBSERVABILITY" = "true" ]; then
  printf 'observability_evidence_file: %s\n' "$OBS_EVIDENCE_FILE"
fi
