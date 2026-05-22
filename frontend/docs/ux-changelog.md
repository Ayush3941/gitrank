# Frontend UX Changelog

## 2026-05-21

- Global fetch-indicator smoothing pass:
  - added a delayed-show (`120ms`) and minimum-visible (`260ms`) policy for the top network activity bar.
  - removes flash/flicker during tiny request bursts while preserving visible feedback on meaningful loading states.
- Sync-run filter stability pass:
  - replaced the status button-row in settings sync activity with a native `<select>` status filter (`All`, `Completed`, `Running`, `Failed`) to avoid interaction jitter and keep filtering stable on constrained devices.
  - removed deferred/debounced sync-run filter churn so result updates are immediate and less jitter-prone.
  - simplified active-filter chips in sync activity by removing per-chip inline clear buttons and keeping one explicit `Reset` action.
- Render-performance and copy-density pass:
  - enabled real offscreen deferral for heavy dashboard/profile sections by switching `.render-opt-card` and `.render-opt-section` to `content-visibility: auto` with intrinsic-size hints.
  - tightened dashboard hero/snapshot wording to reduce repeated explanatory prose while preserving all scoring and sync semantics.
- Empty-state recovery pass:
  - added direct `Open sync settings` recovery actions to dashboard `Recent battle reports`, `Active quests`, and `Badge shelf` empty cards.
  - keeps primary lane actions (`Open contributions`, `Open badge forge`) while removing dead-end panel states.
- Filter-control stability pass:
  - replaced contribution filter selects (mobile category + sort) with native `<select>` controls to avoid portal scroll-lock behavior in long dashboard pages.
  - replaced badge rarity/state selects with native `<select>` controls for lighter interaction cost and more predictable scrolling on constrained devices.
  - replaced leaderboard mobile lane select and settings mobile repository-visibility select with native `<select>` controls for consistent no-portal behavior across dashboard routes.
  - removed unused shared Radix select primitive (`components/ui/select.tsx`) after migration to native route-level controls.
- PR report badge clarity pass:
  - deduplicated repeated badge unlock entries by badge name in PR battle reports and merged their evidence signals into a single card.
  - keeps underlying evidence while removing repeated badge titles that made report rewards noisy.
- PR report evidence copy pass:
  - converted raw stale-analysis wording into user-facing progress copy so deterministic report states stay readable while Gemini enrichment catches up.
- Deterministic summary normalization pass:
  - added shared formatter `frontend/lib/presentation/report-summary.ts` to clean raw deterministic strings (`summary=[...]`, `score version ...`, trailing `final XP ...`) into readable copy.
  - wired the formatter into contributions cards, dashboard recent battle reports, and public-profile best-PR cards for consistent report language.
- Skill evidence-source wording pass:
  - normalized profile skill-note evidence-source labels so empty/unknown values now render as `deterministic snapshot` instead of `unknown source`.
- Noise-reduction copy pass:
  - removed `Lite skill signal view` label from constrained/rduced skill radar rendering.
  - simplified leaderboard mission subcopy from `Focus lane` to `Primary signal`.
  - removed redundant leaderboard row-count sentence under arena rows to keep action hierarchy tighter.
- Mobile filter compactness pass:
  - replaced mobile-only contributions category tab rail with a compact `Select` filter, while keeping desktop tab semantics unchanged.
  - replaced mobile-only leaderboard lane tab rail with a compact `Select` filter, while preserving desktop lane tabs and query-parameter behavior.
  - reduced horizontal-scroll pressure on smaller screens without changing backend contracts or filter logic.
- Background paint simplification pass:
  - removed the global repeating-grid background stripe layer from `body::before` to reduce fixed-overlay paint complexity.
  - retuned fixed radial glow stops on `body::before` and `body::after` for longer/finer falloff, producing a smoother neon atmosphere with less visual harshness.
- Settings/badges filter declutter pass:
  - simplified repository-visibility filter chips in settings by removing per-chip inline clear buttons and keeping one explicit reset path.
  - switched repository visibility filtering to mobile `Select` + desktop segmented buttons for cleaner small-screen control density.
  - simplified badges active-filter chips by removing per-chip clear actions and keeping the existing explicit reset control.
  - simplified contributions active-filter chips by removing per-chip clear actions and standardizing on a single reset flow.
- Dashboard top-bar stability pass:
  - added a fixed-height sync-status slot in `DashboardTopBar` so auto-sync notices no longer collapse/expand the header block height.
  - normalized vertical margin spacing across `DashboardTopBar`, skeleton, and unavailable variants to reduce route-to-route header shift.

## 2026-05-19

- Viewport-locked background framing pass:
  - forced `background-attachment: fixed` across responsive, reduced-data, constrained-network, reduced-gamification, and coarse-pointer paths.
  - normalized fallback background framing to `center center` so the image stays anchored to the screen viewpoint while content scrolls.
- Badges and quest spotlight progression pass:
  - prioritized locked badges by progress so “closest to unlock” appears first across shelf summaries and locked lanes.
  - improved badge cards with explicit unlocked/locked status chips, clearer unlock-heading copy, and remaining-progress text.
  - added quest spotlight status chips (`Active`, `Locked`, `Completed`) and explicit `Next move` guidance under each mission progress bar.
- Contributions card hierarchy pass:
  - restructured each contribution card header into clearer scan blocks: repo lane, PR number/status, title, timeline sentence, and semantic metadata chips.
  - added compact XP/signal summary slab on the right side of each card for faster at-a-glance comparison.
  - added an explicit `Why this moved your score` heading for signal metrics and an `Impact statement` marker inside AI narratives.
- Dashboard navigation + background legibility pass:
  - reformatted mobile dashboard nav into horizontally scrollable lane cards with larger touch targets and stronger active-state contrast.
  - added desktop sidebar lane indexing chips to improve scanability of the five primary lanes without changing route semantics.
  - reduced app-shell vignette and global background glow/overlay intensity so the locked background image remains visible while body text contrast stays stable.
- Onboarding reveal heading-structure pass:
  - normalized repeated badge and fallback card titles in `RevealPanel` from `h2` to `h3` within list-rendered cards.
  - added explicit `list-none` classes on reveal badge/fallback list items for consistent semantic card-list styling.
  - preserves reveal visuals while improving heading hierarchy consistency in onboarding cards.
- Dashboard quest-card heading pass:
  - promoted quest titles in dashboard `QuestPanel` list cards from paragraph text to `h3` headings.
  - normalized quest list-item semantics (`list-none`) for consistent card-list structure.
  - preserves quest rendering behavior while improving heading clarity in repeated mission cards.
- Repeated-card heading hierarchy pass:
  - downgraded repeated contribution and badge card titles from `h2` to `h3` in list-rendered components.
  - keeps visual styling unchanged while preserving cleaner page heading structure for assistive navigation.
- Deferred-section accessibility stability pass:
  - updated `DeferUntilVisible` to eagerly render in jsdom-like runtimes, preventing deferred settings/privacy controls from disappearing in a11y regression environments.
  - restored full pass for `npm run test:a11y` while keeping IntersectionObserver-based deferral in normal browsers.
