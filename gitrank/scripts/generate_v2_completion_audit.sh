#!/usr/bin/env sh
set -eu

root_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
repo_dir="$(CDPATH= cd -- "$root_dir/.." && pwd)"
contributing_file="$repo_dir/CONTRIBUTING.md"
makefile="$root_dir/Makefile"
tmp_root="${TMPDIR:-$root_dir/.tmp}"
output_file="${OUTPUT_FILE:-$root_dir/docs/releases/v2-completion-audit-latest.md}"
run_checks="${RUN_CHECKS:-true}"
display_repository="${GITHUB_REPOSITORY_DISPLAY:-}"
check_public_workflow_health="${CHECK_PUBLIC_WORKFLOW_HEALTH:-auto}"
check_remote_live_workflow_sync="${CHECK_REMOTE_LIVE_WORKFLOW_SYNC:-true}"
check_public_github_controls="${CHECK_PUBLIC_GITHUB_CONTROLS:-true}"
check_live_github_access="${CHECK_LIVE_GITHUB_ACCESS:-true}"
check_workflow_evidence="${CHECK_WORKFLOW_EVIDENCE:-true}"
checklist_audit_run_public_probe="${CHECKLIST_AUDIT_RUN_PUBLIC_PROBE:-auto}"
workflow_run_id="${WORKFLOW_RUN_ID:-latest}"
workflow_event="${WORKFLOW_EVENT:-workflow_dispatch}"
waive_run_checks="${WAIVE_RUN_CHECKS:-}"
waive_public_workflow_health="${WAIVE_PUBLIC_WORKFLOW_HEALTH:-}"
waive_remote_live_workflow_sync="${WAIVE_REMOTE_LIVE_WORKFLOW_SYNC:-}"
waive_live_github_access_preflight="${WAIVE_LIVE_GITHUB_ACCESS_PREFLIGHT:-}"
waive_public_github_controls_precheck="${WAIVE_PUBLIC_GITHUB_CONTROLS_PRECHECK:-}"
waive_workflow_evidence_probe="${WAIVE_WORKFLOW_EVIDENCE_PROBE:-}"

fail() {
  printf 'generate v2 completion audit failed: %s\n' "$1" >&2
  exit 1
}

resolve_checklist_audit_run_public_probe() {
  resolve_boolean_or_auto_from_github_auth "$checklist_audit_run_public_probe" "CHECKLIST_AUDIT_RUN_PUBLIC_PROBE"
}

resolve_check_public_workflow_health() {
  resolve_boolean_or_auto_from_github_auth "$check_public_workflow_health" "CHECK_PUBLIC_WORKFLOW_HEALTH"
}

is_public_repository_accessible() {
  repository=$1
  [ -n "$repository" ] || return 1
  case "$repository" in
    */*) ;;
    *) return 1 ;;
  esac

  if command -v git >/dev/null 2>&1; then
    if GIT_TERMINAL_PROMPT=0 git ls-remote --exit-code "https://github.com/$repository.git" HEAD >/dev/null 2>&1; then
      return 0
    fi
  fi

  command -v curl >/dev/null 2>&1 || return 1
  command -v jq >/dev/null 2>&1 || return 1

  owner=${repository%%/*}
  repo=${repository#*/}
  api_base="${GITHUB_API_URL:-https://api.github.com}"
  api_timeout_seconds="${GITHUB_API_TIMEOUT_SECONDS:-20}"
  probe_file="$tmp_root/v2-completion-audit-public-repo-probe.$$"
  status_code=$(curl -sS -L -o "$probe_file" -w '%{http_code}' \
    --connect-timeout "$api_timeout_seconds" \
    --max-time "$api_timeout_seconds" \
    -H 'Accept: application/vnd.github+json' \
    "$api_base/repos/$owner/$repo" 2>/dev/null || printf '000')
  if [ "$status_code" != "200" ]; then
    rm -f "$probe_file"
    return 1
  fi
  is_private=$(jq -r '.private // true' "$probe_file" 2>/dev/null || printf 'true')
  rm -f "$probe_file"
  [ "$is_private" = "false" ]
}

