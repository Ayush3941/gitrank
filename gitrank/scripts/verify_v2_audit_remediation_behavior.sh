#!/usr/bin/env sh
set -eu

root_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
tmp_root="${TMPDIR:-$root_dir/.tmp}"
mkdir -p "$tmp_root"

fail() {
  printf 'v2 audit remediation behavior verification failed: %s\n' "$1" >&2
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

tmp_prefix="$tmp_root/v2-audit-remediation-behavior.$$"
default_stdout="$tmp_prefix.default.stdout"
default_stderr="$tmp_prefix.default.stderr"
token_stdout="$tmp_prefix.token.stdout"
token_stderr="$tmp_prefix.token.stderr"
rm -f "$default_stdout" "$default_stderr" "$token_stdout" "$token_stderr"
trap 'rm -f "$default_stdout" "$default_stderr" "$token_stdout" "$token_stderr"' EXIT

if (
  cd "$root_dir" &&
  RUN_BASELINE_VERIFIERS=false \
  RUN_PUBLIC_PROBE=false \
  RUN_EXTERNAL_UNBLOCK_PREFLIGHT_SNAPSHOT=false \
  LIVE_V2_ENV_FILE= \
  FINALIZE_V2_ENV_FILE= \
  GITHUB_TOKEN= \
  GH_TOKEN= \
  GITRANK_REPO_ADMIN_TOKEN= \
  ./scripts/audit_v2_contributing_checklist.sh
) >"$default_stdout" 2>"$default_stderr"; then
  fail "default audit run unexpectedly succeeded"
fi

assert_contains "$default_stdout" "v2 contributing audit summary" "default audit output should render summary"
assert_contains "$default_stdout" "run make verify-origin-push-access + make verify-live-github-access (token/App preflight)" "default remediation should require origin push when no token/App auth exists"
assert_not_contains "$default_stdout" "origin push auth is advisory when token/App auth path is active" "default remediation should not use token-first advisory wording"

if (
  cd "$root_dir" &&
  RUN_BASELINE_VERIFIERS=false \
  RUN_PUBLIC_PROBE=false \
  RUN_EXTERNAL_UNBLOCK_PREFLIGHT_SNAPSHOT=false \
  LIVE_V2_ENV_FILE= \
  FINALIZE_V2_ENV_FILE= \
  GITHUB_TOKEN=unit-test-token \
  GH_TOKEN= \
  GITRANK_REPO_ADMIN_TOKEN= \
  ./scripts/audit_v2_contributing_checklist.sh
) >"$token_stdout" 2>"$token_stderr"; then
  fail "token-mode audit run unexpectedly succeeded"
fi

assert_contains "$token_stdout" "v2 contributing audit summary" "token-mode audit output should render summary"
assert_contains "$token_stdout" "origin push auth is advisory when token/App auth path is active" "token-mode remediation should switch to token-first advisory wording"
assert_not_contains "$token_stdout" "run make verify-origin-push-access + make verify-live-github-access (token/App preflight)" "token-mode remediation should not require origin push by default"

printf 'v2 audit remediation behavior verification passed\n'
