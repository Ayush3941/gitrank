#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! command -v git >/dev/null 2>&1; then
  printf 'secret leak check failed: git is required\n' >&2
  exit 1
fi
if ! command -v rg >/dev/null 2>&1; then
  printf 'secret leak check failed: rg is required\n' >&2
  exit 1
fi

tmp_files="$(mktemp "${TMPDIR:-/tmp}/gitrank-secret-scan-files.XXXXXX")"
tmp_hits="$(mktemp "${TMPDIR:-/tmp}/gitrank-secret-scan-hits.XXXXXX")"
trap 'rm -f "$tmp_files" "$tmp_hits"' EXIT

cd "$ROOT_DIR"
while IFS= read -r path; do
  [[ -f "$path" ]] || continue
  printf '%s\n' "$path" >>"$tmp_files"
done < <(git ls-files)

if [[ ! -s "$tmp_files" ]]; then
  printf 'tracked secret scan skipped: no tracked files found\n'
  exit 0
fi

# High-signal token and key prefixes.
secret_pattern='sk-(proj-)?[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{35}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----'

while IFS= read -r path; do
  rg -n -I -S "$secret_pattern" "$path" || true
done <"$tmp_files" >"$tmp_hits"

if [[ ! -s "$tmp_hits" ]]; then
  printf 'tracked secret leak check passed\n'
  exit 0
fi

filtered_hits="$(mktemp "${TMPDIR:-/tmp}/gitrank-secret-scan-filtered.XXXXXX")"
trap 'rm -f "$tmp_files" "$tmp_hits" "$filtered_hits"' EXIT
grep -Ev '(replace-me|example|placeholder|<redacted>|REDACTED)' "$tmp_hits" >"$filtered_hits" || true

if [[ ! -s "$filtered_hits" ]]; then
  printf 'tracked secret leak check passed (only placeholder/example matches)\n'
  exit 0
fi

printf 'tracked secret leak check failed: high-signal secret-like values detected in tracked files\n' >&2
cat "$filtered_hits" >&2
printf 'Rotate exposed credentials and replace with env-based values immediately.\n' >&2
exit 1
