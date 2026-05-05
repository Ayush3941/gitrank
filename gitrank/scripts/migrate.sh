#!/usr/bin/env sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

root_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
migrations_dir="$root_dir/deployments/migrations"

for file in "$migrations_dir"/*.sql; do
  echo "applying migration: $file"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$file"
done
