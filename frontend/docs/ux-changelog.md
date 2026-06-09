# Frontend UX Changelog

## 2026-06-08

- Repository visibility section:
  - routed the section-level repository count through shared plural formatting.
  - added focused coverage for the single-repository settings summary.
- Shared count summaries:
  - added `formatCountOfTotal()` for singular-safe "shown of total" labels.
  - routed badge, repository, contribution-card, and leaderboard-row control summaries through shared count formatting.
- Shared filter controls:
  - changed active-filter chips from terse route-specific labels to shared plural-aware labels.
  - kept route-specific lane/search chips while centralizing the active-count copy in `FilterControlsHeader`.
- Quest cadence controls:
  - routed all visible and screen-reader mission-count summaries through shared plural-count formatting.
  - added coverage for one-result cadence lanes so controls do not announce awkward plural copy.
- Leaderboard row pagination:
  - changed show-more ranked-row batch and remaining labels to use shared plural-count formatting.
  - added focused coverage so the accessible name matches the exact row batch that will render.
- Quest mission pagination:
  - changed quest mission remaining labels to use shared plural-count formatting.
  - added lane-specific context and list-region wiring to the show-more mission action.
- Contribution card pagination:
  - changed show-more contribution batch and remaining labels to use shared plural-count formatting.
  - kept the action's accessible name aligned with the exact number of cards that will be added.
- Locked badge path pagination:
  - changed remaining locked-path copy to use shared plural-count formatting.
  - added remaining-count context to the locked-path show-more action's accessible name.
- Badge shelf pagination:
  - changed remaining badge copy to use shared plural-count formatting.
  - added remaining-count context to the show-more action's accessible name.
- Onboarding unavailable copy:
  - replaced implementation-facing sample-data wording with recovery-focused profile snapshot guidance.
  - added coverage to keep the unavailable reveal panel free of demo/sample-data language.
- Pending action feedback:
  - normalized settings, stale-refresh, sync-log, and PR-report retry pending labels to concise non-ellipsis copy.
  - added or preserved `aria-busy` on pending action buttons so disabled controls still expose active work to assistive technology.
- Settings privacy controls:
  - replaced label-plus-index switch IDs with explicit row-owned control IDs.
  - added focused coverage so public-profile privacy labels stay wired to durable switch IDs.
- Onboarding render identity:
  - added model-owned IDs to sync pipeline phases so phase rows render from durable step identity.
  - replaced reveal skeleton position keys with named placeholder IDs while preserving the same loading layout.
- Badge detail evidence identity:
  - routed badge detail evidence PR chips through stable render identities.
  - added duplicate-evidence coverage so repeated persisted PR IDs render without relying on array position.
- Shared loading and empty states:
  - routed route-loading skeleton rows and compact empty-state actions through explicit render identities.
  - kept loading announcements, empty-state recovery links, and visual skeleton structure unchanged while removing array-position keys.
- Quest card identity:
  - routed dashboard quest cards, quest-board mission rows, and quest evidence chips through stable quest/evidence render identities.
  - added duplicate-title coverage so repeated quest titles render as separate missions without relying on array position.
- Contribution/report card identity:
  - routed contribution cards, dashboard battle-report cards, public best-PR cards, and public repository rows through stable render identities.
  - added duplicate-label coverage so repeated PR titles or repository names render as separate evidence rows without relying on array position.
- Shared render identity:
  - added shared render-row identity normalization for duplicate-prone rows.
  - routed header meta chips, panel loading skeletons, timeline rows, and theme swatches away from array-position keys without changing visible UI.
- PR report row identity:
  - replaced index-derived keys in proof checks, stored evidence chips, suggested quest chips, badge reward chips, and XP breakdown rows with stable source/model IDs.
  - kept PR report copy and ordering unchanged while making report rendering less order-fragile.
- Onboarding reveal model:
  - changed reveal next actions from plain strings to stable `{id, text}` rows.
  - routed reveal badge and next-action lists away from index-derived keys while preserving the same visible copy and ordering.
- Onboarding entry model:
  - moved sign-in steps, connection steps, scoring rules, data-access rows, and privacy controls into `onboarding-entry-model`.
  - kept `LoginPanel` and `ConnectGithubPanel` focused on layout and analytics side effects while mapped rows use stable IDs.
- Social image chips:
  - moved home, profile, and PR OpenGraph/Twitter chip labels into shared `social-image-chips` presentation data.
  - replaced repeated inline chip arrays and index-derived keys in share-card routes with stable chip IDs while preserving the rendered labels.
- Marketing shell model:
  - moved marketing navigation items and anti-spam promise copy into shared `marketing-shell` presentation data.
  - kept `MarketingLayout` and `landing-page-model` aligned through one tested source of truth instead of duplicate inline shell copy.
- Marketing landing model:
  - moved loop steps, problem cards, core journeys, solution lines, badge tracks, and anti-spam promise copy into `landing-page-model`.
  - kept `LandingPage` focused on layout and icon selection while mapped sections use stable content IDs instead of index-derived keys.
- Onboarding reveal model:
  - moved reveal metrics, badge de-duplication, evidence summary copy, sync-recovery decisions, next actions, and share headline formatting into `reveal-panel-model`.
  - kept `RevealPanel` focused on rendering the reveal state, badges, recovery CTA, and dashboard/profile links.
- Onboarding sync model:
  - moved sync steps, polling cadence, progress, retry eligibility, and sanitized action-error state into `sync-pipeline-model`.
  - kept `SyncPipeline` focused on profile-sync side effects, polling orchestration, notices, and rendering the pipeline.
- Quest page model:
  - moved cadence grouping, visible mission lanes, journey progress, spotlight selection, and stale quest-evidence notice projection into `quests-page-model`.
  - kept `QuestsPageClient` focused on React state, sync refresh orchestration, and composing controls, journey, spotlight, and mission sections.
- Badge page model:
  - moved stale badge-evidence notice projection and stale-state visibility into `badges-page-model`.
  - kept `BadgesPageClient` focused on sync refresh orchestration, unlock announcements, and composing the overview, shelf, and locked-path sections.
- Leaderboard view model:
  - moved route-switch busy-state derivation and stale evidence notice projection into `leaderboard-view-model`.
  - kept `LeaderboardPageClient` focused on URL lane updates, sync refresh orchestration, and composing controls with the arena.
- Contributions page model:
  - moved repository and streak summaries, stale evidence notice selection, cached-refresh blocking state, background-refresh warning copy, and ABRA request shaping into `contributions-page-model`.
  - kept `ContributionsPageClient` focused on filter state, sync refresh orchestration, export notices, and composing filters with the card section.
- Dashboard page model:
  - moved streak projection, ABRA request shaping, deterministic archetype/identity fallback, and stale-notice selection into `dashboard-page-model`.
  - added shared GitRank profile and badge fixtures so dashboard, badge, and ABRA model tests use one profile contract instead of private duplicate builders.
- Badge page model:
  - moved page-size policy, deferred-filter status, streak summary, ABRA badge request shaping, and deterministic archetype fallback into `badges-page-model`.
  - kept `BadgesPageClient` focused on query state, sync notices, unlock announcements, and composing the overview, shelf, and locked-path sections.
- Settings sync-run activity:
  - moved row projection, searchable text, safe error normalization, metric summaries, status counts, health labels, summary insight selection, and filtered results into `sync-run-activity-model`.
  - kept `SyncRunActivityPanel` focused on search/status/detail local state while summary, filters, and results consume the same tested model output.
- Leaderboard view model:
  - moved current-user row marking, row page-size policy, nearby/full mode selection, active-control counts, and pagination state into `leaderboard-view-model`.
  - moved arena nearby-row construction into the same model so podium plus local-bracket rules are tested outside `LeaderboardArena`.
- Contribution shelf:
  - moved PR de-duplication, status/focus counts, render capping, visible-row pagination, filtered-empty state, and ABRA sample selection into `contribution-shelf-model`.
  - kept `ContributionsPageClient` focused on React query state, sync notices, export feedback, and composing filters with the card section.
- Badge shelf:
  - moved de-duplication, shelf filtering, locked-path sorting, pagination slices, completion percent, and filter-state counts into `badge-shelf-model`.
  - kept `BadgesPageClient` focused on React state, sync notices, and composing the badge overview, shelf, and locked-path sections.
- Settings account actions:
  - moved profile refresh, relink, sign-out, disconnect, export, delete, notice timeout, and JSON download orchestration into `useSettingsAccountActions`.
  - kept `SettingsPageClient` responsible for page layout and privacy/repository settings while account and data-control cards receive action state from the hook.
- ABRA insights:
  - centralized profile, contribution, and badge request projection in `buildAbraInsightsRequest`.
  - kept per-page gates explicit while removing duplicated AI request mapping from dashboard, contributions, badges, public profile, and onboarding clients.
- Quest spotlight:
  - moved daily, weekly, and long-term mission spotlight cards into `QuestsSpotlightSection`.
  - moved spotlight ranking and progress percent calculation into `quest-spotlight` so presentation and selection rules are testable outside the page client.

## 2026-06-07

- Leaderboard controls:
  - moved lane segmented-control options, active chips, reset presentation, and view-option disclosure into `LeaderboardControls`.
  - kept URL lane replacement, nearby/full mode state, detail state, and row pagination ownership in `LeaderboardPageClient`.
- Quest cadence controls:
  - moved mission-count live status, reset header, cadence segmented-control options, compact labels, and icons into `QuestsCadenceControls`.
  - kept cadence state and deferred filtering in `QuestsPageClient`, with the segmented-filter guard now auditing the extracted component directly.
- Contribution header actions:
  - moved evidence freshness, detail toggle, and CSV export controls into `ContributionsHeaderActions`.
  - moved CSV row formatting and browser download behavior into `contribution-csv-export` so the page client keeps state ownership instead of export plumbing.
