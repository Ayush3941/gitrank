#!/usr/bin/env sh
set -eu

environment=${1:-}
output_file=${2:-}

fail() {
  printf 'k8s release render failed: %s\n' "$1" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "missing required command: $1"
}

require_env() {
  name=$1
  eval "value=\${$name:-}"
  [ -n "$value" ] || fail "$name is required"
}

[ -n "$environment" ] || fail "usage: render_k8s_release_manifests.sh <staging|production> <output-file>"
[ -n "$output_file" ] || fail "usage: render_k8s_release_manifests.sh <staging|production> <output-file>"

case "$environment" in
  staging|production) ;;
  *) fail "environment must be staging or production" ;;
esac

require_command kubectl
require_command sed
require_command mktemp

require_env IMAGE_TAG
require_env IMAGE_REGISTRY_OWNER
require_env K8S_PUBLIC_BASE_URL
require_env K8S_API_BASE_URL
require_env K8S_AUTH_COOKIE_DOMAIN
require_env K8S_GITHUB_OAUTH_REDIRECT_URL
require_env K8S_API_HOST
require_env K8S_AUTH_HOST
require_env K8S_TLS_SECRET_NAME

root_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
source_k8s_dir="$root_dir/deployments/k8s"
overlay_dir="$source_k8s_dir/overlays/$environment"
[ -d "$overlay_dir" ] || fail "overlay not found: $overlay_dir"

tmp_root=${TMPDIR:-"$root_dir/.tmp"}
mkdir -p "$tmp_root"
work_dir=$(mktemp -d "$tmp_root/k8s-release-render.XXXXXX")
trap 'rm -rf "$work_dir"' EXIT

cp -R "$source_k8s_dir" "$work_dir/k8s"

work_overlay_dir="$work_dir/k8s/overlays/$environment"
work_kustomization="$work_overlay_dir/kustomization.yaml"
work_config_patch="$work_overlay_dir/config-patch.yaml"
work_ingress_patch="$work_overlay_dir/ingress-patch.yaml"

if [ -z "${K8S_GITHUB_USER_AGENT:-}" ]; then
  K8S_GITHUB_USER_AGENT="GitRank/$environment"
fi

sed -i "s#ghcr.io/replace-me/gitrank-#ghcr.io/${IMAGE_REGISTRY_OWNER}/gitrank-#g" "$work_kustomization"
sed -i "s#newTag: $environment#newTag: ${IMAGE_TAG}#g" "$work_kustomization"

cat >"$work_config_patch" <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: gitrank-runtime-config
data:
  GITRANK_ENV: $environment
  GITRANK_PUBLIC_BASE_URL: $K8S_PUBLIC_BASE_URL
  GITRANK_API_BASE_URL: $K8S_API_BASE_URL
  AUTH_COOKIE_DOMAIN: $K8S_AUTH_COOKIE_DOMAIN
  GITHUB_OAUTH_REDIRECT_URL: $K8S_GITHUB_OAUTH_REDIRECT_URL
  GITHUB_USER_AGENT: $K8S_GITHUB_USER_AGENT
EOF

cat >"$work_ingress_patch" <<EOF
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: gitrank
spec:
  tls:
    - hosts:
        - $K8S_API_HOST
        - $K8S_AUTH_HOST
      secretName: $K8S_TLS_SECRET_NAME
  rules:
    - host: $K8S_API_HOST
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: api-gateway
                port:
                  name: http
    - host: $K8S_AUTH_HOST
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: auth-service
                port:
                  name: http
EOF

rendered_file="$work_dir/rendered.yaml"
kubectl kustomize "$work_overlay_dir" >"$rendered_file"
test -s "$rendered_file" || fail "rendered manifest is empty"

for pattern in "replace-me" "example.com"; do
  if grep -qi "$pattern" "$rendered_file"; then
    fail "rendered manifest still contains placeholder pattern: $pattern"
  fi
done

cp "$rendered_file" "$output_file"
printf 'k8s release render passed\n'
printf 'environment: %s\n' "$environment"
printf 'output: %s\n' "$output_file"
