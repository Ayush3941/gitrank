# Frontend UX Changelog

## 2026-05-17

- Added field web-vitals reporting (`useReportWebVitals`) with bounded
  route-group tagging via `WebVitalsReporter` mounted in root layout.
- Extended analytics payload and gateway ingestion for `web_vital.sample`
  including metric name/value/rating plus route-group labels.
- Added frontend observability dashboard manifest:
  `gitrank/deployments/observability/grafana/gitrank-frontend-ux-dashboard.json`
  covering route-level error/stale rates and route-group web-vitals trends.
- Added CI guards for:
  - contrast token thresholds
  - media layout stability (`<img>` and `<Image>` sizing/aspect-ratio)
  - server/client boundary enforcement (`server-only` checks)
  - route cache strategy (`dynamic = "force-dynamic"` and `cache: "no-store"`)
  - bundle composition report with dependency-regression check
- Removed unused `motion` dependency from production frontend dependencies.
- Added micro-feedback announcements for:
  - onboarding sync completion
  - newly unlocked badges
  - existing profile share-copy confirmation flow
- Hardened settings form accessibility by linking mutation errors to controls via
  `aria-describedby` + `aria-invalid` and announcing notices/errors with
  `role="status"` / `role="alert"`.
- Added dedicated settings accessibility regression coverage to enforce
  non-empty control names and privacy error announcement/linkage behavior.

## 2026-05-16

- Added shared dashboard navigation contract (`dashboard-nav.ts`) so desktop and
  mobile nav keep identical route semantics.
- Added root and dashboard fallback UX:
  - `app/not-found.tsx`
  - `app/global-error.tsx`
  - `app/(app)/dashboard/not-found.tsx`
  - `app/(app)/dashboard/error.tsx`
- Added interactive accessibility baseline:
  - global `:focus-visible` outline fallback
  - minimum 24x24 target baseline through `.focus-ring`
- Added frontend response security headers policy in `next.config.ts` with
  report-only CSP scaffolding.
- Added route metadata coverage for major routes, including dashboard tabs,
  onboarding routes, marketing/login, public profile, and PR report routes.
- Added SEO crawl assets and canonical coverage:
  - `app/robots.ts`
  - `app/sitemap.ts`
  - canonical metadata on profile and PR report routes
- Made shared `EmptyState`, `ErrorState`, and `StaleState` actionable with
  route links and retry behavior instead of dead-end buttons.
- Added frontend analytics coverage for empty/error/stale incidence and profile
  share actions, plus onboarding-start/sync-start events.
- Added CI guardrails for client env safety and bundle/performance budgets.
- Expanded smoke coverage to include stale and error state route transitions and
  stale sync-status rendering.
- Added dedicated BFF route mapping contract tests and wired them into frontend CI.
