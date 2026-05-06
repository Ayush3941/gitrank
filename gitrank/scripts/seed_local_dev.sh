#!/usr/bin/env sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

if [ "${GITRANK_ENV:-}" != "development" ]; then
  echo "GITRANK_ENV must be development to apply local seed data" >&2
  exit 1
fi

if [ "${ALLOW_LOCAL_SEED:-}" != "1" ]; then
  echo "Set ALLOW_LOCAL_SEED=1 to confirm local seed application" >&2
  exit 1
fi

root_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
seed_dir="$root_dir/deployments/seeds"

for file in "$seed_dir"/*.sql; do
  echo "applying local seed: $file"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$file"
done
