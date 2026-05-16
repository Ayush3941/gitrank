# Frontend UX Changelog

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