- Badge shelf controls:
  - moved state/rarity segmented controls, advanced-filter disclosure, reset header, and live result counts into `BadgesShelfControls`.
  - kept rarity, visibility, deferred filtering, and pagination reset ownership in `BadgesPageClient` so the controls stay presentation-only.
- Badge shelf:
  - moved badge shelf loading, error, empty, grid, and show-more presentation into `BadgesShelfResults`.
  - kept filter state, deferred filter values, and pagination counts in `BadgesPageClient` so shelf controls remain the source of truth.
- Public profile best PRs:
  - moved constrained-network report previews, empty battle-report routing, deferred `BestPRsPanel` loading, and report placeholders into `PublicProfileBestPRsSection`.
  - kept featured-report and detailed-report selection in `PublicProfilePageClient`, with the section now owning presentation and loading behavior.
- Public profile timeline:
  - moved timeline shell, empty evidence routing, constrained-network summary, deferred chart loading, and timeline placeholder into `PublicProfileTimelineCard`.
  - kept the public profile page focused on passing normalized profile evidence and layout composition.
- Public profile skills:
  - moved skill map shell, empty evidence routing, constrained-network summary, and deferred radar chart loading into `PublicProfileSkillCard`.
  - kept skill normalization in `PublicProfilePageClient` so upstream evidence preparation remains separate from presentation.
- Public profile badges:
  - moved top badge rarity chips, expandable badge descriptions, and empty quest routing into `PublicProfileBadgesCard`.
  - kept badge de-duplication and unlocked badge selection in `PublicProfilePageClient` so data ownership stays with the page.
- Public profile repositories:
  - moved top repository ranking, empty state, and XP/skill summary rows into `PublicProfileRepositoriesCard`.
  - kept public profile data loading, timeline rendering, and section layout ownership in `PublicProfilePageClient`.

## 2026-06-06

- Quest missions:
  - moved mission loading/error/empty states, grouped quest cards, and "show more" controls into `QuestsMissionsSection`.
  - kept cadence filters, sync state, and visible-group count ownership in `QuestsPageClient`.
- Contribution cards:
  - moved contribution card empty states, lazy list loading, and "show more" controls into `ContributionsCardsSection`.
  - kept filter/search/sort state, export behavior, and visible-card count ownership in `ContributionsPageClient`.
- Badge locked paths:
  - moved locked-path preview, detail cards, progress copy, and path CTAs into `BadgesLockedPathsSection`.
  - centralized badge unlock recovery links in `badge-unlock-route.ts` so overview and locked-path cards use the same rule.
- Settings repository visibility:
  - moved the deferred repository privacy card and lazy `PrivacyRepositoryToggleList` boundary into `SettingsRepositoryVisibilitySection`.
  - kept repository visibility mutation ownership in `SettingsPageClient`.
- Settings data controls:
  - moved export/delete buttons, destructive-action copy, and pending labels into `SettingsDataControlsCard`.
  - kept account export/deletion mutation handlers and redirect behavior in `SettingsPageClient`.
- Settings public profile privacy:
  - moved the public-profile switch list, save indicator, and mutation error linkage into `SettingsPublicProfileCard`.
  - kept privacy mutation ownership in `SettingsPageClient` while removing the one-off inline settings section.
- Settings sync activity:
  - moved sync-log summary chips, disclosure state, attention auto-expansion, and lazy panel loading into `SettingsSyncActivitySection`.
  - kept account actions, profile refresh, and top-level settings composition in `SettingsPageClient`.
- PR report presentation model:
  - moved report summary labels, fallback guidance, retry notice copy, badge de-duplication, suggested-quest chips, and signal-tier derivation into `frontend/features/pr-report/lib/pr-report-presentation.ts`.
  - added direct unit coverage for rate-limited guidance, repeated badge rewards, and retry outcome notices.
- PR report technical breakdown:
  - moved disclosure state, lazy technical panels, evidence-signal expansion, badge rewards, and quick-read fallback into `PRReportTechnicalBreakdownSection`.
  - kept report loading, retry, summary selection, and top-level section ordering in `PRBattleReportPageClient`.
- PR report technical quick read:
  - moved collapsed score metric tiles into `PRReportTechnicalQuickReadCard`.
  - kept the same metric values and shared card styling while making the collapsed view reusable inside the technical section.
- PR report badge rewards:
  - moved reward header, badge cards, and badge evidence chips into `PRReportBadgeRewardsCard`.
  - kept badge unlock de-duplication in `PRBattleReportPageClient`.
- PR report suggested quest:
  - moved quest CTA, recommendation copy, and signal-chip presentation into `PRReportSuggestedQuestCard`.
  - kept suggested-quest lookup and evidence-signal selection in `PRBattleReportPageClient`.
- PR report impact summary:
  - moved copy action, deterministic fallback notice, and expandable summary copy into `PRReportImpactSummaryCard`.
  - kept report fetch, retry, fallback reason mapping, and summary selection logic in `PRBattleReportPageClient`.
- Settings sync-run results:
  - moved loading, empty, filtered-empty, run-row status chips, durations, and disclosure details into `SyncRunActivityResults`.
  - kept row construction, search state, status filter state, and expanded-detail state in `SyncRunActivityPanel`.
- Settings sync-run filters:
  - moved sync-run search, status segmented control, live result count, and reset action into `SyncRunActivityFilters`.
  - updated the segmented-filter consistency guard so it audits the extracted filter component instead of the parent panel.
- Settings sync-run summary:
  - moved refresh controls, last-attempt chips, and health summary copy into `SyncRunActivitySummary`.
  - kept search, status filtering, result scrolling, and details expansion state in `SyncRunActivityPanel`.
- Badge progress overview:
  - moved progress metrics, ABRA/deterministic summary copy, unlock notices, and closest-next-unlock presentation into `BadgesOverviewCard`.
  - kept sync state, filtering, ABRA query construction, and badge shelf pagination in `BadgesPageClient`.

## 2026-06-05

- PR report overview:
  - moved the top PR identity, XP, evidence-state, category, file-count, confidence, and evidence-reason summary into `PRReportOverviewCard`.
  - kept report fetch, AI retry, and section orchestration in the page client while reducing overview markup pressure.
- Settings display preferences:
  - moved reduced-gamification, display-shortcut, theme, text-scale, and display notice rendering into `SettingsDisplayPreferencesCard`.
  - kept preference hooks and privacy mutation ownership in the page client while moving local disclosure state into the card.
- Settings account card:
  - moved GitHub-account action buttons, sync status, App-install blocker copy, and account notices into `SettingsAccountCard`.
  - kept sync, relink, logout, and disconnect mutation behavior in the page client so the extracted component remains presentation-owned.
- PR report processing state:
  - moved rate-limit, deterministic-fallback, and AI-summary retry presentation into `ReportProcessingStateCard`.
  - kept retry mutation ownership in the report page client while isolating the visible status card, CTA, and inline retry notice.
- PR report structure:
  - moved the deterministic metrics ledger into `DeterministicMetricsLedgerCard`.
  - preserved the metric-note toggle and score-input grouping while reducing the main PR report page client surface.
- Compact embedded empty states:
  - added shared `CompactEmptyState` for card-level empty lanes that should not mount a full-page empty card.
  - dashboard quest/report lanes and public-profile badge, skill, timeline, repository, and best-PR lanes now share the same accessible note, decorative icon, compact heading, and recovery-link pattern.
- Frontend cleanup:
  - pruned unused exported helpers/types from preference, formatting, metrics, evidence-chip, PR-report API, AI-insight, refresh-feedback, and shared model modules.
  - removed obsolete manual installation/review/issue sync client wrappers after the settings operator panel cleanup left no UI caller.
  - declared scanner/test packages directly in `devDependencies` while keeping the narrow `dom-accessibility-api` test shim required by that package's export map.
- Sync-log error state:
  - settings sync-log fetch failures now render through shared `ErrorState` instead of a feature-local rose alert card.
  - shared `ErrorState` retry actions can be disabled while retry work is already active.
- Inline error notices:
  - shared `InlineNotice` now supports assertive alert-mode announcements.
  - settings account-action errors and onboarding sync-action errors use the shared notice surface instead of feature-local alert markup.
- Settings empty states:
  - repository-visibility and sync-run empty/filter results now use shared `EmptyState` cards instead of feature-local dashed cards.
  - the zero-repository state no longer renders a disabled reset button; only real recovery actions remain visible.
- Panel loading placeholders:
  - added shared `PanelLoadingPlaceholder` for deferred and dynamic feature panels.
  - dashboard, contribution, badge, quest, leaderboard, public-profile, PR-report, and settings skeleton fallbacks now share one busy-state and live-announcement contract while preserving each panel's existing skeleton proportions.
  - visible fallback copy now uses a shared `Loading` chip plus normalized target text instead of repeating `Loading ...` phrases inside every deferred panel.
- Settings cleanup:
  - settings sync activity now renders loading through the shared `LoadingState` card instead of a one-off paragraph surface.
  - removed leftover empty local dashboard-alias directories from the working tree after the canonical `/dashboard/*` route cleanup.
- Semantic freshness copy:
  - `StaleState` now accepts rich status content and uses shared exact-time rendering for verification timestamps.
  - public-profile stale copy plus onboarding sync/reveal freshness copy now render shared semantic relative timestamps instead of plain relative-time strings.
- XP-label consistency:
  - added shared `formatXpLabel` rendering for complete `number + XP` labels.
  - dashboard, leaderboard, contribution cards, timeline summaries, onboarding reveal copy, public-profile snippets, deterministic fallback narratives, and evidence chips now share one XP-label path.
- Frontend route and hook cleanup:
  - removed obsolete top-level dashboard route aliases so dashboard pages live only under the canonical `/dashboard/*` tree.
  - pruned unused sync mutation hook wrappers, the dead profile-sync API alias, and the unused dialog close export after static reachability checks.
