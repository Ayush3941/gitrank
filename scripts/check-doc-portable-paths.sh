#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

fail() {
  printf 'doc portable path check failed: %s\n' "$1" >&2
  exit 1
}

if ! command -v rg >/dev/null 2>&1; then
  fail "rg is required"
fi

if (
  cd "$ROOT_DIR" && rg -n '/home/[^[:space:]]+|/Users/[^[:space:]]+|[A-Za-z]:\\\\Users\\\\' \
    --glob '*.md' \
    --glob '!gitrank/docs/releases/**' \
    --glob '!gitrank/docs/evidence/**' \
    --glob '!frontend/docs/evidence/**' \
    --glob '!docs/evidence/**' >/dev/null
); then
  cd "$ROOT_DIR" && rg -n '/home/[^[:space:]]+|/Users/[^[:space:]]+|[A-Za-z]:\\\\Users\\\\' \
    --glob '*.md' \
    --glob '!gitrank/docs/releases/**' \
    --glob '!gitrank/docs/evidence/**' \
    --glob '!frontend/docs/evidence/**' \
    --glob '!docs/evidence/**' >&2
  fail "machine-specific absolute paths found in primary markdown docs"
fi

printf 'doc portable path check passed\n'
