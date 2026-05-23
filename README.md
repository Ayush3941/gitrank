# GitRank

GitRank is a contributor intelligence platform that turns GitHub activity into
an evidence-backed reputation system with game mechanics.

Think: contributor analytics + RPG progression + shareable public profile.

## The Vibe

- Every PR becomes a battle report: category, impact, score signals, and growth.
- Progression is visible: XP, levels, badges, quests, streak framing, leaderboard.
- AI explains outcomes, but deterministic scoring stays in control.

## Strict PR XP Award Strategy (Before Gemini)

GitRank enforces a hard separation between scoring and AI narrative:

- PR XP is awarded only by deterministic backend scoring (`pr-analyzer` + `scoring-engine`).
- Gemini runs after scoring and receives read-only scored evidence.
- Gemini cannot create, edit, or override XP, levels, ranks, or badge awards.
- If Gemini is unavailable, scoring and profile progression continue with deterministic fallback copy.

## Product Surface

| Area | What users see |
| --- | --- |
| Dashboard | Contributor identity summary, momentum, XP/level/streak framing |
| Contributions | Rich PR cards, timeline, repository touchpoints, highlights |
| Badges | Earned badge stories, rarity tiers, locked progress states |
| Quests | Daily and weekly challenge framing plus long-journey progression |
| Leaderboard | Rank and progression context with sparse-data-safe states |
| Public Profile | Shareable reputation card with evidence-driven strengths |

## System Shape

```text
GitHub OAuth + API/Webhooks
        |
        v
auth-service -----> github-ingestor -----> pr-analyzer -----> scoring-engine
      |                     |                     |                   |
      +---------------------+---------------------+-------------------+
                                    |
                                    v
                             profile-service
                                    |
                                    v
                               api-gateway
                                    |
                                    v
                          frontend (Next.js BFF + UI)
```

## Repository Map

- `gitrank/`: Go backend workspace (services, packages, deploy, scripts, docs)
- `frontend/`: Next.js app (dashboard, onboarding, profile, leaderboard, PR view)
- `CONTRIBUTING.md`: production policies, V1/V2 checklists, ABRA checklist

Backend service modules:

- `api-gateway`
- `auth-service`
- `github-ingestor`
- `pr-analyzer`
- `scoring-engine`
- `profile-service`
- `scheduler-worker`

## Quick Start (Local)

Prerequisites:

- Go (1.24+ recommended)
- Node.js (20+ recommended)
- Docker + Docker Compose
- `npm`

### 1) Start infra

```bash
cd /home/kali/Desktop/gitrank
make -C gitrank compose-up
```

### 2) Configure backend env

```bash
cd /home/kali/Desktop/gitrank
cp -n gitrank/.env.example gitrank/.env
```

Set at minimum in `gitrank/.env`:

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITRANK_SESSION_SECRET`
- `GITRANK_JWT_SIGNING_KEY`
- `GITHUB_TOKEN_ENCRYPTION_KEY` (32-byte base64 key)

### 3) Run migrations

```bash
cd /home/kali/Desktop/gitrank/gitrank
./scripts/migrate.sh
```

### 4) Start backend services

```bash
cd /home/kali/Desktop/gitrank/gitrank
mkdir -p ../.logs
for svc in auth-service github-ingestor pr-analyzer scoring-engine profile-service scheduler-worker api-gateway; do
  nohup go run "./services/$svc/cmd/$svc" >"../.logs/$svc.log" 2>&1 &
done
```

### 5) Start frontend

```bash
cd /home/kali/Desktop/gitrank
cp -n frontend/.env.example frontend/.env.local
cd frontend
npm install
npm run dev
```

Open:

- frontend: `http://localhost:3000`
- gateway health: `http://localhost:8080/healthz`

Default sync safety cap:

- `GITHUB_AUTHORED_PR_SYNC_LIMIT=10` keeps user sync bounded to the latest authored PRs for responsive local runs.
- Review/comment/file fetches are treated as best-effort during sync so one unstable GitHub sub-endpoint does not fail the entire PR ingestion pass.

## AI Support (Gemini Only, For Now)

GitRank is configured for Gemini as the active AI provider.

Backend (`gitrank/.env`):

- `AI_PROVIDER=gemini`
- `GEMINI_API_KEY=...`
- `GEMINI_MODEL=gemini-2.5-flash`
- `GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai`

Frontend (`frontend/.env.local`):

- `GEMINI_API_KEY=...`
- `GEMINI_MODEL=gemini-2.5-flash`

If Gemini is unavailable, ABRA insight surfaces degrade gracefully with
deterministic fallback text.

## Quality Gates

Backend:

```bash
cd /home/kali/Desktop/gitrank/gitrank
make test
make test-critical-path-flows
make verify-v2-live-readiness
```

Frontend:

```bash
cd /home/kali/Desktop/gitrank/frontend
npm run lint
npm run check:no-production-mocks
npm run test:smoke
npm run build
```

## Deployment and Operations Docs

- Backend workspace guide: [`gitrank/README.md`](./gitrank/README.md)
- Frontend guide: [`frontend/README.md`](./frontend/README.md)
- K8s deployment notes: [`gitrank/deployments/k8s/README.md`](./gitrank/deployments/k8s/README.md)
- Architecture docs: [`gitrank/docs/architecture.md`](./gitrank/docs/architecture.md)
- API architecture: [`gitrank/docs/api-architecture.md`](./gitrank/docs/api-architecture.md)
- Release and live-gate docs: [`gitrank/docs/releases`](./gitrank/docs/releases)
- Contribution policy and checklists: [`CONTRIBUTING.md`](./CONTRIBUTING.md)

## Current Status

- Core local stack is runnable for demo and development.
- Production readiness still depends on live external gates
  (repo controls, observability evidence, rollback/restore proof, and
  environment-specific infra validation).
- See `CONTRIBUTING.md` and live-gate scripts under `gitrank/scripts/`.

## License

MIT
