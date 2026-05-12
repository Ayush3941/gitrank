#!/usr/bin/env sh
set -eu

root_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
repo_dir="$(CDPATH= cd -- "$root_dir/.." && pwd)"
tmp_root="${TMPDIR:-$root_dir/.tmp}"
mkdir -p "$tmp_root"

OUTPUT_FILE="${OUTPUT_FILE:-$root_dir/docs/releases/v2-live-closeout-status-latest.md}"
CHECK_PUBLIC_GITHUB_CONTROLS="${CHECK_PUBLIC_GITHUB_CONTROLS:-true}"
CHECK_WORKFLOW_EVIDENCE="${CHECK_WORKFLOW_EVIDENCE:-true}"
WORKFLOW_RUN_ID="${WORKFLOW_RUN_ID:-latest}"
WORKFLOW_EVENT="${WORKFLOW_EVENT:-workflow_dispatch}"

fail() {
  printf 'generate v2 live closeout status failed: %s\n' "$1" >&2
  exit 1
}

resolve_repository_from_git_remote() {
  if [ -n "${GITHUB_REPOSITORY:-}" ]; then
    printf '%s' "$GITHUB_REPOSITORY"
    return 0
  fi
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

append_section() {
  title=$1
  exit_code=$2
  output_file=$3
  {
    printf '## %s\n\n' "$title"
    printf '%s\n\n' "- Exit code: \`$exit_code\`"
    printf '```text\n'
    sed -n '1,220p' "$output_file"
    printf '```\n\n'
  } >>"$OUTPUT_FILE"
}

run_and_capture() {
  title=$1
  shift
  out_file="$tmp_root/v2-closeout-status.$$.txt"
  if "$@" >"$out_file" 2>&1; then
    code=0
  else
    code=$?
  fi
  append_section "$title" "$code" "$out_file"
  rm -f "$out_file"
}

gitrank_repo=$(resolve_repository_from_git_remote || true)

mkdir -p "$(dirname "$OUTPUT_FILE")"

{
  printf '# V2 Live Closeout Status\n\n'
  printf '%s\n' "- Generated at (UTC): \`$(date -u +%Y-%m-%dT%H:%M:%SZ)\`"
  printf '%s\n' "- Repository: \`${gitrank_repo:-unset}\`"
  printf '%s\n' "- Workdir: \`$root_dir\`"
  printf '\n'
} >"$OUTPUT_FILE"

run_and_capture "Local Readiness Gate" \
  sh -c "cd '$root_dir' && make verify-v2-live-readiness"

audit_report_tmp="${AUDIT_REPORT_FILE:-$tmp_root/v2-closeout-status-audit.$$.md}"
run_and_capture "Contributing Checklist Audit" \
  sh -c "cd '$root_dir' && RUN_BASELINE_VERIFIERS=false AUDIT_REPORT_FILE='$audit_report_tmp' make audit-v2-contributing-checklist"

if [ -s "$audit_report_tmp" ]; then
  {
    printf '## Checklist Audit Artifact\n\n'
    printf '%s\n\n' "- File: \`$audit_report_tmp\`"
    printf '```markdown\n'
    sed -n '1,260p' "$audit_report_tmp"
    printf '```\n\n'
  } >>"$OUTPUT_FILE"
fi

run_and_capture "Essential Live Env Presence" \
  sh -c '
for v in GITHUB_REPOSITORY GITRANK_REPO_ADMIN_TOKEN GITHUB_TOKEN GH_TOKEN PROMETHEUS_BASE_URL GRAFANA_BASE_URL GRAFANA_API_TOKEN OBS_EVIDENCE_FILE ROLLBACK_EVIDENCE_FILE RESTORE_EVIDENCE_FILE IMAGE_TAG IMAGE_REGISTRY_OWNER; do
  eval val="\${$v-}"
  if [ -n "$val" ]; then
    echo "$v=set"
  else
    echo "$v=unset"
  fi
done
'

if [ "$CHECK_PUBLIC_GITHUB_CONTROLS" = "true" ]; then
  run_and_capture "Public GitHub Controls Precheck" \
    sh -c "cd '$root_dir' && GITHUB_REPOSITORY='${gitrank_repo:-}' make verify-github-repository-controls-public"
fi

if [ "$CHECK_WORKFLOW_EVIDENCE" = "true" ]; then
  run_and_capture "Latest Workflow Evidence Probe" \
    sh -c "cd '$root_dir' && GITHUB_REPOSITORY='${gitrank_repo:-}' WORKFLOW_RUN_ID='$WORKFLOW_RUN_ID' WORKFLOW_EVENT='$WORKFLOW_EVENT' REQUIRE_GITHUB_CONTROLS=true REQUIRE_OBSERVABILITY=true REQUIRE_RELEASE_RENDER=true make verify-live-v2-workflow-run"
fi

printf 'v2 live closeout status report generated\n'
printf 'report: %s\n' "$OUTPUT_FILE"
