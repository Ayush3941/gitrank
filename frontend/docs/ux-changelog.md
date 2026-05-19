# Frontend UX Changelog

## 2026-05-19

- Readability-first surface tuning pass:
  - reduced global blur/shadow/glow intensity tokens in `app/globals.css`
    to keep cyberpunk styling while improving text clarity on translucent panels
  - increased baseline `glass-panel` opacity so body copy sits on denser, more
    stable contrast surfaces over the fixed background image
  - lowered decorative cyber-card overlay opacity and blur halo intensity to
    reduce visual noise and repaint pressure.
- Dashboard navigation formatting refinement:
  - widened desktop sidebar to prevent label crowding
  - wrapped sidebar nav list in a clearer `neon-surface` container and softened
    active-state gradients for better hierarchy
  - simplified mobile bottom nav by moving route-status text to SR-only and
    tightening icon/label alignment with clearer active indicator placement.
- Sticky-header simplification:
  - removed dense `panel-grid` texture from dashboard sticky top bars to reduce
    clutter and improve first-screen scanability
  - normalized shared `PageHeader` shell shape usage to the global radius
    system (no extra hardcoded rounded shell).
- Decorative blur-trim pass:
  - removed non-informational blurred glow blobs from skill radar, timeline,
    quest cards, and onboarding reveal hero panels
  - keeps neon identity via existing gradients/chips while reducing costly
    blur compositing on dense dashboard routes.
- Overlay and texture simplification pass:
  - removed modal overlay blur from shared dialog primitives and tightened
    overlay contrast for cleaner text focus during auth/settings flows
  - removed `panel-grid` texture from marketing shell header/footer, landing
    hero shell, and onboarding reveal shells to reduce visual clutter and
    improve first-screen readability.
- Hero-overlay cleanup in high-traffic app tabs:
  - removed decorative `cyber-hero-overlay` layers from contribution, quest,
    and badge hero summary cards
  - retained existing card structure/content while reducing non-informational
    compositing in primary dashboard routes.
- Reduced-data and containment hardening:
  - `prefers-reduced-data` mode now also strips glass blur and heavy shadows
    from major surface primitives for lighter rendering on constrained devices
  - added `contain: layout paint style` to `render-opt-card` and
    `render-opt-section` helpers to improve containment behavior for long card
    lists and section-heavy pages.
- Dead-end state recovery pass:
  - upgraded sync activity panel sparse/error states with explicit recovery
    actions (`retry`, `open dashboard`, `open settings`, `reset filters`)
  - upgraded badge detail dialog empty evidence state with direct navigation
    actions to contribution and quest lanes.
- Interaction-surface glow reduction:
  - reduced shadow intensity on primary button variants and tab controls to
    keep neon hierarchy while lowering paint-heavy glow effects
  - reduced global top fetch-indicator glow intensity for calmer visual
    feedback during background network activity.
- Badge modal accessibility semantics pass:
  - added explicit `DialogDescription` to badge detail modal so assistive tech
    receives structural context on open (purpose + expected content).
- Chart motion/accessibility pass:
  - disabled Recharts animation on timeline area and skill radar surfaces to
    remove non-essential motion and reduce rendering work on dashboard/profile
    pages
  - added explicit `role="img"` + `aria-describedby` linkage from chart
    containers to nearby summary copy for stronger non-visual chart context.
- Shared progress primitive hardening:
  - clamped progress input values to safe `0-100` bounds in the shared
    `Progress` component to prevent layout glitches from malformed values
  - reduced progress-indicator glow intensity to lower paint-heavy effects
    across dashboard, quest, badge, and profile progress bars.
- Expandable-details keyboard focus pass:
  - added `focus-ring` styling to summary controls in skill/timeline chart
    summaries and onboarding data-policy disclosure panels
  - improves visible keyboard focus on `<summary>` interactions without
    changing disclosure behavior.
- Removed dead visual-overlay CSS paths:
  - deleted unused `.panel-grid` and `.cyber-hero-overlay` style definitions
    after all component references were removed
  - cleaned related reduced-mode/forced-colors selector lists to shrink CSS
    surface area and avoid dead-style maintenance.
- Loading skeleton simplification pass:
  - simplified shared `neon-skeleton` gradients/shadows to reduce paint-heavy
    loading surfaces across route and panel placeholders
  - added a `prefers-reduced-data` fallback for skeletons with flatter static
    backgrounds and lighter borders.
