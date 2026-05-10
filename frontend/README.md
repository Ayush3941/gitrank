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
- `features/*/data/`: feature-local exports and constants
- `hooks/`: TanStack Query hooks
- `lib/api/mock-api.ts`: mock data access layer with delay and preview states
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
npm run build
```

The root GitHub Actions workflows run the same lint/build checks plus repo-wide scheduled secret and Trivy filesystem scans.

## Data Sources

Leaderboard, quest, and PR-report screens still read from `lib/api/mock-api.ts` because the Go gateway does not expose live contracts for those product surfaces yet.

The public profile page, authenticated dashboard overview, badge shelf, contribution drill-down, and dashboard settings page now use live profile data when no demo query param is present:

- browser queries call frontend BFF routes under `app/api/profile/*`
- those BFF routes proxy to the Go `api-gateway`
- the gateway proxies to `profile-service`
- session and CSRF cookies stay same-origin to the frontend
- dashboard badge and contribution screens derive from the authenticated profile snapshot instead of mock PR-analysis detail

The settings page also has live authenticated account actions:

- `/api/sync` proxies to the Go sync trigger route
- `/api/account/unlink` proxies to the Go account disconnect route
- `/api/account/delete` proxies to the Go account deletion route

The demo query params below still force mock preview states for profile/settings so design and error states remain easy to inspect.

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
