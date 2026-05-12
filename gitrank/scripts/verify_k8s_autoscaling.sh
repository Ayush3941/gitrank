#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
BASE_DIR="$REPO_ROOT/deployments/k8s/base"
HPA_FILE="$BASE_DIR/hpa.yaml"
KUSTOMIZATION_FILE="$BASE_DIR/kustomization.yaml"

EXPECTED_DEPLOYMENTS="api-gateway auth-service github-ingestor pr-analyzer profile-service scheduler-worker scheduler-job-worker scoring-engine"

fail() {
  printf 'k8s autoscaling verification failed: %s\n' "$1" >&2
  exit 1
}

[ -f "$HPA_FILE" ] || fail "missing $HPA_FILE"
[ -f "$KUSTOMIZATION_FILE" ] || fail "missing $KUSTOMIZATION_FILE"

grep -Eq '^[[:space:]]*-[[:space:]]*hpa\.yaml[[:space:]]*$' "$KUSTOMIZATION_FILE" || fail "base kustomization does not include hpa.yaml"

EXPECTED_COUNT=0
for deployment in $EXPECTED_DEPLOYMENTS; do
  EXPECTED_COUNT=$((EXPECTED_COUNT + 1))
  if ! awk -v expected="$deployment" '
    BEGIN { RS = "---"; FS = "\n"; found = 0 }
    {
      kind = 0
      metadata_name = ""
      target_name = ""
      in_metadata = 0
      in_scale_target = 0

      for (i = 1; i <= NF; i++) {
        line = $i
        gsub(/\r/, "", line)
        sub(/^[[:space:]]+/, "", line)

        if (line == "kind: HorizontalPodAutoscaler") {
          kind = 1
        }
        if (line == "metadata:") {
          in_metadata = 1
          in_scale_target = 0
          continue
        }
        if (line == "scaleTargetRef:") {
          in_scale_target = 1
          in_metadata = 0
          continue
        }

        if (in_metadata && metadata_name == "" && line ~ /^name:[[:space:]]*/) {
          metadata_name = line
          sub(/^name:[[:space:]]*/, "", metadata_name)
          in_metadata = 0
          continue
        }

        if (in_scale_target && target_name == "" && line ~ /^name:[[:space:]]*/) {
          target_name = line
          sub(/^name:[[:space:]]*/, "", target_name)
          in_scale_target = 0
          continue
        }
      }

      if (kind && metadata_name == expected && target_name == expected) {
        found = 1
      }
    }
    END { exit(found ? 0 : 1) }
  ' "$HPA_FILE"; then
    fail "missing or malformed HPA target for deployment $deployment"
  fi
done

HPA_COUNT=$(awk '
  BEGIN { RS = "---"; count = 0 }
  /kind:[[:space:]]*HorizontalPodAutoscaler/ { count++ }
  END { print count }
' "$HPA_FILE")
[ "$HPA_COUNT" -eq "$EXPECTED_COUNT" ] || fail "expected $EXPECTED_COUNT HPAs but found $HPA_COUNT"

printf 'k8s autoscaling verification passed\n'
printf '%s\n' "- base HPA resources: $HPA_COUNT"
printf '%s\n' "- verified deployment targets: $EXPECTED_DEPLOYMENTS"