- Exact timestamp consistency:
  - added shared `ExactTime` rendering for exact sync timestamps.
  - onboarding sync status and settings sync-run rows now render valid timestamps as semantic `<time>` elements instead of raw locale strings.
  - contribution CSV date labels use the shared `formatDateTime` fallback path so invalid dates stay intentional and empty rather than parser-dependent.
- Dashboard number consistency:
  - added shared plain, signed, and XP number formatting helpers.
  - dashboard rank, league, level progress, and recent battle-report XP values now reuse the same display-formatting path instead of repeating locale formatting inside components.
- Leaderboard number consistency:
  - leaderboard preview, nearby-bracket, XP gap, movement, and metric values now reuse the shared numeric formatting helpers.
  - this keeps rank-comparison labels aligned with dashboard XP and signed-movement presentation.
- PR report number consistency:
  - added shared signed-XP formatting for PR report score deltas and fallback breakdown rows.
  - PR report overview, deterministic ledger, changed-file, addition, and deletion values now reuse shared number formatting instead of local locale calls.
- Public profile number consistency:
  - public profile hero metrics, skill summaries, timeline XP rows, and best-PR XP values now reuse shared number and XP formatters.
  - public proof surfaces now match dashboard, leaderboard, and report numeric presentation.
- Frontend source cleanup:
  - removed unused marketing and onboarding data barrels that were no longer imported by production routes, shared components, or tests.
  - kept actual marketing and onboarding UI copy owned by the active components instead of carrying parallel static lists.
- Quest and reveal number consistency:
  - quest rewards, progress counters, linked-evidence counts, dashboard streak copy, onboarding reveal metrics, and public-profile repository snippets now reuse shared number, XP, signed-XP, and plural-count formatting.
  - deterministic identity and impact fallback summaries now share the same count formatting contract, including singular labels such as `1 evidence PR` and `1 active day`.
- Date-label consistency:
  - contribution cards, activity pulse labels, and profile/leaderboard API month-day labels now use shared date-label helpers instead of component-local locale formatting.
  - invalid short-date values now resolve through explicit fallbacks such as `Date pending` or `Never` instead of relying on parser-dependent rendering.
- Percent-label consistency:
  - badge progress, XP progress, PR confidence, dashboard report confidence, and profile skill-confidence labels now use shared bounded percent formatters.
  - ratio-style confidence values and 0-100 progress values no longer carry separate rounding or clamping logic in each component.
- Progress-value consistency:
  - quest progress, XP meters, badge completion, onboarding pipeline progress, skill bars, timeline bars, and profile consistency mapping now use shared numeric percent helpers.
  - the shared progress primitive also clamps through the same helper, keeping meter values and labels aligned at the final rendering boundary.
- Source cleanup:
  - removed dead browser API wrapper modules plus their self-referential tests after verifying production code uses BFF route contracts, React Query hooks, and shared copy/share components instead.
  - removed ignored local research PDFs from the working tree and added ignore exceptions for required evidence templates, keeping local reference files out of source cleanup scans without hiding tracked runbook templates.
  - declared the `server-only` package directly so server-boundary markers resolve from the frontend manifest instead of relying on framework internals.

## 2026-06-04

- Timestamp accessibility pass:
  - added shared `RelativeTime` rendering for freshness, sync-status, and sync-run activity timestamps.
  - removed hover-only exact-time `title` hints from those surfaces; exact timestamps now stay available through semantic `<time>` text and screen-reader-only labels, with responsive visible exact text where the chip design already supported it.
- PR report metric-ledger clarity:
  - metric descriptions now use `aria-describedby` instead of browser tooltip titles.
  - collapsed metric notes stay screen-reader available, while the existing note toggle reveals the same one-line descriptions visually without duplicating tooltip-only behavior.
- Evidence-state chip accessibility:
  - pending, stale, partial, rate-limited, and failed profile evidence chips now attach their explanations with `aria-describedby`.
  - removed browser tooltip dependency from these chips so keyboard and touch users receive the same status context.
- Stale-notice freshness integrity:
  - contribution, badge, quest, and leaderboard stale notices no longer synthesize local render time when backend refresh timestamps are missing.
  - missing freshness now reads as unavailable so stale UI does not imply evidence was verified just now.
- Loading-state polish:
  - added a shared loading-copy helper for card and route loading states so screen-reader announcements avoid repeated `Loading` phrasing while preserving progressive route copy like `Preparing your dashboard`.
  - kept skeleton bars outside live regions and covered route/card loading announcements with focused render tests.
- Segmented-control semantics pass:
  - replaced the shared filter control with `SegmentedControl`, using `radiogroup`/`radio` semantics and `aria-checked` for single-choice filters and view selectors.
  - updated filter consistency checks and render tests so dashboard segmented controls stay visually unchanged while exposing the correct accessibility pattern.
- ABRA insight provider clarity:
  - frontend ABRA insight generation now follows `AI_PROVIDER` explicitly instead of selecting provider credentials by implicit fallback order.
  - identity-summary source labels distinguish `ChatGPT`, `Gemini`, and deterministic copy so users can tell which enrichment path generated the visible narrative.
- Dependency hygiene:
  - removed unused `@radix-ui/react-tabs` from the frontend package after segmented lane/filter controls no longer use tab primitives.
  - keeps install size and dependency review surface aligned with the current shared radio-group control architecture.
- Query devtools production guard:
  - moved React Query devtools to `devDependencies` and kept the runtime loader disabled when `NODE_ENV=production`.
  - kept `NODE_ENV` as the only allowed non-public client build-mode key in `check:client-env-safety`; all other client env access must still use `NEXT_PUBLIC_*`.
  - added policy coverage for local-development visibility versus production/remote-host suppression.
- Server proxy cleanup:
  - extracted shared header forwarding, set-cookie propagation, and backend origin fallback helpers for frontend BFF proxies.
  - removed duplicate helper code from auth, gateway, and OAuth route modules while preserving the same proxy behavior.
- Timestamp helper cleanup:
  - moved ISO datetime normalization into `formatters.ts`.
  - reused the shared helper from `RelativeTime` and stale-state rendering so freshness components share one date-validity rule.

## 2026-06-03

- Type-safety gate restoration:
  - added `npm run typecheck` and wired it into frontend CI plus repo sync so production/test contract drift fails before merge.
  - wired `npm run lint` into repo sync so local guardrails match the frontend CI lint gate.
  - wired `npm run build` into repo sync so production compile and prerender drift is caught locally too.
  - wired `npm run test:smoke` into repo sync so live-fixture route rendering stays part of the local quality gate.
  - wired `npm run test:a11y` into repo sync so route accessibility, control names, and settings form behavior stay part of local verification.
  - wired `npm run test:contracts` into repo sync so route parity and BFF contract coverage stay aligned locally.
  - wired `npm run test:visual` into repo sync so dashboard, leaderboard, and public-profile visual shell snapshots stay guarded locally.
  - tightened the public-profile visual summary to read the labeled top-signal list instead of all matching hero chips.
  - wired `npm run test:visual` into frontend CI so visual shell regressions fail during pull-request checks too.
  - wired OAuth prefetch, dashboard route-copy, and route-state primitive guards into frontend CI plus repo sync so navigation safety, route metadata copy, and loading/error shells stay consistent.
  - replaced the settings sync-run status select with the shared wrapped `SegmentedControl`, removed the orphaned select primitive/dependency, and wired the remaining frontend CI source, presentation, interaction, performance, and bundle guards into repo sync.
  - promoted the remaining repo-only frontend guards into frontend CI so env coverage, decorative icons, form/control names, button safety, landmarks, new-tab links, live regions, stale refresh wiring, and shared-orphan cleanup fail during pull-request checks too.
  - added a frontend CI/repo-sync parity guard and expanded the grouped repo-sync source-policy guard list so CI `npm run ...` checks cannot drift away from the local repo-wide verification path.
  - hardened the workflow npm-script reference guard to avoid `pipefail` false failures when a valid script match closes the lookup early.
  - removed stale generated/local clutter and deleted the obsolete `app/head.tsx` file; App Router head ownership now stays in `layout.tsx` metadata exports plus the current metadata file conventions.
  - aligned auto-sync analytics, onboarding sync timestamps, PR-report retry errors, unknown status labels, and stale test fixtures with current TypeScript contracts.

## 2026-06-02

