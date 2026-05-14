#!/usr/bin/env sh
set -eu

root_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
repo_dir="$(CDPATH= cd -- "$root_dir/.." && pwd)"
tmp_root="${TMPDIR:-$root_dir/.tmp}"
mkdir -p "$tmp_root"

fail() {
  printf 'v2 artifact redaction verification failed: %s\n' "$1" >&2
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
  if [ -n "$pattern" ] && rg -q --fixed-strings -- "$pattern" "$file"; then
    fail "$context (unexpected pattern: $pattern)"
  fi
}

resolve_repository_from_git_remote() {
  remote_url=$(git -C "$repo_dir" config --get remote.origin.url 2>/dev/null || true)
  [ -n "$remote_url" ] || return 0
  case "$remote_url" in
    https://github.com/*) inferred_repo=${remote_url#https://github.com/} ;;
    git@github.com:*) inferred_repo=${remote_url#git@github.com:} ;;
    *) inferred_repo= ;;
  esac
  inferred_repo=${inferred_repo%.git}
  printf '%s' "$inferred_repo"
}

real_repo=$(resolve_repository_from_git_remote || true)

audit_report="$tmp_root/v2-redaction-audit.$$.md"
closeout_report="$tmp_root/v2-redaction-closeout.$$.md"
completion_report="$tmp_root/v2-redaction-completion.$$.md"
completion_report_custom="$tmp_root/v2-redaction-completion-custom.$$.md"
rm -f "$audit_report" "$closeout_report" "$completion_report" "$completion_report_custom"

if (
  cd "$root_dir" &&
  RUN_BASELINE_VERIFIERS=false \
  RUN_PUBLIC_PROBE=false \
  AUDIT_REPORT_FILE="$audit_report" \
  ./scripts/audit_v2_contributing_checklist.sh >/dev/null 2>&1
); then
  :
else
  audit_code=$?
  case "$audit_code" in
    1|2)
      # unresolved live-gate items are expected in local/offline mode
      ;;
    *)
      fail "audit_v2_contributing_checklist.sh exited with unexpected code: $audit_code"
      ;;
  esac
fi

[ -s "$audit_report" ] || fail "audit report file was not created"
assert_contains "$audit_report" "- repository: OWNER/REPO" "audit report should redact repository label by default"
assert_contains "$audit_report" "- probe skipped: RUN_PUBLIC_PROBE=false" "audit report should honor local probe skip toggle"
assert_not_contains "$audit_report" "$real_repo" "audit report should not leak concrete repository"

if ! (
  cd "$root_dir" &&
  OUTPUT_FILE="$closeout_report" \
  CHECK_LOCAL_READINESS=false \
  CHECK_PUBLIC_GITHUB_CONTROLS=false \
  CHECK_PUBLIC_WORKFLOW_HEALTH=false \
  CHECK_REMOTE_LIVE_WORKFLOW_SYNC=false \
  CHECK_WORKFLOW_EVIDENCE=false \
  CHECK_LIVE_GITHUB_ACCESS=false \
  ./scripts/generate_v2_live_closeout_status.sh >/dev/null 2>&1
); then
  fail "generate_v2_live_closeout_status.sh failed"
fi

[ -s "$closeout_report" ] || fail "closeout status report file was not created"
assert_contains "$closeout_report" "- Repository: \`OWNER/REPO\`" "closeout report should redact repository label by default"
assert_not_contains "$closeout_report" "$real_repo" "closeout report should not leak concrete repository"

if ! (
  cd "$root_dir" &&
  RUN_CHECKS=false \
  OUTPUT_FILE="$completion_report" \
  ./scripts/generate_v2_completion_audit.sh >/dev/null 2>&1
); then
  fail "generate_v2_completion_audit.sh failed"
fi

[ -s "$completion_report" ] || fail "completion audit report file was not created"
assert_contains "$completion_report" "- Repository: \`OWNER/REPO\`" "completion audit should redact repository label by default"
assert_not_contains "$completion_report" "$real_repo" "completion audit should not leak concrete repository"

if ! (
  cd "$root_dir" &&
  RUN_CHECKS=false \
  GITHUB_REPOSITORY_DISPLAY="public/demo-repo" \
  OUTPUT_FILE="$completion_report_custom" \
  ./scripts/generate_v2_completion_audit.sh >/dev/null 2>&1
); then
  fail "generate_v2_completion_audit.sh custom display run failed"
fi

[ -s "$completion_report_custom" ] || fail "custom completion audit report file was not created"
assert_contains "$completion_report_custom" "- Repository: \`public/demo-repo\`" "custom display repository should be rendered"
assert_not_contains "$completion_report_custom" "- Repository: \`OWNER/REPO\`" "custom display repository should replace default placeholder"

printf 'v2 artifact redaction verification passed\n'
