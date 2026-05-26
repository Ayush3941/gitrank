#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

fail() {
  printf 'doc script path check failed: %s\n' "$1" >&2
  exit 1
}

if ! command -v rg >/dev/null 2>&1; then
  fail "rg is required"
fi

missing=0
while IFS= read -r match; do
  [[ -z "$match" ]] && continue

  file="${match%%:*}"
  rest="${match#*:}"
  line_no="${rest%%:*}"
  ref="${rest#*:}"

  normalized="$ref"
  normalized="${normalized#./}"
  normalized="${normalized#\"}"
  normalized="${normalized#\'}"
  normalized="${normalized#\(}"
  normalized="${normalized#\[}"
  normalized="${normalized#\`}"
  normalized="${normalized#<}"
  normalized="${normalized%\`}"
  normalized="${normalized%\'}"
  normalized="${normalized%\"}"
  normalized="${normalized%)}"
  normalized="${normalized%]}"
  normalized="${normalized%>}"
  normalized="${normalized%%\?*}"
  normalized="${normalized%%#*}"
  normalized="$(printf '%s' "$normalized" | sed 's/[[:space:]]*$//')"

  if [[ "$normalized" != scripts/*.sh && "$normalized" != gitrank/scripts/*.sh ]]; then
    continue
  fi

  found=0
  if [[ "$normalized" == gitrank/scripts/*.sh ]]; then
    if [[ -f "$ROOT_DIR/$normalized" ]]; then
      found=1
    fi
  else
    if [[ -f "$ROOT_DIR/$normalized" || -f "$ROOT_DIR/gitrank/$normalized" ]]; then
      found=1
    fi
  fi

  if [[ "$found" -eq 0 ]]; then
    printf 'missing script path referenced in markdown: %s:%s:%s\n' "$file" "$line_no" "$ref" >&2
    missing=1
  fi
done < <(
  cd "$ROOT_DIR" && rg -n -o --glob '*.md' '(\./)?scripts/[A-Za-z0-9._/-]+\.sh|(\./)?gitrank/scripts/[A-Za-z0-9._/-]+\.sh' | sort -u
)

if [[ "$missing" -ne 0 ]]; then
  fail "markdown script path references are out of sync with tracked scripts"
fi

printf 'doc script path check passed\n'
