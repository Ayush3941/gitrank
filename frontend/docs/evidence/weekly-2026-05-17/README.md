# Frontend Weekly Refinement Evidence (2026-05-17)

This record keeps the human-readable result of the May 17 frontend refinement
loop without storing raw Lighthouse JSON or Playwright screenshots in source
control.

Raw generated evidence belongs under `/ai_test` during an agent run. Promote only
durable tests, scripts, or summarized release evidence into tracked project
directories.

## Home Route Metric Diff

Metric diff (`/` route, incognito Lighthouse):

- performance: `0.41 -> 0.46`
- accessibility: `1.00 -> 1.00`
- best-practices: `0.96 -> 0.96`
- SEO: `1.00 -> 1.00`
- FCP: `1.2s -> 1.2s`
- LCP: `50.1s -> 50.2s`
- TBT: `6970ms -> 2520ms`
- CLS: `0 -> 0`

## Route Metric Snapshot (Incognito Lighthouse)

Scores below were captured during the May 17 local Lighthouse run:

- `dashboard`: perf `0.42`, a11y `1.00`, bp `0.96`, seo `1.00`, LCP `50.4s`, TBT `5950ms`, CLS `0`
- `dashboard/contributions`: perf `0.45`, a11y `1.00`, bp `0.96`, seo `1.00`, LCP `50.2s`, TBT `2940ms`, CLS `0`
- `dashboard/badges`: perf `0.40`, a11y `1.00`, bp `0.96`, seo `1.00`, LCP `50.6s`, TBT `15590ms`, CLS `0`
- `dashboard/quests`: perf `0.37`, a11y `1.00`, bp `0.96`, seo `1.00`, LCP `50.5s`, TBT `10790ms`, CLS `0`
- `dashboard/settings`: perf `0.41`, a11y `1.00`, bp `0.96`, seo `1.00`, LCP `50.4s`, TBT `7740ms`, CLS `0`
- `dashboard/leaderboard`: perf `0.48`, a11y `1.00`, bp `0.96`, seo `1.00`, LCP `4.7s`, TBT `7350ms`, CLS `0`
- `login`: perf `0.45`, a11y `1.00`, bp `0.96`, seo `1.00`, LCP `50.0s`, TBT `3070ms`, CLS `0`
- `u/live-maintainer`: perf `0.40`, a11y `0.98`, bp `0.96`, seo `1.00`, LCP `52.0s`, TBT `7890ms`, CLS `0`

## Contrast Coverage Evidence

Contrast is validated through two independent checks:

- token-level guardrail (`npm run check:contrast`)
- route-level Lighthouse audit (`audits.color-contrast.score = 1`) in the May
  17 local run

## Field Data Comparison Context

Field CWV collection is wired through `web_vital.sample` events and route-group
labels (`WebVitalsReporter`), while this report captures lab-run Lighthouse
snapshots from an isolated local environment. Use this evidence together with
live route-group web-vitals telemetry in production observability before any
release decision.
