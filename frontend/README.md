# GitRank Frontend

Dark-first Next.js frontend for GitRank, an evidence-backed open-source reputation and progression interface.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS v4
- Local bundled fonts via `next/font/local` (Space Grotesk, Orbitron, IBM Plex Mono)
- shadcn/ui-style primitives built in `components/ui`
- TanStack Query
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
- `features/*/data/`: feature-local constants
- `hooks/`: TanStack Query hooks
- `lib/api/`: live frontend BFF clients for profile, quests, leaderboard, account actions, sync, and PR reports
- `types/gitrank.ts`: domain model types

## Run

```bash
cd frontend
set -a && source ../gitrank/.env && set +a
npm install
npm run dev
```

Font assets are bundled in `public/assets/fonts` so local and CI builds do not require live Google Fonts fetches.

## Quality Checks

```bash
npm run lint
npm run check:no-production-mocks
npm run check:no-hardcoded-identities
npm run check:copy-tone
npm run check:sync-copy-policy
npm run check:onboarding-prefetch-policy
npm run check:oauth-prefetch-policy
npm run check:dashboard-route-copy-policy
npm run check:env-example-coverage
npm run check:route-state-primitives
npm run check:jsx-ids
npm run check:main-landmark
npm run check:navigation-landmarks
npm run check:scroll-jumps
npm run check:motion-budget
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
- `npm run check:no-hardcoded-identities` fails CI if production frontend modules include banned personal/demo identity literals (`Ayush3941`, `Ayush Kumar Gaur`, `octocat`)
- `npm run check:copy-tone` fails CI if production UI copy regresses to stale/non-conversational negation phrases such as "could not load" or "is not available in this snapshot yet"
- `npm run check:sync-copy-policy` fails CI if production frontend modules reintroduce manual-sync phrasing (`Run sync`, `Sync now`) instead of auto-sync guidance copy
- `npm run check:onboarding-prefetch-policy` fails CI if onboarding/marketing `next/link` usage omits explicit `prefetch={false}` in performance-sensitive entry flows
- `npm run check:oauth-prefetch-policy` fails CI if links targeting `/oauth/github/start` omit strict prefetch-disable policy (`IntentPrefetchLink prefetchMode="never"` or `Link prefetch={false}`)
- `npm run check:dashboard-route-copy-policy` fails CI if dashboard route pages stop sourcing metadata from `dashboardNavByHref`, preventing nav-label and metadata drift
- `npm run check:env-example-coverage` fails CI when frontend runtime env keys in source drift from `gitrank/.env.example` (missing declarations or stale unused keys)
- `npm run check:route-state-primitives` fails CI if route `loading`, `error`, `global-error`, or `not-found` files stop using shared route-state UI primitives
- `npm run check:jsx-ids` fails CI if a TSX file reuses the same literal `id` more than once, preventing duplicate region IDs that break a11y and section controls
- `npm run check:main-landmark` fails CI if feature/page components render extra `<main>` landmarks; `AppShell` owns the single `#main-content` skip-link target
- `npm run check:navigation-landmarks` fails CI if any `<nav>` or `role="navigation"` region lacks an accessible name
- `npm run check:scroll-jumps` fails CI if product routes reintroduce direct `window.scrollTo`/`scrollIntoView` style APIs that can cause viewport jumps
- `npm run check:motion-budget` fails CI if product routes reintroduce heavy animation patterns (`framer-motion`, animation utility classes, keyframes, or `transition: all`)
- `npm run check:perf-budgets` reads `.next/build-manifest.json`; without a prior frontend build it exits cleanly with guidance, and `STRICT_PERF_BUDGET_MANIFEST=1` enforces hard-fail behavior
- frontend CI enforces these UI integrity checks directly (`no-hardcoded-identities`, `copy-tone`, `query-policy`, `jsx-keys`, `jsx-ids`, `nested-interactive`, `scroll-jumps`, `motion-budget`) so regressions fail pull requests before merge
- frontend CI also runs `../gitrank/scripts/verify_v2_no_mock_release_gate.sh` to verify critical OpenAPI entries, worker-flow coverage, and live fixture coverage stay wired
- `npm run test:smoke` renders dashboard, quest, PR-report, profile, leaderboard, and settings flows from live-shaped BFF fixtures

