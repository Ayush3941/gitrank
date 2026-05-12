#!/usr/bin/env sh
set -eu

root_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
repo_dir="$(CDPATH= cd -- "$root_dir/.." && pwd)"
workflow="$repo_dir/.github/workflows/deploy-k8s.yml"
k8s_readme="$root_dir/deployments/k8s/README.md"
tmp_dir="${TMPDIR:-$root_dir/.tmp}"
mkdir -p "$tmp_dir"

command -v kubectl >/dev/null 2>&1 || {
	echo "kubectl is required to verify Kubernetes rollback manifests" >&2
	exit 1
}

for overlay in staging production; do
	rendered="$(TMPDIR="$tmp_dir" mktemp)"
	kubectl kustomize "$root_dir/deployments/k8s/overlays/$overlay" >"$rendered"
	test -s "$rendered"
	grep -q "kind: Deployment" "$rendered"
	grep -q "kind: Job" "$rendered"
	rm -f "$rendered"
done

grep -q "rollback:" "$workflow"
grep -q "rollback_revision:" "$workflow"
grep -q "kubectl rollout history" "$workflow"
grep -q "kubectl rollout undo" "$workflow"
grep -q "kubectl rollout status" "$workflow"

for deployment in api-gateway auth-service github-ingestor pr-analyzer profile-service scoring-engine scheduler-worker scheduler-job-worker; do
	grep -q "$deployment" "$workflow"
done

grep -qi "Rollback" "$k8s_readme"
grep -q "KUBE_CONFIG_B64" "$k8s_readme"
grep -q "rollback_revision" "$k8s_readme"

echo "rollback procedure verification passed"