- Dialog viewport resilience pass:
  - added max-height and internal vertical scrolling to shared dialog content
    shell so long modal content remains reachable on shorter/mobile viewports.
- Lazy chart-mount optimization:
  - added shared `use-lazy-in-view` hook and applied it to timeline/skill
    chart shells so heavy chart modules load only near viewport
  - chart panels now render lightweight skeleton placeholders until in-view,
    reducing initial dashboard/profile work.
  - hook follow-up hardening: switched to callback-ref + node state tracking so
    observer attachment is deterministic across mount/remount transitions.
- Top-bar lazy module loading:
  - switched dashboard command palette and shortcut-help dialog imports in
    `DashboardTopBar` to dynamic client loading
  - shortcut-help dialog now mounts only when opened, reducing always-mounted
    dashboard top-bar module weight.
- Dead utility cleanup:
  - removed unused `.grid-fade` utility class from global stylesheet to keep
    CSS surface area tighter.
- Navigation contrast + shell-glow smoothing pass:
  - finalized `AppShell` vignette reduction so full-page overlays interfere
    less with text over the fixed background image
  - simplified active/hover visual states in desktop sidebar and mobile nav to
    reduce gradient noise while preserving clear route state
  - softened global glow/vignette falloff and enlarged decorative shell glows
    at lower opacity for longer, smoother start/stop gradients.
- Radius-scope correction for decorative layers:
  - removed global pseudo-element radius forcing and scoped universal `0.1rem`
    corners to interactive/surface primitives and rounded utility classes
  - preserved explicit `rounded-full` and `rounded-none` semantics so avatars,
    badges, and deliberate hard/smooth corners render predictably.
- Profile auto-refresh reliability pass for background sync:
  - `useMyProfile` now polls every 20s while sync is incomplete, stale, partial,
    rate-limited, failed, or still at zero merged PR evidence
  - once evidence is present and sync state stabilizes, polling automatically
    stops to reduce unnecessary network load.
- Query devtools production-load trim:
  - switched React Query devtools to dynamic client loading gated to non-production
    environments so production sessions avoid shipping and mounting devtools code.
- Auto-sync retry resilience refinement:
  - dashboard auto-sync now resets retry counters on sync-state transitions and
    allows cool-down-based retry recovery after repeated transient failures
  - prevents long-lived sessions from getting stuck after one burst of sync
    timeouts while still rate-limiting repeated attempts.
- Empty-state recovery-path expansion:
  - shared `EmptyState` now supports a secondary CTA so no-data views can offer
    both a primary next step and a fallback route
  - wired dual-path actions into contributions, badges, quests, PR report, and
    public-profile empty states to reduce dead-end navigation.
- Cross-tab sync-attention state visibility:
  - exported sync-attention gating helpers from `SyncStateGuide` and normalized
    synced-plus-partial status to `partially_synced` messaging
  - added sync-state notice banners to contributions, badges, quests, and
    leaderboard pages when profile sync is incomplete (never synced, syncing,
    partial, failed, rate-limited), not just when stale.
- Web-vitals signal quality refinement:
  - hardened `WebVitalsReporter` with in-memory deduplication keyed by route,
    metric name, and metric id to avoid repeated emission noise
  - added deterministic client-side sampling controlled by
    `NEXT_PUBLIC_WEB_VITALS_SAMPLE_RATE` (default `0.35`) so route-level vitals
    telemetry remains useful without overloading analytics traffic.
  - improved route-group fallback tagging from generic `other` to
    `other.<first-segment>` so unknown routes still produce actionable buckets.
- Status-surface accessibility polish:
  - `ErrorState` now exposes alert semantics (`role=alert`, assertive live
    region) and explicit button types for retry/fallback actions
  - `RouteLoadingState` now includes an SR-only summary sentence so route-level
    loading contexts are announced with meaningful page intent.
- Sync activity panel cadence refinement:
  - `useSyncRuns` now uses adaptive polling (fast when runs are active, slower
    when idle) instead of fixed-interval refresh
  - expanded active run detection/status labeling to include `queued`,
    `pending`, and `in_progress` states so queue progress is surfaced clearly.
  - added explicit failure guidance copy when recent sync runs fail and no jobs
    are active, with direct link back to account settings recovery paths.
  - centralized sync-run status classification in
    `features/settings/lib/sync-run-status.ts` so UI chips and polling cadence
    rely on one source of truth, with focused regression coverage in
    `tests/sync-run-status.test.ts`.