- Frontend orphan cleanup:
  - removed unused `components/ui/separator.tsx` and `hooks/use-auth-session.ts` after confirming no app, component, feature, hook, lib, or test imports referenced them.
  - removed the now-unused `@radix-ui/react-separator` dependency from frontend package metadata.
  - removed the unused copy-link wrapper and its component-only test; production share flows stay owned by shared copy/share components.
  - added `npm run check:shared-orphans` so shared components, UI primitives, and hooks cannot survive as production-dead test-only wrappers.
  - renamed the public profile card export action to `Open proof data`, keeping the same endpoint while removing developer-facing JSON copy from the hero.
  - removed redundant browser `title` tooltips from interactive controls and added `npm run check:interactive-titles`, keeping control names in visible text or ARIA paths.
  - normalized status and alert live regions with explicit atomic announcements and added `npm run check:live-regions`.
  - extracted shared JSX policy scanning into `frontend/scripts/lib/jsx-source-scan.mjs` so accessibility, accessible-name, decorative-icon, duplicate-id, main-landmark, navigation-landmark, nested-interactive, new-tab-link, polymorphic-button, unstable-key, and interaction guards stop duplicating parser/walker code.
  - aligned shared input and native-select primitives with `--radius-universal` directly, removing stale `rounded-2xl` class contracts from form controls.
  - aligned production non-pill surfaces with `rounded-[var(--radius-universal)]` so class names match the enforced radius token instead of implying larger corners.
  - added `npm run check:radius-tokens` and wired it into frontend CI plus repo sync to block future hardcoded or large-radius utility drift.
  - upgraded `ContributionPulseStrip` with visible Today/Peak summaries and screen-reader cell text, removing the browser-title tooltip dependency from activity cells.
  - upgraded contribution-card signal strips to bounded progressbars with readable signal text while preserving the same compact visual meter.
  - added accessible names to shared `Progress` meters and wired `npm run check:progress-names` into frontend CI plus repo sync.
  - extracted dashboard/public-profile avatar rendering into `ProfileAvatar`, keeping optimized image sizing and a single wrapper-level profile-image name instead of duplicate ad hoc avatar markup.
  - added `npm run check:image-alt` so every production `Image`/`img` element must make decorative or descriptive image intent explicit.
  - added `npm run check:role-img-names` so chart/avatar-style visual groups cannot use `role="img"` without an accessible name.
  - added `npm run check:button-names` so literal and shared buttons cannot ship without visible, ARIA, or sr-only naming.
  - added `npm run check:link-names` so literal, Next, and intent-prefetch links keep visible, ARIA, or sr-only naming.
  - made `InlineNotice` placeholder copy explicit and added `npm run check:inline-notice-placeholders` so status lanes stay contextual instead of falling back to generic hidden copy.
  - updated the shared `Input` primitive to forward refs, keeping search-clear focus restoration tied to the real input node.
  - routed shared search-clear refocus through `focusWithoutScroll()` and added `npm run check:focus-without-scroll` to block raw `.focus()` calls from reintroducing viewport jumps.
  - made stale-refresh sync execution use explicit optional user-sync arguments and kept `check:stale-refresh-sync` aligned with that type-safe wiring.
  - tightened contributions, badges, and leaderboard stale-refresh rendering so profile-dependent stale details only appear when a profile snapshot is available.
- Main-landmark consistency pass:
  - `AppShell` now remains the only frontend owner of `<main id="main-content">`.
  - marketing and onboarding content wrappers render as normal containers inside the shell, preventing nested main landmarks while preserving layout.
  - added `npm run check:main-landmark` and focused render coverage so the global skip-link target stays stable.
- Navigation-landmark naming pass:
  - added `npm run check:navigation-landmarks` to require accessible names on every `<nav>` or `role="navigation"` region.
  - added shared-nav render coverage for dashboard lanes, marketing routes, onboarding progress, and in-page section navigation.
- Route-state primitive guard:
  - added `npm run check:route-state-primitives` so app route loading/error/not-found files keep using shared polished fallback primitives.
  - preserves consistent route-level skeleton, recovery, and alert semantics across marketing, dashboard, and public routes.
- Inline loading copy cleanup:
  - shared `LoadingState` now normalizes loading targets before rendering visible copy and polite status text.
  - badge, quest, and leaderboard loading cards now avoid duplicated `Loading` wording and trailing ellipses.
  - `npm run check:copy-tone` now blocks production loading-copy strings that reintroduce trailing ellipses.
- Button type-safety guard:
  - added `npm run check:native-button-type` to require explicit safe `type` attributes on literal native buttons.
  - added `Button` primitive coverage for default `type="button"`, explicit submit behavior, and polymorphic link rendering.
- Input accessible-name guard:
  - added `npm run check:input-names` so production native/shared inputs need an accessible-name path.
  - expanded shared search-input coverage to assert placeholder text is not used as the accessible name.
- Native select consistency pass:
  - moved the settings sync-run status filter onto the shared segmented filter pattern and added `npm run check:select-names` to block unlabeled production selects.
  - removed the now-orphaned `NativeSelect` primitive after segmented filters replaced its last production use.
- Switch accessible-name guard:
  - added `npm run check:switch-names` so production `Switch` controls need explicit naming through labels or ARIA.
  - added primitive coverage for label-paired switches and compact aria-labeled switch rows.

## 2026-05-25

- Settings sync metrics visibility pass:
  - sync-run cards now render compact telemetry summaries (`PRs`, `Reviews`, `Issues`, `Commits`) when backend metrics are available.
  - summary logic reads both legacy counters and new backend-prefixed keys (`persisted_*`, `fetched_*`) and highlights skipped/fetch-error counts.
  - completed runs with skipped or fetch-error telemetry now render a `Partial` status chip instead of a false-clean `Completed` badge.
  - failed runs now surface compact failure telemetry (`Failures`, `Timeout`, `Rate limited`, `Upstream`) from backend sync-run metrics.
- Segmented-control pointer-focus scroll-jump fix:
  - removed forced pointer-down focus behavior in shared segmented controls.
  - pointer and mouse interactions now select without pre-focusing, reducing viewport jump risk on long settings/dashboard pages.
  - keyboard tab/arrow/enter behavior remains unchanged for accessibility.
- Contributions filter-note presentation pass:
  - moved the category interpretation note into the filter surface itself instead of leaving it as a detached paragraph.
  - keeps control context and caution copy in one visual block, reducing scan fragmentation.
- Settings sync-filter wording pass:
  - renamed summary chip from `Status` to `View` and lane heading to `Run status` for clearer scanning.
  - standardized primary reset action label to `Reset filters` in the summary row.
- Dashboard route-nav mobile wrap pass:
  - switched dashboard top navigation from horizontal-only overflow to wrapped lanes on small screens.
  - keeps all primary tabs visible without side scrolling while preserving the same desktop 5-lane layout.
- Contributions filter-summary wording pass:
  - updated summary chips from `Category/Sort` to `View/Order` for cleaner scan semantics.
  - refined helper copy to plain-language guidance: use Status for PR state and Focus for work type.
  - added a clear-search fallback path that resets via `onSearchChange("")` when an explicit clear handler is absent.
- Segmented-control pointer interaction hardening pass:
  - added pointer-down focus-without-scroll handling before click selection in shared segmented controls.
  - preserves no-jump behavior for touch, pen, and mouse paths while keeping keyboard activation unchanged.
- Settings sync-filter simplification pass:
  - switched sync status segmented controls to wrapping lanes with narrower minimum widths to avoid horizontal jitter.
  - added a concise summary row (`Status`, optional `Search`, `Reset`) and reduced duplicate filter-chip noise.
  - kept removable active chips focused on search terms only for faster recovery on dense sync logs.
- Badge and quest filter consistency pass:
  - badges and quests now use the same concise summary row model (`Rarity/State` or `Cadence` + `Reset`) instead of repeating removable filter chips.
  - enabled wrapping segmented lanes with tighter mobile widths for long option labels.
  - added compact labels for long quest cadence names to keep controls scanable on narrow screens.
- Repository-privacy filter consistency pass:
  - settings repository visibility controls now follow the same summary-first pattern (`Visibility`, optional `Search`, `Reset`).
  - reduced duplicate filter-chip noise by keeping removable chips focused on search text only.
  - enabled segmented visibility lanes to wrap instead of forcing horizontal-only scrolling.
- Leaderboard filter-surface consistency pass:
  - replaced dense active-filter chip controls with a compact summary row (`Lane`, `View`, `Details`, `Reset`).
  - kept lane selection and detail/view toggles unchanged while reducing repetitive control chrome.
  - normalized layout structure in the leaderboard control block to avoid visual jitter and keep scan order clear.
- Settings filter reset-copy consistency pass:
  - aligned no-results recovery actions in sync activity and repository visibility panels to `Reset filters`.
  - keeps fallback actions semantically aligned with the summary-row `Reset` pattern used across dashboard tabs.
- Dashboard filter regression-coverage pass:
  - added `SyncRunActivityPanel` coverage for summary-first status/search/reset behavior and no-results reset action.
  - extended live fixture leaderboard coverage to assert the new summary row (`Lane`, `View`, `Details`) render contract.
- Contributions status-lane wrap pass:
  - switched the status segmented control to wrapping behavior with tighter mobile minimum widths.
  - removes the last forced horizontal-only segmented lane pattern in dashboard filter controls.
- Filter clear-control readability pass:
  - increased search-clear icon control size from `h-7 w-7` to `h-8 w-8` across contribution, sync-log, and repository-visibility filters.
  - added subtle hover background treatment so clear controls remain visible in dense neon surfaces.
- Filter vocabulary consistency pass:
  - standardized filtered empty-state recovery wording to `Reset filters` across contributions, badges, and repository visibility.
  - aligns fallback text and action labels with the summary-first control pattern already used in active filter surfaces.
- Leaderboard control header declutter pass:
  - removed duplicated visible `Viewing/Refreshing` text from leaderboard controls while keeping the live status region for assistive tech.
  - keeps control scan order focused on filter state chips (`Lane`, `View`, `Details`) and actions.
- Contributions contextual-copy polish pass:
  - rewrote category guidance in a more conversational tone while preserving the same accuracy boundary.
  - keeps skill framing clear without sounding overly rigid.
- Segmented-lane touch-spacing pass:
  - increased segmented-control option gaps from `gap-1.5` to `gap-2` (8px) in shared segmented controls and dashboard route navigation.
  - improves adjacent target separation for touch inputs without changing route/filter behavior.
- Active-filter row simplification pass:
  - removed redundant visible `Active filters` labels from contribution, sync-log, and repository-visibility search-chip rows.
  - fixed repository visibility to only render the chip row when a search filter is actually active (avoids empty-row chrome).
- Search-chip consolidation pass:
  - moved search-clear actions directly into summary-row chips (`Search: ...`) for contributions, sync activity, and repository visibility.
  - removed duplicate secondary search-chip rows while preserving one-click search filter removal and reset behavior.
  - contributions now render a non-clickable search summary chip when no `onClearSearch` handler is provided, avoiding dead interactive affordances.
- Applied-filter count visibility pass:
  - added `Active: N` filter-summary chips across contributions, badges, quests, leaderboard, sync-log, and repository-visibility controls.
  - keeps active-filter state quantifiable at a glance while preserving existing reset and chip removal behavior.
- Active-filter count regression coverage pass:
  - extended contribution and sync-run filter tests to assert `Active: N` behavior in default and filtered states.
  - protects the new summary-count contract from silent UI regressions.
