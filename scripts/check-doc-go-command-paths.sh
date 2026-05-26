#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

fail() {
  printf 'doc go-command path check failed: %s\n' "$1" >&2
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
  line="${rest#*:}"

  tokenized="$(printf '%s' "$line" | sed -E 's/[|;&(){}\[\],]/ /g')"
  while IFS= read -r token; do
    [[ -z "$token" ]] && continue

    candidate="$token"
    candidate="${candidate#\"}"
    candidate="${candidate#\'}"
    candidate="${candidate#\`}"
    candidate="${candidate%\"}"
    candidate="${candidate%\'}"
    candidate="${candidate%\`}"

    [[ "$candidate" == ./* ]] || continue
    [[ "$candidate" == ./. ]] && continue
    [[ "$candidate" == ./.. ]] && continue
    [[ "$candidate" == ./... ]] && continue

    normalized="${candidate#./}"
    if [[ "$normalized" == "" ]]; then
      continue
    fi

    if [[ "$normalized" == */... ]]; then
      normalized="${normalized%/...}"
    fi
    normalized="${normalized%/}"
    if [[ -z "$normalized" ]]; then
      continue
    fi

    if [[ "$normalized" == gitrank/* ]]; then
      if [[ ! -e "$ROOT_DIR/$normalized" ]]; then
        printf 'missing go command path in markdown: %s:%s:%s\n' "$file" "$line_no" "$candidate" >&2
        missing=1
      fi
      continue
    fi

    if [[ ! -e "$ROOT_DIR/$normalized" && ! -e "$ROOT_DIR/gitrank/$normalized" ]]; then
      printf 'missing go command path in markdown: %s:%s:%s\n' "$file" "$line_no" "$candidate" >&2
      missing=1
    fi
  done < <(printf '%s\n' "$tokenized" | tr ' ' '\n')
done < <(
  cd "$ROOT_DIR" && rg -n --glob '*.md' '\bgo[[:space:]]+(test|run|build|vet)\b'
)

if [[ "$missing" -ne 0 ]]; then
  fail "markdown go command paths are out of sync with repository paths"
fi

printf 'doc go command path check passed\n'