- PR breakdown readability pass:
  - normalized remaining low-opacity evidence/penalty helper copy in `XPBreakdownCard` to full readable tokens.
  - keeps scoring explanations unchanged while improving dense report legibility.
- Quests semantic structure pass:
  - converted mission spotlight cards from plain grid children to semantic `ul/li` entries.
  - converted cadence quest-card grids to semantic `ul/li` rendering for clearer assistive list traversal.
  - corrected quest card heading hierarchy (`h2` to `h3`) so repeated cards no longer over-promote heading level.
- Navigation/readability polish pass:
  - added a safe `scrollIntoView` capability guard to shared `SectionJumpNav` active-chip auto-scroll behavior.
  - normalized remaining low-opacity helper/callout copy in jump-nav mobile label, badge locked-lane next-move text, dashboard report hint text, and PR anti-spam explanation text.
  - keeps route behavior unchanged while improving legibility consistency and non-browser runtime safety.
- High-contrast preference refinement pass:
  - added `@media (prefers-contrast: more)` token overrides to boost readable text contrast and reduce background visual noise automatically.
  - tuned overlay/grid/blur intensity under high-contrast preference so dense surfaces remain legible without changing route logic.
- Tabs compatibility guard pass:
  - added a safe `scrollIntoView` capability check before auto-centering active tabs in shared `TabsList`.
  - preserves route behavior in browsers while preventing test/runtime crashes in environments where `scrollIntoView` is unavailable.
  - validated with `vitest tests/accessibility-controls.test.tsx`.
- Filter control-to-results mapping pass:
  - added `aria-controls` on contributions category tab triggers and sort selector trigger, targeting the contribution cards region.
  - added `aria-controls` on badges rarity/state selector triggers, targeting the earned-badges region.
  - keeps filtering behavior unchanged while tightening assistive linkage from filter widgets to result containers.
- Settings filter-to-results linkage pass:
  - connected sync-run filter actions (status/search/reset) to a stable sync-runs results region via `aria-controls`.
  - connected repository-visibility filter actions (search/state/reset) to a stable repository-results region via `aria-controls`.
  - keeps existing settings behavior while improving assistive mapping between filter controls and updated result sets.
- Leaderboard filter-to-results linkage pass:
  - added `aria-controls` from leaderboard lane tabs and `Reset to Global` action to the existing ranked-rows region container.
  - keeps lane behavior unchanged while tightening assistive mapping between filter controls and updated rank rows.
- Badges filter-control semantics pass:
  - converted badges active-filter chip cluster to semantic list markup, with per-chip clear actions.
  - linked badge filter clear/reset controls to the earned-badges region via `aria-controls`.
  - added a stable earned-badges region container ID so filter actions always target an existing results region.
- Contributions filter-control semantics pass:
  - converted active-filter chip rendering to semantic list markup and kept clear actions attached to each chip.
  - wired filter reset/clear actions with `aria-controls` targeting the contribution cards region for clearer assistive context.
  - connected contributions filter panel to the cards region ID to tighten filter-to-results relationship without API changes.
- Client env-safety hardening pass:
  - removed non-public `process.env.NODE_ENV` usage from the client-side query provider.
  - switched React Query devtools gating to a runtime local-host detector backed by `useSyncExternalStore`, keeping hydration-safe defaults.
  - validated with `npm run check:client-env-safety`.
- Tabs main-thread guard hardening pass:
  - removed `requestAnimationFrame` usage from shared `TabsList` mount behavior and switched to immediate mount-time active-tab alignment.
  - keeps active-tab auto-centering behavior for overflow tab rails while satisfying frontend main-thread guard expectations.
  - validated with `npm run check:main-thread`.
- Leaderboard lane-tab labeling pass:
  - added explicit `aria-label` on leaderboard `TabsList` so the lane selector is announced consistently as a filter control in assistive navigation.
  - preserves existing tab behavior and route semantics.
- Dashboard navigation readability pass:
  - increased lane-status text contrast in desktop sidebar and mobile nav headers.
  - strengthened mobile lane label typography (`0.8rem`) for clearer five-lane scanning without changing route structure.
  - updated mobile `Display controls` shortcut text to use shared readable foreground tokens for consistency with active lane copy.
  - preserves existing navigation behavior while improving quick orientation legibility on smaller screens.
- Settings semantic-list consistency pass:
  - converted settings display theme/text option maps to explicit semantic list markup (`ul/li`) while preserving existing preview and active-state behavior.
  - converted sync-log status filter options and repository visibility filter options to semantic list structures for clearer assistive traversal.
  - added explicit `aria-pressed` state metadata on option buttons (theme, text scale, sync status, repository visibility) for clearer assistive selected-state feedback.
  - converted repository visibility card rendering to a semantic list container so repeated repository rows expose consistent list semantics.
  - no backend/API contract changes; frontend structure-only accessibility consistency refinement.
- PR report semantic-lane pass:
  - converted PR evidence-signal cards, stored-evidence chips, XP breakdown rows, penalty rows, unlocked-badge cards, and suggested-quest evidence chips to semantic list structures (`ul/li`).
  - preserves scoring/report behavior while improving assistive navigation and count context in the report’s densest sections.
- Quick-actions ARIA grouping refinement:
  - aligned dashboard quick-actions listbox with grouped-option semantics (`role="group"` containers with direct `role="option"` children).
  - added option positional metadata (`aria-posinset`, `aria-setsize`) for clearer assistive context while preserving existing keyboard flow and visual grouping.
- Semantic card-grid pass on high-traffic lanes:
  - converted remaining repeated card/chip grids in badges, contributions timeline highlights, dashboard badge shelf, dashboard battle reports, dashboard signal chips, and marketing solution cards to semantic `ul/li` structures.
  - preserved existing visual layout and interactions while improving assistive-tech list traversal and item-count context.
  - no API/data-flow changes; strictly frontend structure/readability consistency work.
- Readability regression guardrail:
  - added `frontend/scripts/check-readable-text-tokens.mjs` to block legacy low-contrast `text-slate-*` helper classes from re-entering product routes.
  - wired guard into `frontend/package.json` as `check:readable-text` and into `.github/workflows/frontend-ci.yml`.
  - kept a narrow allowlist for intentional theme-preview swatch tokens in settings visual-preview metadata.
- Global readability normalization pass across core lanes:
  - replaced remaining low-contrast slate helper text across dashboard, contributions, quests, badges, onboarding, profile, leaderboard, and shared fallback surfaces with unified readable tokens (`text-muted`/`text-foreground` as appropriate).
  - normalized navigation and action microcopy contrast in sidebar, mobile nav, jump rails, top-bar sync chips, and ghost-button default text.
  - converted onboarding sync pipeline rows to semantic ordered-list markup while preserving existing behavior and state transitions.
  - keeps architecture and data contracts unchanged while making cross-route body text and helper labels visibly more consistent.