resolve_boolean_or_auto_from_github_auth() {
  configured_value=$1
  configured_name=$2
  case "$configured_value" in
    true|false)
      printf '%s' "$configured_value"
      return 0
      ;;
    auto)
      token_candidate="${GITHUB_TOKEN:-${GH_TOKEN:-${GITRANK_REPO_ADMIN_TOKEN:-}}}"
      app_id_candidate="${GITHUB_APP_ID:-${GITRANK_GITHUB_APP_ID:-}}"
      app_installation_candidate="${GITHUB_APP_INSTALLATION_ID:-${GITRANK_GITHUB_APP_INSTALLATION_ID:-}}"
      app_key_file_candidate="${GITHUB_APP_PRIVATE_KEY_FILE:-${GITRANK_GITHUB_APP_PRIVATE_KEY_FILE:-}}"
      app_key_pem_candidate="${GITHUB_APP_PRIVATE_KEY_PEM:-${GITRANK_GITHUB_APP_PRIVATE_KEY_PEM:-}}"
      has_app_bootstrap=false
      if [ -n "$app_id_candidate" ] && [ -n "$app_installation_candidate" ]; then
        if [ -n "$app_key_file_candidate" ] || [ -n "$app_key_pem_candidate" ]; then
          has_app_bootstrap=true
        fi
      fi
      if [ -n "$token_candidate" ] || [ "$has_app_bootstrap" = "true" ]; then
        printf 'true'
      elif is_public_repository_accessible "${resolved_repository:-}"; then
        printf 'true'
      else
        printf 'false'
      fi
      return 0
      ;;
    *)
      fail "$configured_name must be one of: true, false, auto"
      ;;
  esac
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

resolved_repository=$(resolve_repository_from_git_remote || true)
if [ -z "$display_repository" ]; then
  display_repository=OWNER/REPO
fi
check_public_workflow_health_resolved=$(resolve_check_public_workflow_health)
checklist_audit_run_public_probe_resolved=$(resolve_checklist_audit_run_public_probe)
auto_waive_public_workflow_health=
if [ "$check_public_workflow_health" = "auto" ] && [ "$check_public_workflow_health_resolved" = "false" ] && [ -z "$waive_public_workflow_health" ]; then
  auto_waive_public_workflow_health="auto-disabled: no GitHub token/App credentials"
fi

run_capture() {
  title=$1
  cmd=$2
  out="$tmp_root/v2-completion-audit.$$.$title.txt"
  rendered="$out"
  sanitized=
  if sh -c "$cmd" >"$out" 2>&1; then
    code=0
  else
    code=$?
  fi
  if [ -n "$resolved_repository" ] && [ "$resolved_repository" != "$display_repository" ]; then
    sanitized="$tmp_root/v2-completion-audit.$$.$title.sanitized.txt"
    sed \
      -e "s|https://github.com/$resolved_repository|https://github.com/$display_repository|g" \
      -e "s|$resolved_repository|$display_repository|g" \
      "$out" >"$sanitized"
    rendered="$sanitized"
  fi
  {
    printf '## %s\n\n' "$title"
    printf '%s\n\n' "- Exit code: \`$code\`"
    printf '```text\n'
    sed -n '1,260p' "$rendered"
    printf '```\n\n'
  } >>"$output_file"
  if [ -n "$sanitized" ]; then
    rm -f "$sanitized"
  fi
  rm -f "$out"
  RUN_CAPTURE_LAST_CODE=$code
}

mkdir -p "$tmp_root"
mkdir -p "$(dirname "$output_file")"
[ -s "$contributing_file" ] || fail "missing CONTRIBUTING.md at $contributing_file"
[ -s "$makefile" ] || fail "missing Makefile at $makefile"

checklist_items_file="$tmp_root/v2-checklist-items.$$.txt"
unchecked_items_file="$tmp_root/v2-unchecked-items.$$.txt"
backticks_file="$tmp_root/v2-backticks.$$.txt"
paths_file="$tmp_root/v2-path-candidates.$$.txt"
paths_unique_file="$tmp_root/v2-path-candidates-unique.$$.txt"
commands_file="$tmp_root/v2-make-commands.$$.txt"
commands_unique_file="$tmp_root/v2-make-commands-unique.$$.txt"
make_targets_file="$tmp_root/v2-make-targets.$$.txt"

trap 'rm -f "$checklist_items_file" "$unchecked_items_file" "$backticks_file" "$paths_file" "$paths_unique_file" "$commands_file" "$commands_unique_file" "$make_targets_file"' EXIT

rg -n "^- \\[[x ]\\]" "$contributing_file" >"$checklist_items_file" || true
rg -n "^- \\[ \\]" "$contributing_file" >"$unchecked_items_file" || true

total_checklist=$(wc -l <"$checklist_items_file" | tr -d ' ')
unchecked_count=$(wc -l <"$unchecked_items_file" | tr -d ' ')
checked_count=$((total_checklist - unchecked_count))

awk -F'`' 'NF > 1 { for (i = 2; i <= NF; i += 2) printf "%d\t%s\n", NR, $i }' "$contributing_file" >"$backticks_file"