## 2026-05-17

- Keyboard shortcut help overlay:
  - added `DashboardShortcutHelpDialog` with an in-app quick-reference for
    navigation, command palette, and display shortcuts
  - added a visible `Shortcuts` top-bar trigger plus global `?` hotkey
    (non-editable-field safe) for fast discovery
  - wired quick actions to include `Open keyboard shortcuts help` in a
    dedicated `Help` group so shortcut discovery is reachable from `Ctrl/Cmd+K`.
  - updated Settings display copy to clarify which shortcuts are always
    available (`Ctrl/Cmd+K`, `?`) versus gated display shortcuts.
  - decluttered mobile top-bar controls by hiding inline theme/text toggles on
    extra-small screens (still available via quick actions and Settings).
  - added focused hotkey coverage to ensure `?` opens shortcut help only when
    focus is outside editable fields.
- Dashboard quick-actions command palette:
  - added `DashboardQuickActions` (`components/shared/DashboardQuickActions.tsx`)
    with searchable keyboard-first actions (`Ctrl/Cmd+K`) for route jumps,
    profile open, manual sync trigger, theme cycle, and text-scale toggle
  - palette now promotes recently executed actions into a `Recent` section
    when search is empty, improving repeat-task speed without fake data
  - added `Clear recent` control so users can reset command history directly
    from the palette.
  - improved combobox semantics for the search input (`role=combobox`,
    `aria-autocomplete=list`, popup state attributes) to align with
    listbox-popup keyboard navigation patterns.
  - upgraded quick actions with grouped sections (`Navigate`, `Profile`, `Sync`,
    `Display`) and arrow-key traversal (`↑/↓`) + `Enter` execution for
    keyboard-only command flows
  - integrated quick actions into top bar (`DashboardTopBar`) and wired manual
    sync execution through existing container mutation flow
  - added discoverability hint in sidebar focus block (`Ctrl/Cmd+K`)
  - added deterministic ranking helper + tests:
    `lib/quick-actions.ts` and `tests/quick-actions.test.ts`, including
    grouped-result ordering coverage.
- Deep-link jump-nav state consistency pass:
  - added shared `initialSectionFromHash` helper (`lib/section-nav.ts`) with
    malformed-hash safety fallback handling
  - wired dashboard, contributions, badges, quests, settings, leaderboard,
    public profile, and PR report jump navs to:
    1) initialize active nav state from URL hash after mount,
    2) react to browser `hashchange`, and
    3) update active state immediately on anchor click.
  - added `tests/section-nav.test.ts` to lock hash parsing/fallback behavior.
- Sync-state clarity and micro-text readability upgrade:
  - added shared `SyncStateGuide` (`components/shared/SyncStateGuide.tsx`) to
    convert raw sync status into explicit state narratives and deterministic
    recovery actions (never synced, syncing, partial, stale, failed, rate-limited)
  - wired `SyncStateGuide` into Settings account section so users always see
    what current sync state means and where to go next
  - added a lightweight `Refresh profile view` action in Settings account
    controls (query refetch only) so stale UI can be updated without
    reintroducing manual sync execution buttons
  - raised tiny utility label legibility by normalizing `text-[10px]` and
    `text-[11px]` classes in `app/globals.css`, including large-text mode
    overrides for better visibility on dense dashboard surfaces.
  - added focused contract coverage in `tests/sync-state-guide.test.ts` for
    failed and syncing CTA routing behavior.
- Contributions information-architecture consistency pass:
  - promoted major contribution sections to explicit semantic headers using
    `SectionHeader` (Repositories, Timeline/Highlights, PR Cards) to align page
    structure and improve in-page scan/navigation behavior
  - standardized subsection zero-data surfaces with shared
    `SubsectionEmptyState` actions so each contribution panel now has a clear
    recovery CTA
  - upgraded timeline/highlights panel titles to explicit heading elements
    instead of label-only text.