- Contrast + semantics cleanup pass on settings and report surfaces:
  - normalized remaining low-contrast helper copy in PR report, XP breakdown, sync-state guide, settings display controls, and contribution fallback blocks to shared readable text tokens.
  - converted dashboard quick-actions result groups, keyboard-shortcuts dialog rows, and settings privacy-toggle rows to semantic list markup (`ul/li`) for cleaner assistive traversal.
  - kept all route behavior and data flow unchanged while tightening dark-theme readability consistency.
- Contributions/badges/quests consistency pass:
  - normalized low-opacity lane copy in contributions, badges, and quests surfaces to shared readable text tokens.
  - converted repeated repository, locked-badge, and quest evidence card groups to semantic list structures.
  - updated lane placeholders and metric labels to use the same readable muted text baseline as the rest of dashboard routes.
  - keeps lane behavior unchanged while improving cross-lane readability consistency and assistive-tech list traversal.
- Leaderboard/profile readability + semantics pass:
  - normalized remaining low-opacity body copy on leaderboard and public-profile surfaces to shared readable text tokens.
  - converted repeated leaderboard season chips and profile/top-skill/repository/best-PR card groups to semantic list structures.
  - converted public badge showcase cards to semantic list markup while preserving existing visual card hierarchy.
  - keeps ranking/profile behavior unchanged while improving assistive-tech traversal and text legibility on dense information views.
- Onboarding readability + semantics pass:
  - converted onboarding step/reason/badge/action card groups in login, connect, and reveal screens to semantic list markup.
  - normalized low-opacity onboarding narrative text to shared readable text tokens while preserving neon surface styling.
  - improved reveal snapshot and identity explanation block readability by removing extra opacity attenuation.
- Dashboard semantic-list + contrast pass:
  - converted dashboard first-run checklist and quest cards/signals to semantic list structures (`ol/li`, `ul/li`) for clearer assistive-tech reading order.
  - converted current-league evidence chips to list semantics while preserving visual chip layout.
  - normalized low-opacity helper text in current league, quest rationale, and chart summary/detail panels to shared readable text tokens.
  - keeps dashboard composition unchanged while improving cross-panel readability consistency.
- Dashboard/settings readability pass:
  - normalized low-opacity dashboard body copy (`rank preview`, `evidence context`, `first-run checklist`, and deferred section placeholders) to shared readable text tokens.
  - strengthened first-run checklist icon contrast for incomplete steps to improve state legibility.
  - upgraded settings sync-activity removable-filter controls to larger icon-button footprints for easier pointer use.
  - converted sync-run history rendering to semantic ordered-list structure (`ol/li`) while preserving per-run card layout.
- Dashboard top-bar density pass:
  - restructured top-bar layout into a two-column grid (`lane context` + `status/actions`) at desktop widths to reduce control crowding and wrap jitter.
  - removed top-bar lane-hint truncation in favor of readable wrapped hint copy.
  - added a compact mobile/tablet `Profile` button while keeping full `View public profile` copy for larger breakpoints.
  - aligned top-bar loading skeleton structure with the new layout to reduce hydration layout shifts.
- Marketing-page semantic-card pass:
  - converted repeated journey, progression-loop, and badge-lane card grids to semantic list markup (`ul/li`, `ol/li`) for clearer assistive-tech navigation.
  - raised low-opacity marketing copy to stronger readable tokens (`text-muted` / solid amber) in high-importance narrative blocks.
  - preserves existing visual hierarchy and route flow while strengthening scanability and accessibility semantics.
- Cross-surface readability + nav-density pass:
  - raised global microtext baselines (`text-xs`, `text-[10px]`, `text-[11px]`, and large-text-scale variants) for stronger dark-theme legibility on dashboard-heavy lanes.
  - increased mobile dashboard nav readability by enlarging active-lane copy and lane labels while preserving five-lane layout and touch-target footprint.
  - shortened mobile lane labels (`Home`, `Contribs`) so bottom-nav scanning stays clean after text-size increases.
  - tightened mobile nav control-button typography so quick display controls remain readable without increasing footer clutter.
  - softened AppShell vignette opacity to keep the locked background image more visible while retaining foreground text contrast.
- Leaderboard progressive-render pass:
  - switched leaderboard ranked-row rendering to a bounded initial window (`24` default, `12` constrained-network mode) with explicit `Show more rows` disclosure.
  - preserves full season context and local-bracket insights while reducing initial leaderboard DOM work on dense lanes.
  - added polite live-status announcements for visible-row counters so assistive tech receives progressive-disclosure updates after row expansion.
  - added `aria-controls` plus remaining-row labels on row expansion controls and anchored the ranked-list region with a stable ID.
  - aligned first-render row window with constrained-mode page-size defaults to avoid oversized initial lane mounts on low-end devices.
  - migrated ranked rows and local-bracket rows to semantic ordered-list markup (`ol`/`li`) to improve assistive-tech list navigation and positional context.
  - when the leaderboard list is partially rendered, row items now expose `aria-posinset` and `aria-setsize` so assistive tech still has full-rank position context.
- Reduced-gamification scroll-jank hardening:
  - switched reduced-gamification background attachment to `scroll` (from fixed behavior) and anchored background position to `center top`.
  - expanded reduced-gamification animation suppression to include `body::after` alongside existing reduced-motion shell overlays.
  - keeps the visual theme while lowering repaint pressure during long dashboard scroll sessions.
- Contributions progressive-disclosure performance pass:
  - capped contribution timeline rendering to a recent-month window (`12` default, `8` on constrained networks) and added explicit window copy for scan clarity.
  - switched contribution card lane to progressive disclosure (`Show more cards`) so initial render mounts a bounded subset (`24` default, `12` constrained) instead of the full list.
  - added polite live-status announcements for visible-card counters so assistive tech receives progressive-disclosure updates after card expansion.
  - added `aria-controls` plus remaining-card labels on card expansion controls and anchored the contribution-card region with a stable ID.
  - aligned first-render card window with constrained-mode page-size defaults to avoid oversized initial card mounts on low-end devices.
  - migrated contribution cards to semantic ordered-list markup (`ol`/`li`) for stronger list semantics and clearer screen-reader traversal.
  - when contribution cards are partially rendered, card items now expose `aria-posinset` and `aria-setsize` so assistive tech receives full-list position context.
  - bounded ABRA contribution payload sampling to a fixed top slice (`24`) so AI narrative requests stay predictable on dense histories.
- Dashboard route prefetch-throttle pass:
  - disabled automatic Next.js prefetch on dense dashboard navigation links (sidebar lanes, mobile lanes, breadcrumb parent, and top-bar profile link).
  - reduces background route compilation/network churn on low-end machines while preserving direct navigation behavior.
- Dense-surface shadow simplification pass:
  - removed per-item active-state glow shadows from sidebar and mobile nav lane tiles while preserving active border/background contrast.
  - removed per-row timeline bar glow shadow in contributions history to reduce repaint-heavy effects in repeated rows.
  - keeps hierarchy cues intact with lower per-element paint pressure on scroll-heavy surfaces.
- Contributions highlight deep-link pass:
  - added direct `View report` actions on top-highlight cards in the contributions timeline lane for faster drill-down into PR battle reports.
  - report links in this dense highlight list explicitly disable prefetch to avoid unnecessary background network churn.