awk -F'\t' '
{
  token=$2
  if (token ~ / /) next
  if (token ~ /^gitrank\// || token ~ /^frontend\// || token ~ /^\.github\// || token ~ /^docs\// || token ~ /^deployments\// || token ~ /^services\// || token ~ /^packages\// || token ~ /^scripts\// || token ~ /^README\.md$/ || token ~ /^CONTRIBUTING\.md$/ || token ~ /^SECURITY\.md$/ || token ~ /^CODEOWNERS$/ || token ~ /^LICENSE$/ || token ~ /^go\.work$/ || token ~ /^dependabot\.yml$/ || token ~ /^[0-9]{4}_[A-Za-z0-9_]+\.sql$/) {
    print $1 "\t" token
  }
}' "$backticks_file" >"$paths_file"

sort -u "$paths_file" >"$paths_unique_file"

awk -F'\t' '$2 ~ /^make / { print $2 }' "$backticks_file" >"$commands_file" || true
sort -u "$commands_file" >"$commands_unique_file"

awk -F':' '/^[a-zA-Z0-9_.-]+:/ { print $1 }' "$makefile" | sort -u >"$make_targets_file"

{
  printf '# V2 Completion Audit Matrix\n\n'
  printf '%s\n' "- Generated at (UTC): \`$(date -u +%Y-%m-%dT%H:%M:%SZ)\`"
  printf '%s\n' "- Repository: \`$display_repository\`"
  printf '%s\n' "- Objective: \`achieve V2 according to CONTRIBUTING.md\`"
  printf '%s\n' "- Contributing source: \`$contributing_file\`"
  printf '%s\n' "- Checklist items found: \`$total_checklist\`"
  printf '%s\n' "- Checked items: \`$checked_count\`"
  printf '%s\n' "- Unchecked items: \`$unchecked_count\`"
  printf '\n'
  printf '## Success Criteria\n\n'
  printf '1. All checklist items in `CONTRIBUTING.md` are checked.\n'
  printf '2. Critical local gates pass (`make verify-v2-live-readiness`).\n'
  printf '3. Public origin workflow health is green (`make verify-public-workflow-health`) unless intentionally waived.\n'
  printf '4. No unresolved checklist items remain in `make audit-v2-contributing-checklist`.\n'
  printf '5. Live-gate preflights and probes are green (or intentionally skipped with explicit waiver):\n'
  printf '   - `make verify-remote-live-v2-workflow-sync`\n'
  printf '   - `make verify-live-github-access`\n'
  printf '   - `make verify-github-repository-controls-public`\n'
  printf '   - `make verify-live-v2-workflow-run`\n'
  printf '6. Explicit file, command, and gate references in `CONTRIBUTING.md` resolve to real artifacts or real commands.\n'
  printf '\n'
  printf '## Prompt-to-Artifact Checklist\n\n'
  printf '### Unchecked Checklist Lines\n\n'
  if [ "$unchecked_count" -eq 0 ]; then
    printf 'All checklist lines are checked.\n\n'
  else
    printf '| Line | Requirement |\n'
    printf '|---|---|\n'
    while IFS= read -r line; do
      [ -n "$line" ] || continue
      line_no=${line%%:*}
      text=${line#*:}
      safe_text=$(printf '%s' "$text" | sed 's/|/\\|/g')
      printf '| %s | %s |\n' "$line_no" "$safe_text"
    done <"$unchecked_items_file"
    printf '\n'
  fi

  printf '### Explicit File References In CONTRIBUTING\n\n'
  printf '| Line | Reference | Exists |\n'
  printf '|---|---|---|\n'
  while IFS="$(printf '\t')" read -r line_no token; do
    [ -n "$token" ] || continue
    exists=no
    if printf '%s' "$token" | rg -q "\\*"; then
      exists=pattern
    elif [ -e "$repo_dir/$token" ] || [ -e "$root_dir/$token" ] || [ -e "$repo_dir/.github/$token" ] || [ -e "$root_dir/deployments/migrations/$token" ]; then
      exists=yes
    fi
    printf '| %s | `%s` | %s |\n' "$line_no" "$token" "$exists"
  done <"$paths_unique_file"
  printf '\n'

  printf '### Explicit `make` Command References In CONTRIBUTING\n\n'
  printf '| Command | Target Present In `gitrank/Makefile` |\n'
  printf '|---|---|\n'
  while IFS= read -r cmd; do
    [ -n "$cmd" ] || continue
    set -- $cmd
    [ "$#" -gt 0 ] || continue
    [ "$1" = "make" ] || continue
    shift
    target=
    while [ "$#" -gt 0 ]; do
      arg=$1
      shift
      case "$arg" in
        *=*) continue ;;
        -C|-f|-j)
          [ "$#" -gt 0 ] && shift
          continue
          ;;
        -*)
          continue
          ;;
        *)
          target=$arg
          break
          ;;
      esac
    done
    [ -n "$target" ] || continue
    present=no
    if rg -q "^${target}\$" "$make_targets_file"; then
      present=yes
    fi
    printf '| `%s` | %s |\n' "$cmd" "$present"
  done <"$commands_unique_file"
  printf '\n'
} >"$output_file"

