#!/usr/bin/env sh
set -eu

root_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
repo_dir="$(CDPATH= cd -- "$root_dir/.." && pwd)"
contributing_file="$repo_dir/CONTRIBUTING.md"
tmp_root="${TMPDIR:-/tmp}"

fail() {
  printf 'contributing checked-file reference verification failed: %s\n' "$1" >&2
  exit 1
}

is_path_candidate() {
  token=$1
  case "$token" in
    gitrank/*|frontend/*|.github/*|docs/*|deployments/*|services/*|packages/*|scripts/*) return 0 ;;
    README.md|CONTRIBUTING.md|SECURITY.md|CODEOWNERS|LICENSE|go.work|dependabot.yml) return 0 ;;
    *.md|*.yml|*.yaml|*.go|*.sql|*.txt|*.json|*.toml|*.sh) return 0 ;;
    [0-9][0-9][0-9][0-9]_*.sql) return 0 ;;
    *) return 1 ;;
  esac
}

is_allowed_absent() {
  token=$1
  case "$token" in
    frontend/lib/api/mock-api.ts|frontend/lib/mock-data/gitrank.ts) return 0 ;;
    *) return 1 ;;
  esac
}

path_exists() {
  token=$1
  if [ -e "$repo_dir/$token" ] || [ -e "$root_dir/$token" ] || [ -e "$repo_dir/.github/$token" ] || [ -e "$root_dir/deployments/migrations/$token" ]; then
    return 0
  fi
  return 1
}

[ -s "$contributing_file" ] || fail "missing CONTRIBUTING.md at $contributing_file"

checked_lines_file="$(mktemp "$tmp_root/gitrank-contributing-checked.XXXXXX")"
trap 'rm -f "$checked_lines_file"' EXIT
rg -n "^- \\[x\\]" "$contributing_file" >"$checked_lines_file" || true

total_refs=0
present_refs=0
absent_refs=0
skipped_patterns=0

while IFS= read -r line; do
  [ -n "$line" ] || continue
  line_no=${line%%:*}
  text=${line#*:}

  token_file="$(mktemp "$tmp_root/gitrank-contributing-tokens.XXXXXX")"
  printf '%s\n' "$text" | awk -F'`' 'NF > 1 { for (i = 2; i <= NF; i += 2) print $i }' >"$token_file"

  while IFS= read -r token; do
    [ -n "$token" ] || continue
    is_path_candidate "$token" || continue
    total_refs=$((total_refs + 1))

    case "$token" in
      *\**)
        skipped_patterns=$((skipped_patterns + 1))
        continue
        ;;
    esac

    if is_allowed_absent "$token"; then
      if path_exists "$token"; then
        rm -f "$token_file"
        fail "line $line_no expects removed reference '$token' to stay absent, but it exists"
      fi
      absent_refs=$((absent_refs + 1))
    else
      if ! path_exists "$token"; then
        rm -f "$token_file"
        fail "line $line_no references missing required file '$token'"
      fi
      present_refs=$((present_refs + 1))
    fi
  done <"$token_file"

  rm -f "$token_file"
done <"$checked_lines_file"

printf 'contributing checked-file reference verification passed\n'
printf '%s\n' "- checked references validated: $total_refs"
printf '%s\n' "- required-present refs: $present_refs"
printf '%s\n' "- required-absent refs: $absent_refs"
printf '%s\n' "- wildcard refs skipped: $skipped_patterns"