- Dense-list link prefetch reduction pass:
  - disabled route prefetch on repeated PR-report links in `ContributionList`, `RecentBattleReports`, and `BestPRsPanel`.
  - reduces background prefetch churn on card-dense views while preserving direct navigation behavior.
- Card virtualization-style containment pass:
  - applied the existing `render-opt-card` containment utility to additional repeated card lists in dashboard skill lanes and PR report badge unlock cards.
  - improves offscreen render skipping consistency across high-density card sections without changing data contracts or visual hierarchy.
- Constrained-device chart fallback pass:
  - `SkillRadarChart` and `TimelineChart` now skip heavy chart rendering in constrained-network or reduced-gamification mode and render lightweight static bar summaries instead.
  - keeps metric visibility and section semantics intact while reducing dynamic chart work on low-end or reduced-data devices.
- Public profile header-structure pass:
  - added a route-level `PageHeader` to the public profile page with snapshot freshness and constrained-network context for consistency with other major product routes.
  - moved the primary page-level heading responsibility to the route header and changed the profile hero display-name heading from `h1` to `h2` to keep heading hierarchy clearer.
- Unique navigation landmark labeling pass:
  - added explicit per-route landmark labels for all `SectionJumpNav` usages (dashboard, contributions, badges, quests, settings, leaderboard, public profile, PR report).
  - updated shared `SectionJumpNav` to accept `landmarkLabel`, improving screen-reader landmark navigation when multiple nav regions are present on the same page.
- Route loading skeleton density pass:
  - reduced skeleton block count across shared `RouteLoadingState` variants (dashboard, marketing, profile, report, default) to lower first-render DOM and paint cost.
  - preserved route-specific loading hierarchy while trimming non-essential placeholder rows/cards for smoother low-end device behavior.
- Section jump-nav landmark-label fix:
  - switched shared `SectionJumpNav` landmark labeling to a direct `aria-label` so the navigation region keeps a stable accessible name on both mobile and desktop layouts.
  - resolves a small-screen labeling edge case where `aria-labelledby` pointed at an element hidden by responsive classes.
- Dashboard breadcrumb orientation pass:
  - added a semantic breadcrumb landmark in the dashboard top bar (`nav` + ordered list + `aria-current="page"`) for explicit “you are here” orientation.
  - breadcrumb now links parent lane (`Dashboard`) and marks current lane as the active page while preserving existing lane hint chips.
  - keeps visual styling consistent with the neon shell while improving screen-reader navigation context.
- PR report header-consistency pass:
  - added `SnapshotFreshnessPill` and constrained-network context to the PR report page header so it matches other dashboard lanes.
  - removed duplicate page-level heading semantics by changing the PR title in the overview card from `h1` to `h2`.
- Mobile lane-label consistency pass:
  - aligned mobile bottom-nav lane labels with desktop lane labels (`Dashboard`, `Contributions`, `Badges`, `Quests`, `Settings`) to improve cross-device navigation scent.
  - increased mobile nav tile minimum height and bounded label width with controlled wrapping so full labels remain readable without truncation.
- Dashboard nav formatting pass:
  - simplified mobile bottom navigation by removing always-visible inline display toggles and replacing them with a single `Display controls` shortcut to Settings.
  - tightened mobile tab label sizing/spacing for cleaner five-lane scan behavior and reduced footer clutter.
  - improved active-lane visibility in desktop shells by adding lane icons to top-bar and sidebar status pills and showing the lane hint earlier (`lg` breakpoint).
- Adaptive constrained-device mode pass:
  - expanded constrained-mode detection beyond network-only hints to include low device-memory, low CPU core count, and slow display update-rate signals.
  - surfaced the active constrained-mode reason in the shared `ConstrainedNetworkPill` (for example low-memory/low-CPU mode) so users understand why visual effects are reduced.
  - tightened constrained-mode interaction transitions and disabled cyber-link glow hover text-shadow in constrained mode to reduce paint cost on weaker devices.
- Onboarding connect-return path pass:
  - added a direct `Continue analyzing` action on connect screen for returning users who already linked GitHub in the current browser context.
  - added explicit copy explaining that analyzing can be opened directly when OAuth is already complete.
- Onboarding analyzing retry-control pass:
  - added explicit `Retry sync` action when onboarding sync state is recoverable (`never_synced`, `partially_synced`, `stale`, `failed`, `rate_limited`) and no sync is currently running.
  - normalized sync-state labels in analyzing copy to user-facing casing for clearer status reading.
  - keeps existing auto-sync polling behavior while adding a direct manual recovery path.
- Onboarding reveal recovery pass:
  - added sync-recovery primary action on reveal when evidence is missing or sync state is `never_synced`, `partially_synced`, `failed`, or `rate_limited`.
  - surfaced relative last-sync timing in reveal snapshot state copy when available.
  - normalized sync-state labels to user-facing casing (`Never synced`, `Rate limited`, etc.) for clearer onboarding messaging.
- Quick-actions keyboard jump pass:
  - added `Home` / `End` navigation in quick actions to jump directly to first or last result.
  - updated shortcut-help reference so keyboard guidance matches live behavior.
  - added a `Clear search` recovery action in the no-results state for faster palette reset.
- Quick-actions search clarity and efficiency pass:
  - added inline clear-search control and live result-count status in the dashboard quick-actions palette.
  - replaced per-item `findIndex` lookups with a memoized action-index map to reduce repeated list scanning during palette rendering.
  - added `Esc` behavior that clears an active query before closing the palette, improving keyboard recovery.
  - updated shortcut-help copy to document the two-step `Esc` behavior.
  - keeps shortcut behavior and command execution contracts unchanged.
- Page-header measure consistency pass:
  - aligned shared `PageHeader` description max width to `68ch` to match project readability baseline.
  - improves long-form header scan comfort on wider displays without changing route structure or content.
- Copy-action layout stability pass:
  - made shared copy-text controls use a stable minimum width for non-icon variants so state transitions (`Copy` -> `Copied`) do not shift nearby layout.
  - improves header and section-nav interaction polish where copy-link controls are frequently used.
- Repository visibility filter-recovery pass:
  - added active-filter chips and one-tap clear actions for repository search query and visibility filter in Settings.
  - added inline clear-search affordance in repository privacy search input for faster mobile/desktop recovery.
  - compacted long query chip labels to preserve layout on narrow screens.
  - keeps existing privacy toggle behavior and backend sync contracts unchanged.
- Contributions filter quick-clear pass:
  - added inline clear-search control in the contributions filter input, aligned with other filter-heavy surfaces.
  - preserves existing active-filter chips and reset behavior while reducing taps needed to recover from narrow searches.
- Badges and leaderboard filter-recovery pass:
  - added removable active-filter chips for badge rarity and visibility filters, each with one-tap clear actions.
  - added a quick `Reset to Global` action in leaderboard lane controls when viewing non-global tabs.
  - improves recovery from narrow-filter and deep-lane states without changing backend contracts.
