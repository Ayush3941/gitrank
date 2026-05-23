# GitRank

GitRank is an evidence-first contributor intelligence platform for open source.
It ingests real GitHub contribution data, computes deterministic reputation
signals, and presents them as a gamified profile with explainable PR battle
reports.

## What GitRank Does

- Uses GitHub OAuth for real account sign-in and linking.
- Syncs contribution evidence from GitHub into local persistence.
- Computes deterministic XP/score/rank progression from persisted evidence.
- Produces PR battle reports with explainable scoring components.
- Adds Gemini-generated narrative layers (when configured) without allowing AI
  to alter score outcomes.

## Deterministic Scoring Rule (Strict)

GitRank enforces a hard boundary between scoring and AI:

- XP, rank, level, and badges are awarded by deterministic backend logic only.
- Gemini consumes scored evidence in read-only mode for explanations.
- AI output cannot write or override final score state.
- If Gemini is unavailable, user-visible summaries fall back gracefully while
  scoring continues normally.

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

- `gitrank/` Go backend workspace (services, DB migrations, deploy, scripts)
- `frontend/` Next.js app (dashboard, contributions, badges, quests, profile)
- `start.sh` one-command local startup for infra + backend + frontend
- `CONTRIBUTING.md` policy decisions, checklists, and roadmap waves

## Local Deployment

### Fast Path (recommended)

```bash
cd /home/kali/Desktop/gitrank
./start.sh
```

`start.sh` does all of the following:

- ensures `.env` / `.env.local` exist from examples
- normalizes local Postgres URL to `localhost:55432`
- starts Postgres + Redis containers
- runs migrations
- builds/starts backend services
- starts frontend dev server (webpack mode for stability)
- writes logs to `.logs/` and pids to `.run/`

### Manual Path

```bash
cd /home/kali/Desktop/gitrank
cp -n gitrank/.env.example gitrank/.env
cp -n frontend/.env.example frontend/.env.local
cd gitrank && ./scripts/migrate.sh
```

Then start backend services and frontend manually.

## Required Environment Configuration

At minimum in `gitrank/.env`:

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITRANK_SESSION_SECRET`
- `GITRANK_JWT_SIGNING_KEY`
- `GITHUB_TOKEN_ENCRYPTION_KEY` (32-byte base64 key)

Gemini (current supported AI path):

- `AI_PROVIDER=gemini`
- `GEMINI_API_KEY=...`
- `GEMINI_MODEL=gemini-2.5-flash`
- `GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai`

Optional frontend AI settings in `frontend/.env.local`:

- `GEMINI_API_KEY=...`
- `GEMINI_MODEL=gemini-2.5-flash`

## Sync and Evidence Behavior

- User sync is intentionally bounded (`GITHUB_AUTHORED_PR_SYNC_LIMIT=10` by
  default) for predictable local performance.
- Sync persists evidence-first records and recomputed aggregates.
- Partial GitHub endpoint failures degrade to partial evidence rather than
  fabricating values.
- Battle reports and profile cards display deterministic fallback states when AI
  enrichment is missing or rate-limited.

## No Fake Data Policy

GitRank UI paths are designed to avoid fake contributor identities in primary
authenticated flows. Preview states must be explicitly labeled and must not be
presented as real synced users.

## Quality Commands

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

- If OAuth fails: verify `GITHUB_OAUTH_REDIRECT_URL` exactly matches your GitHub
  OAuth app callback URL.
- If sync shows timeouts: increase `GITHUB_REQUEST_TIMEOUT` (e.g. `20s` or
  higher) and retry.
- If report says deterministic-only: Gemini key/quota/config is unavailable;
  deterministic scoring still remains valid.
- If frontend shows stale behavior: restart with `./start.sh` (it clears
  frontend cache by default).

## Additional Docs

- Backend overview: [`gitrank/README.md`](./gitrank/README.md)
- Frontend overview: [`frontend/README.md`](./frontend/README.md)
- K8s notes: [`gitrank/deployments/k8s/README.md`](./gitrank/deployments/k8s/README.md)
- Architecture: [`gitrank/docs/architecture.md`](./gitrank/docs/architecture.md)
- API architecture: [`gitrank/docs/api-architecture.md`](./gitrank/docs/api-architecture.md)
- Release docs: [`gitrank/docs/releases`](./gitrank/docs/releases)
- Governance and implementation checklists: [`CONTRIBUTING.md`](./CONTRIBUTING.md)

## License

MIT
