# Frontend UX Changelog

## 2026-05-17

- Added a new `Aurora clarity` theme tuned for long-read dashboard sessions:
  - brighter body/supporting copy tokens with softer accent glow
  - exposed in settings, quick theme switcher, and keyboard theme-cycle flow
  - preserved deterministic behavior (theme-only visual change; no scoring/data effects)
- Global readability hardening pass:
  - raised shared tiny-text baseline (`text-xs`) and placeholder contrast
  - stronger muted/supplementary text rendering for `Aurora` and `High contrast`
    so explanatory copy is easier to scan
  - added `@media (prefers-reduced-transparency: reduce)` fallback to suppress
    blur-heavy surfaces and background overlays for clearer text and lower GPU cost
- Smoothed shell atmosphere rendering in `AppShell`:
  - simplified layered glow/background grid composition
  - reduced decorative overdraw while keeping neon/cyberpunk identity
- Navigation/control readability polish:
  - increased sidebar and mobile-nav label legibility (size/spacing/contrast)
  - reduced active-item glow harshness while preserving selection clarity
  - tuned shared button variants for clearer default text and lighter shadow cost
  - added consistent disabled control treatment (`opacity` + `saturation`) for
    clearer state signaling.
- Global micro-typography readability normalization:
  - reduced overly-wide uppercase label tracking app-wide (`tracking-[0.24em]`,
    `tracking-[0.22em]`, `tracking-[0.2em]`, `tracking-[0.32em]`) using central
    CSS overrides to improve scan speed on dashboard cards and metrics
  - added `prefers-contrast: more` enhancements for stronger focus outlines and
    clearer muted/supporting text in user high-contrast environments.
- Chart readability and theme consistency pass:
  - switched radar/timeline chart palette from hardcoded hex values to shared
    CSS theme tokens (`--primary`, `--primary-2`, `--text-body`, `--text-soft`)
  - tuned axis/tick/tooltip typography and colors for better legibility in
    Neon, Aurora, Midnight, and High Contrast modes.
- Shared cyber-label/readout readability pass:
  - reduced HUD/readout letter-spacing (`.hud-eyebrow`, `.cyber-readout`) to
    improve scan speed on compact metric labels
  - increased muted chip and data-badge text clarity by moving to stronger text
    tokens (`--text-body`, `--text-strong`).
- Added `prefers-reduced-data: reduce` fallback mode:
  - removes heavy decorative overlays/glow layers and fixed background image
    for users requesting lower-data/lower-render UI behavior
  - preserves default neon experience for regular mode users.
- Long-string layout safety pass for live GitHub data:
  - added `break-words` handling on high-visibility dynamic text surfaces
    (PR titles, repo names, identity summaries, leaderboard evidence copy)
  - prevents long owner/repo/title strings from overflowing hero cards and
    panel grids across dashboard, contributions, profile, leaderboard, and
    PR battle report routes.
- Upgraded long-string handling from `break-word` behavior to
  `overflow-wrap:anywhere` via shared `.break-anywhere` utility for better
  protection against unbroken identifiers and deep repo paths.
- Added `text-wrap: pretty` to shared copy utilities to improve multi-line
  paragraph rhythm where browser support is available.
- Added reusable progressive-disclosure text component
  (`components/shared/ExpandableText.tsx`) and applied it to long AI/summary
  blocks across contributions, leaderboard, profile hero, best PR panels, and
  PR battle report so cards stay scan-friendly while preserving full detail.
- Accessibility hardening for OS-enforced contrast modes:
  - added `@media (forced-colors: active)` stylesheet fallback with system
    color tokens (`Canvas`, `CanvasText`, `Highlight`) and simplified surfaces
    so keyboard focus and text remain visible when gradients/shadows are forced off
  - improved `ExpandableText` semantics with `aria-controls` linkage for
    clearer assistive-technology context on Show more / Show less controls.
- Route loading UX now uses page-specific skeleton variants:
  - `dashboard`, `marketing`, `profile`, and `report` loading routes each map
    to structure-aware placeholder shapes instead of one generic card grid
  - lowers perceived layout shift during route transitions and better matches
    final information hierarchy while data is loading.
- Dashboard information architecture refinement:
  - added a compact quick-jump strip (Hero / League / Skills / Reports /
    Badges / Timeline) for faster navigation across long dashboard pages
  - added section anchors with `scroll-mt` offsets so in-page links land on
    readable positions below sticky chrome.