- Settings sync-log filter-recovery pass:
  - added active-filter chips for sync-run search query and status filter, each with one-tap clear controls.
  - added inline clear-search affordance in the sync-log search field for faster filter recovery on mobile and desktop.
  - compacted long query chip labels to preserve layout on narrow screens.
  - keeps existing backend contract and polling behavior unchanged while reducing dead-end filtered states.
- Mobile quick-controls state visibility pass:
  - updated mobile display controls to show current state labels directly on each button (`Theme`, `Text`, `Effects`) instead of generic labels only.
  - added compact active-state styling for non-default text scale and reduced-effects mode to improve at-a-glance orientation.
  - keeps existing shortcuts and interactions unchanged while reducing settings round-trips.
- Dashboard top-bar wayfinding pass:
  - added a visible current-lane context chip in the top bar (`Dashboard`, `Contributions`, `Badges`, `Quests`, `Settings`) so route context stays obvious when the sidebar is off-screen.
  - reduced top-bar control crowding by moving display toggles (effects/theme/text) to very wide breakpoints only, while preserving quick controls in sidebar/mobile nav.
  - keeps primary top-bar actions focused on sync status, rank/XP, quick actions, and profile/share tasks.
  - updated the top-bar loading skeleton with a matching lane-chip placeholder to reduce layout shift between loading and hydrated states.
- Dashboard navigation formatting pass:
  - refined sidebar lane hierarchy with clearer spacing rhythm between lane groups and individual links.
  - surfaced current lane state as a visible status chip in sidebar and mobile nav headers for faster orientation.
  - improved mobile nav readability by using consistent `text-xs` labels and a visible quick-controls caption.
- Filter-aware empty-state pass:
  - updated Contributions and Badges root empty states to distinguish true no-data onboarding states from filter/search no-result states.
  - filter-generated no-results now provide direct `Reset filters` primary actions instead of showing first-use copy that implies no evidence exists.
  - kept existing recovery links to Settings/Contributions/Quests so users always have a clear next action regardless of state.
- Tabs overflow orientation pass:
  - upgraded shared `TabsList` to auto-scroll the active tab trigger into view as tab state changes, including initial mount.
  - behavior respects reduced-motion preference by switching to instant scroll when `prefers-reduced-motion` is enabled.
  - improves lane-switch orientation in horizontally scrollable tab strips (notably leaderboard lane tabs) without route or data-contract changes.
- Section jump-nav focus-tracking pass:
  - upgraded shared `SectionJumpNav` to auto-scroll the active section chip into view when the horizontal chip rail overflows.
  - motion now respects `prefers-reduced-motion` (smooth by default, instant when reduced motion is enabled).
  - improves orientation consistency across dashboard, contributions, badges, quests, leaderboard, settings, public profile, and PR report section rails.
- Empty-state CTA hierarchy pass:
  - updated shared `EmptyState` to keep one clear primary action while rendering secondary actions as lower-emphasis inline links.
  - added optional `eyebrow` support so empty-state intent can be tuned per surface without duplicating component structure.
  - applied context-specific eyebrow labels across contributions, badges, quests, leaderboard, PR report, and public profile empty states.
  - reduces multi-button decision load and aligns empty-state behavior with one-primary-action guidance.
- Leaderboard local-bracket pass:
  - added a “Closest rank neighbors” block in leaderboard arena to show the current user’s immediate rank neighborhood instead of only global top-heavy context.
  - surfaces clear short-range progression framing (`XP to pass #N`) and per-neighbor XP gap/movement chips.
  - improves mid-table motivation and reduces leaderboard disengagement risk without introducing synthetic users or new scoring rules.
- Leaderboard number-scan pass:
  - normalized leaderboard arena numeric readouts to locale-formatted values (for example `12,450` instead of `12450`) across metrics, local-bracket chips, and gap guidance text.
  - improves quick visual scanning and reduces misread risk on dense score cards.
- Season urgency framing pass:
  - added shared `formatTimeUntil()` formatter for stable time-remaining copy without live ticking animations.
  - surfaced season end date + remaining window on dashboard `CurrentLeagueCard` and leaderboard arena hero cards.
  - improves progression clarity and urgency framing with deterministic backend season metadata (`endsAt`) only.
- Coarse-pointer readability and performance pass:
  - added a dedicated `@media (any-pointer: coarse)` surface fallback that disables `backdrop-filter` on glass/neon card families for touch-first devices.
  - increased mobile surface opacity and simplified shadow stacks to preserve text contrast over the locked background while reducing scroll jank risk from layered blur effects.
  - kept existing touch-target sizing (`44x44` focus-ring minimum) and route structure unchanged.
- Sync-log error readability pass:
  - sanitized per-run `last_error` text in Settings sync activity so technical upstream/network strings are no longer rendered raw in cards.
  - reused existing `sanitizeUserFacingError(..., "settings-sync-runs")` mapping for consistent timeout/rate-limit/auth wording.
  - keeps sync diagnosis understandable to end users while avoiding noisy transport-level error output in the primary UI.
- Background-visibility and glow-smoothing pass:
  - softened `neon-vignette` edge ramps to reduce dark-edge clipping and keep the locked background image visible across dashboard and marketing shells.
  - expanded page-shell glow gradients (`::before`/`::after`) with longer falloff stops so accent glow starts/stops are smoother and less abrupt.
  - lowered shell vignette overlay opacity in `AppShell` (`0.08/0.12`) to improve text-background separation without reintroducing heavy motion/effects.
- Dialog safe-area resilience pass:
  - completed safe-area-aware modal layout classes (`.dialog-safe-content`, `.dialog-safe-close`) used by shared `DialogContent`.
  - dialog max-height now respects top/bottom insets and dynamic viewport height (`dvh` with `vh` fallback), reducing clipped content on mobile browser chrome changes.
  - close control now respects right/top safe-area insets for notch and gesture-area devices.
- Legacy dashboard-route alias pass:
  - added top-level route aliases for `/contributions`, `/badges`, `/quests`, `/settings`, and `/leaderboard`.
  - each alias now server-redirects to the dashboard namespace equivalent (`/dashboard/*`) so bookmarked or manually entered legacy paths no longer 404.
  - improves navigation recovery without changing dashboard data contracts or auth flow.
- Mobile shortcut metadata pass:
  - added `aria-keyshortcuts` to mobile quick-display controls (theme/text/effects) for parity with desktop quick-switcher controls.
  - keeps mobile behavior unchanged while improving assistive-technology awareness of available keyboard shortcuts.
- Keyboard shortcut discoverability pass:
  - added `aria-keyshortcuts` metadata to shortcut entry buttons for quick actions (`Meta+K`/`Control+K`) and shortcuts help (`?`).
  - added matching `title` hints so pointer users also see available keyboard triggers.
  - improves assistive-technology discoverability without changing existing shortcut handlers.
- Label truncation resilience pass:
  - removed hard `truncate` from onboarding step labels and mobile nav lane labels.
  - switched to controlled wrapping (`break-anywhere`, explicit line-height, centered mobile labels) to preserve readability when labels expand.
  - keeps the same nav/onboarding flow while reducing clipped text risk under larger text-scale or future copy updates.
