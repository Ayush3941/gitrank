#!/usr/bin/env sh
set -eu

root_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
repo_dir="$(CDPATH= cd -- "$root_dir/.." && pwd)"
template_file="$root_dir/.env.v2-live-gates.example"
output_file="${OUTPUT_FILE:-$root_dir/.env.v2-live-gates.local}"
date_value="${DATE_VALUE:-$(date -u +%F)}"
force_overwrite="${FORCE_OVERWRITE:-false}"

fail() {
  printf 'scaffold live v2 env failed: %s\n' "$1" >&2
  exit 1
}

resolve_output_file() {
  case "$output_file" in
    /*) ;;
    *) output_file="$root_dir/$output_file" ;;
  esac
}

resolve_repository_from_git_remote() {
  if [ -n "${GITHUB_REPOSITORY:-}" ]; then
    printf '%s' "$GITHUB_REPOSITORY"
    return 0
  fi
  if ! command -v git >/dev/null 2>&1; then
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

resolve_image_tag() {
  if ! command -v git >/dev/null 2>&1; then
    printf 'replace-me-with-release-tag'
    return 0
  fi
  commit_short=$(git -C "$repo_dir" rev-parse --short HEAD 2>/dev/null || true)
  if [ -n "$commit_short" ]; then
    printf '%s' "$commit_short"
  else
    printf 'replace-me-with-release-tag'
  fi
}

set_key() {
  key=$1
  value=$2
  target_file=$3
  tmp_file=$(mktemp "${TMPDIR:-/tmp}/gitrank-live-v2-env-scaffold.XXXXXX")
  if ! awk -v key="$key" -v value="$value" '
    BEGIN { replaced = 0 }
    {
      if ($0 ~ ("^" key "=")) {
        print key "=" value
        replaced = 1
      } else {
        print $0
      }
    }
    END {
      if (replaced == 0) {
        print key "=" value
      }
    }
  ' "$target_file" >"$tmp_file"; then
    rm -f "$tmp_file"
    fail "could not set key '$key' in $target_file"
  fi
  mv "$tmp_file" "$target_file"
}

resolve_output_file
[ -s "$template_file" ] || fail "missing template file: $template_file"

if [ -e "$output_file" ] && [ "$force_overwrite" != "true" ]; then
  fail "output file exists ($output_file); set FORCE_OVERWRITE=true to overwrite"
fi

mkdir -p "$(dirname "$output_file")"
cp "$template_file" "$output_file"
chmod 600 "$output_file" 2>/dev/null || true

resolved_repository=$(resolve_repository_from_git_remote || true)
if [ -z "$resolved_repository" ]; then
  resolved_repository="OWNER/REPO"
fi

repo_owner=${resolved_repository%%/*}
if [ "$repo_owner" = "$resolved_repository" ]; then
  repo_owner="replace-me-with-registry-owner"
fi
repo_owner_lc=$(printf '%s' "$repo_owner" | tr '[:upper:]' '[:lower:]')

image_tag=$(resolve_image_tag)

set_key "GITHUB_REPOSITORY" "$resolved_repository" "$output_file"
set_key "IMAGE_TAG" "$image_tag" "$output_file"
set_key "IMAGE_REGISTRY_OWNER" "$repo_owner_lc" "$output_file"
set_key "OBS_EVIDENCE_FILE" "docs/evidence/observability-live-$date_value.txt" "$output_file"
set_key "ROLLBACK_EVIDENCE_FILE" "docs/evidence/rollback-drill-$date_value.txt" "$output_file"
set_key "RESTORE_EVIDENCE_FILE" "docs/evidence/database-restore-drill-$date_value.txt" "$output_file"

printf 'live v2 env scaffold generated\n'
printf 'output_file: %s\n' "$output_file"
printf 'repository: %s\n' "$resolved_repository"
printf 'image_tag: %s\n' "$image_tag"
printf 'next: edit required secret and endpoint values, then run:\n'
printf '  CONFIRM_FINALIZE_V2=yes make -C %s finalize-v2-live-closeout-local-env\n' "$root_dir"
