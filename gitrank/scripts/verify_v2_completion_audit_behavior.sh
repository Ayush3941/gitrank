#!/usr/bin/env sh
set -eu

root_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
tmp_root="${TMPDIR:-$root_dir/.tmp}"
mkdir -p "$tmp_root"

fail() {
  printf 'v2 completion audit behavior verification failed: %s\n' "$1" >&2
  exit 1
}

assert_contains() {
  file=$1
  pattern=$2
  context=$3
  if ! rg -q --fixed-strings -- "$pattern" "$file"; then
    fail "$context (missing pattern: $pattern)"
  fi
}

assert_not_contains() {
  file=$1
  pattern=$2
  context=$3
  if rg -q --fixed-strings -- "$pattern" "$file"; then
    fail "$context (unexpected pattern: $pattern)"
  fi
}

tmp_prefix="$tmp_root/v2-completion-audit-behavior.$$"
default_report="$tmp_prefix.default.md"
custom_report="$tmp_prefix.custom.md"
default_stdout="$tmp_prefix.default.stdout"
default_stderr="$tmp_prefix.default.stderr"
custom_stdout="$tmp_prefix.custom.stdout"
custom_stderr="$tmp_prefix.custom.stderr"
rm -f "$default_report" "$custom_report" "$default_stdout" "$default_stderr" "$custom_stdout" "$custom_stderr"
trap 'rm -f "$default_report" "$custom_report" "$default_stdout" "$default_stderr" "$custom_stdout" "$custom_stderr"' EXIT

if ! (
  cd "$root_dir" &&
  LIVE_V2_ENV_FILE= \
  FINALIZE_V2_ENV_FILE= \
  GITHUB_TOKEN= \
  GH_TOKEN= \
  GITRANK_REPO_ADMIN_TOKEN= \
  GITHUB_REPOSITORY_DISPLAY= \
  GITHUB_APP_ID= \
  GITRANK_GITHUB_APP_ID= \
  GITHUB_APP_INSTALLATION_ID= \
  GITRANK_GITHUB_APP_INSTALLATION_ID= \
  GITHUB_APP_PRIVATE_KEY_FILE= \
  GITRANK_GITHUB_APP_PRIVATE_KEY_FILE= \
  GITHUB_APP_PRIVATE_KEY_PEM= \
  GITRANK_GITHUB_APP_PRIVATE_KEY_PEM= \
  RUN_CHECKS=false \
  CHECK_PUBLIC_WORKFLOW_HEALTH=auto \
  OUTPUT_FILE="$default_report" \
  GITHUB_REPOSITORY="example/private-repo" \
  ./scripts/generate_v2_completion_audit.sh
) >"$default_stdout" 2>"$default_stderr"; then
  fail "default completion-audit generation failed"
fi

[ -s "$default_report" ] || fail "default completion-audit report was not created"
assert_contains "$default_report" "- Repository: \`OWNER/REPO\`" "default display repository should be redacted"
assert_contains "$default_report" "### Probe Waivers" "probe waiver section should exist"
assert_contains "$default_report" "- Public workflow health mode: \`false\` (configured: \`auto\`)" "default run should resolve public workflow probe mode from auth context"
assert_contains "$default_report" "- public workflow health waiver: \`auto-disabled: no GitHub token/App credentials\`" "default run should record auto waiver for public workflow health when auth is missing"
assert_contains "$default_report" "## External Unblock Preflight (make verify-v2-external-unblock-preflight)" "default run should include external unblock preflight section"
assert_contains "$default_report" "- External unblock preflight exit code: \`skip\`" "default run should mark external unblock preflight as skipped when RUN_CHECKS=false"
assert_contains "$default_report" "Current audit verdict: **objective not complete**." "default run should not mark completion"
assert_contains "$default_stderr" "missing waiver for skipped probe" "default skipped probes should require waivers"

if ! (
  cd "$root_dir" &&
  LIVE_V2_ENV_FILE= \
  FINALIZE_V2_ENV_FILE= \
  RUN_CHECKS=false \
  OUTPUT_FILE="$custom_report" \
  GITHUB_REPOSITORY="example/private-repo" \
  GITHUB_REPOSITORY_DISPLAY="public/demo-repo" \
  WAIVE_RUN_CHECKS="offline dry run" \
  WAIVE_PUBLIC_WORKFLOW_HEALTH="no live token in local CI sandbox" \
  WAIVE_REMOTE_LIVE_WORKFLOW_SYNC="no live token in local CI sandbox" \
  WAIVE_LIVE_GITHUB_ACCESS_PREFLIGHT="no live token in local CI sandbox" \
  WAIVE_PUBLIC_GITHUB_CONTROLS_PRECHECK="no live token in local CI sandbox" \
  WAIVE_WORKFLOW_EVIDENCE_PROBE="no live workflow run in local CI sandbox" \
  ./scripts/generate_v2_completion_audit.sh
) >"$custom_stdout" 2>"$custom_stderr"; then
  fail "custom completion-audit generation with waivers failed"
fi

[ -s "$custom_report" ] || fail "custom completion-audit report was not created"
assert_contains "$custom_report" "- Repository: \`public/demo-repo\`" "custom display repository should be rendered"
assert_not_contains "$custom_report" "- Repository: \`OWNER/REPO\`" "custom display repository should replace default placeholder"
assert_contains "$custom_report" "- run_checks waiver: \`offline dry run\`" "run_checks waiver should be recorded"
assert_contains "$custom_report" "- public workflow health waiver: \`no live token in local CI sandbox\`" "public workflow waiver should be recorded"
assert_contains "$custom_report" "- live github access preflight waiver: \`no live token in local CI sandbox\`" "live github waiver should be recorded"
assert_contains "$custom_report" "- External unblock preflight exit code: \`skip\`" "waived run should mark external unblock preflight as skipped"
assert_contains "$custom_report" "Current audit verdict: **objective not complete**." "waived run should still not mark completion"

if rg -q --fixed-strings -- "missing waiver for skipped probe" "$custom_stderr"; then
  fail "waived run should not emit missing-waiver warnings"
fi

printf 'v2 completion audit behavior verification passed\n'
