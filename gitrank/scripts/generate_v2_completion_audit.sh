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

fail() {
  printf 'generate v2 completion audit failed: %s\n' "$1" >&2
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

resolved_repository=$(resolve_repository_from_git_remote || true)
if [ -z "$display_repository" ]; then
  if [ -n "$resolved_repository" ]; then
    display_repository=$resolved_repository
  else
    display_repository=OWNER/REPO
  fi
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
  printf '5. Explicit file, command, and gate references in `CONTRIBUTING.md` resolve to real artifacts or real commands.\n'
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

  run_capture "Public Workflow Health Gate (make verify-public-workflow-health)" \
    "cd '$root_dir' && make verify-public-workflow-health"
  public_workflow_health_code=$RUN_CAPTURE_LAST_CODE

  run_capture "Checklist Audit (make audit-v2-contributing-checklist)" \
    "cd '$root_dir' && RUN_BASELINE_VERIFIERS=false make audit-v2-contributing-checklist"
  checklist_audit_code=$RUN_CAPTURE_LAST_CODE
else
  local_gate_code=skip
  public_workflow_health_code=skip
  checklist_audit_code=skip
fi

{
  printf '## Completion Verdict Inputs\n\n'
  printf '%s\n' "- Local readiness gate exit code: \`$local_gate_code\`"
  printf '%s\n' "- Public workflow health gate exit code: \`$public_workflow_health_code\`"
  printf '%s\n' "- Checklist audit exit code: \`$checklist_audit_code\`"
  printf '%s\n' "- Current unchecked checklist count: \`$unchecked_count\`"
  printf '\n'
  if [ "$unchecked_count" -eq 0 ] && [ "$local_gate_code" = "0" ] && [ "$public_workflow_health_code" = "0" ] && [ "$checklist_audit_code" = "0" ]; then
    printf 'Current audit verdict: **ready to consider objective complete**.\n'
  else
    printf 'Current audit verdict: **objective not complete**.\n'
  fi
  printf '\n'
} >>"$output_file"

printf 'v2 completion audit report generated\n'
printf 'report: %s\n' "$output_file"
