#!/usr/bin/env sh
set -eu

root_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
script="$root_dir/scripts/verify_v2_external_unblock_preflight.sh"

fail() {
  printf 'v2 external unblock preflight behavior verification failed: %s\n' "$1" >&2
  exit 1
}

[ -s "$script" ] || fail "script missing: $script"

for required in \
  'state_for_value() {' \
  'append_unique_csv() {' \
  'input_state.repository:' \
  'input_state.github_token_or_admin_token:' \
  'input_state.prometheus_base_url:' \
  'input_state.grafana_base_url:' \
  'input_state.grafana_api_token:' \
  'input_state.origin_push_required:' \
  'origin_push_required_state=false' \
  '[ "$origin_push_status" = "fail" ] && [ "$origin_push_required_state" = "true" ]' \
  'checklist_probe_mapping' \
  'line.%s => probes[%s] :: %s' \
  'Minimal required next inputs:' \
  'GITRANK_REPO_ADMIN_TOKEN (or GITHUB_TOKEN/GH_TOKEN)' \
  'GITHUB_APP_ID + GITHUB_APP_INSTALLATION_ID + GITHUB_APP_PRIVATE_KEY_FILE/PEM' \
  'PROMETHEUS_BASE_URL' \
  'GRAFANA_BASE_URL' \
  'GRAFANA_API_TOKEN'; do
  grep -qF "$required" "$script" || fail "missing script content: $required"
done

echo "v2 external unblock preflight behavior verification passed"
