#!/usr/bin/env sh
set -eu

root_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"

OUTPUT_FILE="${OUTPUT_FILE:-}"
DATE_VALUE="${DATE_VALUE:-$(date -u +%F)}"
ENVIRONMENT="${ENVIRONMENT:-}"
CLUSTER="${CLUSTER:-}"
NAMESPACE="${NAMESPACE:-}"
OPERATOR="${OPERATOR:-}"
RESTORE_SOURCE="${RESTORE_SOURCE:-}"
RESTORE_TARGET="${RESTORE_TARGET:-}"
BACKUP_IDENTIFIER="${BACKUP_IDENTIFIER:-}"
RESTORE_START_TIMESTAMP="${RESTORE_START_TIMESTAMP:-}"
RESTORE_COMPLETION_TIMESTAMP="${RESTORE_COMPLETION_TIMESTAMP:-}"
RESTORE_COMMAND_OR_WORKFLOW="${RESTORE_COMMAND_OR_WORKFLOW:-}"
SCHEMA_MIGRATION_STATE="${SCHEMA_MIGRATION_STATE:-}"
CRITICAL_PRODUCT_CHECKS="${CRITICAL_PRODUCT_CHECKS:-}"
OBSERVED_ERRORS="${OBSERVED_ERRORS:-none observed}"
FOLLOW_UP_ACTIONS="${FOLLOW_UP_ACTIONS:-none}"
DECISION="${DECISION:-pass}"

fail() {
  printf 'generate database restore drill evidence failed: %s\n' "$1" >&2
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
require_non_empty RESTORE_SOURCE "$RESTORE_SOURCE"
require_non_empty RESTORE_TARGET "$RESTORE_TARGET"
require_non_empty BACKUP_IDENTIFIER "$BACKUP_IDENTIFIER"
require_non_empty RESTORE_START_TIMESTAMP "$RESTORE_START_TIMESTAMP"
require_non_empty RESTORE_COMPLETION_TIMESTAMP "$RESTORE_COMPLETION_TIMESTAMP"
require_non_empty RESTORE_COMMAND_OR_WORKFLOW "$RESTORE_COMMAND_OR_WORKFLOW"
require_non_empty SCHEMA_MIGRATION_STATE "$SCHEMA_MIGRATION_STATE"
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
Restore source: $RESTORE_SOURCE
Restore target: $RESTORE_TARGET
Backup identifier: $BACKUP_IDENTIFIER
Restore start timestamp: $RESTORE_START_TIMESTAMP
Restore completion timestamp: $RESTORE_COMPLETION_TIMESTAMP
Restore command or workflow: $RESTORE_COMMAND_OR_WORKFLOW
Schema migration state after restore: $SCHEMA_MIGRATION_STATE
Critical product checks: $CRITICAL_PRODUCT_CHECKS
Observed errors: $OBSERVED_ERRORS
Follow-up actions: $FOLLOW_UP_ACTIONS
Decision: $DECISION
EOF

"$root_dir/scripts/verify_database_restore_drill_record.sh" "$OUTPUT_FILE"

printf 'database restore drill evidence file generated\n'
printf 'output_file: %s\n' "$OUTPUT_FILE"