if [ "$run_checks" = "true" ]; then
  run_capture "Local Readiness Gate (make verify-v2-live-readiness)" \
    "cd '$root_dir' && make verify-v2-live-readiness"
  local_gate_code=$RUN_CAPTURE_LAST_CODE

  public_workflow_health_code=skip
  if [ "$check_public_workflow_health_resolved" = "true" ]; then
    run_capture "Public Workflow Health Gate (make verify-public-workflow-health)" \
      "cd '$root_dir' && make verify-public-workflow-health"
    public_workflow_health_code=$RUN_CAPTURE_LAST_CODE
  fi

  run_capture "Checklist Audit (make audit-v2-contributing-checklist)" \
    "cd '$root_dir' && RUN_BASELINE_VERIFIERS=false RUN_PUBLIC_PROBE='$checklist_audit_run_public_probe_resolved' make audit-v2-contributing-checklist"
  checklist_audit_code=$RUN_CAPTURE_LAST_CODE

  run_capture "Essential Live Env Presence" \
    "cd '$root_dir' && INFERRED_GITHUB_REPOSITORY='${resolved_repository:-}' ./scripts/report_live_v2_env_presence.sh"
  env_presence_code=$RUN_CAPTURE_LAST_CODE

  remote_live_workflow_sync_code=skip
  if [ "$check_remote_live_workflow_sync" = "true" ]; then
    run_capture "Remote Live V2 Workflow Sync (make verify-remote-live-v2-workflow-sync)" \
      "cd '$root_dir' && GITHUB_REPOSITORY='${resolved_repository:-$display_repository}' make verify-remote-live-v2-workflow-sync"
    remote_live_workflow_sync_code=$RUN_CAPTURE_LAST_CODE
  fi

  live_github_access_code=skip
  if [ "$check_live_github_access" = "true" ]; then
    run_capture "Live GitHub Access Preflight (make verify-live-github-access)" \
      "cd '$root_dir' && GITHUB_REPOSITORY='${resolved_repository:-$display_repository}' make verify-live-github-access"
    live_github_access_code=$RUN_CAPTURE_LAST_CODE
  fi

  public_controls_code=skip
  if [ "$check_public_github_controls" = "true" ]; then
    run_capture "Public GitHub Controls Precheck (make verify-github-repository-controls-public)" \
      "cd '$root_dir' && GITHUB_REPOSITORY='${resolved_repository:-$display_repository}' make verify-github-repository-controls-public"
    public_controls_code=$RUN_CAPTURE_LAST_CODE
  fi

  workflow_probe_code=skip
  if [ "$check_workflow_evidence" = "true" ]; then
    run_capture "Workflow Evidence Probe (make verify-live-v2-workflow-run)" \
      "cd '$root_dir' && GITHUB_REPOSITORY='${resolved_repository:-$display_repository}' WORKFLOW_RUN_ID='$workflow_run_id' WORKFLOW_EVENT='$workflow_event' REQUIRE_GITHUB_CONTROLS=true REQUIRE_OBSERVABILITY=true REQUIRE_RELEASE_RENDER=true make verify-live-v2-workflow-run"
    workflow_probe_code=$RUN_CAPTURE_LAST_CODE
  fi
else
  local_gate_code=skip
  public_workflow_health_code=skip
  checklist_audit_code=skip
  env_presence_code=skip
  remote_live_workflow_sync_code=skip
  live_github_access_code=skip
  public_controls_code=skip
  workflow_probe_code=skip
fi

code_is_ok_or_skipped() {
  probe_name=$1
  code=$2
  waiver_reason=$3
  case "$code" in
    0)
      return 0
      ;;
    skip)
      if [ -n "$waiver_reason" ]; then
        return 0
      fi
      printf 'missing waiver for skipped probe: %s\n' "$probe_name" >&2
      return 1
      ;;
    *)
      return 1
      ;;
  esac
}

ready_for_completion=true
if [ "$run_checks" != "true" ] && [ -z "$waive_run_checks" ]; then
  ready_for_completion=false
