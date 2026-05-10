# Infrastructure Baseline

Last reviewed: May 5, 2026

This document defines the v1 infrastructure, observability, and reliability baseline.

## Deployment Shape

- Kubernetes is the v1 deployment baseline.
- Services are packaged as OCI containers.
- Managed PostgreSQL and managed Redis are preferred over self-hosted stateful services.

Current committed state:

- `deployments/k8s/` contains a base kustomization with namespace, service account, runtime config, per-service Deployments, ClusterIP Services, gateway/auth ingress, and a migration Job
- staging and production overlays set environment-specific namespaces, public URLs, ingress hosts, and image replacement points
- runtime secrets are expected to be materialized as `gitrank-runtime-secrets` by Kubernetes Secret creation or an external secret controller before rollout

## Environments

GitRank should maintain:

- `dev` for local or shared development
- `staging` for release validation
- `prod` for public traffic

Promotion path:

1. merge reviewed code
2. pass CI and release checks
3. deploy to staging
4. verify health, migrations, and critical flows
5. promote to production

## Secrets and Access

- use Kubernetes secrets plus a cloud secret manager integration where available
- materialize the `gitrank-runtime-secrets` contract before applying service Deployments
- separate prod and non-prod credentials with environment-specific remote paths such as `gitrank/staging/<secret-name>` and `gitrank/production/<secret-name>`
- rotate auth, GitHub, AI, database, and observability credentials through `docs/runbooks/secret-rotation.md`
- keep auth/session and GitHub OAuth token-encryption rotations key-ring based by moving the retiring value into the matching `PREVIOUS_*` secret before replacing the primary value
- run `make verify-secret-policy` after changing Kubernetes secret examples or rotation documentation

## Networking and Public Edge

- use TLS before public production launch
- maintain owned DNS and explicit domain ownership
- keep internal service traffic private to the cluster or network boundary

## Rollout and Rollback

- use staged rollout into production rather than one-shot replacement
- document rollback before every release with migrations
- prefer expand-and-contract schema changes for zero-downtime compatibility
- rollback application code first when feasible

## SLO, SLI, RTO, and RPO

V1 target baselines:

- API availability SLI: successful request rate on public and authenticated endpoints
- Sync freshness SLI: age of latest successful profile refresh
- Scoring latency SLI: time from accepted analysis input to score completion
- Queue health SLI: backlog depth and dead-letter growth

Operational objectives:

- RTO target: 4 hours
- RPO target: 24 hours or better where PITR is enabled

## Backup and Restore

- daily automated backups
- PITR where the managed provider supports it
- quarterly restore drills
- restore results should be recorded in maintainer operations notes

## Observability

Required telemetry shape:

- structured logs across all services
- service, queue, GitHub, scoring, AI, and cache metrics
- W3C `traceparent` propagation across synchronous HTTP, scheduler-triggered async execution, GitHub/OAuth calls, and AI request builders, ready for an OpenTelemetry collector or compatible proxy
- dashboards for auth, sync, backlog, scoring, AI, and profile freshness
- alerts for backlog growth, webhook failures, auth failures, AI cost spikes, and scoring failures

## Reliability Behavior

- retries should be idempotent where evidence or score state is written
- GitHub outbound REST and GraphQL clients use a configurable circuit breaker for repeated provider-side failures
- GitHub outbound REST and GraphQL clients have fault-injection tests for secondary-rate-limit recovery and `Retry-After` handling
- backpressure should pause lower-priority sync and backfill work first
- deterministic-only mode should be used when AI is unavailable
- lower-priority syncs should be paused when GitHub rate limits become risky
- stale or partial indicators must remain visible to users

## Performance Proofs

- `make bench-ingestion` benchmarks PostgreSQL-backed pull-request webhook persistence when `GITRANK_INGESTOR_DATABASE_URL` points at a migrated test database.
- `go test ./services/scoring-engine/internal/scoring -bench BenchmarkScoreContribution -benchmem` benchmarks deterministic score computation.
- `go test ./services/profile-service/internal/service -bench BenchmarkPublicProfileResponseFromSnapshot -benchmem` benchmarks public profile projection latency.
- `github-ingestor` caches stable repository metadata for `GITHUB_REPOSITORY_CACHE_TTL` to avoid repeated repository detail calls within bounded sync waves.
- Migration `0009_query_shape_indexes.sql` backs the concrete profile, scoring, auth-session, sync-run, and installation-replay query shapes with targeted indexes.
- Profile and scoring stores use bulk reads and SQL-side lateral aggregation for score rows, files, and reviews instead of application-level N+1 loops.

## Scaling Direction

- scale stateless API and worker pods horizontally
- add backfill scale planning before large historical imports
- keep cost monitoring on AI and GitHub-heavy sync paths
