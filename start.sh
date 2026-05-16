#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/gitrank"
FRONTEND_DIR="$ROOT_DIR/frontend"
BACKEND_ENV_FILE="$BACKEND_DIR/.env"
FRONTEND_ENV_FILE="$FRONTEND_DIR/.env.local"
LOG_DIR="$ROOT_DIR/.logs"
RUN_DIR="$ROOT_DIR/.run"
COMPOSE_FILE="$BACKEND_DIR/deployments/compose/compose.yaml"

BACKEND_SERVICES=(
  auth-service
  github-ingestor
  pr-analyzer
  scoring-engine
  profile-service
  scheduler-worker
  api-gateway
)

POSTGRES_CONTAINER="gitrank-postgres"
REDIS_CONTAINER="gitrank-redis"

log() {
  printf '[start.sh] %s\n' "$*"
}

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    log "missing required command: $1"
    exit 1
  fi
}

kill_pid_file() {
  pid_file="$1"
  if [[ -f "$pid_file" ]]; then
    pid="$(cat "$pid_file" 2>/dev/null || true)"
    if [[ -n "$pid" ]] && kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" >/dev/null 2>&1 || true
      sleep 1
      if kill -0 "$pid" >/dev/null 2>&1; then
        kill -9 "$pid" >/dev/null 2>&1 || true
      fi
    fi
    rm -f "$pid_file"
  fi
}

kill_listeners_on_port() {
  port="$1"
  pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -z "$pids" ]]; then
    return 0
  fi
  for pid in $pids; do
    kill "$pid" >/dev/null 2>&1 || true
  done
  sleep 1
  for pid in $pids; do
    if kill -0 "$pid" >/dev/null 2>&1; then
      kill -9 "$pid" >/dev/null 2>&1 || true
    fi
  done
}

wait_for_health() {
  container="$1"
  timeout_seconds="$2"
  elapsed=0
  while (( elapsed < timeout_seconds )); do
    status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container" 2>/dev/null || true)"
    if [[ "$status" == "healthy" || "$status" == "running" ]]; then
      log "$container is $status"
      return 0
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done
  log "timed out waiting for $container to become healthy (last status: $status)"
  return 1
}

need_cmd docker
need_cmd go
need_cmd npm
need_cmd psql
need_cmd openssl
need_cmd lsof

mkdir -p "$LOG_DIR" "$RUN_DIR"

if [[ ! -f "$BACKEND_ENV_FILE" ]]; then
  log "creating backend env from template: $BACKEND_ENV_FILE"
  cp "$BACKEND_DIR/.env.example" "$BACKEND_ENV_FILE"
fi
if [[ ! -f "$FRONTEND_ENV_FILE" ]]; then
  log "creating frontend env from template: $FRONTEND_ENV_FILE"
  cp "$FRONTEND_DIR/.env.example" "$FRONTEND_ENV_FILE"
fi

set -a
source "$BACKEND_ENV_FILE"
set +a

# Normalize local DB port for lower collision chance.
if [[ -z "${DATABASE_URL:-}" ]]; then
  DATABASE_URL='postgres://postgres:postgres@localhost:55432/gitrank?sslmode=disable'
elif [[ "$DATABASE_URL" == *'localhost:5432'* ]]; then
  DATABASE_URL="${DATABASE_URL/localhost:5432/localhost:55432}"
fi
export DATABASE_URL

if [[ -z "${REDIS_URL:-}" ]]; then
  REDIS_URL='redis://localhost:6379/0'
  export REDIS_URL
fi

# Keep local boot smooth when placeholders remain in .env.
if [[ -z "${GITRANK_SESSION_SECRET:-}" || "${GITRANK_SESSION_SECRET}" == replace-* ]]; then
  GITRANK_SESSION_SECRET="$(openssl rand -hex 32)"
  export GITRANK_SESSION_SECRET
  log "using ephemeral GITRANK_SESSION_SECRET for this run"
fi

if [[ -z "${GITRANK_JWT_SIGNING_KEY:-}" || "${GITRANK_JWT_SIGNING_KEY}" == replace-* ]]; then
  GITRANK_JWT_SIGNING_KEY="$(openssl rand -hex 32)"
  export GITRANK_JWT_SIGNING_KEY
  log "using ephemeral GITRANK_JWT_SIGNING_KEY for this run"
fi

if [[ -z "${GITHUB_TOKEN_ENCRYPTION_KEY:-}" || "${GITHUB_TOKEN_ENCRYPTION_KEY}" == replace-* ]]; then
  GITHUB_TOKEN_ENCRYPTION_KEY="$(openssl rand -base64 32)"
  export GITHUB_TOKEN_ENCRYPTION_KEY
  log "using ephemeral GITHUB_TOKEN_ENCRYPTION_KEY for this run"
fi

log "stopping old frontend/backend processes from prior start.sh runs"
kill_pid_file "$RUN_DIR/frontend.pid"
for svc in "${BACKEND_SERVICES[@]}"; do
  kill_pid_file "$RUN_DIR/$svc.pid"
done

log "freeing local app ports"
for port in 3000 8080 8081 8082 8083 8084 8085 8086; do
  kill_listeners_on_port "$port"
done

log "removing old local DB/cache containers"
docker rm -f "$REDIS_CONTAINER" "$POSTGRES_CONTAINER" >/dev/null 2>&1 || true

log "starting postgres + redis via compose"
docker compose -f "$COMPOSE_FILE" up -d
wait_for_health "$POSTGRES_CONTAINER" 60
wait_for_health "$REDIS_CONTAINER" 60

log "running migrations against DATABASE_URL=$DATABASE_URL"
(
  cd "$BACKEND_DIR"
  ./scripts/migrate.sh
)

log "starting backend services"
for svc in "${BACKEND_SERVICES[@]}"; do
  (
    cd "$BACKEND_DIR"
    nohup go run "./services/$svc/cmd/$svc" >"$LOG_DIR/$svc.log" 2>&1 &
    echo "$!" >"$RUN_DIR/$svc.pid"
  )
  sleep 0.5
done

if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
  log "frontend dependencies missing; running npm install"
  (
    cd "$FRONTEND_DIR"
    npm install
  )
fi

log "starting frontend dev server"
(
  cd "$FRONTEND_DIR"
  nohup npm run dev >"$LOG_DIR/frontend.log" 2>&1 &
  echo "$!" >"$RUN_DIR/frontend.pid"
)

log "startup complete"
log "frontend: http://localhost:3000"
log "api gateway health: http://localhost:8080/healthz"
log "backend logs: $LOG_DIR"
log "pid files: $RUN_DIR"
