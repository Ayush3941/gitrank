#!/usr/bin/env sh
set -eu

root_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"

fail() {
  printf 'live repo placeholder resolution behavior verification failed: %s\n' "$1" >&2
  exit 1
}

assert_contains() {
  file=$1
  needle=$2
  note=$3
  if ! grep -qF "$needle" "$file"; then
    fail "$note ($file)"
  fi
}

assert_contains "$root_dir/scripts/verify_v2_external_unblock_preflight.sh" 'if is_placeholder_value "${GITHUB_REPOSITORY:-}"; then' "preflight should scrub placeholder repository values"
assert_contains "$root_dir/scripts/audit_v2_contributing_checklist.sh" 'if is_placeholder_value "${GITHUB_REPOSITORY:-}"; then' "audit should scrub placeholder repository values"
assert_contains "$root_dir/scripts/verify_live_v2_inputs.sh" 'case "$GITHUB_REPOSITORY" in' "live input verifier should normalize placeholder repository values"

for script_file in \
  "$root_dir/scripts/verify_live_github_access.sh" \
  "$root_dir/scripts/verify_live_v2_workflow_run.sh" \
  "$root_dir/scripts/verify_public_workflow_health.sh" \
  "$root_dir/scripts/verify_remote_live_v2_workflow_sync.sh" \
  "$root_dir/scripts/verify_github_repository_controls_public.sh" \
  "$root_dir/scripts/sync_remote_live_v2_workflow.sh"; do
  assert_contains "$script_file" 'if is_placeholder_value "$REPOSITORY"; then' "script should scrub placeholder repository values"
done

echo "live repo placeholder resolution behavior verification passed"