- Sticky top-bar safe-area pass:
  - added reusable `.sticky-safe-top-4` helper to keep sticky dashboard bars offset from top safe-area insets.
  - applied this helper to all dashboard top-bar variants (live, loading, unavailable).
  - improves top-edge breathing room on notched/mobile devices while preserving desktop sticky spacing.
- Sticky sidebar/nav safe-area pass:
  - added `.sticky-safe-top-6` and `.sticky-safe-top-20` helpers for sidebar and higher-offset sticky lane nav surfaces.
  - wired dashboard sidebar, default section jump nav, public-profile section nav, and PR-report section nav to safe-area-aware sticky top offsets.
  - keeps existing sticky behavior while reducing overlap risk near dynamic top browser UI.
- Cross-surface microtext legibility pass:
  - raised remaining high-visibility `text-[10px]/text-[11px]` spots to `text-xs` across skill confidence chips, profile hero readout, dashboard shortcut hint, mobile quick-display controls, and settings theme/text active chips.
  - enlarged onboarding step index badges (`h-5 w-5`) while moving step numerals to `text-xs` for clearer progress visibility.
  - updated contributions active-filter remove control glyph text to `text-xs` while preserving its `24x24` target-size footprint.
  - keeps compact dashboard density while reducing eye strain on small/medium displays.
- Viewport safe-area enablement pass:
  - extended root `viewport` metadata with `viewportFit: "cover"` so `env(safe-area-inset-*)` spacing rules can fully engage on notched mobile devices.
  - set `interactiveWidget: "resizes-visual"` to reduce keyboard-overlay surprises on mobile form surfaces.
  - keeps existing theme-color/copy styling unchanged while improving layout behavior around browser/device UI chrome.
- Quick-actions readability pass:
  - increased quick-action trigger/modal microtext from `text-[11px]` to `text-xs` for shortcut badges, group labels, and command hints.
  - improves scan speed in the keyboard command surface without changing command routing, ranking, or action behavior.
- Skip-link safe-area pass:
  - updated `.skip-link` top position to `max(0.75rem, env(safe-area-inset-top, 0px))`.
  - keeps keyboard "Skip to main content" control visible and reachable on notched/mobile devices where top inset can obscure fixed UI.
- Mobile dashboard safe-area spacing pass:
  - replaced static dashboard content bottom padding (`pb-24`) with a dedicated safe-area-aware class.
  - new `.dashboard-mobile-safe-bottom` applies `calc(6rem + env(safe-area-inset-bottom, 0px))` so fixed mobile nav does not overlap bottom content on devices with home-indicator inset.
  - keeps zero extra padding on `xl` and up to preserve desktop layout density.
- Contributions and badges metric-label readability pass:
  - increased key metric label styling from `text-[11px]` to `text-xs` in contributions and badges summary cards.
  - normalized the contribution signal-index header away from highly tracked uppercase into clearer title-case `text-xs`.
  - improves quick-scan clarity in dense metric tiles without altering card structure or scoring semantics.
- Dashboard sidebar readability pass:
  - removed hard truncation on sidebar brand/nav labels and hint copy in favor of controlled wrapping (`break-anywhere`, explicit line-height).
  - improves lane-name legibility and prevents clipped semantics on narrower desktop widths or larger text-scale settings.
  - keeps the same route structure and interaction model while making navigation copy easier to scan.
- Settings micro-type readability pass:
  - removed remaining `text-[9px]` usage from theme preview chips in Settings.
  - increased preview chip labels to `text-[10px]` with taller chip height and centered alignment for clearer at-a-glance legibility.
  - keeps compact preview density while avoiding tiny microtext in the primary display-preferences surface.
- Section jump-nav formatting pass:
  - refined `SectionJumpNav` layout to stack cleanly on narrow widths and keep desktop status copy grouped without crowding.
  - removed tiny uppercase mobile active-label styling in favor of clearer `text-xs` title-case rendering.
  - increased desktop jump-pill tap area (`min-h-9`) for more reliable pointer and touch navigation.
- Background preload pass:
  - added `app/head.tsx` preload link for `/assets/background.webp` (gated by `prefers-reduced-data: no-preference`) so the locked background visual appears faster on initial load.
  - keeps reduced-data users on the lighter path while improving first-paint visual consistency for default-network sessions.
- Loading-surface simplification pass:
  - added `GlowCard` `variant="loading"` to render lightweight panel shells without the full cyber-frame/cyber-sheen layered effects.
  - switched shared `RouteLoadingState` and `LoadingState` to the loading variant so first-route/loading skeletons mount with lower paint and compositing cost.
  - preserved the same structure and messaging while reducing visual effect overhead during boot and route transitions.
- Global readability + paint-cost pass:
  - introduced `--copy-line-height` and applied it to body + key narrative copy classes (`.cyber-copy`, `.cyber-copy-muted`) for steadier long-form readability.
  - tightened readable paragraph measure from `72ch` to `68ch` to keep scan width closer to accessibility guidance for comfortable reading.
  - reduced high-cost visual paint pressure by replacing blurred page-shell glow blobs with gradient-based soft glows (no CSS blur filter) and by trimming oversized hero/ring shadow stacks.
- Target-size accessibility pass:
  - increased the contributions active-filter chip remove control hit area to at least `24x24` CSS pixels (`min-h-6 min-w-6`) in line with WCAG 2.2 SC 2.5.8 guidance.
  - keeps the visual chip density while improving touch and imprecise-pointer usability.
- Constrained-network visibility pass:
  - added shared `ConstrainedNetworkPill` that surfaces active reduced-data/constrained-connection mode with reason hints (Save-Data, 2g/slow-2g, or reduced-data preference).
  - attached this indicator to dashboard `PageHeader` meta lanes across Dashboard, Contributions, Badges, Quests, Leaderboard, and Settings.
  - makes adaptive prefetch/polling reductions explicit to users so lower-refresh behavior is explainable rather than silent.
- OAuth-start prefetch hardening pass:
  - disabled `next/link` prefetch on all `GET /oauth/github/start` entry links (marketing header/hero, onboarding connect/login/reveal).
  - avoids background route warmups from creating premature OAuth-start side effects (state/cookie generation before user intent).
  - keeps explicit click-driven auth start behavior deterministic and easier to reason about during local demo flows.
- Adaptive link-prefetch pass:
  - dashboard sidebar, mobile nav, and top-bar public-profile links now disable `next/link` prefetch when constrained-network mode is detected.
  - default-network users keep normal prefetch behavior; reduced-data users avoid unnecessary route payload warmups.
  - this aligns routing behavior with the existing constrained-network rendering and polling reductions.
- Mobile nav quick-controls pass:
  - added a separated quick-controls row inside `MobileNav` for theme, text-size, and effects toggles.
  - keeps primary lane navigation intact while giving one-tap display adjustments on small screens.
  - uses explicit labels and minimum touch-friendly button sizing for mobile ergonomics.
- Snapshot-freshness visibility pass:
  - added shared `SnapshotFreshnessPill` component with relative + exact timestamp hints.
  - extended `PageHeader` with an optional `meta` lane for compact status chips under header copy.
  - wired freshness pills into Dashboard, Contributions, Badges, Quests, Leaderboard, and Settings headers so each major route now shows "last refreshed" context without requiring stale/error states to trigger first.
