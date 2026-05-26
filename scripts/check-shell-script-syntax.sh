#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

fail() {
  printf 'shell script syntax check failed: %s\n' "$1" >&2
  exit 1
}

if ! command -v git >/dev/null 2>&1; then
  fail "git is required"
fi
if ! command -v head >/dev/null 2>&1; then
  fail "head is required"
fi

missing_interpreter=0
syntax_failures=0

while IFS= read -r rel_path; do
  [[ -z "$rel_path" ]] && continue
  abs_path="$ROOT_DIR/$rel_path"
  [[ -f "$abs_path" ]] || continue

  shebang="$(head -n 1 "$abs_path" || true)"
  interpreter=""
  case "$shebang" in
    '#!/usr/bin/env bash'|'#!/bin/bash')
      interpreter="bash"
      ;;
    '#!/usr/bin/env sh'|'#!/bin/sh')
      interpreter="sh"
      ;;
    *)
      printf 'unsupported/missing normalized shebang for syntax check: %s (%s)\n' "$rel_path" "$shebang" >&2
      syntax_failures=1
      continue
      ;;
  esac

  if ! command -v "$interpreter" >/dev/null 2>&1; then
    printf 'required interpreter is missing for %s: %s\n' "$rel_path" "$interpreter" >&2
    missing_interpreter=1
    continue
  fi

  if ! "$interpreter" -n "$abs_path"; then
    printf 'syntax error in %s (%s -n)\n' "$rel_path" "$interpreter" >&2
    syntax_failures=1
  fi
done < <(cd "$ROOT_DIR" && git ls-files 'scripts/*.sh' 'gitrank/scripts/*.sh' 'start.sh' | sort)

if [[ "$missing_interpreter" -ne 0 ]]; then
  fail "one or more required interpreters are unavailable"
fi

if [[ "$syntax_failures" -ne 0 ]]; then
  fail "one or more shell scripts failed syntax validation"
fi

printf 'shell script syntax check passed\n'