- Leaderboard deep-link state pass:
  - leaderboard lane tabs now persist in URL query state (`?lane=`), enabling
    direct sharing and refresh-stable reconstruction of the selected lane
  - added typed lane mapping helpers in
    `features/leaderboard/lib/lane-param.ts` to keep route semantics stable
  - added `Copy lane link` action in leaderboard filters so current lane state
    can be shared directly without manual URL editing
  - added `tests/leaderboard-lane-param.test.ts` to lock param-to-tab and
    tab-to-param mappings.
- Hero avatar image optimization pass:
  - dashboard and public-profile hero avatars now set explicit Next.js `sizes`
    plus `priority` preload hints to reduce first-view image uncertainty and
    improve above-the-fold visual stabilization.
- Dashboard list virtualization-style render optimization:
  - added `render-opt-card` (`content-visibility` helper) to repeated quest,
    battle-report, and badge cards inside dashboard panels
  - reduces offscreen rendering work on long dashboard sessions while
    preserving existing layout and styling.
- Quest cadence share-link refinement:
  - cadence navigator now exposes a live active-lane status label and a
    `Copy cadence link` action (`/dashboard/quests#...`) so mission lanes can
    be shared directly with preserved in-page anchor context.
- Contribution section share-link refinement:
  - contribution jump navigator now shows active section context and a
    `Copy section link` action (`/dashboard/contributions#...`) for
    shareable drill-down state.
- Badge section share-link refinement:
  - badge jump navigator now mirrors other tabs with active section context and
    a `Copy section link` action (`/dashboard/badges#...`) for shareable shelf
    and locked-lane views.
- Dashboard section share-link refinement:
  - dashboard jump navigator now exposes active section context plus
    `Copy section link` (`/dashboard#...`) to share specific command-center
    panels directly.
- Settings section share-link refinement:
  - settings jump navigator now includes active section context and
    `Copy section link` (`/dashboard/settings#...`) so privacy and account
    panels can be shared with direct anchors.
- Leaderboard section share-link refinement:
  - leaderboard jump navigator now includes active section context and
    `Copy section link` (`/dashboard/leaderboard#...`) in addition to lane
    query sharing, making both lane and panel context shareable.
- Public profile section share-link refinement:
  - public profile jump navigator now shows active section context and a
    `Copy section link` action (`/u/<username>#...`) so shared profile links
    can point to exact sections.
- Absolute share-link normalization:
  - added shared `CopyLinkButton` + `toAbsoluteShareUrl` helper so copied
    dashboard/profile section links resolve to absolute URLs in the browser
    instead of relative path fragments
  - migrated dashboard, contributions, badges, quests, settings, leaderboard,
    and public-profile copy-link actions to this shared behavior
  - added `tests/share-links.test.ts` to lock absolute/relative URL
    normalization semantics.
- PR report section share-link refinement:
  - PR battle report jump navigator now includes active section context and a
    `Copy section link` action (`/pr/<owner>/<repo>/<number>#...`) for direct
    shareable anchors to score/AI/evidence/rewards panels.
- Leaderboard section link context fix:
  - leaderboard `Copy section link` now preserves the active lane query
    (`?lane=...#section`) so shared section links restore both lane and panel
    context.
- Public profile link encoding hardening:
  - public profile section links now URL-encode usernames before copy so
    non-trivial handles keep valid, stable share URLs.
- Copy-link control visibility pass:
  - `CopyLinkButton` now defaults to `secondary` variant styling so share-link
    actions are more discoverable in jump navigators across dashboard surfaces.
- Copy-link behavior contract coverage:
  - added `tests/copy-link-button.test.tsx` to verify the rendered copy-link
    control writes an absolute URL payload to clipboard using current origin.
- Public profile nav label readability pass:
  - refined jump-nav labels from symbol-heavy text (`Badges+Skills`,
    `Timeline+Repos`) to clearer wording (`Badges & Skills`, `Timeline & Repos`).
- Anchor target visual orientation pass:
  - added scoped `:target` highlight treatment for dashboard/profile/report
    section anchors so deep-linked shared URLs visibly emphasize the destination
    panel when opened
  - respects reduced-motion preference by disabling target highlight animation.
- Route fallback consistency pass:
  - added shared `RouteFallbackCard` (`components/shared/RouteFallbackCard.tsx`)
    and migrated all route-level `not-found` surfaces (global, dashboard,
    marketing, public profile, public PR report) to the same structure
  - keeps 404 experiences aligned on hierarchy (eyebrow/title/description) and
    guarantees each missing route offers clear recovery actions
  - added `tests/route-fallback-card.test.tsx` to lock fallback action link
    rendering.
