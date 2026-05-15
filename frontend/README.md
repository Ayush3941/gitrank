# GitRank Frontend

Dark-first Next.js frontend for GitRank, an evidence-backed open-source reputation and progression interface.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS v4
- shadcn/ui-style primitives built in `components/ui`
- TanStack Query
- Motion for React
- Recharts
- Lucide React

## Routes

- `/`
- `/login`
- `/onboarding/connect-github`
- `/onboarding/analyzing`
- `/onboarding/reveal`
- `/dashboard`
- `/dashboard/contributions`
- `/dashboard/badges`
- `/dashboard/quests`
- `/dashboard/leaderboard`
- `/dashboard/settings`
- `/u/[username]`
- `/pr/[owner]/[repo]/[number]`

## Structure

- `app/`: thin App Router entrypoints and layouts
- `components/ui/`: reusable primitives
- `components/shared/`: layout shell, cards, charts, states, and navigation
- `features/*/components/`: page and feature modules
- `features/*/data/`: feature-local constants and clearly labeled marketing sample data
- `hooks/`: TanStack Query hooks
- `lib/api/`: live frontend BFF clients for profile, quests, leaderboard, account actions, sync, and PR reports
- `types/gitrank.ts`: domain model types

## Run

```bash
cd frontend
cp -n .env.example .env.local
npm install
npm run dev
```

## Quality Checks

```bash
npm run lint
npm run check:no-production-mocks
npm run test:smoke
npm run build
```

The root GitHub Actions workflows run the same lint, production-mock boundary, live-fixture smoke, and build checks plus repo-wide scheduled secret and Trivy filesystem scans.

## Data Sources

Quest screens read the live `GET /v1/me/quests` contract through the frontend BFF. PR-report screens read the live `GET /v1/pr/{owner}/{repo}/{number}/report` contract through the frontend BFF, including persisted score-component metadata from newly replayed score events and PR-linked badge unlocks from newly replayed badge awards.

The public profile page, authenticated dashboard overview, onboarding reveal, badge shelf, contribution drill-down, leaderboard, and dashboard settings page now use live profile data:

- browser queries call frontend BFF routes under `app/api/profile/*`
- quest queries call the frontend BFF route at `app/api/profile/me/quests`
- PR report queries call the frontend BFF route at `app/api/pr/[owner]/[repo]/[number]/report`
- leaderboard queries call the frontend BFF route at `app/api/leaderboard`
- those BFF routes proxy to the Go `api-gateway`
- the gateway proxies to `profile-service`
- session and CSRF cookies stay same-origin to the frontend
- dashboard badge, contribution, and recent battle-report panels derive from the authenticated profile snapshot instead of mock PR-analysis detail
- contribution rows surface score-history evidence state plus score/formula version linkage when the backend provides it
- leaderboard rows surface season snapshot IDs, rank movement event IDs, profile-snapshot provenance, score version, source watermark, and missing rank-ledger evidence when the backend provides it
- `npm run check:no-production-mocks` fails CI if production app, hook, feature, or API modules import mock datasets, preview adapters, or demo query plumbing
- frontend CI also runs `../gitrank/scripts/verify_v2_no_mock_release_gate.sh` to verify critical OpenAPI entries, worker-flow coverage, and live fixture coverage stay wired
- `npm run test:smoke` renders dashboard, quest, PR-report, profile, leaderboard, and settings flows from live-shaped BFF fixtures

The gamified UI adds season metadata, rank-progress cards, player-card profile presentation, quest recommendation evidence, badge rarity styling, and PR battle-report explanation panels. Live leaderboard season metadata now comes from the gateway response window when available; final scoring still comes from backend score/profile snapshots.

The marketing landing page uses a dedicated sample fixture under `features/marketing/data/`; it does not import authenticated profile data or any mock app route dataset.

The settings page includes an account-backed reduced-gamification display preference. Authenticated dashboard and reveal flows apply the value from the live profile response, mirror it into browser `localStorage` for immediate rendering, respect OS reduced-motion intent in animated components, and do not change score, badge, or leaderboard state.

The settings page also has live authenticated account actions:

- `/api/sync` proxies to the Go sync trigger route
- `/api/account/export` proxies to the Go account export route and downloads a JSON file with token secrets and secret hashes excluded
- `/api/account/unlink` proxies to the Go account disconnect route
- `/api/account/delete` proxies to the Go account deletion route

## Backend Configuration

The frontend expects the Go gateway at `http://localhost:8080` by default.

Override it with:

```bash
GITRANK_API_BASE_URL=http://localhost:8080
```

If you expose a non-default CSRF cookie name to the browser, also set:

```bash
NEXT_PUBLIC_GITRANK_CSRF_COOKIE_NAME=gitrank_csrf
```

## Optional Gemini ABRA Insights

ABRA insight generation (contribution impact explanation, badge story, identity summary) runs through the frontend server route `POST /api/ai/abra-insights`.

Set these in `frontend/.env.local`:

```bash
GEMINI_API_KEY=your-key
GEMINI_MODEL=gemini-2.5-flash
```

If `GEMINI_API_KEY` is not set or request generation fails, GitRank automatically falls back to deterministic insight copy so demo flows remain stable.