- Adaptive polling pass for constrained networks:
  - `useMyProfile` now uses longer stale-time and slower auto-poll intervals when reduced-data/constrained-network mode is detected.
  - `useSyncRuns` now also shifts to slower active/idle polling windows on constrained networks and disables focus-triggered refetch bursts in that mode.
  - keeps normal freshness behavior on default networks while reducing repeated sync/profile request pressure on slower links and lower-end devices.
- Visual-effects quick-control pass:
  - added `GamificationQuickSwitcher` so users can switch between full and reduced visual effects from dashboard surfaces without opening Settings.
  - wired the new control into sidebar and top-bar quick controls with an explicit `Alt+Shift+G` accelerator.
  - extended keyboard-help and quick-action palette to include the effects toggle for consistent discoverability.
  - added global display-shortcut handling for `Alt+Shift+G`, with live status announcements matching existing theme/text controls.
- Constrained-network runtime fallback pass:
  - added runtime network constraint detection from `navigator.connection.saveData` and `effectiveType` (`slow-2g`/`2g`) inside `use-gamification-preference`.
  - now sets `html[data-network="constrained"]` so low-data render reductions apply even where `prefers-reduced-data` media query is unsupported.
  - mirrored reduced-data visual trims (background simplification, overlay removal, blur/shadow reduction) under the new constrained-network attribute in global CSS.
- AI privacy redaction consistency pass:
  - profile adaptation now redacts contribution/report AI summary text when `privacy.showAiSummaries` is disabled.
  - applies to contribution cards, featured contribution summaries, and recent PR reports derived from `/api/profile/me`.
  - keeps deterministic evidence signals visible while ensuring AI-generated wording does not appear when the user has opted out.
- Settings deferred-render pass:
  - applied `DeferUntilVisible` to sync activity, profile privacy, display controls, repository visibility, and data-control sections.
  - added lightweight settings placeholders so jump-nav and account controls remain interactive while heavier section content mounts near viewport.
  - moved sync-run query subscription inside the deferred sync-activity section so background polling does not start until the section is near viewport.
- Public profile deferred-render pass:
  - applied `DeferUntilVisible` to badges/skills, best-PR panel, and timeline/repository lanes.
  - kept profile section anchors intact while reducing initial mount pressure from charts and dense card grids.
  - gated ABRA/Gemini identity generation behind real contribution evidence (`mergedPrCount > 0` and contribution history present) and user AI-summary visibility preference.
  - added deterministic identity-summary fallback text so the profile remains informative when AI is disabled, unavailable, or intentionally skipped.
- ABRA evidence-gating consistency pass:
  - introduced shared `shouldRequestAbraInsights` + deterministic identity-summary helper under `lib/ai/deterministic-identity-summary.ts`.
  - applied the evidence/privacy gate to dashboard, onboarding reveal, contributions, and badges surfaces so AI generation is skipped when users disable AI summaries or have no real contribution evidence.
  - wired deterministic fallback summaries into dashboard and onboarding hero/reveal panels to keep copy meaningful without synthetic claims.
  - added deterministic archetype derivation from strongest-signal categories and wired it into dashboard, public profile, onboarding reveal, contributions, and badges headings.
  - removed generic fallback archetype text when AI is skipped so progression labels stay evidence-linked instead of static.
  - improved zero-evidence deterministic identity summaries to avoid overstated claims and explicitly direct users toward first merged-PR evidence.
- Landing page deferred-render pass:
  - kept the hero section immediate, then deferred below-the-fold marketing sections (context lanes, journeys, solution loop, battle preview, anti-spam/CTA) using `DeferUntilVisible`.
  - added lightweight landing placeholders to keep the first paint responsive while preserving the same visual narrative and call-to-action flow.
- PR battle report deferred-render pass:
  - applied `DeferUntilVisible` to score matrix, AI summary, evidence signals, badge unlocks, and suggested-quest sections.
  - preserved explainability and section-jump flow while reducing above-the-fold render cost on deep report pages.
- Dashboard deferred-render pass:
  - added shared `DeferUntilVisible` section helper using
    `IntersectionObserver` + positive `rootMargin` preloading window to delay
    below-the-fold panel mounts
  - applied deferred mounts to heavy dashboard sections (league, quests, score
    explanation, skill breakdown, battle reports, badges, timeline) with
    stable loading placeholders so first paint does less work while preserving
    route structure and jump-nav anchors.
- Contributions deferred-render pass:
  - applied `DeferUntilVisible` to contributions overview, repositories,
    timeline/highlights, and achievement-card lanes
  - added lightweight section placeholders so filters and top-level routing
    stay interactive while heavier PR-card blocks mount near viewport.
- Leaderboard and badges deferred-render pass:
  - applied `DeferUntilVisible` to leaderboard arena/climb blocks and badge
    forge/earned/locked sections
  - preserved section anchors and recovery states while reducing initial mount
    pressure from dense grids and table surfaces.
- Quests deferred-render pass:
  - applied `DeferUntilVisible` to journey hero, mission spotlight, and all
    cadence section card grids
  - kept cadence deep links and empty-state recovery actions intact while
    reducing immediate mount cost of multi-lane quest boards.
- Dashboard lane readability pass:
  - expanded dashboard nav item contracts with route-level hints so lane intent
    is visible across sidebar, mobile nav, and command palette surfaces
  - reformatted desktop sidebar lane cards into two-line label + hint rows with
    stronger active-state contrast and cleaner section hierarchy
  - tightened mobile bottom-nav typography and active signal while keeping
    compact five-lane layout and accessible hidden lane descriptions.
- Shell render stability pass:
  - removed `next/dynamic` + `ssr:false` wrappers from root query provider and
    dashboard topbar helpers inside client-only modules
  - eliminated root-route server render bailout traces tied to `next/dynamic`,
    improving first paint consistency on local dev startup.
- Frontend production build hardening pass:
  - fixed typed preference-store inference for theme/text hooks to keep strict unions (`neon|midnight|aurora|high-contrast`, `default|large`) across render and action surfaces
  - fixed shared section-jump typing to support strongly typed route section IDs via generic-safe `SectionJumpNav`
  - fixed leaderboard `aria-busy` computation to always emit booleanish values
  - fixed onboarding polling state typing and settings sync-run error-sanitizer context coverage
  - fixed skill radar fallback typing so sparse snapshots compile under strict type checks.
- Social image renderer compatibility pass:
  - replaced unsupported `display: "inline-flex"` with `display: "flex"` across root and public OG/Twitter image routes so `next build` can prerender image routes reliably.
- Mobile jump-nav clarity pass:
  - surfaced current active section label above compact mobile jump-select controls for faster section orientation on small screens.
- Theme-switcher visual identity pass:
  - added compact three-swatch theme signatures to `ThemeQuickSwitcher` so the current theme is recognizable at a glance without opening settings.