- Settings and onboarding error-safety hardening:
  - added shared `sanitizeUserFacingError` mapping in
    `lib/ui-error-messages.ts` to prevent raw upstream/network/backend error
    text from leaking into user-visible surfaces
  - wired sanitizer into `SettingsPageClient` account/privacy action errors and
    onboarding `SyncPipeline` sync errors
  - added `tests/ui-error-messages.test.ts` to lock timeout/CSRF/500 fallback
    behavior and preserve clear user-facing messages when already safe.
- Background readability tuning:
  - reduced shell vignette opacity in `AppShell` so fixed background artwork
    remains visible during dashboard use
  - softened global page overlay/grid/glow alpha levels across Neon, Midnight,
    Aurora, and High Contrast themes for smoother, less harsh atmosphere layers
  - widened vignette falloff in `.neon-vignette` to make glow transitions
    longer and less abrupt at page edges.
- Reduced-gamification performance hardening:
  - `html[data-gamification="reduced"]` now disables expensive glass blur
    rendering (`backdrop-filter`) across major card/surface primitives
  - reduced mode now suppresses decorative panel-grid/page-shell overlay layers
    to cut render cost while preserving layout and information hierarchy
  - updated Settings copy so users know reduced mode now explicitly prioritizes
    lower GPU/render overhead in addition to animation/glow reduction.
- `backdrop-filter` support fallback hardening:
  - added `@supports not ((backdrop-filter...) or (-webkit-backdrop-filter...))`
    fallback so glass/cyber surfaces render readable static backgrounds without
    blur/polyfill assumptions on unsupported or constrained browsers
  - fallback covers shared surface primitives (`glass-panel`, `cyber-card`,
    `neon-surface`, `neon-tile`, `neon-metric`) to keep visual hierarchy
    consistent even when blur effects are unavailable.
- Contribution card achievement framing upgrade:
  - each contribution card now surfaces a computed run-tier chip (`Solid`,
    `Rare`, `Epic`, `Mythic`) from real score/difficulty/impact values
  - added explicit merged date metadata plus maintainer-review and CI chips to
    tighten the "achievement artifact" story per PR
  - status chips now use readable title-case labels instead of raw lowercase
    backend status values.
- Quest mission spotlight and progress hardening:
  - added a new mission spotlight row in `QuestsPageClient` for
    `Today's Quest`, `Weekly Challenge`, and `Long-Term Journey`, each with
    deterministic quest selection and clear recovery CTAs when data is absent
  - spotlight selection now prefers active quests, then highest safe progress,
    then higher XP reward to keep next actions clear and stable
  - `QuestCard` progress math now guards zero/invalid goals to prevent NaN or
    overflow rendering from malformed backend rows.
- Badge card narrative clarity pass:
  - badge grid cards now frame `why earned` (description) separately from the
    `trigger pattern` (unlock condition) for clearer achievement storytelling
  - locked badges now include visual progress bars directly on cards (not only
    percentage text) and keep deterministic fallback when no story payload exists
  - badge detail dialog now renders progress with a bar + numeric value for
    better scanability during demos and reviews.
- Mobile/coarse-pointer shell smoothness:
  - for `@media (any-pointer: coarse)`, body background now uses
    `background-attachment: scroll` (instead of fixed) with top-centered
    positioning to reduce heavy repaint pressure on constrained devices.
- Leaderboard progression context upgrade:
  - added a personalized `Your arena mission` panel when the current user is
    present in the active lane (rank, focus lane, gap-to-leader, movement, and
    progress-to-next-band)
  - upgraded the zero-row leaderboard state with a non-fake rank-band preview
    card and explicit unlock steps so the tab stays useful before live
    participants appear
  - included deterministic progress calculation helper for next-band progress,
    bounded to safe 0-100 output.
- Public profile proof-strip upgrade:
  - added a new `Profile proof strip` panel in `PublicProfilePageClient`
    summarizing snapshot freshness, evidence scope, and trend-window bounds for
    clearer share-readiness framing
  - added compact proof cards (`Snapshot state`, `Evidence scope`, `Trend window`)
    so public profile viewers can interpret profile certainty/context faster.
