#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

fail() {
  printf 'frontend node script syntax check failed: %s\n' "$1" >&2
  exit 1
}

if ! command -v node >/dev/null 2>&1; then
  fail "node is required"
fi
if ! command -v git >/dev/null 2>&1; then
  fail "git is required"
fi

syntax_failures=0

while IFS= read -r rel_path; do
  [[ -z "$rel_path" ]] && continue
  abs_path="$ROOT_DIR/$rel_path"
  [[ -f "$abs_path" ]] || continue

  if ! node --check "$abs_path" >/dev/null; then
    printf 'syntax error in frontend node script: %s\n' "$rel_path" >&2
    syntax_failures=1
  fi
done < <(cd "$ROOT_DIR" && git ls-files 'frontend/scripts/*.mjs' | sort)

if [[ "$syntax_failures" -ne 0 ]]; then
  fail "one or more frontend node scripts failed syntax validation"
fi

printf 'frontend node script syntax check passed\n'
