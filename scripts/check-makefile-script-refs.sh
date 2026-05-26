#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MAKEFILE_PATH="$ROOT_DIR/gitrank/Makefile"
SCRIPT_ROOT="$ROOT_DIR/gitrank"

fail() {
  printf 'makefile script reference check failed: %s\n' "$1" >&2
  exit 1
}

[[ -f "$MAKEFILE_PATH" ]] || fail "missing gitrank/Makefile"

if ! command -v rg >/dev/null 2>&1; then
  fail "rg is required"
fi
if ! command -v sed >/dev/null 2>&1; then
  fail "sed is required"
fi

missing=0
not_executable=0

while IFS= read -r script_ref; do
  [[ -z "$script_ref" ]] && continue
  script_path="$SCRIPT_ROOT/$script_ref"

  if [[ ! -f "$script_path" ]]; then
    printf 'missing script referenced by gitrank/Makefile: %s\n' "$script_ref" >&2
    missing=1
    continue
  fi

  if [[ ! -x "$script_path" ]]; then
    printf 'non-executable script referenced by gitrank/Makefile: %s\n' "$script_ref" >&2
    not_executable=1
  fi
done < <(
  rg -n -o 'scripts/[A-Za-z0-9._/-]+\.sh' "$MAKEFILE_PATH" \
    | sed -E 's/.*:(scripts\/[^[:space:]]+)/\1/' \
    | sort -u
)

if [[ "$missing" -ne 0 ]]; then
  fail "one or more Makefile script references are missing"
fi

if [[ "$not_executable" -ne 0 ]]; then
  fail "one or more Makefile script references are not executable"
fi

printf 'makefile script reference check passed\n'
