# GitRank

GitRank is an evidence-first contributor intelligence platform for GitHub activity.
It converts real pull-request history into deterministic score signals, progression,
and shareable contributor profiles without relying on fake leaderboard data.

## What GitRank Delivers

- GitHub OAuth login and linked account identity.
- Automated PR evidence sync with bounded fetch limits for reliability.
- Deterministic XP/rank/badge scoring that is explainable and replayable.
- PR battle reports with score components, evidence tags, and confidence state.
- Dashboard and public profile views with privacy and visibility controls.
- Optional Gemini-generated narratives for impact summaries and profile storytelling.

## Core Principle: AI Does Not Decide Score

GitRank enforces a strict scoring boundary:

- Final XP and rank are computed by deterministic backend rules.
- AI output is descriptive only (explanations, summaries, stories).
- AI failure or quota limits never block deterministic scoring.
- Reports must remain explainable through persisted evidence and metadata.

## PR XP Award Strategy (Deterministic)

GitRank awards XP from persisted contribution evidence, including:

- contribution category and technical depth
- review strength and maintainer-signal indicators
- test signal and repository context weight
- anti-concentration and diminishing-returns modifiers
- outcome/state weighting and consistency modifiers

This keeps ranking reproducible and resistant to noise farming.

## Architecture

```text
GitHub OAuth + GitHub API
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

## Monorepo Layout

- `gitrank/` Go backend services, migrations, deployment assets, runbooks.
- `frontend/` Next.js app (dashboard, contributions, badges, quests, profile).
- `start.sh` local one-command bootstrapping for infra + backend + frontend.
- `CONTRIBUTING.md` implementation checklists, production decisions, acceptance gates.

## Local Setup

### Prerequisites

- Docker + Docker Compose
- Go
- Node.js + npm
- `psql`, `openssl`, `curl`, `lsof`

### 1) Configure Environment

Backend env file:

```bash
cp -n gitrank/.env.example gitrank/.env
```

Frontend env file:

```bash
cp -n frontend/.env.example frontend/.env.local
```

Set required values in `gitrank/.env`:

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_OAUTH_REDIRECT_URL` (must match GitHub OAuth app callback)
- `GITRANK_SESSION_SECRET`
- `GITRANK_JWT_SIGNING_KEY`
- `GITHUB_TOKEN_ENCRYPTION_KEY`

Optional AI (Gemini-only path in current baseline):

- `AI_PROVIDER=gemini`
- `GEMINI_API_KEY`
- `GEMINI_MODEL` (default `gemini-2.5-flash`)

### 2) Start Everything

```bash
./start.sh
```

`start.sh` will:

- create missing env files from examples
- normalize local Postgres to `localhost:55432`
- recreate local `gitrank-postgres` and `gitrank-redis`
- run migrations
- build and start all backend services
- start frontend on `http://localhost:3000`
- write logs to `.logs/` and PID files to `.run/`

### 3) Open the App

- Frontend: `http://localhost:3000`
- API health: `http://localhost:8080/healthz`

## Sync and Evidence Notes

- `GITHUB_AUTHORED_PR_SYNC_LIMIT` controls authored PR fetch size (local default: `10`).
- Profile and report views are evidence-backed snapshots.
- Partial upstream failures are surfaced as partial/stale evidence states, not hidden.

## Developer Commands

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
npm run build
```

## Troubleshooting

- OAuth callback mismatch: verify GitHub app callback equals `GITHUB_OAUTH_REDIRECT_URL`.
- Sync timeout on large repos: increase `GITHUB_REQUEST_TIMEOUT` (for example `20s` or higher).
- Report shows deterministic-only: AI enrichment was unavailable, but deterministic scoring remains valid.
- Frontend stale or route-hang behavior: rerun `./start.sh` (clears `.next` cache by default).

## Key Docs

- [Backend Workspace README](./gitrank/README.md)
- [Frontend README](./frontend/README.md)
- [Architecture](./gitrank/docs/architecture.md)
- [API Architecture](./gitrank/docs/api-architecture.md)
- [Production Decision Register](./gitrank/docs/production-decision-register.md)
- [Maintainer Guide](./gitrank/docs/MAINTAINER_GUIDE.md)
- [Contributing and Checklists](./CONTRIBUTING.md)

## License

MIT