- Inline-notice dismiss affordance pass:
  - increased shared inline-notice dismiss control from `h-5 w-5` to `h-6 w-6` for easier touch and pointer targeting.
  - added dedicated `InlineNotice` test coverage for placeholder rendering and dismiss callback behavior.
- Filter-summary integration coverage pass:
  - extended live fixture tests to verify `Active: 1` state appears when quest and badge filters move off defaults.
  - confirms the applied-filter count summary pattern works across additional dashboard lanes, not only unit-level filter components.
  - fixed a badges runtime regression uncovered by this test (`isFiltering` state is now defined before use).
  - added leaderboard route-param coverage to assert lane-prefilled states surface `Active: 1` in summary chips.
- Contributions filter-summary presentation pass:
  - surfaced an always-visible summary row (`Category: ...`, `Sort: ...`, `Reset`) so active view state is readable without scanning multiple control lanes.
  - reduced duplicate chip chrome by keeping removable chips focused on search terms only.
  - updated contribution-filter tests to lock the new contract (summary labels + removable search chip).
- Leaderboard lane-wrap resilience pass:
  - enabled wrapping for lane tabs and tightened lane minimum widths on narrow viewports.
  - keeps all lane options reachable without forced horizontal-only scrolling.
- Contribution filter active-chip clarity pass:
  - replaced dense chip labels (`Category: ...`, `Sort: ...`) with clearer lane-focused labels (`Status · ...`, `Focus · ...`, `Sort · ...`).
  - added an explicit `Active filters` strip and unified `Clear all` reset action for faster scanning and simpler recovery.
  - updated contribution-filter tests to lock in the new presentation semantics.
- Dashboard route-nav lane stability pass:
  - kept horizontal scroll behavior on mobile, but switched desktop dashboard nav to a stable 5-lane grid layout.
  - removed desktop min-width lane jitter so `Dashboard`, `Contributions`, `Badges`, `Quests`, and `Settings` align consistently across route transitions.
- Cross-tab active-filter consistency pass:
  - applied the same `Active filters` row pattern used in Contributions to both Badges and Quests control surfaces.
  - updated chip labels to lane-friendly formatting (`Rarity · ...`, `State · ...`, `Cadence · ...`) and added a single `Clear all` action in each filter shell.
  - keeps filter interactions visually and behaviorally consistent across all major dashboard tabs.
- Segmented-control compact-label pass:
  - added optional compact labels to shared `SegmentedControl` so mobile can render shorter lane names while preserving full labels for desktop and assistive text.
  - applied compact labels to leaderboard lanes (`Documentation` → `Docs`, `Weekly XP` → `Weekly`, `Testing` → `Tests`) with tighter mobile min widths.
  - updated segmented-control tests to assert the focus-first mousedown behavior that prevents scroll jumps before click selection.
- Leaderboard active-filter clarity pass:
  - added an `Active filters` row to leaderboard controls with removable chips for lane selection, details view, and full-board mode.
  - added one-click `Clear all` control to restore default leaderboard context (`Global` lane, nearby mode, details off).
  - keeps leaderboard controls consistent with Contributions/Badges/Quests filter-shell behavior.
- Settings sync-log filter consistency pass:
  - migrated sync-run activity chips to the same active-filter pattern (`Search · ...`, `Status · ...`) with an explicit `Active filters` label.
  - replaced older `Reset filters` copy with `Clear all` in both control and no-results recovery actions.
  - aligns settings filter terminology and visual hierarchy with the rest of dashboard tabs.
- Cross-route filter-copy harmonization pass:
  - updated remaining empty-state filter recovery copy from `Reset filters` to `Clear filters` in Contributions, Badges, and repository-visibility messaging.
  - keeps terminology consistent with the active-chip filter pattern introduced across dashboard surfaces.
- Repository-visibility filter-surface consistency pass:
  - added an `Active filters` strip to repository-visibility controls in Settings with removable `Search · ...` and `Visibility · ...` chips.
  - added one-click `Clear all` and replaced the remaining empty-state `Reset` action with `Clear all`.
  - aligns repository privacy controls with the same filter interaction model used across the rest of dashboard tabs.
- Contributions compact-segment label pass:
  - added compact mobile labels for longer contribution lanes and sort options (for example `Bugfix`, `Perf`, `Top Diff`) while preserving full desktop labels.
  - reduced mobile minimum widths for those lane options to keep contribution controls easier to scan without excessive horizontal travel.
- Segmented-label accessibility-name guard pass:
  - updated shared segmented-control naming logic so compact labels only alter accessible names when they differ from the full label.
  - prevents duplicated names like `Newest (Newest)` and keeps role-name queries stable in tests and assistive output.
- Repository-visibility result-feedback pass:
  - added visible count feedback (`x of y repositories`) in repository-visibility controls header.
  - keeps settings filter behavior aligned with dashboard filter-panel guidance where result impact is visible before users scroll the list.
- Onboarding sync-status copy alignment pass:
  - updated onboarding analyzer status line from raw `Status:` phrasing to the same concise lane style used across dashboard routes (`Sync · ...`).
  - keeps top-level status language consistent between onboarding and post-auth dashboard surfaces.

## 2026-05-24

- Segmented-control focus fallback hardening pass:
  - introduced shared `focusWithoutScroll` fallback restoration logic for browsers that do not support `focus({ preventScroll: true })`.
  - wired the helper into both pointer selection and keyboard navigation paths for segmented controls.
  - reduces jump-to-top behavior on long dashboard/settings pages when switching status filters.
- Visual regression snapshot hardening pass:
  - switched route-level visual regression assertions from brittle full-HTML snapshots to stable semantic summaries.
  - updated snapshots to reflect summary-based baselines for dashboard, leaderboard, and public profile shells.
- Dashboard hero activity-pulse pass:
  - added a lightweight 14-day contribution pulse strip in the dashboard hero using existing persisted contribution timestamps.
  - exposes short-horizon momentum at a glance without new API calls or heavy chart rendering.
  - keeps the lane gamified while remaining low-CPU and readable on reduced-effects paths.
- Shared contribution-pulse component pass:
  - extracted the pulse strip into a reusable shared component and reused it in both dashboard and public-profile hero surfaces.
  - public profile now includes a compact 10-day pulse lane for shareable momentum context aligned with dashboard semantics.
- Contributions momentum strip pass:
  - added a compact contribution-momentum panel to the Contributions route with streak chips and a 21-day pulse strip.
  - uses existing persisted profile contribution timestamps only (no new fetch paths), keeping the enhancement low-cost on CPU/network.
- Contribution pulse regression coverage pass:
  - added focused tests for `ContributionPulseStrip` day-window rendering and same-day contribution aggregation behavior.
  - prevents accidental regressions in active-day counts or accessibility labels as pulse visuals evolve.
- Runtime mode visibility pass:
  - added an explicit `Runtime Lite mode` meta chip in dashboard and contributions headers when constrained-network/reduced-cost rendering is active.
  - makes performance-saving render mode visible to users so simplified visuals are intentional and understandable.
- Runtime mode reason transparency pass:
  - settings now surfaces the active Lite-mode reason (`Save-Data`, slow connection, reduced-data preference, low memory/CPU, or slow display updates) beside reduced-gamification controls.
  - helps users understand why rendering was simplified without guessing whether behavior is a bug.
- Network-constraint hydration stability pass:
  - switched network-constraint `useSyncExternalStore` server snapshots from a synthetic default reason to `null`.
  - prevents transient server-side Lite-mode assumptions before real client capability detection completes.
- Cross-lane runtime-mode consistency pass:
  - extended `Runtime Lite mode` header metadata chips to leaderboard, badges, and quests so all core dashboard lanes expose the same constrained-render context.
  - keeps performance-mode messaging consistent across navigation instead of only a subset of tabs.
- Public-profile summary-source transparency pass:
  - public profile identity callout now labels source mode explicitly (`Gemini` or `Deterministic`) to match dashboard/report transparency language.
  - reduces ambiguity when AI enrichment is unavailable and deterministic fallback is serving user-facing summary text.
- Runtime-mode visibility extension pass:
  - added `Runtime Lite mode` visibility to PR report header metadata and public profile hero context.
  - aligns constrained-render transparency across dashboard, contributions, leaderboard, badges, quests, settings, public profile, and PR report routes.
- Settings header runtime consistency pass:
  - added `Runtime Lite mode` chip to the Settings page header metadata so runtime-mode status is visible in every authenticated dashboard lane header.
  - keeps route-level mode signaling uniform while preserving detailed reason text inside Settings display controls.
- Locked-badge collapsed preview pass:
  - replaced the hidden-placeholder collapsed state in the locked badge section with a visible preview queue of upcoming badge unlocks.
  - keeps full locked-path details behind expand while preserving useful context when the section is collapsed.
- Sync-run filter-state visibility pass:
  - settings sync activity now surfaces active search/status filters as removable chips and keeps a one-click `Reset filters` control visible whenever filters are active.
  - improves filter-state clarity and reduces dead-end resets that previously only appeared in no-result states.
- Header freshness consistency pass:
  - added shared `SnapshotFreshnessPill` metadata into core route headers (contributions, badges, quests, leaderboard, settings, PR report, dashboard) to surface recency at the same hierarchy as primary actions.
  - improves trust/scannability by making data age visible without requiring stale-state banners first.
- Public-profile snapshot status strip pass:
  - added an always-visible public-profile status strip with refreshed timestamp, fresh/partial evidence state, and runtime-lite mode indicator.
  - improves share-page trust by exposing evidence freshness context even when stale-state banners are not active.
- Snapshot freshness component test coverage pass:
  - added focused tests for `SnapshotFreshnessPill` render behavior (missing timestamp, custom/default labels, normalized datetime output).
  - hardens a shared component now used across multiple route headers.
