#!/usr/bin/env sh
set -eu

root_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
tmp_root="${TMPDIR:-$root_dir/.tmp}"
mkdir -p "$tmp_root"

fail() {
  printf 'v2 live env scaffold verification failed: %s\n' "$1" >&2
  exit 1
}

assert_contains_line() {
  key=$1
  file=$2
  grep -q "^${key}=" "$file" || fail "missing key in scaffolded env: ${key}"
}

assert_not_empty_value() {
  key=$1
  file=$2
  value=$(awk -F= -v key="$key" '$1 == key { print $2; exit }' "$file")
  [ -n "$value" ] || fail "key has empty value in scaffolded env: ${key}"
}

assert_matches() {
  pattern=$1
  file=$2
  grep -Eq "$pattern" "$file" || fail "missing expected pattern in scaffolded env: $pattern"
}

scaffold_file=$(mktemp "$tmp_root/gitrank-v2-live-env-scaffold.XXXXXX")
trap 'rm -f "$scaffold_file"' EXIT

OUTPUT_FILE="$scaffold_file" FORCE_OVERWRITE=true "$root_dir/scripts/scaffold_v2_live_env_file.sh" >/dev/null

[ -s "$scaffold_file" ] || fail "scaffold output file is empty"

assert_contains_line "GITHUB_REPOSITORY" "$scaffold_file"
assert_contains_line "IMAGE_TAG" "$scaffold_file"
assert_contains_line "IMAGE_REGISTRY_OWNER" "$scaffold_file"
assert_contains_line "OBS_EVIDENCE_FILE" "$scaffold_file"
assert_contains_line "ROLLBACK_EVIDENCE_FILE" "$scaffold_file"
assert_contains_line "RESTORE_EVIDENCE_FILE" "$scaffold_file"

assert_not_empty_value "GITHUB_REPOSITORY" "$scaffold_file"
assert_not_empty_value "IMAGE_TAG" "$scaffold_file"
assert_not_empty_value "IMAGE_REGISTRY_OWNER" "$scaffold_file"

assert_matches '^OBS_EVIDENCE_FILE=docs/evidence/observability-live-[0-9]{4}-[0-9]{2}-[0-9]{2}\.txt$' "$scaffold_file"
assert_matches '^ROLLBACK_EVIDENCE_FILE=docs/evidence/rollback-drill-[0-9]{4}-[0-9]{2}-[0-9]{2}\.txt$' "$scaffold_file"
assert_matches '^RESTORE_EVIDENCE_FILE=docs/evidence/database-restore-drill-[0-9]{4}-[0-9]{2}-[0-9]{2}\.txt$' "$scaffold_file"

printf 'v2 live env scaffold verification passed\n'
