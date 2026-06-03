#!/usr/bin/env sh
set -eu

root_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
repo_dir="$(CDPATH= cd -- "$root_dir/.." && pwd)"
contributing_file="$repo_dir/CONTRIBUTING.md"
abra_closeout_file="$root_dir/docs/releases/abra-closeout.md"
tmp_root="${TMPDIR:-$root_dir/.tmp}"
mkdir -p "$tmp_root"

fail() {
  printf 'abra checklist verification failed: %s\n' "$1" >&2
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

[ -s "$contributing_file" ] || fail "missing CONTRIBUTING.md at $contributing_file"
[ -s "$abra_closeout_file" ] || fail "missing ABRA closeout artifact at $abra_closeout_file"

abra_start_line=$(rg -n "^## ABRA Goal Checklist$" "$contributing_file" | head -n 1 | cut -d: -f1 || true)
abra_end_line=$(rg -n "^## Suggested Early Issues$" "$contributing_file" | head -n 1 | cut -d: -f1 || true)

[ -n "$abra_start_line" ] || fail "ABRA section heading not found in CONTRIBUTING.md"
[ -n "$abra_end_line" ] || fail "ABRA section terminator heading not found in CONTRIBUTING.md"
[ "$abra_end_line" -gt "$abra_start_line" ] || fail "ABRA section boundaries are invalid in CONTRIBUTING.md"

unchecked_in_abra=$(rg -n "^- \\[ \\]" "$contributing_file" | awk -F: -v start="$abra_start_line" -v end="$abra_end_line" '$1 > start && $1 < end' || true)
if [ -n "$unchecked_in_abra" ]; then
  printf '%s\n' "$unchecked_in_abra" >&2
  fail "ABRA section still contains unchecked checklist items"
fi

abra_section_tmp="$(mktemp "$tmp_root/abra-checklist-section.XXXXXX")"
trap 'rm -f "$abra_section_tmp"' EXIT
sed -n "${abra_start_line},$((abra_end_line - 1))p" "$contributing_file" >"$abra_section_tmp"

assert_contains "$abra_section_tmp" "gitrank/docs/releases/abra-closeout.md" "ABRA closeout artifact reference should be present in CONTRIBUTING.md"
assert_contains "$abra_closeout_file" "## Scope completed" "ABRA closeout must document implemented scope"
assert_contains "$abra_closeout_file" "## Modules changed" "ABRA closeout must list changed modules"
assert_contains "$abra_closeout_file" "## Gemini env/config" "ABRA closeout must document Gemini config requirements"
assert_contains "$abra_closeout_file" "## Working vs degraded behavior" "ABRA closeout must document fully-working and degraded behavior"
assert_contains "$abra_closeout_file" "## Recommended demo flow" "ABRA closeout must include presentation demo flow"

printf 'abra checklist verification passed\n'
printf -- '- ABRA unchecked checklist items: 0\n'
printf -- '- ABRA closeout artifact: %s\n' "$abra_closeout_file"
