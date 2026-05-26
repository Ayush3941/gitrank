#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
START_SCRIPT="$ROOT_DIR/start.sh"

fail() {
  printf 'start.sh contract check failed: %s\n' "$1" >&2
  exit 1
}

[[ -f "$START_SCRIPT" ]] || fail "missing start.sh"

if ! command -v rg >/dev/null 2>&1; then
  fail "rg is required"
fi
if ! command -v awk >/dev/null 2>&1; then
  fail "awk is required"
fi
if ! command -v find >/dev/null 2>&1; then
  fail "find is required"
fi

mapfile -t declared_services < <(
  awk '
    /^BACKEND_SERVICES=\(/ {inside=1; next}
    inside && /^\)/ {inside=0; next}
    inside {
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", $0)
      gsub(/^["'"'"']|["'"'"']$/, "", $0)
      if ($0 != "") print $0
    }
  ' "$START_SCRIPT" | sort -u
)

if [[ "${#declared_services[@]}" -eq 0 ]]; then
  fail "unable to parse BACKEND_SERVICES array from start.sh"
fi

mapfile -t actual_services < <(
  cd "$ROOT_DIR" \
    && find gitrank/services -mindepth 3 -maxdepth 3 -type d -path 'gitrank/services/*/cmd/*' -printf '%f\n' \
    | sort -u
)

if [[ "${#actual_services[@]}" -eq 0 ]]; then
  fail "no service cmd entrypoints discovered under gitrank/services/*/cmd/*"
fi

declared_tmp="$(mktemp "${TMPDIR:-/tmp}/declared-services.XXXXXX")"
actual_tmp="$(mktemp "${TMPDIR:-/tmp}/actual-services.XXXXXX")"
trap 'rm -f "$declared_tmp" "$actual_tmp"' EXIT

printf '%s\n' "${declared_services[@]}" >"$declared_tmp"
printf '%s\n' "${actual_services[@]}" >"$actual_tmp"

missing_from_start="$(comm -23 "$actual_tmp" "$declared_tmp" || true)"
unknown_in_start="$(comm -13 "$actual_tmp" "$declared_tmp" || true)"

if [[ -n "$missing_from_start" ]]; then
  printf 'service cmd entrypoint missing from BACKEND_SERVICES: %s\n' "$missing_from_start" >&2
  fail "start.sh service list is missing service cmd entrypoints"
fi

if [[ -n "$unknown_in_start" ]]; then
  printf 'service declared in BACKEND_SERVICES without cmd entrypoint: %s\n' "$unknown_in_start" >&2
  fail "start.sh service list references unknown services"
fi

while IFS= read -r script_ref; do
  [[ -z "$script_ref" ]] && continue
  normalized="${script_ref#./}"
  script_path="$ROOT_DIR/gitrank/$normalized"
  if [[ ! -f "$script_path" ]]; then
    printf 'missing gitrank script referenced by start.sh: %s\n' "$script_ref" >&2
    fail "start.sh references missing gitrank scripts"
  fi
  if [[ ! -x "$script_path" ]]; then
    printf 'non-executable gitrank script referenced by start.sh: %s\n' "$script_ref" >&2
    fail "start.sh references non-executable gitrank scripts"
  fi
done < <(
  rg -o --no-filename --no-line-number '(?:\./)?scripts/[A-Za-z0-9._/-]+\.sh' "$START_SCRIPT" | sort -u
)

for required_path in \
  "$ROOT_DIR/gitrank/.env.example" \
  "$ROOT_DIR/gitrank/deployments/compose/compose.yaml"; do
  if [[ ! -f "$required_path" ]]; then
    fail "required start.sh dependency missing: ${required_path#$ROOT_DIR/}"
  fi
done

printf 'start.sh contract check passed\n'
