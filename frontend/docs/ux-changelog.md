# Frontend UX Changelog

## 2026-05-17

- Optimized hero/background rendering while preserving cyber style:
  - compressed `public/background.jpg` from large source to web-safe size
  - added `public/background.webp` and CSS `image-set()` fallback selection
  - moved to fixed desktop + scroll-mobile background attachment policy
- Added always-accessible theme switching and readability pass:
  - new shared `ThemeQuickSwitcher` action in dashboard top bar + sidebar
  - theme switcher is also available on landing and login onboarding screens
  - public profile hero and PR battle report now expose quick theme switching
  - theme changes now announce via polite live region for assistive tech
  - added shared `TextScaleQuickSwitcher` so `Default`/`Large` text mode is
    quickly reachable in dashboard, landing, login, public profile, and PR
    report surfaces without opening settings
  - new global text-scale preference (`Default` / `Large`) with settings
    controls and persisted document-level rendering mode
  - settings now includes a live readability preview panel for current theme
  - stronger global text tokens for body/supporting copy across all themes
  - raised global type baseline (`16px` floor, higher line-height) for clearer
    scanning on laptop/mobile displays
  - removed low-opacity text usage in shared headers, sync pills, and form
    placeholders where contrast was unnecessarily weak.
- Smoothed and simplified shell glow layers in `AppShell` to reduce decorative
  overdraw and avoid abrupt glow cutoffs.
- Added responsive visual cost guard in `app/globals.css`:
  - disables expensive backdrop blur on smaller screens
  - reduces heavy shadows and background overlays for lower GPU pressure
  - kept reduced-motion behavior while removing duplicate global motion rules
- Tuned shared `cyber-card` overlays and hover shadows to reduce per-card paint
  work while retaining visual hierarchy.
- Extended reduced-gamification defaults to include browser reduced-data
  preference (`navigator.connection.saveData`) when no explicit account/local
  override is set.
- Added theme fallback behavior for accessibility: when no stored theme exists,
  the app now auto-selects `high-contrast` if the OS/browser advertises
  `prefers-contrast: more`.
- Improved readability consistency:
  - shared headers now use constrained reading measure and calmer line-height
  - heading text uses `text-wrap: balance` for cleaner multi-line wraps
  - `high-contrast` theme now renders heading titles without gradient text fill
    to maximize legibility.
- Interaction refinement: global interactive transition baseline now limits
  transition properties to color/background/border/shadow/opacity/transform
  instead of broad implicit transitions.
- Adjusted overlay density to reveal more of the locked background image while
  preserving readable text contrast, and added Safari-compatible
  `-webkit-backdrop-filter` + no-backdrop fallback surfaces.
- Added consistent `PageHeader` primary actions across key routes
  (dashboard/contributions/badges/quests/leaderboard/settings/PR report) so
  each page has a clear next action instead of dead-end reading states.
- Upgraded settings theme chooser with visual swatches and explicit `Active`
  status chip for faster mode recognition.
- Onboarding UX upgrade:
  - added a shared 4-step onboarding progress indicator (sign in → connect →
    analyze → reveal) with `aria-current="step"` semantics
  - wired step state into login, connect, analyzing pipeline, reveal, and
    reveal-unavailable/skeleton states
  - added progressive-disclosure details on OAuth connect screen for "what is
    read" vs "what is not read by default".
- Reveal flow now includes a "What to do next" 3-step action lane and direct
  CTA to contribution drill-down, reducing post-onboarding dead-end behavior.
- Added shared numeric readability utility (`font-variant-numeric:
  tabular-nums`) and applied it to major stat/leaderboard readouts for more
  stable, legible number scanning.
- Landing hero clarity update: added audience chips (maintainers/contributors/
  hiring teams) and a direct "See onboarding flow" CTA for faster first-screen
  comprehension during demos.
- Mobile interaction pass:
  - fixed bottom mobile nav now respects iOS safe-area insets via `env()`
  - hover-only glow behavior is neutralized on non-hover devices
  - coarse-pointer devices now enforce larger minimum interactive hit areas via
    `.focus-ring`.
- Sync pipeline now includes an explicit completion progress meter with text
  equivalent (`N of M phases completed`) to improve status clarity.
