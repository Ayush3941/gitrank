#!/usr/bin/env sh
set -eu

root_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
repo_dir="$(CDPATH= cd -- "$root_dir/.." && pwd)"
workflow="$repo_dir/.github/workflows/verify-live-v2-gates.yml"

fail() {
  printf 'live v2 workflow verification failed: %s\n' "$1" >&2
  exit 1
}

[ -s "$workflow" ] || fail "workflow file missing: $workflow"

for required in "run_observability" "run_github_controls" "run_release_render" "make verify-github-repository-controls" "make verify-live-observability" "make render-k8s-release-manifests" "actions/upload-artifact@v4"; do
  grep -q "$required" "$workflow" || fail "missing workflow content: $required"
done

for key in K8S_PUBLIC_BASE_URL K8S_API_BASE_URL K8S_AUTH_COOKIE_DOMAIN K8S_GITHUB_OAUTH_REDIRECT_URL K8S_API_HOST K8S_AUTH_HOST K8S_TLS_SECRET_NAME; do
  grep -q "$key" "$workflow" || fail "missing runtime override key in workflow: $key"
done

grep -q "GITRANK_REPO_ADMIN_TOKEN" "$workflow" || fail "missing repository-controls token binding"
grep -q "GRAFANA_API_TOKEN" "$workflow" || fail "missing Grafana API token binding"
grep -q "PROMETHEUS_BASE_URL" "$workflow" || fail "missing Prometheus base URL binding"
grep -q "GRAFANA_BASE_URL" "$workflow" || fail "missing Grafana base URL binding"

echo "live v2 workflow verification passed"
