# Frontend Performance and Observability

Last updated: May 17, 2026

## Core Web Vitals Budgets

Target budgets (p75):

- LCP <= 2.5s
- INP <= 200ms
- CLS <= 0.1

These thresholds are the frontend quality target for release decisions and are
aligned with the production checklist in `CONTRIBUTING.md`.

Latest Lighthouse lab evidence:

- `frontend/docs/evidence/weekly-2026-05-17/README.md`
- includes incognito route snapshots, route screenshots, and before/after
  metric deltas for the home route.

## Build-Time Performance Budgets

CI guardrail: `npm run check:perf-budgets` after `npm run build`.

Current enforced limits:

- root main JS total <= 700KB
- largest root main JS chunk <= 300KB
- polyfill JS total <= 150KB

Implementation:

- `frontend/scripts/check-performance-budgets.mjs`
- `.github/workflows/frontend-ci.yml`

Bundle composition analysis:

- `npm run analyze:bundle` reports top JavaScript assets by size from
  `.next/build-manifest.json` and fails if the removed `motion` dependency
  regresses into production dependencies.

## Accessibility CI Checks

CI guardrail: `npm run test:a11y`.

Current coverage focuses on shared interactive surfaces and dashboard navigation
landmarks via automated `axe` checks in JSDOM:

- `frontend/tests/accessibility.test.tsx`

This is additive to the live fixture route smoke suite (`npm run test:smoke`).

Additional control-label guard:

- `frontend/tests/accessibility-controls.test.tsx` verifies interactive controls
  keep non-empty accessible names across shared nav, contribution filters, and
  repository-privacy toggles.
- `frontend/tests/settings-form-accessibility.test.tsx` verifies settings
  switch controls expose accessible names and that privacy mutation errors are
  announced and linked via `aria-describedby`/`aria-invalid`.

## Stateful Smoke Coverage

`npm run test:smoke` now covers:

- happy-path dashboard/profile/quests/leaderboard/settings rendering
- stale-state quest snapshot rendering
- leaderboard error-state rendering
- stale sync-status rendering on settings

## BFF Route Contract Coverage

CI guardrail: `npm run test:contracts`.

Contract tests verify frontend BFF route mappings for critical endpoints:

- `/api/profile/me` -> `/v1/me/profile`
- `/api/profile/me/quests` -> `/v1/me/quests`
- `/api/leaderboard` -> `/v1/leaderboard`
- `/api/sync/user` -> `/v1/sync/user/execute`
- `/api/pr/[owner]/[repo]/[number]/report` -> encoded `/v1/pr/.../report`

## Client Environment Safety Guard

CI guardrail: `npm run check:client-env-safety`.

This check fails if non-`NEXT_PUBLIC_` environment keys are referenced from
client-scoped modules.

Implementation:

- `frontend/scripts/check-client-env-safety.mjs`
- `.github/workflows/frontend-ci.yml`

## Server-Boundary and Cache Strategy Guards

CI guardrails:

- `npm run check:server-boundaries`
- `npm run check:cache-strategy`

These checks enforce:

- `server-only` markers on server-sensitive frontend modules.
- no client imports of server-only modules.
- `dynamic = "force-dynamic"` on frontend route handlers.
- `cache: "no-store"` fetch policy on frontend API adapters.

Implementation:

- `frontend/scripts/check-server-boundaries.mjs`
- `frontend/scripts/check-route-cache-strategy.mjs`

## Contrast and Layout-Stability Guards

CI guardrails:

- `npm run check:contrast`
- `npm run check:media-stability`
- `npm run check:main-thread`

These checks enforce:

- token-level contrast ratios for key dark-theme text/surface pairs.
- width/height or explicit aspect-ratio requirements for `<img>` and Next
  `<Image>` usage to reduce CLS risk.
- static rejection of aggressive client polling (`setInterval < 4000ms`),
  `requestAnimationFrame` loops, and client infinite-loop patterns that can
  degrade INP on secondary routes.

Implementation:

- `frontend/scripts/check-contrast-tokens.mjs`
- `frontend/scripts/check-media-layout-stability.mjs`
- `frontend/scripts/check-main-thread-guards.mjs`

## Field CWV Collection

Field web-vitals collection is emitted from `WebVitalsReporter` in root layout
using `useReportWebVitals` and grouped into bounded route families.

Events:

- `web_vital.sample` with `metric_name`, `metric_value`, `metric_rating`,
  `route_group`.

Gateway metrics:

- `gitrank_frontend_web_vital_samples_total`
- `gitrank_frontend_web_vital_value_total`

## Frontend Product Analytics Events

Frontend emits bounded events through `POST /api/analytics/events`, proxied to
`/v1/analytics/events` and enforced by API-gateway event allowlist.

Coverage implemented:

- onboarding: `onboarding.started`, `onboarding.sync.started`, `onboarding.completed`
- sync outcomes: `sync.succeeded`, `sync.failed`
- score explanation: `score_explanation.opened`
- badge view: `badge.viewed`
- share actions: `profile.shared`
- empty/error/stale state incidence:
  `empty_state.viewed`, `error_state.viewed`, `stale_state.viewed`

## Route-Level Tracking Notes

Current event target naming uses `route:state` patterns, for example:

- `dashboard:error`
- `contributions:empty`
- `public-profile:stale`
- `leaderboard:no-live-rows`

This supports dashboard charting by route family and state type.
