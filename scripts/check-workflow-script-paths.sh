#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

fail() {
  printf 'workflow script path check failed: %s\n' "$1" >&2
  exit 1
}

if ! command -v rg >/dev/null 2>&1; then
  fail "rg is required"
fi
if ! command -v sed >/dev/null 2>&1; then
  fail "sed is required"
fi

missing=0
not_executable=0

resolve_candidates() {
  local ref="$1"
  case "$ref" in
    ./scripts/*)
      printf '%s\n' \
        "$ROOT_DIR/${ref#./}" \
        "$ROOT_DIR/gitrank/${ref#./}"
      ;;
    ../gitrank/scripts/*)
      printf '%s\n' "$ROOT_DIR/gitrank/scripts/${ref#../gitrank/scripts/}"
      ;;
    gitrank/scripts/*)
      printf '%s\n' "$ROOT_DIR/$ref"
      ;;
    scripts/*)
      printf '%s\n' \
        "$ROOT_DIR/$ref" \
        "$ROOT_DIR/gitrank/$ref"
      ;;
    *)
      ;;
  esac
}

while IFS= read -r match; do
  [[ -z "$match" ]] && continue

  # format: path:line:match
  ref="${match#*:}"
  ref="${ref#*:}"
  ref="${ref#*:}"

  found_file=""
  while IFS= read -r candidate; do
    [[ -z "$candidate" ]] && continue
    if [[ -f "$candidate" ]]; then
      found_file="$candidate"
      break
    fi
  done < <(resolve_candidates "$ref")

  if [[ -z "$found_file" ]]; then
    printf 'missing script path referenced in workflow: %s\n' "$match" >&2
    missing=1
    continue
  fi

  if [[ ! -x "$found_file" ]]; then
    printf 'non-executable script referenced in workflow: %s -> %s\n' "$match" "${found_file#$ROOT_DIR/}" >&2
    not_executable=1
  fi
done < <(
  cd "$ROOT_DIR" && rg -n -o \
    '(./scripts/[A-Za-z0-9._/-]+\.sh|../gitrank/scripts/[A-Za-z0-9._/-]+\.sh|gitrank/scripts/[A-Za-z0-9._/-]+\.sh|scripts/[A-Za-z0-9._/-]+\.sh)' \
    .github/workflows --glob '*.yml' --glob '*.yaml' | sort -u
)

if [[ "$missing" -ne 0 ]]; then
  fail "one or more workflow script references are missing"
fi

if [[ "$not_executable" -ne 0 ]]; then
  fail "one or more workflow script references are not executable"
fi

printf 'workflow script path check passed\n'