The gamified UI adds season metadata, rank-progress cards, player-card profile presentation, quest recommendation evidence, badge rarity styling, and PR battle-report explanation panels. The interface now uses a consistent neon/cyberpunk visual language across dashboard tabs, onboarding, public profile internals, PR report internals, and chart surfaces while preserving reduced-gamification accessibility behavior. Live leaderboard season metadata now comes from the gateway response window when available; final scoring still comes from backend score/profile snapshots.

The marketing landing page avoids synthetic contributor identities and does not import authenticated profile data or any mock app route dataset.

The settings page includes an account-backed reduced-gamification display preference. Authenticated dashboard and reveal flows apply the value from the live profile response, mirror it into browser `localStorage` for immediate rendering, respect OS reduced-motion intent in animated components, and do not change score, badge, or leaderboard state.

Authenticated dashboard routes now use background auto-sync instead of manual sync buttons:

- dashboard layout triggers bounded `POST /api/sync/user` execution when authenticated profile state is stale
- sync success invalidates profile-derived dashboard caches (`dashboard`, `contributions`, `badges`, `quests`, `leaderboard`) so tabs refresh without a hard reload
- sync failures are surfaced through stale/partial state messaging and retried opportunistically while the user stays in authenticated routes
- "Synced" presentation now requires PR contribution evidence (not repository rows alone), preventing false-green freshness when only repo metadata is available
- auto-sync no longer force-retries only because merged PR count is zero; retries now key off bootstrap/stale-age signals to avoid unnecessary refresh churn

The settings page has live authenticated account actions:

- `/api/account/export` proxies to the Go account export route and downloads a JSON file with token secrets and secret hashes excluded
- `/api/account/unlink` proxies to the Go account disconnect route
- `/api/account/delete` proxies to the Go account deletion route
- `/api/session/logout` proxies to auth-service session invalidation and clears frontend-visible auth cookies

Frontend product analytics now posts bounded events to backend `POST /v1/analytics/events` through `/api/analytics/events` for:

- onboarding completion
- sync success and failure
- score explanation views
- badge page views
- sampled Core Web Vitals (`CLS`, `FCP`, `LCP`, `INP`, `TTFB`, `FID`) with route-group tags

Adjust vitals sampling in `gitrank/.env` if needed:

```bash
NEXT_PUBLIC_WEB_VITALS_SAMPLE_RATE=0.35
```

## Backend Configuration

Set these server-side env vars in `gitrank/.env` for frontend proxy routes:

```bash
GITRANK_API_BASE_URL=http://localhost:8080
GITRANK_AUTH_BASE_URL=http://localhost:8081
```

If you expose a non-default CSRF cookie name to the browser, also set:

```bash
NEXT_PUBLIC_GITRANK_CSRF_COOKIE_NAME=gitrank_csrf
```

Set deterministic score-version fallback copy used when score history metadata is missing:

```bash
NEXT_PUBLIC_GITRANK_SCORE_VERSION_FALLBACK=v1alpha1
```

If your backend uses a non-default session cookie name:

```bash
AUTH_SESSION_COOKIE_NAME=gitrank_session
```

GitHub auth is initiated and completed through frontend routes:

- `GET /oauth/github/start`
- `GET /oauth/github/callback`

These routes proxy to auth-service and preserve auth cookies on the frontend origin.

Optional contribution UI policy values (no hardcoded thresholds in component logic):

```bash
NEXT_PUBLIC_GITRANK_CONTRIBUTION_CARD_PAGE_SIZE=12
NEXT_PUBLIC_GITRANK_CONTRIBUTION_CARD_PAGE_SIZE_CONSTRAINED=6
NEXT_PUBLIC_GITRANK_CONTRIBUTION_RENDER_HARD_CAP=100
NEXT_PUBLIC_GITRANK_ABRA_CONTRIBUTION_SAMPLE_LIMIT=24
NEXT_PUBLIC_GITRANK_HIGH_XP_THRESHOLD=200
```

## Optional ChatGPT ABRA Insights

ABRA insight generation (contribution impact explanation, badge story, identity summary) runs through the frontend server route `POST /api/ai/abra-insights`.

PR XP and rank progression are not AI-authored: deterministic backend scoring is finalized before this route runs, and ChatGPT receives read-only scored evidence for explanation only.

Set these in `gitrank/.env`:

```bash
OPENAI_API_KEY=your-key
OPENAI_MODEL=gpt-4o-mini
# optional override
# OPENAI_BASE_URL=https://api.openai.com/v1
```

If `OPENAI_API_KEY` is not set or request generation fails, GitRank automatically falls back to deterministic insight copy so demo flows remain stable.
