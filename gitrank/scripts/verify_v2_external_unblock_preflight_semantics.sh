#!/usr/bin/env sh
set -eu

root_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
tmp_root="${TMPDIR:-$root_dir/.tmp}"
mkdir -p "$tmp_root"

fail() {
  printf 'v2 external unblock preflight semantics verification failed: %s\n' "$1" >&2
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

stub_dir=$(mktemp -d "$tmp_root/gitrank-v2-preflight-semantics.XXXXXX")
no_token_output="$stub_dir/no-token.out"
token_output="$stub_dir/token-invalid.out"
trap 'rm -rf "$stub_dir"' EXIT

cat >"$stub_dir/report_live_v2_env_presence.sh" <<'EOF'
#!/usr/bin/env sh
set -eu
scenario="${STUB_SCENARIO:-no-token}"
if [ "$scenario" = "token-invalid" ]; then
  cat <<'OUT'
derived.auth_mode=token
derived.has_app_bootstrap=false
derived.workflow_sync_credential_readiness=token-present
derived.origin_push_access_readiness=unavailable
derived.workflow_sync_execution_path=token-or-app
OUT
else
  cat <<'OUT'
derived.auth_mode=none
derived.has_app_bootstrap=false
derived.workflow_sync_credential_readiness=unavailable
derived.origin_push_access_readiness=unavailable
derived.workflow_sync_execution_path=unavailable
OUT
fi
EOF

cat >"$stub_dir/verify_live_github_access.sh" <<'EOF'
#!/usr/bin/env sh
set -eu
scenario="${STUB_SCENARIO:-no-token}"
if [ "$scenario" = "token-invalid" ]; then
  printf 'live github access verification failed: repository metadata denied: token invalid or expired (HTTP 401)\n' >&2
else
  printf 'live github access verification failed: GITHUB_TOKEN, GH_TOKEN, or GITRANK_REPO_ADMIN_TOKEN is required (or set GitHub App credentials)\n' >&2
fi
exit 1
EOF

cat >"$stub_dir/verify_origin_push_access.sh" <<'EOF'
#!/usr/bin/env sh
set -eu
printf "origin push access verification failed: missing HTTPS git credentials for remote 'origin'; configure a credential helper or PAT-backed remote and retry\n" >&2
exit 1
EOF

cat >"$stub_dir/verify_remote_live_v2_workflow_sync.sh" <<'EOF'
#!/usr/bin/env sh
set -eu
printf 'verify remote live-v2 workflow sync failed: remote workflow content drift detected\n' >&2
exit 1
EOF

cat >"$stub_dir/verify_github_repository_controls_public.sh" <<'EOF'
#!/usr/bin/env sh
set -eu
printf 'github repository controls public verification failed: default branch is neither protected nor covered by branch rulesets\n' >&2
exit 1
EOF

cat >"$stub_dir/verify_live_v2_inputs.sh" <<'EOF'
#!/usr/bin/env sh
set -eu
printf 'verify live v2 inputs failed: missing PROMETHEUS_BASE_URL\n' >&2
exit 1
EOF

cat >"$stub_dir/verify_live_v2_workflow_run.sh" <<'EOF'
#!/usr/bin/env sh
set -eu
printf "live v2 workflow run verification failed: no successful 'Verify Live V2 Gates' workflow run found\n" >&2
exit 1
EOF

chmod +x \
  "$stub_dir/report_live_v2_env_presence.sh" \
  "$stub_dir/verify_live_github_access.sh" \
  "$stub_dir/verify_origin_push_access.sh" \
  "$stub_dir/verify_remote_live_v2_workflow_sync.sh" \
  "$stub_dir/verify_github_repository_controls_public.sh" \
  "$stub_dir/verify_live_v2_inputs.sh" \
  "$stub_dir/verify_live_v2_workflow_run.sh"

run_preflight() {
  scenario=$1
  token_value=$2
  output_file=$3
  if (
    cd "$root_dir" &&
    STUB_SCENARIO="$scenario" \
    GITHUB_REPOSITORY="acme/demo" \
    GITHUB_TOKEN="$token_value" \
    GH_TOKEN= \
    GITRANK_REPO_ADMIN_TOKEN= \
    GITHUB_CLIENT_ID=replace-me-oauth-client-id \
    GITHUB_CLIENT_SECRET=replace-me-oauth-client-secret \
    PROMETHEUS_BASE_URL= \
    GRAFANA_BASE_URL= \
    GRAFANA_API_TOKEN= \
    REPORT_LIVE_V2_ENV_PRESENCE_SCRIPT="$stub_dir/report_live_v2_env_presence.sh" \
    VERIFY_LIVE_GITHUB_ACCESS_SCRIPT="$stub_dir/verify_live_github_access.sh" \
    VERIFY_ORIGIN_PUSH_ACCESS_SCRIPT="$stub_dir/verify_origin_push_access.sh" \
    VERIFY_REMOTE_LIVE_V2_WORKFLOW_SYNC_SCRIPT="$stub_dir/verify_remote_live_v2_workflow_sync.sh" \
    VERIFY_GITHUB_REPOSITORY_CONTROLS_PUBLIC_SCRIPT="$stub_dir/verify_github_repository_controls_public.sh" \
    VERIFY_LIVE_V2_INPUTS_SCRIPT="$stub_dir/verify_live_v2_inputs.sh" \
    VERIFY_LIVE_V2_WORKFLOW_RUN_SCRIPT="$stub_dir/verify_live_v2_workflow_run.sh" \
    ./scripts/verify_v2_external_unblock_preflight.sh
  ) >"$output_file" 2>&1; then
    fail "scenario '$scenario' unexpectedly passed"
  fi
}

run_preflight no-token "" "$no_token_output"
assert_contains "$no_token_output" "input_state.origin_push_required: true" "no-token scenario should require origin push path"
assert_contains "$no_token_output" "probe.github_access_effective_status: credential-missing" "no-token scenario should classify missing credentials"
assert_contains "$no_token_output" "probe.origin_push_effective_status: required" "no-token scenario should classify origin push as required"
assert_contains "$no_token_output" "probes[github_access, origin_push, remote_workflow_sync, controls_public, workflow_evidence]" "no-token mapping should require origin push probe"
assert_contains "$no_token_output" "working origin push auth OR GitHub token/App creds for sync/apply paths" "no-token remediation should include origin-push alternative"

run_preflight token-invalid "unit-test-token" "$token_output"
assert_contains "$token_output" "input_state.origin_push_required: false" "token scenario should mark origin push as optional"
assert_contains "$token_output" "probe.github_access_effective_status: credential-invalid" "token scenario should classify invalid credentials"
assert_contains "$token_output" "probe.origin_push_effective_status: advisory" "token scenario should classify origin push as advisory"
assert_contains "$token_output" "workflow_evidence (+ advisory origin_push)" "token scenario should map origin push as advisory in checklist mapping"
assert_contains "$token_output" "GITRANK_REPO_ADMIN_TOKEN (or GITHUB_TOKEN/GH_TOKEN)" "token scenario should still request credential refresh when token is invalid"
assert_not_contains "$token_output" "working origin push auth OR GitHub token/App creds for sync/apply paths" "token scenario should not include origin-push credential hint"

printf 'v2 external unblock preflight semantics verification passed\n'
