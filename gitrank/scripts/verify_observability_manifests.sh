#!/usr/bin/env sh
set -eu

root_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
tmp_dir="${TMPDIR:-$root_dir/.tmp}"
mkdir -p "$tmp_dir"
rendered="$(TMPDIR="$tmp_dir" mktemp)"
trap 'rm -f "$rendered"' EXIT

command -v kubectl >/dev/null 2>&1 || {
	echo "kubectl is required to verify observability manifests" >&2
	exit 1
}

kubectl kustomize "$root_dir/deployments/observability" >"$rendered"
test -s "$rendered"

for name in gitrank-prometheus gitrank-grafana gitrank-prometheus-config gitrank-prometheus-rules gitrank-grafana-dashboards; do
	grep -q "name: $name" "$rendered"
done

grep -q "kind: Deployment" "$rendered"
grep -q "kind: Service" "$rendered"
grep -q "kind: RoleBinding" "$rendered"
grep -q "gitrank-overview-dashboard.json" "$rendered"
grep -q "gitrank-slo-dashboard.json" "$rendered"
grep -q "GitRankSyncBacklogHigh" "$rendered"

echo "observability manifest verification passed"