- Leaderboard no-rows recovery action pass:
  - added explicit `Open sync settings` recovery action alongside `Open contributions` in the no-live-rows leaderboard preview state.
  - keeps users out of dead-end preview-only states when missing rows are caused by sync freshness gaps.
- Empty-state action consistency pass:
  - standardized empty-state secondary actions from tiny text links to real `Button` controls with consistent hierarchy.
  - added responsive full-width CTA behavior on narrow viewports for easier touch targeting and clearer next-step recovery.
- Prefetch-boundary pass for onboarding and marketing CTAs:
  - added explicit `prefetch={false}` on non-critical onboarding/marketing links (`/onboarding/analyzing`, `/onboarding/reveal`, `/onboarding/connect-github`, `/`) to reduce background route prefetch churn.
  - keeps core navigation intact while lowering speculative network work on constrained devices.
- Prefetch consistency cleanup:
  - closed remaining default-prefetch gaps in shared marketing shell and onboarding login return link so non-critical landing-path navigation is uniformly explicit.
  - keeps route behavior unchanged while removing unnecessary background fetch variance across entry flows.
- Onboarding prefetch policy guard:
  - added `npm run check:onboarding-prefetch-policy` to enforce explicit `prefetch={false}` on onboarding/marketing internal links.
  - wired this guard into frontend CI so entry-flow prefetch boundaries stay stable across future updates.
- Repository-privacy empty-state accessibility fix:
  - restored an always-rendered `Reset` button in the empty repository-visibility state (disabled when no active filters).
  - keeps actionable controls discoverable for assistive tech and aligns with accessibility regression tests.
- Global backdrop visibility smoothing pass:
  - reduced heavy overlay opacity and softened radial/linear overlay falloff so `assets/background.jpg` remains visible without sacrificing text contrast.
  - kept the background locked to viewport (`body::before` fixed layer) while slightly lowering saturation/contrast boost to avoid harsh banding on neon themes.
- Hardcoded identity guard pass:
  - added `npm run check:no-hardcoded-identities` to block banned personal/demo identity literals in production frontend modules (`app`, `components`, `features`, `hooks`, `lib`).
  - prevents accidental reintroduction of fake/sample handles into live dashboard, profile, or contribution UI copy.
- Frontend CI integrity-enforcement pass:
  - wired UI integrity gates directly into `.github/workflows/frontend-ci.yml` for `check:no-hardcoded-identities`, `check:query-policy`, `check:jsx-keys`, `check:jsx-ids`, `check:nested-interactive`, and `check:scroll-jumps`.
  - makes these anti-regression rules merge-blocking in PRs instead of local-only checks.
- PR report summary-clarity pass:
  - replaced ambiguous `AI summary` heading with explicit mode-aware copy: `Impact summary (Gemini)`, `Impact summary (deterministic)`, or `Impact summary (deterministic fallback)`.
  - keeps deterministic fallback visible while reducing confusion when Gemini enrichment is temporarily unavailable.
- Auto-sync copy consistency pass:
  - replaced remaining `Run sync` language in contributions empty-state, onboarding reveal guidance, and repository-visibility empty-state with `Open sync settings` wording.
  - aligns user guidance with the current background auto-sync model (no mandatory manual sync button flow).
- Sync copy policy guard pass:
  - added `npm run check:sync-copy-policy` to block manual-sync phrases (`Run sync`, `Sync now`) in production frontend modules.
  - wired this guard into frontend CI so auto-sync guidance remains consistent across future UI changes.
- PR report lazy-technical-panels pass:
  - switched heavy PR report technical sections (`ScoreMatrixCard`, `XPBreakdownCard`, `EvidenceSignalsCard`) to `next/dynamic` lazy loading with bounded placeholders.
  - keeps summary-first rendering fast while loading deep technical breakdown only when users open that section.
- Segmented-filter focus no-scroll pass:
  - pointer interactions on shared segmented filters now apply focus with `preventScroll` semantics before selection, reducing browser-driven jump-to-control behavior during filter changes.
  - helps stabilize settings sync-status and similar segmented lanes where users reported abrupt viewport jumps.
- JSX key-safety guard pass:
  - added `npm run check:jsx-keys` to detect risky direct list keys (for example single volatile label/signal keys) that can reintroduce duplicate-key render issues.
  - guard is scoped to direct key expressions to avoid false positives on safe compound/template keys.
- Leaderboard control declutter pass:
  - removed redundant `Reset to Global` button from lane controls.
  - global lane remains one click away via the segmented lane tabs, so functionality is unchanged with less control noise.
- Quests filter declutter pass:
  - removed duplicate reset controls in mission cadence filtering.
  - active cadence now uses a single removable chip (clear action) instead of chip + separate reset button.
  - keeps full filter behavior while reducing control noise above mission lanes.
- Sync-copy consistency pass:
  - updated quest empty-state CTA from `Sync now` to `Open sync settings` to match auto-sync model and avoid implying a mandatory manual sync button flow.
  - updated dashboard hero stale/empty-evidence guidance copy to direct users to settings-based evidence refresh path.
- Share-action fallback hygiene pass:
  - native Web Share cancellation (`AbortError`) no longer triggers clipboard/manual fallback.
  - share button now keeps a stable minimum width so label transitions (share/copied/shared/error) do not shift surrounding layout.
  - cancellation now explicitly resets the button state to idle so stale labels never persist after a dismissed native-share sheet.
  - manual `window.prompt` fallback now treats prompt cancel as true cancel (no success state, no success analytics) for both share and copy actions.
  - keeps user-intent cancel as a no-op while preserving fallback copy flow for real share failures.
  - added component tests for cancel-vs-failure fallback behavior.
- Query churn reduction pass:
  - changed global React Query default retry policy from `retry: 1` to `retry: false` in `QueryProvider` to remove hidden automatic retry bursts across any query not explicitly overridden.
  - disabled ABRA insights retries to avoid repeated same-input AI calls when provider quota/errors occur.
  - disabled window-focus refetch churn for dashboard/contributions/public-profile/leaderboard/quests/pr-report queries and increased constrained-network stale windows on dashboard, leaderboard, and quest reads.
  - disabled automatic retry loops for core route queries (`profile`, `dashboard`, `contributions`, `badges`, `quests`, `leaderboard`, `sync-runs`, `pr-report`) so transient failures do not trigger repeated burst retries on constrained laptops/connections.
  - added `npm run check:query-policy` to enforce low-churn query defaults in core hooks (including badges) and `QueryProvider`.
  - keeps all explicit refresh and invalidation paths intact while reducing background request bursts and CPU wakeups.
- Chart data-table disclosure pass:
  - skill radar and timeline cards now include `View data table` toggles for explicit numeric inspection.
  - each table exposes lane/window, score/XP, and delta values, improving shareability and non-visual interpretation without removing chart visuals.
  - chart regions now expose explicit `aria-label` context in addition to descriptive summaries for faster screen-reader orientation.
  - follows accessibility guidance to pair visual charts with structured textual/tabular equivalents.
- Deterministic impact-summary fallback upgrade:
  - contribution cards and PR battle reports now use structured deterministic summaries when Gemini text is missing, stale, or placeholder-only.
  - fallback copy now includes contribution category/scope, evidence context, and a concrete next-improvement suggestion instead of generic pending text.
  - keeps AI enrichment optional while maintaining presentation-quality narrative for demo and low-quota paths.
- Skill-lane canonicalization and dedupe pass:
  - added shared skill normalization (`backend/back-end/back end`, `frontend/front-end/front end`, `devops/dev ops`, `qa/quality assurance`) before lane aggregation.
  - profile and dashboard skill-lane dedupe now resolve equivalent labels into one canonical lane instead of repeating near-duplicates.
  - keeps evidence contracts untouched while making strongest-signal chips and skill maps more readable.
- Settings sync-panel viewport stability pass:
  - fixed sync-run results lane to a stable internal height (`h-[22rem]`) so status-filter switches (`All/Completed/Running/Failed`) do not collapse/expand page height.
  - fixed repository-visibility results lane to a stable internal height (`h-[24rem]`) for the same reason.
  - reduces perceived jumpiness on long settings pages when toggling sync status filters.
- Scroll-stability hardening pass:
  - disabled `content-visibility` card virtualization and intrinsic placeholder sizing on dashboard/public route cards.
  - switched sync/repository activity panels back to default `overflow-anchor` behavior for more predictable viewport anchoring during filter and data updates.
  - capped settings sync/repository result lanes with internal scrolling (`max-h` + `overflow-y-auto`) so filter/status interactions stop reflowing the full page height.
  - reduces jumpy auto-scroll behavior reported on long settings/contributions sessions.
- Public profile repository ranking clarity pass:
  - top repository rows now include explicit rank chips (`#1`, `#2`, `#3`) beside repository names.
  - keeps existing data contract unchanged while making contribution concentration easier to scan in demos and share links.
- PR report evidence-state clarity pass:
  - added a compact `Report processing state` callout when reports are deterministic-only, stale/incomplete, fallback, or rate-limited.
  - each non-complete state now includes an explicit action path (`Open settings` or `View contributions`) so users can recover without hunting through tabs.
- Settings repository-filter declutter pass:
  - moved `X of Y repositories` to an `sr-only` live status channel and removed the extra top reset/filter-summary strip.
  - keeps counts and empty-state recovery intact while reducing repetitive control chrome in settings.
- Dashboard route-nav lane consistency pass:
  - normalized dashboard route navigation to a single horizontal rail on all breakpoints (no mobile wrap rows).
  - keeps lane order stable and avoids vertical nav reflow as route labels and viewport widths change.
- Dashboard numeric-motion reduction pass:
  - removed animated level/XP number transitions in the hero rank card and switched to static tabular numeric rendering.
  - reduces non-essential motion and lowers CPU cost on frequent dashboard refreshes.
