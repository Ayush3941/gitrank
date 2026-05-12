#!/usr/bin/env sh
set -eu

root_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"

OUTPUT_FILE="${OUTPUT_FILE:-}"
DATE_VALUE="${DATE_VALUE:-$(date -u +%F)}"
ENVIRONMENT="${ENVIRONMENT:-}"
CLUSTER="${CLUSTER:-}"
NAMESPACE="${NAMESPACE:-}"
OPERATOR="${OPERATOR:-}"
STARTING_COMMIT="${STARTING_COMMIT:-}"
CANDIDATE_COMMIT="${CANDIDATE_COMMIT:-}"
ROLLBACK_TARGET_REVISION="${ROLLBACK_TARGET_REVISION:-}"
DATABASE_BACKUP_MARKER="${DATABASE_BACKUP_MARKER:-}"
WORKFLOW_RUN_URL="${WORKFLOW_RUN_URL:-}"
ROLLOUT_HISTORY_CAPTURED="${ROLLOUT_HISTORY_CAPTURED:-}"
ROLLBACK_MODE="${ROLLBACK_MODE:-}"
ROLLOUT_STATUS_RESULTS="${ROLLOUT_STATUS_RESULTS:-}"
CRITICAL_PRODUCT_CHECKS="${CRITICAL_PRODUCT_CHECKS:-}"
OBSERVED_ERRORS="${OBSERVED_ERRORS:-none observed}"
FOLLOW_UP_ACTIONS="${FOLLOW_UP_ACTIONS:-none}"
DECISION="${DECISION:-pass}"

fail() {
  printf 'generate rollback drill evidence failed: %s\n' "$1" >&2
  exit 1
}

require_non_empty() {
  name=$1
  value=$2
  [ -n "$value" ] || fail "$name is required"
}

require_non_empty OUTPUT_FILE "$OUTPUT_FILE"
require_non_empty ENVIRONMENT "$ENVIRONMENT"
require_non_empty CLUSTER "$CLUSTER"
require_non_empty NAMESPACE "$NAMESPACE"
require_non_empty OPERATOR "$OPERATOR"
require_non_empty STARTING_COMMIT "$STARTING_COMMIT"
require_non_empty CANDIDATE_COMMIT "$CANDIDATE_COMMIT"
require_non_empty ROLLBACK_TARGET_REVISION "$ROLLBACK_TARGET_REVISION"
require_non_empty DATABASE_BACKUP_MARKER "$DATABASE_BACKUP_MARKER"
require_non_empty WORKFLOW_RUN_URL "$WORKFLOW_RUN_URL"
require_non_empty ROLLOUT_HISTORY_CAPTURED "$ROLLOUT_HISTORY_CAPTURED"
require_non_empty ROLLBACK_MODE "$ROLLBACK_MODE"
require_non_empty ROLLOUT_STATUS_RESULTS "$ROLLOUT_STATUS_RESULTS"
require_non_empty CRITICAL_PRODUCT_CHECKS "$CRITICAL_PRODUCT_CHECKS"
require_non_empty OBSERVED_ERRORS "$OBSERVED_ERRORS"
require_non_empty FOLLOW_UP_ACTIONS "$FOLLOW_UP_ACTIONS"
require_non_empty DECISION "$DECISION"

mkdir -p "$(dirname "$OUTPUT_FILE")"

cat >"$OUTPUT_FILE" <<EOF
Date: $DATE_VALUE
Environment: $ENVIRONMENT
Cluster: $CLUSTER
Namespace: $NAMESPACE
Operator: $OPERATOR
Starting commit: $STARTING_COMMIT
Candidate commit: $CANDIDATE_COMMIT
Rollback target revision: $ROLLBACK_TARGET_REVISION
Database backup or PITR marker: $DATABASE_BACKUP_MARKER
Workflow run URL: $WORKFLOW_RUN_URL
Rollout history captured: $ROLLOUT_HISTORY_CAPTURED
Rollback command or workflow mode: $ROLLBACK_MODE
Rollout status results: $ROLLOUT_STATUS_RESULTS
Critical product checks: $CRITICAL_PRODUCT_CHECKS
Observed errors: $OBSERVED_ERRORS
Follow-up actions: $FOLLOW_UP_ACTIONS
Decision: $DECISION
EOF

"$root_dir/scripts/verify_rollback_drill_record.sh" "$OUTPUT_FILE"

printf 'rollback drill evidence file generated\n'
printf 'output_file: %s\n' "$OUTPUT_FILE"