- Leaderboard row actionability pass:
  - each leaderboard row now includes a deterministic `Next action` hint based
    on promotion-zone, demotion-risk, and xp-to-next-rank states so lane cards
    communicate what to do next, not only current placement.
- Onboarding reveal resilience upgrade:
  - reveal panel now includes a compact metric row (merged PRs, reviewed PRs,
    unlocked badges, evidence rows) plus explicit snapshot-state context
  - no-evidence users now get deterministic fallback badge cards and tailored
    next steps instead of thin/empty reveal sections
  - next-step guidance now branches based on whether merged contribution
    evidence exists, improving first-run onboarding clarity.
- Dashboard evidence-context strip:
  - added a new top-level `Evidence context` block below dashboard snapshot
    cards with sync state, contribution window scope, and current pipeline step
  - surfaces explicit freshness + scope framing near the top of the command
    center so score and progression interpretation starts from verified context.
- Dashboard quest/badge card safety and progress clarity:
  - `QuestPanel` now uses safe progress math for quest cards to prevent invalid
    rendering when backend rows provide zero/invalid goals
  - `BadgeShelf` now shows unlocked completion progress (`x/y`, percentage, bar)
    and renders locked badge progress with bars instead of text-only percentages.
- Dashboard battle-report readability pass:
  - `RecentBattleReports` now sorts rows by XP impact and exposes report count
    context chips for quicker scanability
  - each report card now shows clear category/difficulty/status/evidence chips,
    contribution summary text, and formula/analysis version traceability fields
  - battle report cards now surface confidence percentages and a concise
    quality-priority footer to reinforce how ranking signal is interpreted.
  - confidence labels now switch to deterministic/fallback/rate-limited mode
    text when percentage confidence would be misleading.
- Mobile navigation orientation cue:
  - `MobileNav` now renders a small live current-lane label (`Current lane:
    <route>`) above nav tiles for stronger in-flow orientation on compact
    screens and demo recordings.
- Sidebar navigation orientation cue:
  - `DashboardSidebar` now mirrors mobile behavior with a live
    `Current lane: <route>` status line above desktop nav links.
  - added accessibility regression coverage so desktop + mobile current-lane
    cues remain present (`tests/accessibility-controls.test.tsx`).
- Contribution filter iteration upgrade:
  - active contribution filters are now removable directly from inline chips
    (category/search/sort), reducing reset friction during rapid drill-down
  - filter bar now explicitly shows a `No active filters` state when defaults
    are active, improving orientation during demos and QA checks.
  - added targeted UI tests in `tests/contribution-filters.test.tsx` to lock
    default-state messaging and removable chip callback behavior.
- Sync freshness readability/traceability upgrade:
  - `formatRelativeDays` now reports recent sync age with minute/hour precision
    (for example `2m ago`, `3h ago`) before day-level buckets
  - `SyncStatusPill` now exposes exact local sync timestamp via tooltip and
    assistive label text (`Last synced <timestamp>`) to improve trust around
    stale/partial states
  - added `tests/formatters.test.ts` to lock formatter behavior for recent and
    older windows plus invalid timestamp handling.
- Sync error messaging now avoids raw upstream technical strings for direct
  sync actions:
  - user/repository/installation sync failures map timeout/rate-limit/auth/
    upstream-unavailable failures into plain-language, actionable recovery copy
  - added `tests/account-api-sync-errors.test.ts` to lock timeout and
    rate-limit message mapping behavior.
- Dashboard top bar now exposes background auto-sync state as an inline status
  note:
  - running state now explicitly says sync is happening in the background
  - success/failure outcomes from auto-sync attempts are surfaced as plain
    language follow-up notes so users can understand whether evidence refresh
    completed or needs attention.
  - top-bar background-sync status now uses a persistent live region node
    (`role="status"`, `aria-live="polite"`, `aria-atomic="true"`) so assistive
    tech can consistently announce complete message updates across sync state
    transitions.
- Stale-state banners now include exact “last verified” timestamps:
  - `StaleState` accepts `updatedAt` and renders precise local time alongside
    the relative stale summary
  - applied across dashboard, contributions, badges, quests, leaderboard, and
    public profile stale banners for stronger snapshot trust.
  - added `tests/stale-state.test.tsx` to lock rendering of the exact
    verification timestamp hint.
