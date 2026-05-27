# GitRank

GitRank is an evidence-first contributor intelligence platform for GitHub activity.
It turns real pull request history into explainable XP, rank, badges, reports, and
public profile signals without fake production users or mock leaderboard identity data.

## Status

Current baseline is a working local MVP with live GitHub OAuth sign-in, PR sync,
deterministic scoring, profile rendering, and optional ChatGPT narrative enrichment.

This repo is optimized for:

- local end-to-end demo loops
- deterministic scoring trust
- production-hardening checklists and policy gates
- offline-safe frontend builds via locally bundled UI fonts (no runtime Google Fonts dependency)

## Product Contract

### Deterministic score authority

- XP/rank/badge scoring is deterministic and rule-based.
- Every score claim must be traceable to persisted evidence.
- AI output never writes final score values.

### AI role (ChatGPT)

- ChatGPT provides explanation copy, impact narratives, and profile storytelling.
- If ChatGPT is missing/rate-limited/fails, the product degrades to deterministic
  fallback text and still remains usable.
- Evidence state is shown instead of silently hiding degraded AI conditions.

### PR XP award strategy (strict)

PR XP is computed from persisted evidence components such as:

- contribution category and technical depth
- review strength and maintainer-signal indicators
- test signal and repository context weight
- anti-concentration/diminishing-returns modifiers
- outcome weighting and consistency modifiers

This keeps ranking reproducible, auditable, and harder to game.

## Architecture

```text
GitHub OAuth (identity/linking) + GitHub App installation tokens (preferred sync auth)
                           |
                           v
auth-service -> github-ingestor -> pr-analyzer -> scoring-engine
      |               |                |               |
      +---------------+----------------+---------------+
                              |
                              v
                        profile-service
                              |
                              v
                          api-gateway
                              |
                              v
                      frontend (Next.js)
```

## Repository Layout

- `frontend/` app layer (Next.js UI, BFF routes, tests, frontend scripts).
- `gitrank/` backend workspace (Go services, shared packages, migrations, deployments, backend scripts).
- `docs/` top-level navigation + research notes for this monorepo.
- `scripts/` root repo-maintenance utilities.
- `start.sh` local bootstrap for infra + backend + frontend.
- `CONTRIBUTING.md` master implementation checklists, policy decisions, V1/V2/ABRA tracking.

## Local Run (Recommended)

### Prerequisites

- Docker + Docker Compose
- Go
- Node.js + npm
- `psql`, `openssl`, `curl`, `lsof`

### 1) Seed env files

```bash
cp -n gitrank/.env.example gitrank/.env
```

### 2) Configure required secrets in `gitrank/.env`

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_OAUTH_REDIRECT_URL` (must match your GitHub OAuth app callback)
- `GITRANK_SESSION_SECRET`
- `GITRANK_JWT_SIGNING_KEY`
- `GITHUB_TOKEN_ENCRYPTION_KEY`

ChatGPT path:

- `AI_PROVIDER=openai`
- `OPENAI_API_KEY`
- optional `OPENAI_MODEL` (default `gpt-4o-mini`)

Frontend runtime also reads its server env from this same `gitrank/.env` export path.

### 3) Start stack

```bash
./start.sh
```

`start.sh` does the full local startup path:

- removes old local Redis/Postgres containers if present
- starts `gitrank-postgres` on `localhost:55432` and `gitrank-redis` on `localhost:6379`
- runs DB migrations
- starts all backend services
- starts frontend on `http://localhost:3000`
- writes logs to `.logs/` and pid files to `.run/`

### 4) Open and verify

- Frontend: `http://localhost:3000`
- API health: `http://localhost:8080/healthz`

## Current User Flow

1. Sign in with GitHub OAuth.
2. Backend auto-sync fetches bounded PR evidence.
3. GitHub ingestor prefers GitHub App installation tokens for PR/repo sync when installation context exists, and safely falls back to linked OAuth user token when it does not.
4. Deterministic scoring computes XP/rank/badges.
5. Dashboard + Contributions + PR reports render evidence-backed results.
6. ChatGPT enriches explanations when configured and available.

## Evidence and Sync Notes

- User sync limits are runtime-configurable (`GITHUB_AUTHORED_PR_SYNC_LIMIT`, `GITHUB_AUTHORED_PR_SEARCH_LIMIT`, page-size and timeout policy env vars).
- User sync execution no longer enforces a hidden floor for authored-PR count; `GITHUB_AUTHORED_PR_SYNC_LIMIT` is applied directly (default `10`) and then capped only by `GITHUB_AUTHORED_PR_SEARCH_LIMIT`.
- Sync-run history auto-normalizes stale active statuses to prevent indefinite `running` rows in Settings when an upstream execution exceeded its active window.
- When user sync reports `authored_pull_requests_capped`, UI now shows a bounded-window notice instead of implying full-history completion.
- User-sync cursor progression no longer stays pinned on mixed-result runs; if at least one selected PR hydrated successfully, the cursor advances with overlap so newer PRs can enter subsequent bounded windows.
- User-sync execution marks authored-PR backfill as partial when discovery is still incomplete (`authored_pull_request_backfill_incomplete`), avoiding false "fully synced" states while history backfill is still in progress.
- Concurrent user sync requests for the same login are deduplicated in-process; overlapping executions return a conflict response instead of running duplicated heavy sync loops.
- Concurrent user sync requests are also deduplicated with a PostgreSQL advisory lease keyed by GitHub login, so multi-instance deployments avoid duplicate heavy sync execution for the same user.
- Conflict attempts are persisted in sync-run telemetry with explicit `user_sync_in_progress` / `lease_conflicts` metrics so contention is visible in Settings and diagnostics.
- Deterministic score math is runtime-configurable through `SCORING_*` env policy values; AI summaries never directly assign XP.
- Profile/report pages are snapshot-backed and may show partial/stale states.
- Upstream failures are surfaced as explicit sync/evidence states.

## Verification Commands

Backend (from `gitrank/`):

```bash
make test
make test-critical-path-flows
make verify-v2-live-readiness
```

Frontend (from `frontend/`):

```bash
npm run lint
npm run test:smoke
npm run test:a11y
npm run check:stale-refresh-sync
npm run build
```

Repository navigation snapshot:

```bash
./scripts/generate-repo-tree.sh
```

Repository sync/usability audit:

```bash
./scripts/check-repo-sync.sh
```

## Troubleshooting

- OAuth callback mismatch: ensure GitHub callback URL equals `GITHUB_OAUTH_REDIRECT_URL`.
- Sync timeout on heavy repos: raise `GITHUB_REQUEST_TIMEOUT` (for example `20s`+).
- Deterministic-only report: AI enrichment was unavailable; scoring still remains valid.
- Frontend route/cache oddity: rerun `./start.sh` (it resets local startup path cleanly).

## Key Documentation

- [Repository Map](./docs/README.md)
- [Repository Tree (Human-Friendly)](./docs/REPO_TREE.md)
- [Backend Workspace README](./gitrank/README.md)
- [Frontend README](./frontend/README.md)
- [Architecture](./gitrank/docs/architecture.md)
- [API Architecture](./gitrank/docs/api-architecture.md)
- [System and Product Flows (Mermaid)](./gitrank/docs/mermaid-flows.md)
- [Production Decision Register](./gitrank/docs/production-decision-register.md)
- [Maintainer Guide](./gitrank/docs/MAINTAINER_GUIDE.md)
- [Research Notes](./docs/research/README.md)
- [Contributing and Checklists](./CONTRIBUTING.md)

## License

MIT