fi
effective_waive_public_workflow_health=${waive_public_workflow_health:-$auto_waive_public_workflow_health}
if ! code_is_ok_or_skipped "local readiness gate" "$local_gate_code" "$waive_run_checks"; then
  ready_for_completion=false
fi
if ! code_is_ok_or_skipped "public workflow health gate" "$public_workflow_health_code" "$effective_waive_public_workflow_health"; then
  ready_for_completion=false
fi
if ! code_is_ok_or_skipped "checklist audit gate" "$checklist_audit_code" "$waive_run_checks"; then
  ready_for_completion=false
fi
if ! code_is_ok_or_skipped "env presence probe" "$env_presence_code" "$waive_run_checks"; then
  ready_for_completion=false
fi
if ! code_is_ok_or_skipped "remote live workflow sync probe" "$remote_live_workflow_sync_code" "$waive_remote_live_workflow_sync"; then
  ready_for_completion=false
fi
if ! code_is_ok_or_skipped "live github access preflight" "$live_github_access_code" "$waive_live_github_access_preflight"; then
  ready_for_completion=false
fi
if ! code_is_ok_or_skipped "public github controls precheck" "$public_controls_code" "$waive_public_github_controls_precheck"; then
  ready_for_completion=false
fi
if ! code_is_ok_or_skipped "workflow evidence probe" "$workflow_probe_code" "$waive_workflow_evidence_probe"; then
  ready_for_completion=false
fi
if [ "$unchecked_count" -ne 0 ]; then
  ready_for_completion=false
fi

{
  printf '## Completion Verdict Inputs\n\n'
  printf '%s\n' "- Local readiness gate exit code: \`$local_gate_code\`"
  printf '%s\n' "- Public workflow health gate exit code: \`$public_workflow_health_code\`"
  printf '%s\n' "- Public workflow health mode: \`$check_public_workflow_health_resolved\` (configured: \`$check_public_workflow_health\`)"
  printf '%s\n' "- Checklist audit exit code: \`$checklist_audit_code\`"
  printf '%s\n' "- Checklist audit public probe mode: \`$checklist_audit_run_public_probe_resolved\` (configured: \`$checklist_audit_run_public_probe\`)"
  printf '%s\n' "- Env presence probe exit code: \`$env_presence_code\`"
  printf '%s\n' "- Remote live workflow sync exit code: \`$remote_live_workflow_sync_code\`"
  printf '%s\n' "- Live GitHub access preflight exit code: \`$live_github_access_code\`"
  printf '%s\n' "- Public GitHub controls precheck exit code: \`$public_controls_code\`"
  printf '%s\n' "- Workflow evidence probe exit code: \`$workflow_probe_code\`"
  printf '%s\n' "- Current unchecked checklist count: \`$unchecked_count\`"
  printf '\n'
  printf '### Probe Waivers\n\n'
  if [ -n "$waive_run_checks" ]; then
    printf '%s\n' "- run_checks waiver: \`$waive_run_checks\`"
  fi
  if [ -n "$effective_waive_public_workflow_health" ]; then
    printf '%s\n' "- public workflow health waiver: \`$effective_waive_public_workflow_health\`"
  fi
  if [ -n "$waive_remote_live_workflow_sync" ]; then
    printf '%s\n' "- remote live workflow sync waiver: \`$waive_remote_live_workflow_sync\`"
  fi
  if [ -n "$waive_live_github_access_preflight" ]; then
    printf '%s\n' "- live github access preflight waiver: \`$waive_live_github_access_preflight\`"
  fi
  if [ -n "$waive_public_github_controls_precheck" ]; then
    printf '%s\n' "- public github controls precheck waiver: \`$waive_public_github_controls_precheck\`"
  fi
  if [ -n "$waive_workflow_evidence_probe" ]; then
    printf '%s\n' "- workflow evidence probe waiver: \`$waive_workflow_evidence_probe\`"
  fi
  if [ -z "$waive_run_checks" ] && [ -z "$effective_waive_public_workflow_health" ] && [ -z "$waive_remote_live_workflow_sync" ] && [ -z "$waive_live_github_access_preflight" ] && [ -z "$waive_public_github_controls_precheck" ] && [ -z "$waive_workflow_evidence_probe" ]; then
    printf '%s\n' "- none"
  fi
  printf '\n'
  if [ "$ready_for_completion" = "true" ]; then
    printf 'Current audit verdict: **ready to consider objective complete**.\n'
  else
    printf 'Current audit verdict: **objective not complete**.\n'
  fi
  printf '\n'
} >>"$output_file"

printf 'v2 completion audit report generated\n'
printf 'report: %s\n' "$output_file"