- Sync status pill now exposes exact timestamp text visibly (not only via
  tooltip/title):
  - the top-bar sync badge now appends an inline exact sync timestamp on wider
    layouts while keeping the relative age text
  - added `tests/sync-status-pill.test.tsx` to lock visible exact-timestamp
    rendering alongside status + relative freshness copy.
- Sync and stale freshness timestamps now use semantic `<time datetime>`
  markup:
  - `SyncStatusPill` renders relative and exact freshness values with
    machine-readable `datetime` values when available
  - `StaleState` renders the exact "Last verified" value using semantic time
    markup instead of plain text only
  - updated `tests/sync-status-pill.test.tsx` and
    `tests/stale-state.test.tsx` to lock semantic datetime output.
- Dashboard auto-sync now executes direct user sync runs instead of relying on
  queue-only triggers, so authenticated route opens actively refresh profile
  evidence without requiring manual sync controls.
- Added global readability overrides for remaining translucent utility text
  classes used across dashboard/badges/quests/profile/report surfaces
  (`text-cyan-100/*`, `text-amber-50/*`, `text-amber-100/*`,
  `text-emerald-100/*`, `text-rose-100/*`) with theme-aware fallbacks for
  Aurora and High Contrast modes.
- Added dedicated marketing route fallbacks:
  - new `app/(marketing)/error.tsx` and `app/(marketing)/not-found.tsx`
    with direct login/onboarding recovery actions
  - marketing route errors now emit `error_state.viewed` analytics events and
    use `unstable_retry()` when available for stronger retry behavior.
- Added metadata contract coverage for marketing/onboarding routes in
  `tests/marketing-metadata.test.ts`:
  - locks canonical URLs and generated social image endpoints for landing,
    login, and onboarding route metadata.
- Added private-dashboard indexing guardrails:
  - `app/(app)/dashboard/layout.tsx` now exports route-level `robots` metadata
    with `noindex` / `nofollow` defaults for authenticated dashboard surfaces
  - added `tests/dashboard-metadata.test.ts` to lock that policy as a frontend
    contract.
- Added route-specific public error/not-found boundaries:
  - `app/(public)/u/[username]/error.tsx` + `not-found.tsx`
  - `app/(public)/pr/[owner]/[repo]/[number]/error.tsx` + `not-found.tsx`
  - these now provide contextual recovery CTAs instead of falling back to the
    generic global fallback UX for public share routes.
- Public route error boundaries now emit `error_state.viewed` analytics events
  and prefer `unstable_retry()` when available (falling back to `reset()`),
  aligning retry behavior with current Next.js App Router guidance.
- Added route-specific share cards for public profile and PR report pages:
  - generated dynamic `opengraph-image` + `twitter-image` handlers in
    `app/(public)/u/[username]/` and `app/(public)/pr/[owner]/[repo]/[number]/`
  - public route metadata now points to per-route image endpoints instead of a
    generic background asset, so shared links carry contextual preview cards.
  - added metadata contract test coverage in
    `tests/public-metadata-sharecards.test.ts` to keep encoded image route
    mapping stable.
- Standardized marketing/onboarding social metadata:
  - updated landing, login, and onboarding (`connect-github`, `analyzing`,
    `reveal`) metadata to include canonical URLs and OpenGraph/Twitter cards
  - switched these routes from static background image previews to the branded
    generated image endpoints (`/opengraph-image`, `/twitter-image`).
- Added JSON-LD structured data for public share routes:
  - introduced reusable `JsonLdScript` helper for safe server-rendered
    `application/ld+json` output
  - public profile pages now emit `ProfilePage` + `Person` structured data
  - public PR report pages now emit `WebPage` + `CreativeWork` references to
    canonical GitHub repository/PR URLs.
- Settings repository privacy empty-state refinement:
  - `PrivacyRepositoryToggleList` now distinguishes between
    “no repository data synced yet” and “no filter match” states
  - added direct recovery actions in empty states (`Reset filters`, `Run sync
    in account section`) to avoid dead-end outcomes inside Settings.
  - improved repository filter accessibility semantics by wiring
    `aria-describedby` status context for search/filter controls and adding
    grouped filter labeling.
  - added regression coverage in `tests/accessibility-controls.test.tsx` for
    the zero-repository empty-state action path.