- Contributions UX/performance pass:
  - contributions query now caches profile data under a stable key and applies
    filter/sort/search transforms via `select`, avoiding redundant profile
    refetch on every filter keystroke
  - contributions page now uses deferred filter/search/sort state updates to
    keep interactions responsive
  - added live result count + reset-filters action in the filter bar.
- Expanded stale-state visibility beyond dashboard:
  - contributions and badges routes now show explicit stale snapshot banners
    when profile sync state is stale, with direct settings CTA.
  - leaderboard route now shows stale profile context warning with sync CTA.
- Badges filter UX now mirrors contributions:
  - live "showing X of Y" status
  - one-click reset filters action
  - transitions for filter state updates to keep interactions smooth.
- Repository privacy panel now supports large account lists better:
  - live total/public/hidden counters
  - search by repository or visibility reason
  - All/Public/Hidden quick filter chips
  - reset control and empty-filter state messaging.
- Query reuse optimization:
  - dashboard, badges, and quests hooks now reuse cached `profile/me` query
    data via `ensureQueryData` instead of triggering independent profile fetches
  - added short stale-time windows to reduce rapid tab-switch network churn.
- Leaderboard tab switching now preserves previous snapshot while fetching the
  next tab (`placeholderData`) and surfaces a lightweight live refresh status
  instead of full-page flicker.
- Added shared profile-share action component with native-share → clipboard
  fallback chain and integrated it across:
  - public profile hero
  - dashboard hero card
  - onboarding reveal completion panel
  for consistent share behavior and copy feedback.
- Added `content-visibility` rendering optimization class and applied it to
  high-volume card lists (contributions, leaderboard rows, badges, quests,
  best PRs, repository privacy list) to reduce offscreen paint/layout cost.
- Added dashboard top-bar profile share action to align sharing affordances
  across the major authenticated profile surfaces.
- Added `aria-busy` state hints on contribution and leaderboard list surfaces
  during client-side filter/tab refresh transitions.
- Added reusable copy-text control for content snippets and integrated it into:
  - contribution impact statement cards
  - badge achievement story cards
  - best PR summary cards
  so users can quickly reuse polished lines for profiles, resumes, and demos.
- Added settings-header profile sharing action so public-link copy/share is
  available directly from privacy controls.
- Hardened copy/share controls:
  - explicit manual-copy and failure states
  - failure analytics targets for clipboard/share errors
  - dedicated polite live-region status output for assistive tech.
- Public profile hero now includes one-click "copy headline" action for
  presentation-ready identity copy reuse.
- Normalized XP/number formatting on key surfaces (top bar, league card, recent
  reports, best PRs, PR report hero, and next-level gate) using locale-aware
  formatting plus shared numeric-readout styling.
- Hardened `ErrorState` fallback behavior: fallback action now renders only when
  a valid link target or callback exists, avoiding inert fallback buttons.
- Added global accessibility navigation + motion-respect refinements:
  - root `Skip to main content` link in `app/layout.tsx`
  - `AppShell` now renders semantic `<main id="main-content">`
  - system-level `@media (prefers-reduced-motion: reduce)` guard in
    `app/globals.css` to disable non-essential animation and smooth-scroll
- Reduced decorative rendering cost on smaller screens by gating heavier
  background layers in `AppShell` behind responsive breakpoints.
- Added route-level `loading.tsx` coverage for major surfaces:
  - `app/(app)/dashboard/loading.tsx`
  - `app/(public)/u/[username]/loading.tsx`
  - `app/(public)/pr/[owner]/[repo]/[number]/loading.tsx`
  - `app/(marketing)/loading.tsx`
  using a shared `RouteLoadingState` shell for consistent perceived-performance
  feedback during App Router navigation.
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
- Fixed visual-regression fixture isolation by moving shared live fixtures into
  `tests/helpers/live-fixtures.tsx` so visual tests do not import/execute smoke
  test suites as side effects.
- Added public-profile route visual regression coverage to keep share-card hero
  presentation stable in snapshot tests.
- Added weekly refinement evidence bundle under
  `frontend/docs/evidence/weekly-2026-05-17/` with route screenshots plus
  Lighthouse JSON artifacts and before/after metric diffs.
- Hardened client analytics emission with short abort windows plus `keepalive`
  so telemetry failures do not hold open route transitions in local/offline
  conditions.

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
