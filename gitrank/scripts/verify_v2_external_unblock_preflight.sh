#!/usr/bin/env sh
set -eu

root_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
repo_dir="$(CDPATH= cd -- "$root_dir/.." && pwd)"
tmp_root="${TMPDIR:-$root_dir/.tmp}"
contributing_file="$repo_dir/CONTRIBUTING.md"
mkdir -p "$tmp_root"

report_live_v2_env_presence_script="${REPORT_LIVE_V2_ENV_PRESENCE_SCRIPT:-$root_dir/scripts/report_live_v2_env_presence.sh}"
verify_live_github_access_script="${VERIFY_LIVE_GITHUB_ACCESS_SCRIPT:-$root_dir/scripts/verify_live_github_access.sh}"
verify_origin_push_access_script="${VERIFY_ORIGIN_PUSH_ACCESS_SCRIPT:-$root_dir/scripts/verify_origin_push_access.sh}"
verify_remote_live_v2_workflow_sync_script="${VERIFY_REMOTE_LIVE_V2_WORKFLOW_SYNC_SCRIPT:-$root_dir/scripts/verify_remote_live_v2_workflow_sync.sh}"
verify_github_repository_controls_public_script="${VERIFY_GITHUB_REPOSITORY_CONTROLS_PUBLIC_SCRIPT:-$root_dir/scripts/verify_github_repository_controls_public.sh}"
verify_live_v2_inputs_script="${VERIFY_LIVE_V2_INPUTS_SCRIPT:-$root_dir/scripts/verify_live_v2_inputs.sh}"
verify_live_v2_workflow_run_script="${VERIFY_LIVE_V2_WORKFLOW_RUN_SCRIPT:-$root_dir/scripts/verify_live_v2_workflow_run.sh}"