- Dashboard quick-jump rail now tracks active section while scrolling:
  - active chip is highlighted with `aria-current="location"` state
  - lightweight scroll+resize `requestAnimationFrame` tracking keeps updates
    smooth
  - quick-jump rail is sticky on larger breakpoints for persistent orientation.
- Quest board navigation and card-density refinement:
  - added cadence quick-jump rail (Daily / Weekly / Long-term / Skill-based)
    with active-section highlighting + `aria-current="location"` state
  - added cadence section anchors and sticky jump rail behavior on larger screens
  - quest cards now use progressive-disclosure text blocks for long
    descriptions/recommendations to preserve scanability.

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
- Stale snapshot states now include a direct `Refresh snapshot` action (in
  addition to settings navigation) across dashboard, contributions, badges,
  quests, leaderboard, and public profile pages for faster recovery.
- Refresh actions now show explicit loading feedback (`Refreshing...`) and
  disable repeat clicks while refetch is in progress.
- Added global inline-link readability treatment in text blocks (underline,
  stronger offset/thickness, clearer hover/focus) so links are not conveyed by
  color alone.
- Settings now includes a one-click display reset action that restores
  `Midnight` theme and `Default` text scale with immediate confirmation text.
- Upgraded shared `LoadingState` component with structured skeleton placeholders
  and explicit live-region loading announcements, improving perceived progress
  and accessibility across all major routes that reuse this component.
- Added global display accessibility shortcuts (when not typing in inputs):
  `Alt+Shift+T` cycles theme and `Alt+Shift+L` toggles text size, with
  live-region confirmation announcements and settings-page shortcut hints.
- Added `aria-keyshortcuts` metadata and explicit shortcut hints on quick
  theme/text switch buttons for better discoverability.
- Added a settings-level on/off toggle for global display shortcuts to prevent
  workflow conflicts when users prefer to disable hotkeys.
- Shortcut handler now ignores key-repeat and respects ARIA textbox-like
  editable widgets (`role="textbox"` / multiline editors) to prevent accidental
  display toggles while typing in rich inputs.
- Added a lightweight global network-activity indicator (top progress line)
  driven by React Query fetch/mutation state, with live-region status text for
  screen-reader users during active refreshes.
- Split heavy chart rendering into lazy-loaded client chunks for
  `SkillRadarChart` and `TimelineChart`, with themed skeleton fallbacks to
  reduce initial JS pressure on primary routes.
- Mobile nav now keeps compact labels visually while exposing full route names
  via `aria-label` and `title` for clearer assistive-tech and tooltip context.
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
- Added badges quick-jump rail with active section tracking (`Forge`, `Earned`,
  `Locked`) so long badge pages keep orientation and faster navigation.
- Improved badge readability for long content:
  - unlock conditions and AI stories now use shared `ExpandableText` patterns
    in card and dialog views
  - locked badge conditions now clamp/expand instead of overflowing dense cards
- Tuned global visual performance and legibility:
  - reduced heavy overlay/blur intensity and broad transition scope
  - strengthened muted-text legibility defaults
  - switched runtime background image source to `/assets/background.*` and
    added matching public asset paths for stable rendering.
- Reformatted dashboard navigation shells for clearer scanability:
  - sidebar now includes explicit `Navigate` section framing
  - desktop/mobile inactive items default to stronger readable muted tone
  - nav item styling keeps state clarity without extra transition churn.
- Added settings in-page navigation for dense account/privacy pages:
  - sticky `Jump to` rail with section anchors (`Account`, `Privacy`, `Display`, `Repositories`, `Data`)
  - active section highlighting powered by `IntersectionObserver`
  - section IDs and `scroll-mt` anchors so direct hash links land cleanly under sticky chrome.
- Added contributions in-page navigation to keep long analysis surfaces scannable:
  - sticky `Jump to` rail with anchors for filters, overview, repositories, timeline, and contribution cards
  - active section highlighting with `IntersectionObserver`
  - hash-friendly section IDs and `scroll-mt` offsets for cleaner deep links.
- Added leaderboard in-page navigation for snapshot-heavy layouts:
  - sticky `Jump to` rail for tabs, arena view, and climb guidance
  - active section tracking via `IntersectionObserver`
  - section anchors with `scroll-mt` offsets so hash links land correctly with sticky UI.
- Added public profile in-page navigation and readability refinements:
  - sticky `Jump to` rail for overview, badges+skills, best PRs, and timeline+repos
  - active-section highlighting from `IntersectionObserver`
  - badge descriptions now use `ExpandableText` to keep cards scannable without truncation loss.