- Removed remaining dashboard dead-end empty panels:
  - `QuestPanel`, `RecentBattleReports`, and `BadgeShelf` now include direct
    recovery actions (sync settings, contribution drill-down, badge forge)
  - added explicit `BadgeShelf` zero-data fallback so the section never renders
    as an empty grid when no badge records are present.
- Reduced onboarding sync polling pressure in `SyncPipeline`:
  - replaced fixed `5s` interval polling with progressive backoff (`5s` → `7s`
    → `10s` → `15s` → `20s`) while sync is still pending
  - surfaced active poll cadence in UI so users understand refresh timing and
    why updates can appear less frequently on longer-running syncs.
- Route-level error UX instrumentation and navigation consistency:
  - `app/(app)/dashboard/error.tsx` and `app/global-error.tsx` now emit
    `error_state.viewed` analytics events for error incidence visibility
  - replaced raw anchor navigation with `next/link` actions so fallback
    navigation remains in-app and consistent with App Router behavior.
- Added file-based social-share identity layer:
  - new generated social cards in `app/opengraph-image.tsx` and
    `app/twitter-image.tsx` with cyber-neon branding and high-contrast copy
  - added descriptive `opengraph-image.alt.txt` and `twitter-image.alt.txt`
    metadata companions for accessibility.
- Added a generated web app manifest in `app/manifest.ts`:
  - sets app identity, theme/background colors, and install metadata for
    share-ready browser surfaces
  - keeps icon references pinned to existing `favicon.ico` so no new asset
    loading paths were required.
- Upgraded root metadata defaults in `app/layout.tsx`:
  - configured `metadataBase`, canonical root path, and baseline OpenGraph /
    Twitter defaults so page-level metadata composes cleanly
  - switched default social image references to generated metadata routes
    (`/opengraph-image`, `/twitter-image`) for consistent link previews.
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
- Expanded list-render optimization coverage:
  - added `render-opt-card` to locked badge cards and contribution repository/highlight rows
  - extends deferred paint/layout behavior to more high-count card lists.
- Applied quick-jump navigation accessibility labeling pass:
  - switched jump rails to `aria-labelledby` with visible label IDs across dashboard, contributions, badges, quests, settings, leaderboard, public profile, and PR report views
  - converted remaining non-nav quick-jump wrappers to semantic `nav` landmarks.
- Added leaderboard snapshot context chips near lane tabs:
  - surface active row count, time window, and formula version before arena cards
  - improves immediate understanding of what dataset each tab is showing.
- Upgraded jump-rail structure semantics:
  - converted jump-link groups to list markup (`ul/li`) across all major dashboard rails
  - retains current visual treatment while improving assistive navigation context.
- Updated primary dashboard navigation semantics:
  - sidebar and mobile app navigation now use list markup (`ul/li`) inside nav landmarks for clearer assistive structure.
- Wired sidebar visible nav label into accessibility naming:
  - sidebar navigation now uses `aria-labelledby` bound to visible `Navigate` text instead of a standalone string label.
- Restored explicit keyboard focus styling on chip-based jump links:
  - dashboard and quests quick-jump chips now include `focus-ring` to keep focus-visible behavior consistent with other rails.
- Improved filter-control clarity and mobile readability:
  - contribution category tabs now use mobile-short labels with full labels retained on larger breakpoints
  - contribution and badge filter controls now expose stronger live-status/described-by context
  - badge filters now surface active filter chips (`Rarity`, `State`) to reduce hidden-state confusion.
- Improved badge date/status presentation:
  - normalized earned-date display to formatted date strings on badge cards
  - badge detail dialog now surfaces explicit unlocked/locked status chips and earned date metadata.
- Clarified sign-in onboarding flow:
  - login panel now includes a visible 3-step post-auth path (`OAuth`, `sync`, `dashboard/quests`) to reduce uncertainty before first sign-in.
- Added accessible chart summaries and data alternatives:
  - timeline and skill radar cards now include expandable text/data summaries beneath charts
  - each summary surfaces strongest/weakest or start/latest/peak insights plus a simple row list of values, so chart meaning is available without relying on visual interpretation.
- Added active-filter chips to contribution controls:
  - contribution filter bar now shows currently applied category/search/sort chips
  - reduces hidden filter state and makes result changes easier to diagnose quickly.
- Tightened badge filter control-bar grouping:
  - aligned active filter chips and reset action into one control cluster
  - added explicit `No active filters` state chip for immediate context when filters are clear.

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