LIVE_ENV_FILE="${LIVE_V2_ENV_FILE:-${FINALIZE_V2_ENV_FILE:-}}"
if [ -n "$LIVE_ENV_FILE" ]; then
  resolved_live_env_file="$LIVE_ENV_FILE"
  case "$resolved_live_env_file" in
    /*) ;;
    *)
      if [ -f "$root_dir/$resolved_live_env_file" ]; then
        resolved_live_env_file="$root_dir/$resolved_live_env_file"
      fi
      ;;
  esac
  if [ ! -f "$resolved_live_env_file" ]; then
    printf 'v2 external unblock preflight failed: env file not found: %s\n' "$LIVE_ENV_FILE" >&2
    exit 1
  fi
  set -a
  # shellcheck disable=SC1090
  . "$resolved_live_env_file"
  set +a

  for token_var in GITRANK_REPO_ADMIN_TOKEN GITHUB_TOKEN GH_TOKEN GRAFANA_API_TOKEN; do
    eval token_value="\${$token_var:-}"
    case "$token_value" in
      replace-me*|changeme*|example-token*) eval "$token_var=''" ;;
    esac
  done
fi

fail_count=0

is_placeholder_value() {
  value=$1
  case "$value" in
    ""|OWNER/REPO|replace-me*|changeme*|*your-env.example*|*YYYY-MM-DD*|*your-cluster*|*your-name*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

state_for_value() {
  value=$1
  if [ -z "$value" ]; then
    printf 'unset'
    return 0
  fi
  if is_placeholder_value "$value"; then
    printf 'placeholder'
    return 0
  fi
  printf 'set'
}

resolve_repository_from_git_remote() {
  if is_placeholder_value "${GITHUB_REPOSITORY:-}"; then
    GITHUB_REPOSITORY=
  fi
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

resolved_repo="$(resolve_repository_from_git_remote)"
if [ -z "$resolved_repo" ]; then
  printf 'v2 external unblock preflight failed: could not resolve repository (set GITHUB_REPOSITORY=owner/name)\n' >&2
  exit 1
fi

for script_file in \
  "$report_live_v2_env_presence_script" \
  "$verify_live_github_access_script" \
  "$verify_origin_push_access_script" \
  "$verify_remote_live_v2_workflow_sync_script" \
  "$verify_github_repository_controls_public_script" \
  "$verify_live_v2_inputs_script" \
  "$verify_live_v2_workflow_run_script"; do
  if [ ! -x "$script_file" ]; then
    printf 'v2 external unblock preflight failed: required probe script is missing or not executable: %s\n' "$script_file" >&2
    exit 1
  fi
done

token_state=$(state_for_value "${GITRANK_REPO_ADMIN_TOKEN:-${GITHUB_TOKEN:-${GH_TOKEN:-}}}")

run_probe() {
  name=$1
  shift
  log_file=$(mktemp "$tmp_root/gitrank-v2-unblock-${name}.XXXXXX")
  if "$@" >"$log_file" 2>&1; then
    probe_status=pass
  else
    probe_status=fail
  fi
  probe_summary=$(tail -n 1 "$log_file" 2>/dev/null || true)
  if [ -z "$probe_summary" ]; then
    probe_summary="no output captured"
  fi
  rm -f "$log_file"
}

append_unique_csv() {
  current=$1
  item=$2
  if [ -z "$item" ]; then
    printf '%s' "$current"
    return 0
  fi
  case ",$current," in
    *",$item,"*)
      printf '%s' "$current"
      ;;
    *)
      if [ -n "$current" ]; then
        printf '%s, %s' "$current" "$item"
      else
        printf '%s' "$item"
      fi
      ;;
  esac
}

report_env_file=$(mktemp "$tmp_root/gitrank-v2-unblock-env.XXXXXX")
INFERRED_GITHUB_REPOSITORY="$resolved_repo" \
  "$report_live_v2_env_presence_script" >"$report_env_file" 2>/dev/null || true

auth_mode=$(awk -F= '/^derived\.auth_mode=/{print $2; exit}' "$report_env_file")
workflow_sync_credential_readiness=$(awk -F= '/^derived\.workflow_sync_credential_readiness=/{print $2; exit}' "$report_env_file")
origin_push_readiness=$(awk -F= '/^derived\.origin_push_access_readiness=/{print $2; exit}' "$report_env_file")
workflow_sync_execution_path=$(awk -F= '/^derived\.workflow_sync_execution_path=/{print $2; exit}' "$report_env_file")
rm -f "$report_env_file"

run_probe github_access env GITHUB_REPOSITORY="$resolved_repo" "$verify_live_github_access_script"
github_access_status=$probe_status
github_access_summary=$probe_summary

run_probe origin_push env REMOTE_NAME=origin "$verify_origin_push_access_script"
origin_push_status=$probe_status
origin_push_summary=$probe_summary

run_probe remote_workflow_sync env GITHUB_REPOSITORY="$resolved_repo" "$verify_remote_live_v2_workflow_sync_script"
remote_workflow_sync_status=$probe_status
remote_workflow_sync_summary=$probe_summary

run_probe controls_public env GITHUB_REPOSITORY="$resolved_repo" "$verify_github_repository_controls_public_script"
controls_public_status=$probe_status
controls_public_summary=$probe_summary

run_probe observability_inputs env RUN_OBSERVABILITY=true "$verify_live_v2_inputs_script"
observability_inputs_status=$probe_status
observability_inputs_summary=$probe_summary

run_probe workflow_evidence env GITHUB_REPOSITORY="$resolved_repo" WORKFLOW_RUN_ID=latest WORKFLOW_EVENT=any REQUIRE_GITHUB_CONTROLS=true REQUIRE_OBSERVABILITY=true REQUIRE_RELEASE_RENDER=true "$verify_live_v2_workflow_run_script"
workflow_evidence_status=$probe_status
workflow_evidence_summary=$probe_summary

printf 'v2 external unblock preflight\n'
printf 'repository: %s\n' "$resolved_repo"
printf 'derived.auth_mode: %s\n' "${auth_mode:-unknown}"
printf 'derived.workflow_sync_credential_readiness: %s\n' "${workflow_sync_credential_readiness:-unknown}"
printf 'derived.origin_push_access_readiness: %s\n' "${origin_push_readiness:-unknown}"
printf 'derived.workflow_sync_execution_path: %s\n' "${workflow_sync_execution_path:-unknown}"
printf 'probe.github_access: %s (%s)\n' "$github_access_status" "$github_access_summary"
printf 'probe.origin_push: %s (%s)\n' "$origin_push_status" "$origin_push_summary"
printf 'probe.remote_workflow_sync: %s (%s)\n' "$remote_workflow_sync_status" "$remote_workflow_sync_summary"
printf 'probe.controls_public: %s (%s)\n' "$controls_public_status" "$controls_public_summary"
printf 'probe.observability_inputs: %s (%s)\n' "$observability_inputs_status" "$observability_inputs_summary"
printf 'probe.workflow_evidence: %s (%s)\n' "$workflow_evidence_status" "$workflow_evidence_summary"

repo_state=$(state_for_value "${GITHUB_REPOSITORY:-$resolved_repo}")
prometheus_state=$(state_for_value "${PROMETHEUS_BASE_URL:-}")
grafana_base_state=$(state_for_value "${GRAFANA_BASE_URL:-}")
grafana_token_state=$(state_for_value "${GRAFANA_API_TOKEN:-}")
workflow_id_state=$(state_for_value "${WORKFLOW_RUN_ID:-latest}")
workflow_event_state=$(state_for_value "${WORKFLOW_EVENT:-any}")

origin_push_required_state=true
if [ "$token_state" = "set" ]; then
  origin_push_required_state=false
fi

origin_push_effective_status=required
if [ "$origin_push_required_state" = "false" ]; then
  origin_push_effective_status=advisory
fi

github_access_effective_status=pass
if [ "$github_access_status" = "fail" ]; then
  case "$github_access_summary" in
    *"is required"*|*"requires authentication"*|*"provide GITHUB_TOKEN"*|*"set GitHub App credentials"*)
      github_access_effective_status=credential-missing
      ;;
    *"invalid or expired"*|*"HTTP 401"*|*"denied"*|*"insufficient scope"*|*"forbidden"*)
      github_access_effective_status=credential-invalid
      ;;
    *)
      if [ "$token_state" = "set" ]; then
        github_access_effective_status=credential-invalid
      else
        github_access_effective_status=credential-missing
      fi
      ;;
  esac
fi

if [ "$github_access_status" = "fail" ]; then
  fail_count=$((fail_count + 1))
fi
if [ "$origin_push_status" = "fail" ] && [ "$origin_push_required_state" = "true" ]; then
  fail_count=$((fail_count + 1))
fi
if [ "$remote_workflow_sync_status" = "fail" ]; then
  fail_count=$((fail_count + 1))
fi
if [ "$controls_public_status" = "fail" ]; then
  fail_count=$((fail_count + 1))
fi
if [ "$observability_inputs_status" = "fail" ]; then
  fail_count=$((fail_count + 1))
fi
if [ "$workflow_evidence_status" = "fail" ]; then
  fail_count=$((fail_count + 1))
fi

printf 'input_state.repository: %s\n' "$repo_state"
printf 'input_state.github_token_or_admin_token: %s\n' "$token_state"
printf 'input_state.prometheus_base_url: %s\n' "$prometheus_state"
printf 'input_state.grafana_base_url: %s\n' "$grafana_base_state"
printf 'input_state.grafana_api_token: %s\n' "$grafana_token_state"
printf 'input_state.workflow_run_id: %s\n' "$workflow_id_state"
printf 'input_state.workflow_event: %s\n' "$workflow_event_state"
printf 'input_state.origin_push_required: %s\n' "$origin_push_required_state"
printf 'probe.github_access_effective_status: %s\n' "$github_access_effective_status"
printf 'probe.origin_push_effective_status: %s\n' "$origin_push_effective_status"

if [ -s "$contributing_file" ]; then
  unresolved_file=$(mktemp "$tmp_root/gitrank-v2-unblock-unresolved.XXXXXX")
  if command -v rg >/dev/null 2>&1; then
    rg -n "^- \\[ \\]" "$contributing_file" >"$unresolved_file" || true
  else
    grep -n "^- \\[ \\]" "$contributing_file" >"$unresolved_file" || true
  fi

  printf 'checklist_probe_mapping\n'
  while IFS= read -r line; do
    [ -n "$line" ] || continue
    line_no=${line%%:*}
    requirement=${line#*:}
    probes=
    case "$requirement" in
      *"dependency graph"*|*"Dependabot alerts"*|*"default branch"*|*"pull request review"*|*"status checks"*|*"required checks"*|*"repository controls"*|*"direct pushes"*|*"rulesets"*|*"GitHub repository controls"*)
        if [ "$origin_push_required_state" = "true" ]; then
          probes="github_access, origin_push, remote_workflow_sync, controls_public, workflow_evidence"
        else
          probes="github_access, remote_workflow_sync, controls_public, workflow_evidence (+ advisory origin_push)"
        fi
        ;;
      *"observability"*|*"Prometheus"*|*"Grafana"*|*"real traffic"*)
        probes="observability_inputs, workflow_evidence"
        ;;
      *)
        probes="(no probe mapping rule)"
        ;;
    esac
    printf 'line.%s => probes[%s] :: %s\n' "$line_no" "$probes" "$requirement"
  done <"$unresolved_file"
  rm -f "$unresolved_file"
fi

if [ "$fail_count" -gt 0 ]; then
  required_inputs=
  if [ "$github_access_status" = "fail" ] || [ "$remote_workflow_sync_status" = "fail" ] || [ "$controls_public_status" = "fail" ] || [ "$workflow_evidence_status" = "fail" ]; then
    if [ "$token_state" != "set" ] || [ "$github_access_effective_status" = "credential-invalid" ]; then
      required_inputs=$(append_unique_csv "$required_inputs" "GITRANK_REPO_ADMIN_TOKEN (or GITHUB_TOKEN/GH_TOKEN)")
      required_inputs=$(append_unique_csv "$required_inputs" "or GitHub App bootstrap: GITHUB_APP_ID + GITHUB_APP_INSTALLATION_ID + GITHUB_APP_PRIVATE_KEY_FILE/PEM")
      required_inputs=$(append_unique_csv "$required_inputs" "or OAuth web-flow bootstrap: GITHUB_CLIENT_ID + GITHUB_CLIENT_SECRET + GITRANK_ALLOW_OAUTH_WEB_TOKEN_BOOTSTRAP=yes")
    fi
  fi
  if [ "$observability_inputs_status" = "fail" ]; then
    if [ "$prometheus_state" != "set" ]; then
      required_inputs=$(append_unique_csv "$required_inputs" "PROMETHEUS_BASE_URL")
    fi
    if [ "$grafana_base_state" != "set" ]; then
      required_inputs=$(append_unique_csv "$required_inputs" "GRAFANA_BASE_URL")
    fi
    if [ "$grafana_token_state" != "set" ]; then
      required_inputs=$(append_unique_csv "$required_inputs" "GRAFANA_API_TOKEN")
    fi
  fi
  if [ "$origin_push_status" = "fail" ] && [ "$token_state" != "set" ]; then
    required_inputs=$(append_unique_csv "$required_inputs" "working origin push auth OR GitHub token/App creds for sync/apply paths")
  fi

  printf 'remediation\n'
  if [ -n "$required_inputs" ]; then
    printf '0. Minimal required next inputs: %s\n' "$required_inputs"
  fi
  printf '1. Prepare live env file: make -C %s scaffold-v2-live-env\n' "$root_dir"
  printf '2. Fill credentials and endpoints in %s/.env.v2-live-gates.local\n' "$root_dir"
  printf '3. Re-run this preflight: make -C %s verify-v2-external-unblock-preflight\n' "$root_dir"
  printf '4. Execute live gates: CONFIRM_FINALIZE_V2=yes make -C %s finalize-v2-live-closeout-local-env\n' "$root_dir"
  printf 'v2 external unblock preflight failed: unresolved external prerequisites remain\n' >&2
  exit 1
fi

printf 'v2 external unblock preflight passed\n'