- Global readability contrast pass:
  - increased text-soft token contrast in default, cyberpunk, terminal, and high-contrast themes.
  - reduced heavy page-overlay opacity and decorative cyber-card glow masks while increasing surface/card opacity for denser text backgrounds.
  - keeps neon/cyberpunk identity intact with clearer body-copy legibility across dashboard tabs.
- Leaderboard fixture-test stability pass:
  - increased async wait windows in smoke/visual leaderboard fixture tests so dynamic lane rendering has enough time before assertion.
  - reduces intermittent local failures caused by short default `findByText` timeouts on heavy dev machines.
- Public-profile empty-state recovery pass:
  - added direct CTAs to empty badge and empty best-PR lanes on the public profile shell.
  - keeps share pages non-blocking by routing users straight to quests/contributions when profile evidence is sparse.
- Dashboard empty-lane recovery pass:
  - quest and recent-report empty states now include both `Open contributions` and `Open sync settings` actions.
  - reduces dead-end moments when users need either evidence inspection or immediate sync remediation.
- Public-profile sparse-evidence recovery pass:
  - added direct `Open contributions` actions to empty skill-map, timeline, and repository lanes.
  - avoids passive text-only empty cards and keeps public-profile viewers one click away from actionable evidence paths.
- Segmented filter auto-scroll regression fix:
  - removed forced viewport restoration (`window.scrollTo`) from shared segmented-tab selection and keyboard fallback focus handling.
  - fixes jump-to-top behavior seen when switching filter tabs in dashboard routes (notably settings sync status tabs).
- Added regression coverage:
  - updated `tests/segmented-control.test.tsx` to assert control selection does not invoke viewport scroll restoration.
  - keeps filter interactions stable while preserving manual keyboard activation behavior.
- Reduced decorative interaction motion on dashboard chrome:
  - softened `cyber-card` hover deltas so cards keep visual hierarchy without expensive hover glow jumps.
  - simplified dashboard-route-nav interaction transitions to quick color/border updates and removed heavy hover shadow pulses.
  - keeps nav affordance intact while reducing perceived jitter on lower-power devices.
- Navigation language consistency pass:
  - unified marketing-header anchor chips with shared dashboard-nav visual tokens (`dashboard-nav-item`) for one consistent navigation treatment across public and authenticated surfaces.
  - removed unused `marketing-nav-chip` CSS after migration to avoid style drift.
- Leaderboard nearby-rank mode pass:
  - added a focused `Nearby` view mode for larger lanes (default when user rank context is available), showing podium plus the user's local bracket before the full board.
  - added an explicit `Show full board` / `Show nearby view` toggle to switch between motivational local context and complete ranking scans.
  - keeps full-lane access intact while reducing cognitive overload and render density in dense lanes.
- Timeline readability pass:
  - upgraded shared timeline summaries with an explicit momentum chip (`Rising`, `Cooling`, `Flat`) and latest-step delta text.
  - limited tabular timeline detail to the latest 8 points for faster scanning on long histories while preserving chart context.
  - keeps deterministic evidence narration intact and avoids additional motion cost.
- Leaderboard empty-state engagement pass:
  - replaced the bare no-rows lane state with a structured arena preview explaining Bronze/Silver/Gold progression bands.
  - added a clear preview-only label to avoid fake-live confusion and optionally shows the signed-in user's current tier plus XP-to-next-tier guidance.
  - keeps no-fake-user policy intact while preventing a dead empty leaderboard experience.
  - added live-fixture smoke coverage (`tests/live-fixture-render.test.tsx`) for the no-rows leaderboard preview state.
- Scroll-jump regression guard pass:
  - added `scripts/check-scroll-jump-apis.mjs` and `npm run check:scroll-jumps` to block direct `window.scrollTo` / `scrollIntoView` APIs in product route code.
  - updated docs checklists so this guard runs alongside existing no-mock, nested-interactive, and main-thread checks.
- Dashboard skill-lane progressive disclosure pass:
  - dashboard skill breakdown now prioritizes the top 4 strongest skill lanes by score for first-pass readability.
  - added a compact follow-up affordance linking to the full public profile skill map when additional lanes exist.
  - reduces repeated low-signal cards in the dashboard command center without removing access to full skill detail.
- Public profile lite-summary readability pass:
  - lite skill summary now surfaces the strongest lane explicitly before the compact lane list.
  - lite timeline summary now includes a momentum chip and recent-window XP delta to clarify trend direction in constrained mode.
  - visual regression baseline updated for the intentional public-profile shell changes.

## 2026-05-22

- Added a new `Cyberpunk matrix` display theme preset:
  - introduced a dedicated `html[data-theme="cyberpunk"]` token palette in `app/globals.css` using high-contrast deep-pink, amber, and lime accents over low-noise dark surfaces.
  - wired the new theme through shared theme infrastructure: `use-theme-preference`, dashboard quick switcher, keyboard display shortcuts (`Alt+Shift+T` cycle), and settings theme controls.
  - keeps current architecture and fallback behavior intact while expanding visual variety for demo/presentation paths.
- Upgraded color-contrast verification to theme-wide enforcement:
  - `scripts/check-contrast-tokens.mjs` now validates contrast thresholds per theme (`neon`, `cyberpunk`, `midnight`, `terminal`, `aurora`, `high-contrast`) instead of checking only one flattened token map.
  - prevents regressions where a non-default theme could slip below readability thresholds while default tokens still pass.
- Applied progressive disclosure on high-density report/profile routes:
  - PR battle report now keeps deep score/evidence/reward mechanics behind an explicit `Show technical breakdown` toggle with proper `aria-expanded` / `aria-controls`.
  - public profile now supports section-level `Show section` / `Hide section` controls for `Badges and skills`, `Best PR battle reports`, and `Timeline and repositories`.
  - collapsed states now render concise signal summaries instead of empty placeholders, preserving share-readability while reducing initial cognitive load.
- Removed route-level deferred/dynamic section wrappers across dashboard-critical routes:
  - switched dashboard, contributions, badges, quests, leaderboard, settings, public profile, and PR report pages to direct section rendering.
  - removed section-placeholder mount shells that were causing visible phase shifts and occasional scroll-position jitter during route interaction.
- Simplified dashboard chrome and reduced repeated surface noise:
  - trimmed top bar chips to core account state (`sync` + `rank`) and removed duplicate weekly-XP badge from the nav strip.
  - reduced dashboard chrome/nav glow intensity and gradient weight in `globals.css` to keep hierarchy clear without muddy contrast.
- Reduced redundant dashboard copy in deep panels:
  - removed extra “Score and skill lanes” preamble block above advanced cards so the route reads faster and keeps focus on evidence cards.
- Background rendering and scroll-jump stability pass:
  - switched global background behavior to desktop-fixed only; constrained/mobile/reduced-data/slow-update contexts now use scroll attachment to avoid repaint-heavy jank and inconsistent fixed-background behavior.
  - lowered global overlay/grid opacity defaults so `assets/background.jpg` remains visibly present behind dashboard surfaces.
  - set dashboard route-nav links to `scroll={false}` to reduce unwanted top-jumps when switching dashboard lanes.
- Fixed-background fallback hardening pass:
  - replaced remaining `background-attachment: fixed` overrides inside fallback/perf branches (`max-width`, coarse-pointer, reduced-gamification, reduced-data, constrained-network, and slow-update modes) with `scroll` attachment.
  - keeps desktop visual style unchanged while removing mobile/low-power repaint pressure in the exact contexts meant to be lightweight.
- Coarse-pointer hit-target pass:
  - enforced a 44px minimum height for coarse-pointer interactive controls (`button`, non-toggle text inputs, `select`, `textarea`, and role-based button/tab/switch controls).
  - keeps desktop density unchanged while improving touch accuracy and WCAG-friendly target spacing on mobile devices.
- Dashboard chrome structure pass:
  - inserted an explicit `dashboard-chrome-divider` between the account-state strip and lane navigation tabs in `DashboardLayout`.
  - improves visual grouping so the dashboard nav reads as one consistent chrome block without adding extra copy or motion.
- Autosync noise reduction pass:
  - dashboard auto-sync no longer treats `partialProfileAvailable` by itself as a re-sync trigger.
  - stale-state and zero-evidence recovery still auto-sync, but already-synced partial snapshots avoid repeated background sync churn.
- Validation pass:
  - `npm run build` succeeded after changes.
  - frontend quality checks passed: `check:contrast`, `check:readable-text`, `check:media-stability`, `check:main-thread`, `check:cache-strategy`, `check:server-boundaries`, `check:client-env-safety`, `check:no-production-mocks`.

## 2026-05-21

- Dashboard top-bar display controls pass:
  - surfaced compact `ThemeQuickSwitcher` and `TextScaleQuickSwitcher` controls directly in the dashboard top bar on larger screens.
  - improves day-to-day readability/theme switching speed without forcing a settings-page round trip.
- Contributions CSV export pass:
  - added a header-level `Export CSV` action on contributions that exports the currently filtered, deduplicated contribution rows.
  - expanded export columns with direct PR URL, local-date rendering, and sanitized impact summary text for better share/report workflows.
  - added UTF-8 BOM output for spreadsheet compatibility in common desktop tools.
  - keeps visual card UX intact while adding a lightweight table-friendly output path for presentation and accessibility workflows.
- Momentum legend clarity pass:
  - added labeled intensity legend chips (`Idle`, `Warm`, `Active`, `Hot`, `Peak`) to the shared streak heat strip with per-band day counts.
  - improves scanability of activity intensity bands without requiring color-memory only interpretation.
- Header redundancy suppression pass:
  - shared `PageHeader` and `SectionHeader` now hide the eyebrow when it duplicates the title label (case/spacing-insensitive), removing repeated header text without touching route-level copy.
- Dashboard momentum heat-strip pass:
  - added a compact 21-day contribution heat strip to dashboard and contributions (`frontend/components/shared/StreakHeatStrip.tsx`) to make streak/momentum scan faster without heavy animation.
  - each day tile now includes tooltip and ARIA labels with contribution count + XP so momentum state is not color-only.
