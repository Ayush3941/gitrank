#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GITRANK_MAKEFILE="$ROOT_DIR/gitrank/Makefile"

fail() {
  printf 'doc make target check failed: %s\n' "$1" >&2
  exit 1
}

[[ -f "$GITRANK_MAKEFILE" ]] || fail "missing gitrank/Makefile"

if ! command -v rg >/dev/null 2>&1; then
  fail "rg is required"
fi
if ! command -v awk >/dev/null 2>&1; then
  fail "awk is required"
fi

known_targets="$(
  awk -F: '
    /^[A-Za-z0-9_.-]+:/ {
      if ($1 != ".PHONY") {
        print $1
      }
    }
  ' "$GITRANK_MAKEFILE" | sort -u
)"

[[ -n "$known_targets" ]] || fail "could not parse targets from gitrank/Makefile"

pattern='^[[:space:]]*([A-Z_][A-Z0-9_]*=[^[:space:]]+[[:space:]]+)*make([[:space:]]+-C[[:space:]]+[^[:space:]]+)?[[:space:]]+[A-Za-z0-9_.-]+([[:space:]]|$)'
missing=0

while IFS= read -r match; do
  [[ -z "$match" ]] && continue

  file="${match%%:*}"
  rest="${match#*:}"
  line_no="${rest%%:*}"
  command_line="${rest#*:}"

  target="$(
    printf '%s' "$command_line" \
      | sed -nE 's/^[[:space:]]*([A-Z_][A-Z0-9_]*=[^[:space:]]+[[:space:]]+)*make([[:space:]]+-C[[:space:]]+[^[:space:]]+)?[[:space:]]+([A-Za-z0-9_.-]+).*/\3/p'
  )"
  if [[ -z "$target" ]]; then
    continue
  fi

  cdir="$(
    printf '%s' "$command_line" \
      | sed -nE 's/^[[:space:]]*([A-Z_][A-Z0-9_]*=[^[:space:]]+[[:space:]]+)*make[[:space:]]+-C[[:space:]]+([^[:space:]]+).*/\2/p'
  )"

  # Only validate gitrank-scoped make invocations.
  if [[ -n "$cdir" ]]; then
    cdir_basename="$(basename "$cdir")"
    if [[ "$cdir" != "gitrank" && "$cdir" != "./gitrank" && "$cdir_basename" != "gitrank" ]]; then
      continue
    fi
  fi

  if ! printf '%s\n' "$known_targets" | rg -qx -- "$target"; then
    printf 'unknown make target referenced in markdown: %s:%s:%s\n' "$file" "$line_no" "$command_line" >&2
    missing=1
  fi
done < <(
  cd "$ROOT_DIR" && rg -n --glob '*.md' "$pattern"
)

if [[ "$missing" -ne 0 ]]; then
  fail "markdown make references are out of sync with gitrank/Makefile"
fi

printf 'doc make target check passed\n'

