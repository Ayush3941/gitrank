#!/usr/bin/env sh
set -eu

record_file=${1:-}

fail() {
  printf 'database restore drill evidence verification failed: %s\n' "$1" >&2
  exit 1
}

trim() {
  value=$1
  value=$(printf '%s' "$value" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
  printf '%s' "$value"
}

field_value() {
  field=$1
  awk -v field="$field" '
    BEGIN { IGNORECASE = 0 }
    $0 ~ ("^" field ":[[:space:]]*") {
      line = $0
      sub("^" field ":[[:space:]]*", "", line)
      print line
      exit
    }
  ' "$record_file"
}

field_exists() {
  field=$1
  grep -Eq "^${field}:[[:space:]]*" "$record_file"
}

placeholder_like() {
  value=$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')
  case "$value" in
    ""|todo|tbd|n/a|na|pending|"<fill>"|"<todo>"|"..."|"-")
      return 0
      ;;
  esac
  return 1
}

[ -n "$record_file" ] || fail "usage: verify_database_restore_drill_record.sh <record-file>"
[ -f "$record_file" ] || fail "record file not found: $record_file"
[ -s "$record_file" ] || fail "record file is empty: $record_file"

required_fields='
Date
Environment
Cluster
Namespace
Operator
Restore source
Restore target
Backup identifier
Restore start timestamp
Restore completion timestamp
Restore command or workflow
Schema migration state after restore
Critical product checks
Observed errors
Follow-up actions
Decision
'

printf '%s' "$required_fields" | while IFS= read -r field; do
  [ -n "$field" ] || continue
  field_exists "$field" || fail "missing field: $field"
  raw_value=$(field_value "$field" || true)
  value=$(trim "$raw_value")
  [ -n "$value" ] || fail "field is empty: $field"
  if placeholder_like "$value"; then
    fail "field has placeholder value: $field"
  fi
done

printf 'database restore drill evidence verification passed\n'
printf 'record: %s\n' "$record_file"
