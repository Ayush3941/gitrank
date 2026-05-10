#!/usr/bin/env sh
set -eu

root_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
examples_dir="$root_dir/deployments/k8s/examples"
staging="$examples_dir/external-secret.staging.example.yaml"
production="$examples_dir/external-secret.production.example.yaml"
template="$examples_dir/external-secret.example.yaml"
runbook="$root_dir/docs/runbooks/secret-rotation.md"

for file in "$template" "$staging" "$production" "$runbook"; do
	test -s "$file"
done

for key in DATABASE_URL REDIS_URL GITRANK_SESSION_SECRET GITRANK_JWT_SIGNING_KEY GITHUB_TOKEN_ENCRYPTION_KEY GITHUB_CLIENT_ID GITHUB_CLIENT_SECRET GITHUB_WEBHOOK_SECRET OPENAI_API_KEY GRAFANA_ADMIN_USER GRAFANA_ADMIN_PASSWORD; do
	grep -q "secretKey: $key" "$staging"
	grep -q "secretKey: $key" "$production"
done

grep -q "namespace: gitrank-staging" "$staging"
grep -q "namespace: gitrank-production" "$production"
grep -q "gitrank/staging/" "$staging"
grep -q "gitrank/production/" "$production"

if grep -q "gitrank/production/" "$staging"; then
	echo "staging ExternalSecret must not reference production remote paths" >&2
	exit 1
fi

if grep -q "gitrank/staging/" "$production"; then
	echo "production ExternalSecret must not reference staging remote paths" >&2
	exit 1
fi

grep -q "replace-environment" "$template"
grep -q "GITHUB_TOKEN_ENCRYPTION_KEY" "$runbook"
grep -q "do not rotate blindly" "$runbook"
grep -q "make verify-secret-policy" "$runbook"

echo "secret policy verification passed"