- Added PR battle report in-page navigation for presentation flow:
  - sticky `Jump to` rail for overview, score, AI summary, evidence signals, and rewards
  - active-section tracking via `IntersectionObserver`
  - section anchors with `scroll-mt` offsets improve deep linking during demos.
- Tuned section jump rails for mobile usability:
  - dashboard jump rails (badges/settings/contributions/leaderboard) now stick only on `xl` screens
  - public profile and PR report rails now stick from `lg` upward
  - small screens keep rails non-sticky to preserve vertical reading space.
- Reduced shell and effect overhead for smoother rendering:
  - simplified `AppShell` overlays to a single subtle vignette layer
  - lowered backdrop blur tokens across themes to keep glass surfaces readable without over-blurring
  - narrowed global interactive transitions to color/opacity/transform-focused properties.
- Trimmed decorative sheen overlays that did not communicate state:
  - disabled `rarity-badge` and `cyber-sheen` pseudo highlights to reduce visual noise.
- Refined dashboard navigation formatting for clearer hierarchy:
  - strengthened inactive text contrast in sidebar and mobile nav
  - tightened active-state styling and added a top active indicator on mobile cards.
- Reworked dashboard top information architecture into a summary-first snapshot lane:
  - added `Snapshot` jump section after hero with a bento-style split between `Immediate next move` and key KPIs
  - introduced deterministic next-action guidance (recover sync, first sync, continue active quest, or review contribution cards)
  - kept drill-down depth below the snapshot lane to reduce first-screen cognitive load.
- Removed a remaining non-uniform radius override in chart tooltip rendering:
  - `timeline-chart-inner` tooltip now uses `var(--radius-universal)` instead of a fixed `0.6rem`.
- Added recovery actions for empty quest cadence sections:
  - empty daily/weekly/skill lanes now link directly to contribution drill-down
  - empty long-term lane links to sync/settings recovery instead of a dead-end message.
- Optimized high-volume contribution cards for lighter rendering:
  - removed per-card decorative blurred glow element
  - replaced with a low-cost top gradient rule for hierarchy
  - strengthened chip text weight for faster scanability without extra visual effects.
- Improved onboarding connect reveal clarity:
  - added explicit 3-step OAuth-to-reveal path cards (`Authorize`, `Sync evidence`, `Reveal profile`)
  - surfaced expected first-snapshot timing (`~60-90s`) as a visible callout
  - clarified post-OAuth destination and no-fabricated-user behavior in onboarding copy.
- Improved page-level orientation with contextual headers:
  - `PageHeader` now accepts a route-specific eyebrow label while retaining a default fallback
  - dashboard surfaces now show explicit section context (`Dashboard`, `Contributions`, `Badges`, `Quests`, `Settings`, `Leaderboard`, `PR Report`) instead of a single repeated generic label.
- Upgraded sparse leaderboard handling from a plain empty-state style message to a live arena preview panel:
  - keeps rank context visible when few public profiles exist
  - shows current slot, promotion target, and fastest climb guidance
  - keeps direct next actions (`contributions`, `quests`) so sparse data still feels actionable.
- Improved PR report first-glance comprehension:
  - added a summary verdict strip above section navigation with `Signal tier`, `Evidence confidence`, and `Best next move`
  - keeps long-form report depth below, while making the immediate interpretation visible within one screen.
- Added explicit persona journeys to the landing experience:
  - new `New contributor`, `Returning contributor`, and `Profile sharer` cards
  - each card includes a concrete success moment to make onboarding outcomes immediately legible.
- Improved leaderboard tab readability on small screens:
  - added mobile-short labels (`Docs`, `Weekly`, `Rising`) with full labels retained for larger breakpoints and accessibility metadata.
- Strengthened badge progression guidance:
  - added `Closest next unlock` panel in badge forge with direct recovery action
  - added per-locked-badge `Next move` guidance plus lane action buttons
  - added missing `Jump to` heading in badge quick navigation rail for consistency with other pages.
- Fixed contribution-page quick-jump integrity under sparse data:
  - ensured `Repositories`, `Timeline`, and `Cards` sections always render when page data is loaded
  - replaced hidden-section states with explicit fallback copy so quick links never target missing anchors.
- Added recovery CTAs to contribution sparse-state panels:
  - repository/timeline/highlight/card fallback states now include direct next actions (`sync settings`, `quest lane`, `reset filters`)
  - keeps every fallback state actionable instead of static explanatory text.
- Added action paths to public-profile sparse evidence panels:
  - `Best PRs` empty state now links to contribution lane and visibility settings
  - top-repositories empty state now offers in-page jumps back to summary or PR evidence.

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