- Error-state recovery pass:
  - added in-place `Retry` actions on all major dashboard route error states (`dashboard`, `contributions`, `badges`, `quests`, `leaderboard`, `settings`, `public profile`, `PR report`).
  - each retry now triggers the page query `refetch` directly, reducing forced navigation during transient sync/API failures.
- Settings module lazy-load pass:
  - switched `SyncRunActivityPanel` and `PrivacyRepositoryToggleList` to `next/dynamic` with bounded placeholders.
  - keeps settings behavior intact while reducing eager module loading for dense sync/repository panels.
- Public profile collapsed-state summary pass:
  - replaced dead-text collapsed blocks in public-profile sections with compact summary chips (unlocked badges, top skill, report count/top XP, timeline latest XP, top-repo count).
  - keeps progressive disclosure while preserving useful signal in collapsed mode.
- Settings sync-collapsed summary pass:
  - replaced the collapsed sync-log helper sentence with compact sync-state chips (state, last-sync availability, current step).
  - keeps diagnostics discoverable while preserving useful context in collapsed mode.
- Onboarding reveal collapsed-summary pass:
  - replaced collapsed unlock/next-action helper sentences with compact summary chips (unlocked badge count, strongest signals, evidence rows, step count, first action).
  - keeps reveal progressive disclosure while preserving useful signal in collapsed mode.
- Quests collapsed-lane summary pass:
  - replaced generic collapsed quest-section placeholder text with compact lane-summary chips (quest count, active count, total reward XP).
  - keeps quest progressive disclosure while preserving useful signal in collapsed mode.
- Onboarding sync progressive-disclosure pass:
  - added a `Show phases / Hide phases` toggle to the analyzing pipeline.
  - phase list is now collapsed by default into compact status chips (sync state, current phase, poll cadence), reducing cognitive load while preserving full phase detail on demand.
- Public profile lazy-load pass:
  - switched heavy public-profile modules to `next/dynamic` (`PublicProfileHero`, `BestPRsPanel`, `SkillRadarChart`, `TimelineChart`) with bounded skeleton fallbacks.
  - improves first-render responsiveness on profile routes with large contribution history.
- Leaderboard arena lazy-load pass:
  - switched `LeaderboardArena` to `next/dynamic` with a bounded loading placeholder so lane controls and mission summary can render before heavier arena rows.
  - keeps leaderboard behavior intact while reducing eager route module loading.
- Contributions list lazy-load pass:
  - switched `ContributionList` to `next/dynamic` so filter controls and route chrome render before card-lane module hydration.
  - keeps contribution behavior intact while reducing eager route module loading.
- Badges grid lazy-load pass:
  - switched `BadgeGrid` to `next/dynamic` with a bounded placeholder so badge filters and progression summary render before grid hydration.
  - keeps badge behavior intact while reducing eager route module loading.
- Quests lane lazy-load pass:
  - switched `QuestCard` to `next/dynamic` with bounded fallback placeholders so mission frame and spotlight render before dense quest-card hydration.
  - keeps quest behavior intact while reducing eager route module loading.
- PR report module lazy-load pass:
  - switched `ScoreMatrixCard`, `XPBreakdownCard`, and `EvidenceSignalsCard` to `next/dynamic` with bounded placeholders.
  - keeps report behavior intact while reducing eager route module loading.
- Dashboard code-splitting pass:
  - switched heavy dashboard lane modules (`CurrentLeagueCard`, `QuestPanel`, `RecentBattleReports`, `ScoreExplanationCard`, `BadgeShelf`, `SkillBreakdownCard`, `ContributionTimelineCard`) to `next/dynamic`.
  - keeps route behavior intact while reducing eager dashboard module loading.
- KPI hierarchy pass:
  - upgraded dashboard snapshot layout to a weighted 12-column grid where `GitRank score` is the primary wide metric and supporting metrics are compact side cards.
  - extended shared `StatCard` with layout/value-class hooks for route-level hierarchy control.
  - tightened stat-card detail line-height for denser, cleaner scanability.
- Contributions snapshot strip pass:
  - added a compact pre-card metrics strip on the contributions route: filtered-card count, repositories touched, and streak summary.
  - improves quick orientation before entering detailed PR card scanning.
- Landing hero clarity pass:
  - added a compact three-point proof strip under the hero statement (`evidence-backed score movement`, `real PR battle reports`, `share-ready contributor profile`) to front-load value clarity.
- Header action clarity pass:
  - added a clear primary header action on each major dashboard route:
    `Dashboard` → `Open contributions`,
    `Contributions` → `Open sync settings`,
    `Badges` → `Open contributions`,
    `Quests` → `Open contributions`,
    `Leaderboard` → `Open quests`,
    `Settings` → `View public profile`.
  - improves route-level wayfinding so each screen has an immediate next step.
- Marketing anchor navigation pass:
  - switched marketing-header quick-route chips to in-page anchors (`Why GitRank`, `Journeys`, `Reports`, `Start`) instead of redirect-oriented dashboard aliases.
  - added stable section anchors on the landing page so first-time visitors can jump directly to the relevant product narrative block.
- Marketing header navigation pass:
  - added compact quick-route chips (`Dashboard`, `Contributions`, `Badges`, `Quests`) to the public marketing header for faster first-time wayfinding.
  - introduced `marketing-nav-chip` styling with low-noise neon contrast that matches dashboard chrome without heavy effects.
- Dashboard route consistency pass:
  - removed top-level sync-guide banners from badges, quests, and leaderboard to reduce repeated route noise and keep each page header compact.
  - tightened route descriptions and collapsed helper copy in hidden sections for faster scanning.
- Landing journey action pass:
  - added explicit CTA actions to each core user-journey card (`Start onboarding`, `Open contributions`, `Open dashboard`) so every journey has a direct next step.
  - tightened journey success copy for clearer outcome framing.
- Dashboard stability and signal-density pass:
  - deduplicated contribution cards by PR identity (`owner/repo#number`) so each PR maps to one consistent battle-report entry in the contributions lane.
  - reduced dashboard/settings/contributions header verbosity to keep navigation and top-of-page content scan-friendly.
  - removed `SyncStateGuide` from settings and contributions top blocks to cut repeated sync prose noise.
- Scroll-jitter mitigation pass:
  - removed `content-visibility: auto` deferral for `.render-opt-section` and `.render-opt-card` to avoid viewport jumps on long dynamic dashboard pages.
  - kept non-deferring `contain: none` behavior for stable scrolling during filters, sync activity, and panel toggles.
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
  - switched React Query devtools gating to a runtime local-host detector backed by `useSyncExternalStore`, keeping hydration-safe defaults.
  - kept client env access constrained by `check:client-env-safety` so only approved public/runtime keys can appear in client-scoped modules.
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
  - added `app/head.tsx` preload link for `/assets/background.webp` (gated by `prefers-reduced-data: no-preference`) so the locked background visual appears faster on initial load; this stale convention was removed on June 3 after the Next.js metadata audit.
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
  - added deterministic ranking coverage for grouped-result ordering.
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
  - added a shared copy-link helper so copied
    dashboard/profile section links resolve to absolute URLs in the browser
    instead of relative path fragments
  - migrated dashboard, contributions, badges, quests, settings, leaderboard,
    and public-profile copy-link actions to this shared behavior
  - added focused coverage to lock absolute/relative URL normalization semantics.
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
  - copy-link actions use secondary styling so share-link controls are more
    discoverable in jump navigators across dashboard surfaces.
- Copy-link behavior contract coverage:
  - added focused coverage to verify rendered copy controls write the expected
    URL payload to clipboard using current origin.
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
  - uses the shared `/assets/logo.png` identity asset for manifest and browser
    icon surfaces.
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
  - compressed runtime background image and standardized served assets under
    `public/assets/background.*`
  - added WebP + JPEG fallback selection through CSS `image-set()`
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
- Replaced the weekly refinement evidence bundle with a lightweight summary
  under `frontend/docs/evidence/weekly-2026-05-17/`; raw generated screenshots
  and Lighthouse JSON now stay out of tracked source.
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
- Applied dashboard declutter and filter chrome reductions:
  - merged streak telemetry into one card (`Current streak`) by folding yearly activity into the same panel.
  - compact contribution filters now hide the top status/reset chrome while retaining full category/search/sort behavior.
  - smoothed long-tail background glow falloff so neon overlays start and fade more gradually with less visual noise.
- Simplified settings sync activity controls:
  - removed the redundant visible `X of Y runs` + top reset strip from sync activity filters.
  - kept the live filter status in an `sr-only` region so assistive tech still receives count updates.
- Reduced cognitive-load chrome on badge and leaderboard filters:
  - moved `showing X of Y` live counts to `sr-only` status text in badges and leaderboard lane controls.
  - removed the extra badge filter reset button row and kept direct per-chip filter clears.
- Softened dashboard route chrome for readability:
  - reduced border/glow intensity on dashboard shell and route-nav cards.
  - keeps cyberpunk styling while reducing visual noise and scan fatigue on dense pages.
- Simplified the dashboard top bar:
  - removed the verbose signed-in sentence and switched to compact handle + sync/rank pills.
  - keeps quick identity context while reducing repeated text in the dashboard chrome.
- Tightened leaderboard mission copy:
  - replaced repeated "Your arena mission" labels with shorter lane-status phrasing.
  - preserves rank context while reducing duplicate headline text in the leaderboard hero card.
- Simplified contributions achievement cards:
  - removed redundant decorative/technical chrome from each PR card.
  - trimmed duplicate status/file chips and condensed signal labels for faster scan.
  - kept the impact summary and report drill-down while reducing visual clutter.
- Tightened PR battle report copy and evidence labels:
  - shortened header/error wording and removed duplicate partial-evidence chip noise.
  - keeps source/confidence/fallback diagnostics while reducing repeated status text.

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
