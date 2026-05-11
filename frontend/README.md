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
- `lib/demo/preview-api.ts`: development-gated preview adapter for mock loading, error, empty, and stale states
- `lib/demo/mock-api.ts`: mock data access layer used only by the preview adapter
- `lib/mock-data/gitrank.ts`: main mock domain dataset for Ayush3941
- `types/gitrank.ts`: domain model types

## Run

```bash
cd frontend
npm install
npm run dev
```

## Quality Checks

```bash
npm run lint
npm run check:no-production-mocks
npm run build
```

The root GitHub Actions workflows run the same lint/build checks plus repo-wide scheduled secret and Trivy filesystem scans.

## Data Sources

Quest screens now read the live `GET /v1/me/quests` contract through the frontend BFF when no demo query param is present. PR-report screens now read the live `GET /v1/pr/{owner}/{repo}/{number}/report` contract through the frontend BFF when no demo query param is present.

The public profile page, authenticated dashboard overview, onboarding reveal, badge shelf, contribution drill-down, leaderboard, and dashboard settings page now use live profile data when no demo query param is present:

- browser queries call frontend BFF routes under `app/api/profile/*`
- quest queries call the frontend BFF route at `app/api/profile/me/quests`
- PR report queries call the frontend BFF route at `app/api/pr/[owner]/[repo]/[number]/report`
- leaderboard queries call the frontend BFF route at `app/api/leaderboard`
- those BFF routes proxy to the Go `api-gateway`
- the gateway proxies to `profile-service`
- session and CSRF cookies stay same-origin to the frontend
- dashboard badge and contribution screens derive from the authenticated profile snapshot instead of mock PR-analysis detail
- `npm run check:no-production-mocks` fails CI if production app, hook, feature, or API modules import the mock API or mock domain dataset directly

The gamified UI adds season metadata, rank-progress cards, player-card profile presentation, quest recommendation evidence, badge rarity styling, and PR battle-report explanation panels. Live leaderboard season metadata is derived from the gateway response timestamp and displayed as presentation context; final scoring still comes from backend score/profile snapshots.

The marketing landing page uses a dedicated sample fixture under `features/marketing/data/`; it does not import the mock authenticated profile dataset.

The settings page includes an account-backed reduced-gamification display preference. Authenticated dashboard and reveal flows apply the value from the live profile response, mirror it into browser `localStorage` for immediate rendering, respect OS reduced-motion intent in animated components, and do not change score, badge, or leaderboard state.

The settings page also has live authenticated account actions:

- `/api/sync` proxies to the Go sync trigger route
- `/api/account/unlink` proxies to the Go account disconnect route
- `/api/account/delete` proxies to the Go account deletion route

The demo query params below are development-gated. They force mock preview states only when `NODE_ENV !== "production"` or `GITRANK_ENABLE_DEMO_PREVIEWS=true` is set, so production URLs keep using live BFF routes by default.

Supported preview query params:

- `?demo=loading`
- `?demo=error`
- `?demo=empty`
- `?demo=stale`

Example:

```bash
/dashboard?demo=stale
```

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
