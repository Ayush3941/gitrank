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
GitHub OAuth (identity/linking only) + GitHub App installation tokens (required PR/repo sync auth)
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
There is no separate runtime `.env` for `frontend/`; keep all runtime vars in `gitrank/.env`.
`start.sh` exports `GITRANK_ENV_FILE=<repo>/gitrank/.env`, and frontend runtime honors that path first.
If `GITRANK_ENV_FILE` is unset, frontend runtime falls back to `../gitrank/.env`.

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
3. GitHub ingestor uses GitHub App installation tokens for PR/repo sync and does not extract PRs with OAuth tokens.
4. Deterministic scoring computes XP/rank/badges.
5. Dashboard + Contributions + PR reports render evidence-backed results.
6. ChatGPT enriches explanations when configured and available.

## Evidence and Sync Notes

- User sync limits are runtime-configurable (`GITHUB_AUTHORED_PR_SYNC_LIMIT`, `GITHUB_AUTHORED_PR_SEARCH_LIMIT`, page-size and timeout policy env vars).
- User sync execution no longer enforces a hidden floor for authored-PR count; `GITHUB_AUTHORED_PR_SYNC_LIMIT` is applied directly (default `25`) and then capped only by `GITHUB_AUTHORED_PR_SEARCH_LIMIT`.
- User-sync telemetry now includes explicit authored-PR sync bounds (`authored_pull_request_sync_limit`, `authored_pull_request_search_limit`) plus timeout budget seconds (`authored_pull_request_timeout_seconds`) so Settings/diagnostics show the real runtime window.
- GitHub REST/GraphQL retry logic now honors `retry-after`, then `x-ratelimit-reset` when remaining budget is zero, and exits early on canceled contexts instead of sleeping through full backoff windows.
- Sync-run history auto-normalizes stale active statuses and stale queued rows to prevent indefinite `running`/`queued` rows in Settings; malformed rows missing `started_at` are marked failed with explicit diagnostics.
- Frontend boot now opportunistically loads missing env vars from `GITRANK_ENV_FILE` (or `../gitrank/.env` fallback) inside `next.config.ts`, so `npm run dev` in `frontend/` still follows the single-env-file contract without requiring a second frontend `.env`.
- User-sync queue identity is now canonicalized case-insensitively (`user:<login-lowercase>`), and sync-run reconciliation treats user subjects case-insensitively during `queued -> running -> terminal` transitions to reduce duplicate/stuck rows when login casing differs between requests.
- Sync-run normalization now marks contradictory rows (`finished_at` present while status is still active/queued) as failed instead of completed, preventing false "Synced" signals from inconsistent run-state records.
- In-progress sync rows are superseded by newer terminal runs using both correlation ID and logical target scope (run type + requested user/repository), reducing persistent ghost `running` entries after repeated retries.
- User sync now includes a broad authored-PR fallback query when recent-window discovery returns empty, reducing false-empty sync outcomes caused by cursor/window edge cases.
- Authored-PR discovery queries now use `is:pull-request` qualifiers for both bounded windows and broad fallback discovery.
- Dashboard stale-state UI now surfaces the latest sync diagnostic reason (when available) so partial/empty evidence states are explicit instead of generic.
- Sync failures now classify unsupported GitHub API-version responses and surface a direct `GITHUB_API_VERSION` remediation message in sync diagnostics.
- User sync now enforces GitHub App credentials for PR extraction. Installation bootstrap/discovery also runs through GitHub App credentials (`/app/installations`), while OAuth remains login/session-only.
- If no direct user-owned installation mapping exists, sync now probes persisted active App installations with a bounded authored-PR search and selects the first installation that can see the actor’s PR evidence, keeping org-repo PR extraction App-only without OAuth token discovery.
- Sync extraction error contracts now expose only strict App-installation signals (`github_app_installation_required`, `github_app_installation_unavailable`); OAuth-required extraction error codes were removed from ingestor and frontend diagnostics.
- Repository, pull-request, and review execute routes now follow the same fail-closed rule: they require GitHub App installation credentials and return explicit app/bootstrap errors instead of generic sync failures.
- Strict request-level app-auth now prioritizes explicit `installation_id` when provided; actor-login installation matching is only used when no installation ID is supplied.
- Gateway user-sync routes now enforce authenticated-login ownership (`req.user` is normalized to the current session GitHub login), preventing cross-user sync payload overrides.
- Scheduler/webhook-triggered repository/PR/review sync still works without user-login headers by using explicit `installation_id` app-token resolution.
- Scheduler sync job payloads now preserve optional `installation_id` and `user` context, and scheduler execution forwards `X-GitRank-GitHub-Login`/`X-GitRank-Subject` when user context is present.
- Settings sync execute/queue controls now forward optional `user` and `installation_id` context for repository/PR/review/issue/commit sync actions, improving strict app-auth resolution from manual execution paths.
- Authored-PR hydration skip metrics are now classified by cause (timeout, rate-limit, auth/scope, not-found masking, conflict, upstream), improving partial-sync diagnostics and cursor-hold behavior for auth/scope gaps.
- When user sync reports `authored_pull_requests_capped`, UI now shows a bounded-window notice instead of implying full-history completion.
- User-sync cursor progression no longer stays pinned on mixed-result runs; if at least one selected PR hydrated successfully, the cursor advances with overlap so newer PRs can enter subsequent bounded windows.
- User-sync execution marks authored-PR backfill as partial when discovery is still incomplete (`authored_pull_request_backfill_incomplete`), avoiding false "fully synced" states while history backfill is still in progress.
- User-sync execution also treats all-unmerged selected target windows (`authored_pull_requests_selected_unmerged_only`) as partial-state outcomes so sync status does not over-claim score-ready completion.
- Refresh feedback explicitly differentiates "history backfill still in progress" from credential-scope failures, so users are not prompted to reconnect GitHub during normal backfill progression.
- Dashboard/profile sync-state pills now evaluate the full authenticated sync-run stream (not only `run_type=user`) so active child PR/repository runs keep the UI in `syncing` until terminal.
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
