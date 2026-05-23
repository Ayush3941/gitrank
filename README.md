# GitRank

GitRank is an evidence-first contributor intelligence platform.
It converts real GitHub contribution history into explainable score signals,
progression metrics, and shareable contributor profiles.

## Why GitRank

- Uses real GitHub identity and contribution evidence.
- Scores with deterministic backend rules, not opaque AI outputs.
- Presents contribution quality through PR battle reports, skills, badges, and
  progression.
- Supports Gemini summaries for narrative context without changing score truth.

## Core Product Capabilities

- GitHub OAuth sign-in and account linking.
- Authenticated sync of authored PR evidence (bounded for reliability).
- Deterministic XP, rank, badge, and progression calculation.
- PR battle report view with score components and evidence metadata.
- Public profile and dashboard views with privacy controls.

## Scoring and AI Boundary (Strict)

GitRank enforces a non-negotiable separation:

- Score state is deterministic and persisted by backend scoring logic.
- AI is read-only and optional; it can explain evidence, not grade it.
- If AI is unavailable, the system falls back to deterministic summaries and
  keeps scoring live.

## High-Level Architecture

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

## Repository Structure

- `gitrank/`: Go services, shared packages, migrations, deployment assets.
- `frontend/`: Next.js dashboard, public profile, and UX surfaces.
- `start.sh`: one-command local bootstrap for infra + backend + frontend.
- `CONTRIBUTING.md`: implementation checklists, decisions, and standards.

## Local Quickstart

### 1. Start Everything

```bash
cd /home/kali/Desktop/gitrank
./start.sh
```

`start.sh` automatically:

- creates `gitrank/.env` and `frontend/.env.local` from examples when missing
- ensures local DB URL is on `localhost:55432`
- starts Postgres + Redis via Docker Compose
- runs DB migrations
- builds and boots backend services
- starts frontend dev server on `http://localhost:3000`
- writes logs to `.logs/` and PID files to `.run/`

### 2. Open the App

- Frontend: `http://localhost:3000`
- API health: `http://localhost:8080/healthz`

## Environment Baseline

Set these in `gitrank/.env` before serious local testing:

| Key | Required | Purpose |
| --- | --- | --- |
| `GITHUB_CLIENT_ID` | Yes | GitHub OAuth client ID |
| `GITHUB_CLIENT_SECRET` | Yes | GitHub OAuth client secret |
| `GITHUB_OAUTH_REDIRECT_URL` | Yes | Must match OAuth app callback |
| `GITRANK_SESSION_SECRET` | Yes | Session signing secret |
| `GITRANK_JWT_SIGNING_KEY` | Yes | JWT signing key |
| `GITHUB_TOKEN_ENCRYPTION_KEY` | Yes | Encrypts stored GitHub tokens |
| `AI_PROVIDER=gemini` | Yes (if AI on) | Current AI provider path |
| `GEMINI_API_KEY` | Yes (if AI on) | Gemini API credential |

Frontend environment is read from `frontend/.env.local`.

## Current Local Sync Behavior

- `GITHUB_AUTHORED_PR_SYNC_LIMIT=10` by default for stable local performance.
- Sync writes evidence-first records, then recomputed score/profile snapshots.
- Partial upstream failures surface as partial evidence, not fabricated data.

## Development Commands

Backend:

```bash
cd /home/kali/Desktop/gitrank/gitrank
make test
make test-critical-path-flows
```

Frontend:

```bash
cd /home/kali/Desktop/gitrank/frontend
npm run lint
npm run test:smoke
npm run build
```

## Troubleshooting

- OAuth callback error: ensure `GITHUB_OAUTH_REDIRECT_URL` exactly matches your
  GitHub OAuth app callback URL.
- Sync timeout errors: raise `GITHUB_REQUEST_TIMEOUT` in `gitrank/.env` and
  retry.
- Deterministic-only PR report: AI enrichment is unavailable (key/quota/config)
  but deterministic scoring is still valid.
- Frontend serving stale output: rerun `./start.sh` (clears frontend cache by
  default).

## Documentation

- Backend overview: [`gitrank/README.md`](./gitrank/README.md)
- Frontend overview: [`frontend/README.md`](./frontend/README.md)
- Architecture: [`gitrank/docs/architecture.md`](./gitrank/docs/architecture.md)
- API architecture: [`gitrank/docs/api-architecture.md`](./gitrank/docs/api-architecture.md)
- Production decision register: [`gitrank/docs/production-decision-register.md`](./gitrank/docs/production-decision-register.md)
- Maintainer guide: [`gitrank/docs/MAINTAINER_GUIDE.md`](./gitrank/docs/MAINTAINER_GUIDE.md)
- Contribution and delivery checklists: [`CONTRIBUTING.md`](./CONTRIBUTING.md)

## License

MIT