- Settings display preference consistency pass:
  - added explicit system-vs-manual theme source state to `use-theme-preference`
  - added one-click “Follow system theme” action in Settings
  - fixed “Reset display preferences” to clear manual theme override (system-follow mode) instead of forcing high-contrast.
- Settings theme chooser preview pass:
  - upgraded theme rows to mini preview cards with sample title/body/chip lanes so readability and accent density can be compared before applying a theme.
- Contribution card signal-profile pass:
  - replaced flat metric tiles with a compact signal-profile block
  - added weighted `Signal index` plus per-signal bars (difficulty, impact, review depth, test signal)
  - surfaced line-change footprint (`+additions/-deletions`) inside each card for quicker contribution scope read.
- Cyberpunk palette + visibility tuning pass:
  - shifted base theme tokens toward electric-blue / deep-pink / lime / amber accents while preserving readability-first text contrast
  - updated key accent utilities (`neon-title`, divider, selection, status chips) to use the new palette language instead of flat cyan-magenta defaults
  - changed theme default fallback to `neon` (system high-contrast still respected) so first-load visuals match the intended dashboard mood.
- Background image compatibility hardening:
  - added an explicit `background.jpg` fallback before `image-set(...)` so fixed background rendering remains reliable on browsers with partial `image-set` support.
- Section jump-nav mobile formatting pass:
  - switched small-screen jump navigation to a compact `<select>` control with
    direct hash navigation, keeping the larger chip-based horizontal jump rail
    for `sm+` breakpoints
  - reduces cramped header controls on mobile while preserving keyboard and
    assistive-label coverage.
- Adaptive presentation + performance baseline correction:
  - fixed reduced-gamification default inference so sessions without an explicit
    user setting now follow real device/browser signals (`prefers-reduced-motion`,
    `prefers-reduced-data`, `prefers-reduced-transparency`, and `navigator.connection.saveData`)
    instead of always forcing reduced mode
  - added `@media (update: slow)` fallback styles to trim heavy overlays,
    backdrop blur, and transition cost on slow-refresh or constrained displays.
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
  - enabled explicit refetch on window focus/reconnect for sync-run queries so
    users returning to Settings see fresh queue state immediately.
  - added semantic `<time>` freshness labeling in sync log header with both
    relative and absolute timestamps for clearer freshness verification.
- Web-vitals observability testability pass:
  - extracted route-group mapping, metric-rating normalization, tracked-metric
  registry, and sampling logic into `lib/web-vitals.ts`
  - added focused regression coverage in `tests/web-vitals.test.ts` so route
  bucketing and deterministic sampling behavior stay stable as telemetry evolves.
- Sync-state guide regression coverage expansion:
  - extended `tests/sync-state-guide.test.ts` to cover partial-snapshot
    normalization (`synced` + partial -> `partially_synced`) and visibility
    gating behavior used across dashboard tabs.

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
- Added a consistent route-header pattern across dashboard surfaces:
  - dashboard, contributions, badges, quests, settings, and leaderboard now start with the same compact `PageHeader` structure (eyebrow, title, one-line purpose) for faster orientation.
- Normalized dashboard route navigation scroll behavior:
  - removed `scroll={false}` from primary dashboard route links so route changes follow default browser/Next navigation behavior more predictably.
- Added progressive disclosure for dashboard depth:
  - moved score-factor/skill/timeline deep panels behind an explicit `Show advanced analytics` toggle
  - keeps initial dashboard view lighter and reduces first-screen cognitive load on repeated visits.
- Improved contributions sync visibility:
  - added sync-state guide and stale-state banner at the top of `Contributions`
  - makes partial/stale snapshot conditions explicit before filters and cards, reducing confusion when evidence is missing or delayed.
- Added progressive disclosure to PR battle reports:
  - introduced `Show technical breakdown` toggle for score matrix, evidence signals, and reward derivation panels
  - keeps the default PR report view concise (`overview` + `AI summary` + `next quest`) while preserving deep diagnostics on demand.
- Reduced mobile filter clutter in contributions:
  - compact contribution filters now include a `Show filters` / `Hide filters` mobile disclosure control
  - keeps result count and active chips visible while deferring heavy search/sort controls until requested.
- Added one-tap active-filter chip removal in contributions:
  - active `Category`, `Search`, and `Sort` chips now clear their specific filter directly from the chip itself
  - reduces reset churn when comparing adjacent filter combinations.
- Unified dashboard chrome for stronger hierarchy:
  - merged top identity strip and route navigation into a single shared shell (`dashboard-chrome`) across all dashboard routes
  - removes stacked duplicate shells and makes primary navigation visually consistent while staying non-sticky.
- Added progressive disclosure to display customization in settings:
  - theme and text-scale controls now live behind a `Show tuning` toggle
  - keeps core privacy/sync controls scannable while preserving full customization when needed.
- Upgraded contribution card scoring visuals:
  - each contribution card now shows a deterministic signal band (`High`, `Rising`, `Early`) plus a static progress meter
  - preserves numeric signal transparency while making card scanning more game-like and presentation-friendly.
- Added one-tap chip clearing for badge filters:
  - active `Rarity` and `State` chips in badges now act as direct clear controls
  - keeps filter reset granular and avoids full-reset churn during badge browsing.
- Added progressive disclosure for leaderboard mission detail:
  - `Your arena mission` now defaults to a compact summary with a `Show mission plan` action
  - detailed climb metrics and progress bar remain available on demand, reducing first-view clutter.
- Added per-cadence quest section collapse controls:
  - `Daily`, `Weekly`, `Long-term`, and `Skill-based` quest sections now support `Show section` / `Hide section`
  - improves scan speed on long quest boards while keeping full detail available on demand.
- Tightened leaderboard lane tab readability on medium widths:
  - lane tabs now use short labels on tighter breakpoints and full labels on large screens
  - preserves lane meaning while reducing horizontal crowding.
- Added progressive disclosure to public profile heavy sections:
  - `Badges and skills`, `Best PR battle reports`, and `Timeline and repositories` now support `Show section` / `Hide section`
  - keeps the share-ready profile concise on first load while preserving full detail on demand.
- Added CSS render optimization for long dashboards:
  - `render-opt-section` and `render-opt-card` now use `content-visibility: auto` with intrinsic-size fallback where supported
  - lowers off-screen layout/paint pressure for large pages while preserving visible behavior.
- Added progressive disclosure to onboarding reveal detail blocks:
  - `Unlock preview` and `What to do next` now support `Show section` / `Hide section`
  - keeps the reveal screen dramatic but less overwhelming on first load.
- Added progressive disclosure for settings sync diagnostics:
  - `Sync activity` now defaults to a compact state with explicit `Show sync log` / `Hide sync log`
  - keeps settings focused on core privacy/display controls while preserving deep sync debugging on demand.
- Added copy-ready impact actions on contribution cards:
  - each impact summary panel now includes `Copy impact` with feedback states
  - makes PR narratives immediately reusable in public profile updates and presentation material.
- Added copy actions for core narrative summaries:
  - dashboard identity summary, public profile identity summary, and PR report AI summary now expose `Copy summary`
  - speeds up reuse of polished contribution language for resumes, social profiles, and presentations.

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
