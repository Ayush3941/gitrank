# Contributing to GitRank

Last reviewed: June 4, 2026

This document is intentionally detailed.

## Session Notes (June 4, 2026)

- Added shared loading-copy normalization for route and card loading states so assistive-technology announcements remove duplicated `Loading` prefixes while preserving intentional progressive copy such as `Preparing your dashboard`.
- Replaced the shared `SegmentedTablist` implementation with `SegmentedControl` radio-group semantics for dashboard filters and view selectors; filter controls now expose `radiogroup`/`radio` with `aria-checked`, and `npm run check:segmented-filters` enforces the shared component.
- Tightened the segmented-control cleanup guard so stale tablist component names, stale `aria-selected` filter state, and old leaderboard snapshot naming cannot drift back into shared/source/test files.
- Made frontend ABRA insight generation respect `AI_PROVIDER` explicitly: OpenAI remains the default when configured, Gemini is used only when selected or when it is the only available key, and identity labels now distinguish ChatGPT, Gemini, and deterministic fallback.
- Removed the unused `@radix-ui/react-tabs` dependency after all dashboard lane/filter controls moved to the shared `SegmentedControl` radio-group implementation.

## Session Notes (June 3, 2026)

- Restored a clean frontend TypeScript gate with `npm run typecheck`, wired it into frontend CI and `scripts/check-repo-sync.sh`, and refreshed stale test fixtures to match current profile, sync, repository visibility, and PR category contracts.
- Wired `npm run lint` into `scripts/check-repo-sync.sh` so the local repo-wide gate now matches frontend CI for lint and typecheck drift.
- Wired `npm run build` into `scripts/check-repo-sync.sh` so local repo-wide verification also proves the Next production build and prerender pass.
- Wired `npm run test:smoke` into `scripts/check-repo-sync.sh` so local repo-wide verification renders the live-fixture dashboard, contribution, badge, quest, report, profile, leaderboard, and settings flows.
- Wired `npm run test:a11y` into `scripts/check-repo-sync.sh` so local repo-wide verification exercises route accessibility, control names, and settings form behavior.
- Wired `npm run test:contracts` into `scripts/check-repo-sync.sh` so local repo-wide verification covers gateway/BFF route parity, auth proxy parity, and frontend BFF contract tests.
- Wired `npm run test:visual` into `scripts/check-repo-sync.sh` so route-level visual shell snapshots stay part of the local repo-wide gate.
- Tightened the public-profile visual snapshot helper so top-signal chips are selected by their labeled list, not by every hero chip that happens to share visual styling.
- Wired `npm run test:visual` into frontend CI so dashboard, leaderboard, and public-profile shell regressions fail in pull-request checks as well as local repo sync.
- Wired the OAuth prefetch, dashboard route-copy, and route-state primitive guards into both frontend CI and `scripts/check-repo-sync.sh`, keeping auth navigation, dashboard metadata copy, and route loading/error UI consistent by default.
- Replaced the settings sync-run status `<select>` with the shared wrapped `SegmentedTablist`, removed the orphaned `NativeSelect` primitive and unused Radix select dependency, and expanded `scripts/check-repo-sync.sh` to run the remaining frontend CI source, presentation, interaction, performance-budget, and bundle-composition guards locally.
- Promoted the remaining repo-only frontend guards into frontend CI: env-example coverage, decorative icons, input/select/switch names, native and polymorphic button safety, landmarks, new-tab links, live-region atomicity, stale-refresh wiring, and shared-orphan cleanup.
- Added `scripts/check-frontend-ci-repo-sync-parity.sh` and expanded the grouped repo-sync source-policy guard list so every frontend CI `npm run ...` step must stay covered by `scripts/check-repo-sync.sh` through either a direct npm call, grouped helper entry, or the underlying frontend script path.
- Hardened `scripts/check-workflow-frontend-npm-scripts.sh` to use a here-string lookup instead of a `printf | rg -q` pipeline, avoiding false failures under `pipefail` when `rg` exits early after a valid match.
- Removed stale local clutter (`frontend/.next`, `gitrank/.tmp`, and empty untracked scaffold directories), hardened live-gate scripts to create their temp root on demand, and deleted the obsolete `frontend/app/head.tsx` App Router convention after checking the installed Next.js docs; root metadata now stays owned by `app/layout.tsx`, `manifest.ts`, `robots.ts`, `sitemap.ts`, and generated OG/Twitter image files.
- Production frontend type fixes now keep auto-sync analytics events, onboarding sync timestamps, PR-report AI retry errors, and unknown status labels aligned with their current runtime contracts.

## Session Notes (June 2, 2026)

- Removed unused frontend modules `components/ui/separator.tsx` and `hooks/use-auth-session.ts`; no production or test imports referenced them, and the unused `@radix-ui/react-separator` dependency was removed with the lockfile refreshed.
- Removed the orphaned `CopyLinkButton` wrapper and its component-only test; production share flows already use `CopyTextButton`/`ShareProfileButton`, while `toAbsoluteShareUrl` remains covered directly.
- Added `npm run check:shared-orphans` and wired it into `scripts/check-repo-sync.sh`; shared components, UI primitives, and hooks now need a production import outside themselves or they should be removed instead of kept alive by isolated tests.
- Public profile card exports now use the user-facing `Open proof data` label; `npm run check:copy-tone` blocks the old developer-facing JSON label from returning.
- Markdown make-target verification now uses a deterministic here-string lookup instead of a `printf | rg` pipeline, avoiding false failures when `pipefail` observes SIGPIPE after a valid early match.
- Markdown frontend npm-script verification now uses the same deterministic here-string lookup so valid `npm run` references do not fail under `pipefail`.
- Production frontend surfaces now use `rounded-[var(--radius-universal)]` directly for non-pill shapes, keeping component code aligned with the global radius token instead of relying on CSS overrides to erase large-radius classes.
- Added `npm run check:radius-tokens`, wired into frontend CI and repo sync, so production source can only use `rounded-[var(--radius-universal)]`, `rounded-full`, or `rounded-none`.
- `ContributionPulseStrip` now exposes visible Today/Peak summaries and screen-reader day labels instead of relying on browser `title` tooltips for activity-cell detail.
- Contribution cards now expose their signal strip as a bounded progressbar with readable signal text instead of leaving the score as a purely visual width fill.
- Added `npm run check:progress-names`, wired into frontend CI and repo sync, so every shared `Progress` meter must expose an accessible name.
- Dashboard and public-profile hero avatars now render through shared `ProfileAvatar`, keeping optimized dimensions and one wrapper-level profile-image label instead of duplicate ad hoc `next/image` markup.
- Added `npm run check:image-alt`, wired into frontend CI and repo sync, so production `Image`/`img` elements must declare explicit decorative or descriptive alt intent.
- Added `npm run check:role-img-names`, wired into frontend CI and repo sync, so chart/avatar-style `role="img"` visuals must expose an accessible name.
- Added `npm run check:button-names`, wired into frontend CI and repo sync, so literal and shared buttons must expose visible, ARIA, or screen-reader-only names.
- Added `npm run check:link-names`, wired into frontend CI and repo sync, so literal, Next, and intent-prefetch links must expose visible, ARIA, or screen-reader-only names.
- `InlineNotice` now requires contextual placeholder text, and `npm run check:inline-notice-placeholders` blocks generic hidden status lanes from returning.
- Shared `Input` now forwards refs so focus restoration helpers can target the real input element without unsafe prop assumptions.
- Shared search-clear refocus now uses `focusWithoutScroll()`, and `npm run check:focus-without-scroll` is wired into frontend CI and repo sync to block raw `.focus()` calls that can jump the viewport.
- Stale-refresh pages now pass the optional user-sync argument explicitly, and the stale-refresh wiring guard accepts that type-safe form while still requiring `runUserSync.mutateAsync(...)`.
- Contributions stale-refresh handling now uses the shared stale-refresh error context, and contributions/badges/leaderboard only render stale-state details when a profile snapshot exists.
- Removed redundant browser `title` tooltips from interactive controls and added `npm run check:interactive-titles`; controls must expose names and detail through visible text or ARIA, not hover-only tooltips.
- Live-region announcements now use explicit atomic updates; `npm run check:live-regions` blocks `role="status"` and `role="alert"` nodes that omit `aria-atomic="true"`.
- Frontend JSX policy scripts share `frontend/scripts/lib/jsx-source-scan.mjs`; add new AST-based UI guards, including accessible-name, decorative-icon, duplicate-id, main-landmark, navigation-landmark, nested-interactive, new-tab-link, polymorphic-button, and unstable-key checks, through that helper instead of copying parser/walker code.
- Removed accidental local project clutter from the working tree: root `node_modules/`, root `GITRANK FLOWS/` image exports, and the root `gitrank/github-ingestor` Go binary. Durable flow docs belong under `gitrank/docs/`, frontend dependencies under `frontend/node_modules/`, and service binaries under `.run/bin/` or ignored temp paths.
- Root `.gitignore` and `scripts/check-repo-sync.sh` now guard against those clutter paths returning, including root-level Go service binaries for all backend services.
- Test-only GitHub App private-key placeholders now use non-secret file-path strings instead of PEM-shaped literals, keeping `scripts/check-no-tracked-secrets.sh` high-signal without weakening the scanner.
- Frontend script discoverability now treats `frontend/scripts/lib/` as helper-only code while still requiring top-level `frontend/scripts/*.mjs` audit entrypoints to be reachable from package/workflow/repo-sync wiring.
- GitHub App sync policy guards now expect `ValidateGitHubAppSyncRuntime()` for gateway/ingestor sync readiness so webhook-only configuration does not block local PR sync.
- Frontend route landmarks now use one shared owner: `AppShell` renders the only `<main id="main-content" tabIndex={-1}>`, while marketing/onboarding content renders inside it as normal containers. This keeps the global skip link, landmark navigation, and shell design consistent.
- Added `npm run check:main-landmark` plus focused render coverage in `frontend/tests/main-landmark.test.tsx` so nested page-level `<main>` wrappers cannot quietly return in feature components.
- Added `npm run check:navigation-landmarks` and focused shared-nav coverage in `frontend/tests/navigation-landmarks.test.tsx`; every `<nav>` or `role="navigation"` region must keep a stable accessible name.
- Added `npm run check:route-state-primitives` so route `loading`, `error`, `global-error`, and `not-found` files keep using shared route-state UI primitives instead of one-off fallback screens.
- Shared inline loading cards now normalize loading targets so visible copy and polite announcements avoid duplicated `Loading` wording and trailing ellipses; `npm run check:copy-tone` blocks production `Loading ...` regressions.
- Added `npm run check:native-button-type`; literal `<button>` elements must declare a safe `type`, while the shared `Button` primitive defaults plain buttons to `type="button"` and keeps polymorphic links type-free.
- Added `npm run check:input-names`; production inputs must expose an accessible-name path and must not rely on placeholder text as the only label.
- Settings sync-log status filtering now uses the shared `NativeSelect` surface treatment instead of one-off native dropdown styling; `npm run check:select-names` blocks unlabeled production selects.
- Added `npm run check:switch-names`; shared `Switch` controls must be named by `aria-label`/`aria-labelledby` or by an `id` paired with a visible or screen-reader-only label.

## Session Notes (May 31, 2026)

- Leaderboard controls now use progressive disclosure for secondary view actions: lane tabs stay visible, while `Show details` and nearby/full toggles live under a `View options` disclosure, reducing first-view control noise without removing capabilities.
- Leaderboard arena root now exposes `data-leaderboard-arena="true"` so visual-regression checks do not depend on brittle generated IDs.
- Sync-run rows now use per-row disclosure controls for verbose diagnostics: concise metrics stay visible, while long outcome/error/correlation details are revealed on demand with `aria-expanded`/`aria-controls` wiring aligned to WAI-ARIA disclosure guidance.
- Contributions filters now use progressive disclosure: status and search stay visible by default, while category/sort controls live behind an explicit `Advanced filters` toggle to reduce first-view noise without removing any filtering capability.
- Dashboard lane navigation now renders through a single shared shell (`DashboardLayout` + `DashboardRouteNav`) instead of stacked wrapper chrome, reducing duplicate borders and keeping lane hierarchy visually consistent across all dashboard routes.
- Settings sync diagnostics now open collapsed by default with compact health chips (`Healthy` / `active` / `partial` / `failed`) and explicit `Open log` disclosure, reducing first-view clutter and avoiding auto-expand layout jumps while preserving full run diagnostics on demand.
- Horizontal overflow affordances are now explicit across dashboard rails (`DashboardRouteNav`, `SegmentedTablist`, and `HeaderMetaChips`) via shared `scroll-fade-x` edge fades, improving mobile discoverability of off-screen lanes without adding animation-heavy cues.
- Marketing hero trust blocks were tightened to explicit authority lanes (`deterministic scoring`, `GitHub App extraction`, `AI explanation-only`) and section header/action alignment was normalized through shared header primitives (`PageHeader`, `SectionHeader`) for cleaner cross-route hierarchy.
- Freshness-pill rendering is now centralized through `shouldShowProfileFreshnessPill` (`frontend/lib/presentation/sync-evidence.ts`) and reused by Dashboard, Contributions, Badges, Quests, Leaderboard, and Settings to prevent route-specific drift.
- Dashboard surfaces now only render `Refreshed …` chips when effective sync state is `synced` and no GitHub App installation/runtime blocker is active; blocked/partial states consistently show non-fresh evidence chips.
- Dashboard/shared route chips (`dashboard-nav-item`) were visually refined for clearer hierarchy: stronger inactive/active separation, touch-safe hover behavior (`@media (hover:hover)`), and cleaner active-lane indicator rails without introducing additional animation.
- Page-shell glow fields were smoothed with larger, longer-falloff gradients to reduce abrupt hotspot edges while preserving fixed-view background behavior and reduced-motion safeguards.
- Refresh-feedback truthfulness is now fail-safe: `buildUserSyncRefreshFeedback` classifies terminal `failed` sync executions (including app-installation-required/runtime-unavailable and in-progress conflict metrics) as warning outcomes, so UI never reports a success-like refresh message for failed PR extraction runs.
- Dashboard/Settings profile freshness pills now suppress `Refreshed …` badges whenever effective sync state is not `synced` or App-installation blockers are active, preventing false “fresh” signals during blocked sync states.
- Settings account-action notice rendering now maps refresh outcome tone (`success`/`warning`/`error`) into `InlineNotice` variants, so sync recovery states are visually distinct from normal success responses.
- Repository visibility list keys now include deterministic compound identity fields to avoid duplicate-key instability in settings list rendering and satisfy JSX key stability guards.
- GitHub App sync runtime validation is now separated from webhook-delivery validation: execute/queue sync routes and dependency manifests require App JWT/install credentials only, while webhook secret remains a webhook-only requirement.
- Auth install preview/health signals now report App sync-runtime readiness (not webhook-secret presence), reducing false "app misconfigured" states during local PR-sync setup.
- Settings sync activity status filtering now uses a single compact dropdown instead of segmented tab buttons, reducing interaction overhead and eliminating tab-triggered scroll/focus jitter in long settings pages.
- Contributions now uses stale-while-revalidate rendering rules: it blocks only on first-load/no-cache failures and keeps cached evidence visible with an inline refresh warning when background refetch fails.
- Dashboard and settings now use shared `IntentPrefetchLink` navigation on high-traffic internal actions (lane nav, hero CTAs, quest/report empty states, and account actions), so route prefetching is intent-driven (hover/focus/touch) and automatically suppressed on constrained networks.
- Settings account controls now always expose a GitHub App install/manage action and show an explicit install-required warning when strict App sync is blocked, keeping sync recovery obvious instead of relying on hidden diagnostics.
- Dashboard lane styling was tightened for readability consistency (higher contrast nav tokens and clearer active-state hierarchy) without reintroducing heavy motion or blur effects.
- Settings sync diagnostics now mount the `SyncRunActivityPanel` only while the disclosure is expanded, so collapsed state no longer pays render cost for search/filter/result virtualization markup.
- Dashboard secondary lanes (league, quest lane, battle reports) and the settings repository-visibility section now mount through `DeferUntilVisible` with placeholders, so below-the-fold panels delay hydration/render cost until near viewport while keeping first-view interactions responsive.
- `DeferUntilVisible` now renders eagerly in test mode (`NODE_ENV=test`) to keep fixture/accessibility tests deterministic while production continues to use IntersectionObserver gating.
- Contribution and settings filter surfaces now use shared `ControlSurface` wrappers and `useId`-based status/region IDs (`ContributionFilters`, `PrivacyRepositoryToggleList`, `SyncRunActivityPanel`) to reduce duplicated layout styling and avoid static-ID collisions in reusable filter modules.
- Accessibility control tests were updated to validate semantic status linkage (search input `aria-describedby` points to a real `role="status"` region) without assuming fixed literal IDs, preserving test robustness after `useId` adoption.
- Dashboard filter-control shells now use a shared `ControlSurface` component (`neon-surface` spacing/radius/padding contract) across Badges, Quests, and Leaderboard to reduce duplicated styling and keep control density consistent.
- Dashboard lane navigation now uses a deterministic grid layout (`2` columns on narrow viewports, `5` on larger screens) instead of mixed flex/min-width behavior, removing small-screen overflow pressure while keeping all primary lanes visible.
- Contributions, Quests, and Leaderboard now generate per-instance disclosure/status region IDs via React `useId` instead of static constants, preventing duplicate-ID collisions when sections are reused while preserving ARIA control/link semantics.
- User-sync selection in `github-ingestor` now keeps a historic PR slice while authored-history bootstrap is in progress, even when recent discovery can fully fill the per-run cap. This prevents merged evidence from being starved by a stream of newer open PRs.
- Profile/dashboard skill rendering now uses shared skill deduplication from `frontend/lib/presentation/skill-normalization.ts` and stronger deterministic list keys in high-traffic cards/charts to avoid duplicate-key regressions.
- Sync state presentation remains evidence-first: "synced" display now requires merged contribution evidence (`mergedPrCount > 0`) instead of repository-only or superficial sync artifacts.
- Settings sync-run filtering now uses metric-aware derived status (`syncRunStatusLabelWithMetrics`) as a single source of truth, so completed rows with partial evidence markers are shown under `Partial` instead of being counted as `Completed`.
- Settings sync-run panel now precomputes row view models and uses deferred search (`useDeferredValue`) to keep filtering responsive under larger run histories, while the results viewport exposes `role="region"` + `aria-busy`/`aria-live` semantics for clearer assistive-state updates.
- Shared stale-state refresh controls now stay actionable during existing queued/running sync work and switch label text to `Check sync status`, so users get immediate in-flight diagnostics instead of a disabled control across Dashboard, Contributions, Badges, Quests, and Leaderboard.
- Shared profile-evidence chips now read the effective sync state and show truthful labels (`Syncing evidence`, `Partially synced`, `Sync failed`, etc.) across Dashboard, Contributions, Badges, Quests, Leaderboard, and Settings instead of collapsing all non-fresh states into a generic pending label.
- Settings now uses progressive disclosure for sync diagnostics: a compact `Sync activity` summary remains visible by default, while detailed run logs are collapsed in healthy states and auto-expanded when active/partial/failed runs need attention.
- Disclosure controls now expose stronger ARIA wiring (`aria-controls` + `role="region"` + `aria-labelledby`) across Settings diagnostics, display tuning, chart data-table toggles, and PR technical breakdown so expanded content has an explicit accessible relationship to its trigger.
- Disclosure panels now use React `useId` for trigger/content IDs (instead of fixed strings), preventing accidental ID collisions when components are reused or rendered more than once on a page.
- Badge shelves now use stable badge-ID keys (no index-based keys) and locked-path disclosure now controls a true hidden details region (`Show details`/`Hide details`) with per-instance `useId` wiring while keeping a lightweight preview visible when collapsed.
- Sync outcome selection now prioritizes GitHub App installation/runtime block diagnostics over newer generic partial outcomes, so dashboard/settings consistently show install-required blocking instead of falsely optimistic sync health when App access is broken.
- Shared stale-state banners now distinguish `Data is stale` from `Evidence pending` and use intent-prefetch navigation + polite status semantics, keeping partial-sync copy truthful without extra motion or noisy auto-focus behavior.
- Settings sync-activity disclosure now keeps expanded diagnostic context stable across polling refreshes (auto-open on attention, no implicit auto-collapse), reducing perceived scroll jumps while preserving manual user control.
- Shared inline status notices now keep `role="status"` on message text only (dismiss controls remain outside the live region), improving screen-reader announcement hygiene while preserving the same compact visual style.
- Stale-sync and GitHub-App-block banners now scope live-region announcements to message text nodes instead of whole cards with action buttons, aligning advisory announcements with ARIA live-region guidance while preserving current CTAs and layout.
- Dashboard, Contributions, and Settings now share one in-page section-navigation pattern (`InPageSectionNav`) with stable anchor IDs + `data-scroll-target`, so dense pages stay scannable, deep-linkable, and visually consistent without adding sticky chrome or extra motion.
- The same in-page section-navigation pattern now extends across Quests, Badges, Leaderboard, Public Profile, and PR Report so long-form surfaces keep consistent scan/jump behavior on desktop and mobile.
- Shared in-page navigation now normalizes section IDs and marks the active hash target with `aria-current="location"` plus a clearer chip state; hash tracking uses `useSyncExternalStore` and a single `hashchange` subscription instead of scroll listeners.
- Header summary-chip rails now reuse `ScrollableRegion`, exposing a labeled keyboard-focus target when narrow screens overflow while preserving the existing larger-screen wrapped layout.
- Dashboard, Settings, Public Profile, and PR Report client-side first loads now use route-shaped `RouteLoadingState` skeletons instead of generic single cards, reducing visual reflow when live data resolves.
- `RouteLoadingState` now scopes its polite live announcement to one screen-reader-only status node while leaving decorative skeleton markup outside the live region.
- Shared inline loading cards now use the same scoped-announcement pattern and remove the static spinner glyph plus generic filler sentence, keeping deferred dashboard panels quieter and easier to scan.
- Removed the unused `SyncStateGuide` component and its orphaned test instead of preserving a speculative second sync-status pattern; active routes continue to use the shared stale-state, inline-notice, and GitHub-App-block surfaces.
- Shared `ErrorState` cards now scope assertive alert semantics to the error title and description only; retry and fallback controls remain visually adjacent but outside the announcement region.
- Settings sync-log fetch errors now announce only the failure sentence; the adjacent retry action remains interactive without being folded into the assertive alert region.
- Settings sync-run polling now announces its concise `N of M runs` status instead of treating the full scrollable card list as a live region, preventing repeated disclosure-button and diagnostics chatter during refreshes.
- Shared empty states now use a decorative inbox cue instead of a generic sparkle glyph, keeping absence states purposeful across contributions, badges, quests, leaderboard, profile, and report routes without adding visual weight.
- Shared empty states now expose one clear recovery action; unused speculative secondary-action branches were removed instead of preserving an unexercised button hierarchy.
- Shared `BrandLogo` placements now default to decorative empty alt text when paired with visible product or section labels, avoiding repeated spoken branding while retaining an explicit standalone-image override.
- Settings form accessibility tests now wait for a live privacy switch instead of the route skeleton heading, preventing false-start failures and vacuous control-label passes during client-side loading.
- Shared route-level error cards now announce their eyebrow, title, and description through one scoped assertive region while leaving retry and fallback navigation controls outside the announcement boundary.
- Route-level not-found cards now cap recovery choices at two deliberate links, reducing sparse-screen decision noise while keeping one primary next move and one secondary escape route.
- Page, section, and route-loading headers now share one eyebrow-normalization helper, so first-load skeletons suppress repeated labels such as `Settings` / `Settings` while preserving distinct context labels.
- Removed obsolete shared presentation modules (`AnimatedNumber`, the null-returning `ConstrainedNetworkPill`, and superseded `StreakHeatStrip`) after confirming they had no runtime or test imports; active routes use direct formatted values, inline mode chips, and `ContributionPulseStrip`.
- Removed the unused `EffectsQuickSwitcher` button module after confirming reduced-effects behavior remains available through settings and the global display-shortcut hook.

It serves two purposes:

1. It explains what GitRank is and how contributors should approach the project.
2. It acts as the master production-readiness checklist for turning the current scaffold into a serious, deployable platform.

If an item in this file is unchecked, assume it is not production-ready yet.

Policy items that have been frozen in docs may be checked here even when their downstream engineering implementation is still incomplete. Use the linked policy docs to distinguish `decision made` from `runtime finished`.

## What GitRank Is

GitRank is an AI-assisted developer reputation platform built around one core idea:

> Open-source activity is easy to count, but hard to evaluate well.

GitHub already shows commits, pull requests, stars, forks, streaks, and contribution graphs. Those are activity signals, not skill signals.

GitRank exists to evaluate:

- what a developer actually changed
- how technically meaningful that work was
- how difficult the work appears to have been
- whether maintainers reviewed and accepted it
- whether the change improved quality, reliability, performance, security, or maintainability

The product should reward meaningful contribution, not spam.

That means GitRank must be:

- explainable
- evidence-based
- resistant to gaming
- respectful of privacy
- credible enough for contributors, maintainers, and recruiters to trust

## Research Baseline (GitRanking Paper)

Source reviewed: `docs/research/gitrank_research.pdf` (local paper copy), reviewed on May 24, 2026.

The paper this project name is inspired by is:

- `GitRanking: A Ranking of GitHub Topics for Software Classification using Active Sampling`

Paper scope (what it actually does):

- ranks GitHub topic terms by general-to-specific meaning (topic taxonomy), not developers
- starts from ~121K scraped GitHub topics and filters/ranks into 301 application-domain topics
- applies active pairwise sampling (ASAP) + TrueSkill ranking with Wikidata linking to reduce ambiguity
- converges ranking with ~5,281 annotated pairs from 8 annotators (instead of exhaustive full-pair comparisons)
- clusters ranked terms into 8 discrete levels
- finds developers overuse broad/high-level labels, reducing project discoverability
- targets project discoverability/label quality, not human contributor competency ranking

What this means for GitRank product work in this repo:

- GitRank is an extension, not a copy: we score contributor evidence (PR/review/repo signals), not topic labels alone
- keep skill/category signals explicit and bounded; never collapse unrelated dimensions into one opaque number
- keep claims calibrated: profile language must communicate uncertainty and evidence scope
- deterministic scoring and provenance remain the trust anchor; AI is enrichment, never score authority

Research-derived engineering guardrails (treat as policy memory):

- avoid fake certainty from sparse data (`low evidence` must stay visible in UI and report payloads)
- preserve extensibility: new skill lanes/categories must be schema-versioned and validation-backed
- keep classification explainable: each score change should map to inspectable evidence and rule version
- treat ambiguity as first-class: normalize labels/signals before aggregation; do not silently merge near-duplicates

Research memory lock (do not regress this interpretation):

- GitRanking paper validates topic-taxonomy ranking quality, not contributor skill scoring quality.
- Paper dataset/ranking constants to preserve in project memory:
  - initial scrape: ~121K GitHub topics (paper figure references ~130K raw before filtering)
  - frequent-topic seed: top 60% by frequency
  - post-linking taxonomy size: 301 topics (after dedupe/reconciliation)
  - annotation scale: 5,281 pairwise comparisons from 8 annotators
  - hierarchy output: 8 discrete general-to-specific levels
- Product implication: do not over-claim "research-proven developer ranking" in UI or docs.
  Keep wording constrained to evidence-backed PR scoring in this repo’s own deterministic model.

Contributor memory checkpoint:

- Before changing ranking language, scoring explanation copy, or claim wording,
  re-check this section first and keep product claims bounded to persisted
  evidence in this codebase.

## Current Repository Status

The repository is past the pure scaffold stage, but it is not production-ready.

Current state:

- [x] Top-level repository README exists.
- [x] Detailed project README exists at `gitrank/README.md`.
- [x] Go workspace exists at `gitrank/go.work`.
- [x] Core service modules are scaffolded.
- [x] Shared package modules are scaffolded.
- [x] Business logic exists for auth, webhook intake, deterministic PR analysis, scoring, and live frontend product flows.
- [x] API contracts are implemented.
- [x] Database schema exists.
- [x] Migrations exist.
- [x] Tests exist.
- [x] CI exists.
- [x] Security policy exists.
- [x] Code ownership rules exist.
- [x] Issue or PR templates exist.
- [x] Deployment manifests exist.
- [x] Production observability exists.
- [x] Release process exists.
- [x] Frozen v1 production decision register exists.
- [x] Maintainer guide exists.
- [x] DCO enforcement workflow exists.

Production observability assets are committed and locally verifiable (`make verify-observability-manifests`), while live deployment and traffic validation remain required in the V2 operational checklist (`Deploy and verify production observability against real traffic ...`).

## Repository Layout

The backend workspace lives under `gitrank/`. The frontend lives under `frontend/`.

```text
.
├── CONTRIBUTING.md
├── README.md
├── frontend/
│   ├── app/
│   ├── components/
│   ├── features/
│   ├── hooks/
│   ├── lib/
│   └── types/
└── gitrank/
    ├── AGENTS.md
    ├── README.md
    ├── deployments/
    ├── docs/
    ├── go.work
    ├── packages/
    │   ├── aiapi/
    │   ├── authkit/
    │   ├── config/
    │   ├── contracts/
    │   ├── errors/
    │   ├── events/
    │   ├── githubapi/
    │   ├── httpkit/
    │   └── logger/
    ├── scripts/
    └── services/
        ├── api-gateway/
        ├── auth-service/
        ├── github-ingestor/
        ├── pr-analyzer/
        ├── profile-service/
        ├── scheduler-worker/
        └── scoring-engine/
```

## Product Principles

Every meaningful contribution to GitRank should preserve these principles:

- Explainability over magic.
- Quality over activity volume.
- Deterministic scoring over opaque hype.
- Abuse resistance over vanity metrics.
- User trust over aggressive data collection.
- Production discipline over demo-only shortcuts.

## Before You Contribute

Read these first:

- `README.md`
- `gitrank/README.md`
- `gitrank/docs/production-decision-register.md`
- this file

Then understand the current reality:

- the project already contains meaningful implementation, but several services are still partial
- contributors are expected to improve both implementation and clarity
- a large portion of the remaining work is integration, persistence, and production hardening rather than pure feature polish

## Contribution Rules

### General expectations

- Keep pull requests focused.
- Prefer one coherent change over broad unrelated edits.
- Do not introduce fake handlers, fake persistence, fake success states, or silent TODO logic without documenting it.
- If you add a temporary shortcut, disclose it in both `README.md` and this file in the same change set.
- Match the repo’s architecture direction instead of adding convenience code that will need to be ripped out later.

### Communication expectations

- Open an issue before large architectural changes.
- Write down assumptions.
- Call out tradeoffs explicitly.
- If you change scoring logic, document why.
- If you change contributor-facing behavior, update docs in the same PR.

### Pull request expectations

Every PR should include:

- a clear summary
- the problem being solved
- design notes or tradeoffs
- testing performed
- known limitations
- follow-up work if the change is incomplete

## Frontend No-Slowdown Rules (Required)

Any UI change must preserve responsiveness on low-end laptops and avoid adding
runtime-heavy effects.

Required guardrails:

- Keep animation minimal on product routes (`/dashboard`, `/contributions`, `/badges`, `/quests`, `/settings`, `/leaderboard`).
- Avoid continuous/repeating motion loops in core layouts, cards, tables, and nav surfaces.
- Prefer static visuals over runtime visual effects (for example heavy blur stacks, multi-layer glow animations, and JS-driven parallax).
- Use transitions only for state clarity; keep them short and limited to `opacity` and `transform` when possible.
- Do not block first meaningful render on optional data. Non-critical enrichments (AI summaries, secondary panels, decorative stats) must degrade gracefully.
- Keep contribution/profile payloads bounded; do not remove the recent-history cap without performance evidence and a fallback strategy.
- Avoid production polling loops that can amplify CPU/network load. Use event-driven updates or conservative intervals when background refresh is required.
- Never re-introduce mock adapters into production frontend data paths.
- Use manual keyboard activation for rendering-heavy segmented filters (`Arrow` keys move focus; `Enter`/`Space` applies) to prevent accidental high-cost rerenders while preserving ARIA tab accessibility.

Frontend PR verification (required before merge):

```bash
cd frontend
npm run lint
npm run build
npm run check:no-production-mocks
npm run check:jsx-ids
npm run check:scroll-jumps
npm run check:stale-refresh-sync
npm run test:smoke
```

If a PR touches rendering-heavy components, include a short before/after note in
the PR description describing expected UX/performance impact.

Recent no-slowdown refinement (May 22, 2026):

- Dashboard top chrome was simplified to remove always-on display quick-switch controls from the primary nav surface.
- Theme/text/effect toggles remain available in Settings and onboarding, reducing routine dashboard UI noise and interaction cost.

Recent no-slowdown refinement (May 24, 2026):

- Dashboard route pages now share `stable-scroll-scope` so segmented filters do not yank viewport position when tabs/filters update.
- `SegmentedTablist` now avoids viewport-restoration scroll calls entirely, and `npm run check:scroll-jumps` prevents direct scroll-jump APIs from being reintroduced in product routes.
- Header meta chips on small screens are now horizontal rails instead of multi-line wraps, reducing header bloat and preserving actionable content density.

Recent no-slop refinement (May 29, 2026):

- Settings removed the redundant `Latest sync outcome` panel; sync run details stay in one place (`Sync activity`) to reduce duplicate status noise.
- Sync activity cards no longer surface correlation IDs in the default list view; the panel now prioritizes user-actionable run state and outcomes.
- Contribution filter helper copy was tightened to one clear sentence: categories reflect recent PR work and help choose the next lane.

Recent no-slop refinement (May 31, 2026):

- `ContributionFilters` removed redundant `View` and `Order` summary chips that repeated state already visible in segmented controls.
- Top filter rail now prioritizes only actionable context (`Active filters`, active lane, search chip, reset), reducing visual noise and scan cost on dense contribution pages.
- Updated frontend test coverage (`frontend/tests/contribution-filters.test.tsx`) to lock this simplified control-header behavior.
- `SyncRunActivityPanel` status-tab option mapping is now declarative (`SYNC_RUN_STATUS_META`) instead of nested ternary branches, reducing drift risk between counts/icons and improving reviewability.
- `frontend/tests/sync-run-activity-panel.test.tsx` app-installation insight assertion now uses a stable phrase-level matcher instead of brittle full-string matching.
- PR battle reports now expose an in-place `Retry AI summary` action when evidence is `rate_limited`, `ai_fallback`, or `deterministic_only`; it executes pull-request sync for that PR directly and keeps deterministic score output visible while enrichment retries.
- Added focused regression coverage in `frontend/tests/pr-report-retry-ai-summary.test.tsx` to lock retry-action visibility and pull-request sync invocation wiring.
- Badges and quests filter bars removed duplicate state chips (`Rarity`, `State`, `Cadence`) because segmented tabs already represent active state; control rails now keep only actionable context (`Active` + `Reset` when applicable).
- Live fixture smoke coverage now asserts selected tab state directly for badge/quest filters, preventing regressions back to duplicated chip state.
- Added shared `FilterControlsHeader` (`frontend/components/shared/FilterControlsHeader.tsx`) and wired contributions, badges, and quests to it so filter-rail summary/chip/reset layout stays consistent and avoids repeated one-off JSX patterns.
- Settings repository privacy controls now use the same shared filter header pattern and removed redundant `Visibility:` chip text (segmented tabs already encode selected state), keeping controls denser and more consistent with other dashboard filter rails.
- Added shared `SearchInputWithClear` (`frontend/components/shared/SearchInputWithClear.tsx`) and wired contributions, settings sync-activity, and repository privacy search fields to it for consistent clear affordance, `type="search"` semantics, and keyboard `Esc`-to-clear behavior.
- Added regression coverage in `frontend/tests/search-input-with-clear.test.tsx` and updated accessibility/sync-run tests for `searchbox` roles so search-control semantics stay stable.
- Settings sync-run and repository-visibility result panes now use adaptive max-height viewport sizing (`dvh` bounded) with stable scroll gutters and contained overscroll, replacing rigid fixed-height containers for better behavior on short/mobile screens.
- Repository privacy controls removed redundant `Public/Hidden` distribution chips because segmented visibility tabs already provide the same counts; this reduces header noise while preserving all filter signals.
- PR report deterministic metrics ledger now uses semantic definition-list markup (`dl` with grouped `dt`/`dd`) so metric labels, values, and explanations are exposed with stronger assistive-technology relationships.

Recent strict app-auth refinement (May 30, 2026):

- `github-ingestor` request-level strict auth now prioritizes explicit `installation_id` for repository/PR/review/issue/commit execution, then falls back to actor-linked installation discovery only when installation ID is absent.
- Executor strict-app cloning is now shared through a single helper, reducing duplicate per-call client wiring and drift risk in app-token-only sync paths.
- Profile sync-state observers now query the full authenticated sync-run stream (not only `run_type=user`) so active child runs keep dashboard/settings state in `syncing` until terminal.
- API-gateway user sync queue/execute routes now hard-bind `user` mode to the authenticated GitHub login, preventing cross-user payload overrides while keeping OAuth strictly in login/session scope.
- Ingestor user sync queue/execute routes now apply the same actor-login binding (`X-GitRank-GitHub-Login` wins when present) so internal requests cannot drift into cross-user sync payloads.

Recent no-slop refinement (May 30, 2026):

- Sync evidence truthfulness now requires merged rows to be score-bearing (`xpEarned > 0`) before the frontend treats a profile as materially synced, reducing false `Synced` chips from zero-XP rows.
- Added regression coverage in `frontend/tests/sync-evidence.test.ts` for merged-but-zero-XP contribution rows so this sync-state drift does not regress.
- Copy-tone guard now blocks previously removed dashboard clutter phrases (`command center`, `quick actions`, `low-cpu device mode`, `theme: midnight`, `text: large`, and similar stale metadata phrasing).
- Dashboard route metadata/loading copy was tightened to keep labels direct and avoid legacy “command center” wording.

Recent no-slowdown refinement (May 28, 2026):

- Settings now shows only real end-user controls (account, sync activity, privacy, display, repository visibility, data controls).
- Debug/operator-only panels (manual execute/queue controls, backend capability manifests, schema probes) were removed from the product settings surface to reduce UI noise and avoid dead admin-style UX in normal contributor flow.

Recent sync-state integrity refinement (May 27, 2026):

- Sync-run normalization now treats contradictory run rows (`finished_at` present while status remains `running`/`queued`) as `failed`, not `completed`, so dashboard/settings cannot show false-success runs.
- Older in-progress rows are now superseded by newer terminal rows using both correlation scope and logical target scope (run type + requested user/repository), reducing stuck `running` rows after repeated refresh cycles.
- User sync now performs a broad authored-PR fallback query when all windowed discovery passes are empty, reducing false-empty profile refresh outcomes on cursor/window edge cases.
- Dashboard stale-state banners now include the latest sync diagnostic reason (when available) so users see why evidence is partial and what state is still catching up.
- Authored-PR hydration skip telemetry is now cause-specific (timeout, rate-limit, auth/scope, not-found masking, conflict, upstream) and cursor progression now stays pinned on auth/scope failures until coverage can recover.
- Dashboard nav rails use thin visible scrollbars (instead of hidden scrollbars) to improve discoverability of horizontal navigation overflow.
- Background image visibility was increased with softer dark overlays and lower shell-glow opacity to keep text readable while preserving the cyberpunk visual layer.
- Added `npm run check:jsx-ids` and fixed duplicate region IDs in the badges locked-lane panel to prevent section-control and accessibility collisions.

Recent no-slowdown refinement (May 27, 2026):

- Unified stale/partial sync messaging across Dashboard, Contributions, Badges, Quests, and Leaderboard to avoid manual "run sync" language and align with auto-sync behavior.
- Settings account action copy now uses "Refresh snapshot" instead of "Sync now" to keep user-facing actions consistent with the background sync model.
- Guard checks `npm run check:sync-copy-policy` and `npm run check:copy-tone` are required after copy-only sync UX edits to prevent regressions.
- Sync refresh feedback now reports explicit outcomes for completed runs with zero discovered authored PRs and includes count-aware success copy when PR targets are actually synced.
- `scripts/check-start-sh-contracts.sh` now enforces `gitrank/.env` as the only `start.sh` runtime env source to prevent accidental frontend or secondary `.env` drift.
- `start.sh` now treats `gitrank/.env` as the sole local runtime env source and no longer scans root/frontend `.env*` files.

Recent slop-reduction refinement (May 28, 2026):

- Settings sync activity filters no longer duplicate state in extra summary chips (`Active`, `View`, `Search`). The panel now keeps one source of truth: search input + status tabs + optional reset action.
- Post-sync replay status handling now marks user sync as `partial` only for true replay mismatch (`merged targets selected` + `zero replay events`), while `all selected targets unmerged` stays `completed` with explicit zero-expected metrics.
- Dashboard hero signal lane removed redundant explanatory filler copy so the card stays evidence-first.
- Header freshness UI is now shared through `ProfileEvidenceStateChip` across Dashboard, Contributions, Badges, Quests, Leaderboard, and Settings to remove repeated inline JSX blocks and keep one consistent evidence-pending pattern.
- Dashboard hero action config no longer carries unused `title` fields, reducing dead presentation data in the rank card flow.

Recent sync-auth refinement (May 28, 2026):

- User sync execution is now strict GitHub App for PR extraction. OAuth remains identity/session only.
- `github-ingestor` now bootstraps user installation records via GitHub App JWT inventory (`GET /app/installations`) when no installation mapping exists, then retries sync with installation credentials.
- When account-login installation mapping is missing, actor installation resolution now probes persisted active App installations with a bounded authored-PR search and picks the first installation that can see the actor’s PR evidence, keeping org installation discovery App-only.
- Sync telemetry now exposes installation bootstrap lookup/attempt/success/failure counters so false “synced” states can be traced in run metadata.
- User sync execution now fails closed if any non-installation credential source is returned, preventing silent reintroduction of OAuth/shared PR extraction paths.
- Repository PR hydration now runs REST-only inside ingestor execution paths, removing the dormant GraphQL actor-token branch and reducing ambiguity around credential source during strict app sync.
- `scripts/check-ingestor-strict-app-auth.sh` now enforces case-insensitive OAuth detection and bans legacy actor-token GraphQL wiring symbols (`graphqlTokenSource`, `graphQLClientForActor`, `graphqlClientFactory`) in non-test ingestor service code.
- Removed dead GraphQL batch conversion/query code from `github-ingestor/internal/service/graphql_batch.go` after strict extraction moved to REST-only hydration, reducing unused runtime paths and maintenance surface.
- Service manifests now reflect the active runtime dependency set: GitHub REST remains a strict sync dependency while GraphQL is no longer reported as an active extraction dependency in api-gateway/github-ingestor manifests.
- Repository, pull-request, and review execute routes now use the same strict app-auth path and return explicit install/bootstrap diagnostics instead of generic gateway failures.
- OAuth-required extraction diagnostics (`github_user_oauth_required`, `oauth_token_required`, `oauth_token_malformed`) were removed from ingestor error mappings and frontend sync diagnostics so extraction failures now resolve only through strict App-installation signals.
- Strict app-auth sync runtime now disables OAuth GraphQL token usage in those routes, so PR extraction remains installation-token-only end to end.
- Scheduler/webhook sync paths can satisfy the same strict requirement without user-login headers by resolving app auth from explicit `installation_id` when present.
- Scheduler queued sync payloads now preserve optional `installation_id` and user login context, and scheduler execution forwards `X-GitRank-GitHub-Login`/`X-GitRank-Subject` headers when user context exists.
- Sync request validation now normalizes optional user-login context for repository/pull-request/review/issue/commit/report-analysis modes (trim, drop leading `@`, validate GitHub login format, lowercase), preventing malformed actor context from reaching strict app-auth extraction routes.
- Settings sync execute and queue controls now pass optional `user`/`installation_id` context for repository/pull-request/review/issue/commit actions, reducing manual strict-auth failures in local operator workflows.
- Service dependency manifests now explicitly document auth split: GitHub App installation tokens are required for sync extraction/bootstrap, OAuth is identity/login only.
- Frontend `next.config.ts` now loads missing env keys from `../gitrank/.env` before config evaluation, so standalone `frontend/` dev/build commands follow the same single-env-file contract without requiring a second frontend env file.
- GitHub ingestor executor now disables OAuth-backed GraphQL token sourcing by default in `NewExecutor`; sync extraction paths must use installation-auth clients only.
- Removed the dead non-strict actor runtime selector (`executorForActor`) from ingestor service code/tests to reduce ambiguity around OAuth-shaped extraction fallbacks.
- Removed unused OAuth-token extraction/refresh helpers from `github-ingestor` service persistence/runtime paths, keeping OAuth strictly login/session-only in extraction-related service code.
- Added `scripts/check-ingestor-strict-app-auth.sh` and wired it into `scripts/check-repo-sync.sh` so repo sync gates fail if OAuth extraction wiring reappears in non-test ingestor service code.
- Actor-installation resolution now fails closed when scanning global installation inventory: if no installation can prove authored-PR visibility for the actor, sync returns installation-required instead of falling back to an arbitrary installation token.
- Production decision register, API architecture, and roadmap docs now reflect the strict runtime split: OAuth is login/account-linking only; GitHub App installation tokens are required for sync extraction.
- Global-installation probing logic is now isolated in `selectActorInstallationClient(...)` with focused unit coverage so fail-closed matching rules stay testable and regression-resistant.
- User-mode sync queue jobs now canonicalize login casing in `subject`/dedupe identity, and sync-run lifecycle reconciliation now matches user subjects case-insensitively so queued/running rows cannot drift when request casing differs.
- Settings page sync state now incorporates live sync-run statuses (`running` / `queued` -> `syncing`) so chips and freshness pills do not present stale “Synced” states while background sync is still active.
- User sync execution now marks runs `partial` when authored PR discovery returns empty while persisted authored PR evidence already exists (`authored_pull_request_persisted_existing=1`), preventing false “completed” trust when refresh found no historical PR targets unexpectedly.
- Settings sync activity cards now render deterministic run-outcome insights from persisted sync metrics (scope-limited auth, zero-discovery with prior history, search-limit pressure, retryable timeouts, backfill-in-progress, and synced-target counts) so users can diagnose why PR evidence is missing without reading raw counters.
- Backend now emits `authored_pull_request_zero_discovery_with_history=1` when authored PR discovery returns empty while persisted authored evidence exists, and this marker is treated as `partial` execution status for safer sync trust semantics.
- Sync-run diagnostics are centralized in `frontend/features/settings/lib/sync-run-diagnostics.ts` and reused by both Settings account summary and Sync Activity cards to prevent drift between per-run and top-level sync explanations.
- `ListSyncRuns` now performs stale-run timeout materialization in storage (`MarkStaleSyncRunsFailed`) before listing, so long-stuck `running/syncing/queued` rows are persisted as `failed` with deterministic reasons instead of being re-inferred on every frontend poll.
- Dashboard sync-state chips now read live sync-run statuses via `useSyncRuns` so `queued/running` activity surfaces as `Syncing` instead of stale `Synced` labels during active background refresh.
- `github_sync_runs` writes now finalize existing in-flight rows (`queued/pending/running`) by correlation + run type + subject before inserting new rows, reducing duplicate lifecycle rows and improving sync-run timeline reliability.
- Sync executors now transition matching queued rows to `running` when execution actually starts, so run timelines reflect real lifecycle state (`queued -> running -> completed/failed`) instead of remaining queued until terminal write.
- Repository-mode queued sync jobs now persist `subject=<owner>/<repo>` (matching execution-time repository subjects), so correlation-based lifecycle reconciliation can correctly advance `queued -> running -> terminal` for repository runs.
- Settings sync activity status taxonomy now treats backend `partial` runs as a first-class UI state (separate from `completed`) so degraded sync outcomes are visible in filters and chips.
- Contributions, Badges, Quests, and Leaderboard now derive sync freshness from live sync-run statuses (same pattern as Dashboard/Settings) so active queue/running work consistently renders as `Syncing` across all dashboard tabs.
- Frontend sync-run normalization now preserves backend terminal `partial` and `failed` statuses when `finished_at` is present (instead of collapsing all finished runs to `completed`), so degraded outcomes remain visible across settings diagnostics and sync-state derivation.
- Effective sync-state derivation now interprets latest terminal run outcomes (`partial` -> `partially_synced`, `failed` -> `failed`) after pending-run checks, preventing stale success chips during degraded or failed terminal sync outcomes.
- Sync truthiness now requires materialized profile evidence (`PR contribution evidence` or tracked `owner/repo` repository evidence) before rendering healthy synced freshness chips, reducing false "Synced/Refreshed" states on empty snapshots.
- Scoring replay candidate loading now falls back to linked-account login matching when `author_github_account_id` is missing on synced PR rows, preventing zero-event replays caused by incomplete PR author-account linkage.
- User sync execute now emits post-refresh diagnostics from score replay (`post_sync_score_replay_events`, `post_sync_score_replay_total_xp`, mismatch flags) and downgrades execute responses to `partial` when authored PR targets were discovered but replay produced zero events, so "sync completed" cannot silently mask empty score snapshots.
- Authored PR target discovery now blends an incremental `updated` window with an incremental `created` window before deeper backfill, reducing repeated old-target loops when heavily-updated historical PRs crowd out newly-created PRs.
- Settings sync diagnostics now surface score-replay mismatch outcomes (`post_sync_score_replay_mismatch`) so users can distinguish “PR targets found” from “score replay still empty” without reading raw metric keys.
- Authored PR discovery now performs a bounded one-year `created` rescan when normal incremental/backfill windows return zero targets, so cursor drift or sparse windows do not strand active users at empty sync snapshots.
- User sync execution status now reports `partial` whenever authored PR discovery is empty (even without prior persisted history), preventing false `completed` runs when a refresh produced zero PR evidence.
- Dashboard hero next-action logic now uses the same derived effective sync state used by top-level sync chips, preventing conflicting “synced” vs “refresh evidence” cues inside the same dashboard render.
- GitHub API retry logic now treats documented rate-limit signals (`Retry-After`, `X-RateLimit-Remaining=0`, and rate-limit/abuse messages on 403/429) as retryable for both REST and GraphQL, reducing avoidable sync failures during primary and secondary throttling windows.
- GitHub API clients now retry transient upstream server failures (`500/502/503/504`) for safe REST methods (`GET`/`HEAD`) and GraphQL queries, while leaving unsafe REST mutations non-retryable to avoid accidental duplicate side effects.
- Dashboard sync freshness now derives from profile-relevant sync runs only (`run_type=user` with matching requested user when present), so PR/review/repository sub-run noise cannot override top-level profile sync state chips.
- Frontend sync-run polling now requests `run_type=user` for dashboard route freshness checks, and api-gateway auto-fills `user=<authenticated github_login>` for that mode when omitted, reducing cross-target run noise and payload size while preserving explicit user overrides.
- Profile freshness derivation is now centralized in `frontend/hooks/use-profile-sync-state.ts` and reused by Dashboard, Contributions, Badges, Quests, Leaderboard, and Settings to keep sync-state chips/pills behavior consistent across tabs.
- Effective synced-state truthiness now requires PR contribution evidence (not repository rows alone), so profiles with repo-only metadata cannot surface as fully synced before scored PR evidence materializes.
- Private-profile sync-state adaptation now treats backend `partial_profile_available` as a hint (only forcing partial when score evidence is still absent or source watermark is unusable), preventing false partial loops when evidence is already present.
- Dashboard auto-sync coordinator no longer force-triggers refresh solely because merged PR count is zero; it now relies on bootstrap, stale state, and staleness age, reducing repeated low-signal sync churn.
- GitHub ingestor sync-run normalization now marks stale in-progress rows as failed when a newer terminal row exists for the same correlation scope, reducing contradictory `running + completed` activity rows in Settings.
- Added `scripts/check-no-tracked-secrets.sh` and wired it into `scripts/check-repo-sync.sh` so local quality gates fail fast when high-signal token/private-key patterns are committed in tracked files.
- Sync-run supersession diagnostics now use a deterministic metric marker (`superseded_by_terminal_correlation=1`) emitted by backend normalization, reducing fragile frontend dependence on free-form error strings.
- Dashboard-route pages (Dashboard, Contributions, Badges, Quests, Leaderboard) now share `useProfileSyncRuns(limit)` for profile freshness polling, removing username-key churn from per-page `useSyncRuns(..., { user })` usage and keeping sync-state derivation consistent.
- Quests page hook ordering was fixed so `useQuests()` is initialized before any profile sync-run wiring, preventing a runtime `data used before declaration` failure in the quests route.
- Profile sync-run filtering now normalizes GitHub login tokens with optional leading `@` before matching `requested_user`, so active user sync runs are still recognized when upstream identifiers include handle-style prefixes.
- GitHub ingestor sync-run filter normalization now canonicalizes `run_type`, `status`, `repository`, `user`, and `requested_by_github_login` to lowercase (and strips leading `@` from GitHub logins) before listing runs, reducing false-empty activity lists caused by case/handle-format mismatches.
- `Store.ListSyncRuns` now applies case-insensitive matching for `run_type`, `status`, `requested_repository_full_name`, `requested_user_login`, and `requested_by_github_login` filters, so settings diagnostics remain stable even when callers send mixed-case values.
- Frontend effective sync-state derivation now treats any visible `running`/`queued` profile sync row as `syncing` regardless terminal-row ordering, reducing false “Synced/Refreshed” chips while active work is still in flight.
- GitHub search client now forwards the requested `page` parameter for authored-PR discovery calls, preventing repeated page-1 windows during bounded multi-page PR target selection.
- Frontend metadata icon URLs were corrected to rooted public asset paths (`/assets/logo.png`) so icon resolution works consistently across dashboard and public routes.
- PR analyzer AI summary client now accepts both `openai` and `gemini` provider modes through the same OpenAI-compatible chat-completions contract, keeping deterministic scoring authority unchanged while allowing provider swaps via env.
- Frontend AI/evidence labels are now provider-neutral (`AI ready`/`AI fallback`) and public/profile skill-copy now references ChatGPT when OpenAI-backed insights are active.
- Route-level visual regression snapshots were refreshed for the current dashboard/leaderboard shells after UI text/tab refinements, and `npm run test:visual` remains required when these route shells change.
- Added explicit unit coverage for sync-run timestamp precedence (`FinishedAt` over `StartedAt` when both are present) to keep `last_attempted_at`/`last_updated_at` semantics stable across lifecycle reconciliation changes.
- Frontend sync-run list requests now canonicalize filter params (`run_type`, `status`, `repository`, `user`) and strip `@` from user handles before calling `/api/sync/runs`, keeping client and backend filter semantics aligned.
- `ListSyncRuns` now publishes both `last_attempted_at` and `last_successful_at` watermarks in addition to `last_updated_at`, so UI surfaces can separate recent failed attempts from the last successful evidence materialization.
- Settings sync activity header now renders distinct "Last attempted" and "Last successful" indicators from backend watermarks, reducing false confidence when the newest run failed or was partial.
- Authored PR discovery now uses `is:pull-request` search qualifiers (instead of legacy `type:pr`) across windowed and broad fallback queries, improving compatibility with current GitHub search behavior for user-scoped PR discovery.
- Default authored-PR sync breadth was raised from `10` to `25` (`GITHUB_AUTHORED_PR_SYNC_LIMIT`) so fresh sync runs include a wider evidence slice without requiring local env overrides.
- User sync now marks `authored_pull_requests_selected_unmerged_only` as partial-state evidence, preventing false “completed/synced” trust when selected PR targets are all unmerged and score-bearing evidence is expectedly zero.
- GitHub sync failure metrics now explicitly classify unsupported API-version errors (`unsupported_api_version` and `authored_pull_requests_unsupported_api_version`), and frontend diagnostics map these to a direct `GITHUB_API_VERSION` remediation hint.
- User sync credential flow is strict GitHub App for PR extraction and installation bootstrap; OAuth user tokens are only used for sign-in/session continuity.
- Frontend profile sync-state matching now includes user-owned child sync runs (`pull_request`, `review`, `issue`, `commit`, `repository`, `installation`) when ownership is proven by `requested_user`, `requested_by_github_login`, or `subject=@handle`, so top-level status chips do not remain falsely "Synced" while user-linked downstream sync work is still active.
- Sync-state precedence now treats active (`running`/`queued`) rows as blocking only when they appear before the newest terminal outcome in run history, so stale trailing active rows no longer override newer `completed`/`partial`/`failed` truth on dashboard and settings.
- Frontend profile sync-state filtering now sorts profile-owned run statuses by `started_at` before derivation, so out-of-order sync-run payloads cannot surface stale `Synced` states while a newer run is still active.
- Dashboard route navigation now uses a single compact lane strip (without the extra "Current lane" summary card) to reduce repeated header noise and keep navigation hierarchy consistent across dashboard tabs.
- Settings sync-activity and repository-visibility scroll regions now expose keyboard-scroll semantics (`tabindex="0"`, labeled `role="region"`), aligning with overflow accessibility guidance and improving non-pointer navigation in long result panes.
- Dynamic Settings list panels now opt out of scroll anchoring (`overflow-anchor: none`) to reduce upward jump behavior while live sync/status rows refresh.
- Added a shared `ScrollableRegion` primitive in frontend shared UI to standardize accessible overflow regions (`role="region"`, label contract, optional keyboard focus), reducing duplicated ARIA/tabindex logic across settings and chart surfaces.
- Skill and timeline data-table disclosures now use the shared scrollable-region primitive, so horizontal overflow areas are keyboard-focusable and labeled consistently with the same focus affordance as Settings panes.
- User sync now records authored-PR lifecycle counters (`authored_pull_requests_selected_merged` / `_unmerged`) from per-PR hydration, and gateway replay mismatch detection only triggers when merged targets were selected; all-unmerged selections now emit `post_sync_score_replay_expected_zero_unmerged` instead of a false mismatch.
- Frontend direct `runUserSync` execution now uses bounded retry with jitter for retryable transient failures (timeouts/network failures and `429/5xx`, honoring `Retry-After` when present) while keeping non-retryable auth/conflict failures immediate.
- Authored PR discovery now performs a deterministic fresh-first created-date seed window (bounded 120-day lookback) before incremental/backfill scans, improving visibility of newly opened PRs while preserving bounded historical backfill behavior.
- Settings sync diagnostics now surface a dedicated "recent seeded window empty" outcome when the fresh-first authored-PR sample is empty, so users can distinguish newest-window misses from broader historical discovery gaps.
- GitHub REST/GraphQL clients now retry transient transport failures (for example EOF / connection resets / idle-connection closes) with bounded backoff for safe/idempotent paths, while preserving no-retry behavior for unsafe REST mutations and context-canceled requests.
- Sync-run `last_updated_at` now reflects the newest persisted run activity timestamp (from run data) instead of request-time `now`, so Settings no longer reports misleading "Updated just now" timestamps when no new sync activity occurred.
- Sync-run list responses now omit `last_updated_at` when there are no persisted run timestamps, preventing empty accounts from rendering synthetic "Updated just now" sync-activity headers.
- Frontend account sync actions now invalidate the `["sync","runs"]` query key on success, so Settings sync activity reflects new runs immediately instead of waiting for the next polling interval.
- Settings sync diagnostics now emit an explicit bounded-sync message when `authored_pull_requests_capped=1`, clarifying that the newest PR slice was synced intentionally and older authored history will continue in later backfill runs.
- Post-sync user-sync reconciliation now executes score replay and each profile refresh/backfill step independently, records per-step `post_sync_*_{ok|failed}` metrics, and keeps processing remaining steps after intermediate failures to maximize useful evidence refresh.
- Settings sync diagnostics now surface step-specific degradation signals (`post_sync_score_replay_failed`, `post_sync_profile_refresh_failed`) so users can distinguish replay outages from profile-refresh failures.
- Settings sync activity metric summaries now include explicit post-sync step failure hints (score replay, profile refresh, PR report backfill, quest backfill) plus a “Refresh settled” marker when post-sync reconciliation completed cleanly.
- Added `scripts/review.sh` as a single local review entrypoint (repo-sync checks + targeted sync-state tests) and kept it alarm-free by design.
- Root-level research PDF assets are now expected under `docs/research/` so repository quality checks and tree documentation stay deterministic.
- Frontend backend-env loader now supports inline comments in unquoted values (for example `KEY=value # note`) while preserving quoted `#` literals, keeping `gitrank/.env` parsing consistent with real shell-style env files.
- Sync-run persistence/filtering now canonicalizes `requested_by_subject` UUID casing on both write and filter paths, reducing false misses when the same UUID appears with mixed case across services.
- User-history PR hydration now uses a bounded PR-file page-size override (`GITHUB_REPOSITORY_SYNC_PAGE_SIZE`) instead of hard-coded wide pages during child PR syncs, reducing timeout risk on large PR file listings while keeping repository/pull-request direct sync surfaces unchanged.
- Dashboard-route sync-state polling now uses a configurable user-sync run lookback limit (`NEXT_PUBLIC_GITRANK_PROFILE_SYNC_RUN_LOOKBACK_LIMIT`, default `50`) so active user runs are less likely to be dropped from freshness derivation when run history is dense.
- Frontend `runUserSync` now performs a single bounded `/api/session/refresh` recovery attempt when user-sync fails with OAuth-required (`401/403`) responses, then retries sync once so expired GitHub App user tokens can recover without forcing immediate reconnect.
- GitHub ingestor now hardens zero-discovery metric annotation by deriving `authored_pull_request_discovery_empty` (and `authored_pull_request_zero_discovery_with_history` when applicable) from selected-target counts before final status resolution, preventing false `completed` trust when authored-PR discovery yields zero targets.
- Added focused regression tests for the new sync guards: backend caps PR-file page-size overrides at `100`, frontend policy parsing validates sync-run lookback bounds, and `useProfileSyncRuns` keeps run-type/user lookback defaults wired through policy.
- Profile score-history PR references now persist PR lifecycle fields (`state`, `merged`) from `pull_requests`, so frontend contribution cards can render truthful `open/closed/merged` status without hardcoded merged labels.
- Onboarding sync surfaces now derive status from effective sync state (materialized evidence + run-state-aware) instead of raw snapshot state, reducing false "synced" reveal/analyzing states on empty evidence snapshots.
- Frontend direct user-sync execution timeout policy now defaults to a safer `120s` with a `90s` minimum clamp for `NEXT_PUBLIC_GITRANK_USER_SYNC_EXECUTION_TIMEOUT_MS`, preventing common false client aborts on bounded multi-PR sync runs.
- Sync-run polling now keeps `refetchOnReconnect` disabled in `useSyncRuns` (polling remains active) to avoid redundant reconnect fetch bursts and reduce duplicate `/api/sync/runs` calls during normal dashboard rendering and fixture smoke runs.
- Live fixture smoke assertions now explicitly include profile-sync activity fetches (`/api/sync/runs`) on dashboard tabs that consume profile freshness state, aligning smoke coverage with the real runtime sync-state contract.
- Profile projection tests now lock PR lifecycle propagation (`pull_request.state`, `pull_request.merged`) in score history entries, preventing regressions where contribution status rendering could silently collapse back to merged-only assumptions.
- Frontend backend-env bootstrapping now honors `GITRANK_ENV_FILE` first (falling back to `../gitrank/.env`), so `start.sh` and standalone frontend runtime resolve the same single env source-of-truth path.
- `gitrank/.env.example` now declares `GITRANK_ENV_FILE`, keeping frontend env-coverage checks aligned with runtime behavior and preventing source-of-truth drift during repo review checks.
- Contribution lifecycle fallback no longer defaults unknown PR state to `merged`; unknown lifecycle now resolves to `open`, preventing false merged evidence from sparse payloads.
- Sync evidence truthiness now requires persisted PR identity (`score_event_id`/`pull_request_id`/report evidence status) before treating zero-XP rows as materialized contribution evidence, reducing false “Synced” states from placeholder rows.
- GitHub ingestor sync-run list normalization now downgrades legacy `completed` user runs to `partial` when persisted authored-PR metrics indicate incomplete discovery/backfill/scope-limited outcomes, preserving truthful sync-state UX for historical rows.
- Frontend sync-run normalization now mirrors this guard by downgrading `completed` user runs to `partial` when authored-PR metrics indicate incomplete discovery/scope/backfill, keeping UI truthful even if older backend rows predate normalization.
- `scripts/review.sh` now includes `tests/account-api-sync-runs-normalization.test.ts` so sync-run normalization/filter regressions are caught in the default lightweight review gate.
- Partial-sync metric criteria are now centralized in `frontend/lib/sync/sync-run-metrics-policy.ts` and reused by API normalization plus Settings status rendering, removing duplicated condition lists and preventing frontend drift in partial/completed semantics.
- `scripts/review.sh` also includes `tests/sync-run-metrics-policy.test.ts` to lock the shared partial-sync metric contract.
- `scripts/review.sh` now also runs `tests/sync-run-diagnostics.test.ts` so sync outcome explanation ordering/phrasing regressions are caught in the lightweight local gate.
- Backend sync-failure metrics now classify strict App-auth failure causes explicitly (`app_installation_required`, `app_installation_unavailable`) so Settings diagnostics can provide deterministic installation/remediation guidance.
- `scripts/review.sh` now also runs targeted backend sync-state unit checks (`TestSyncFailureFetchedMetrics`, `TestUserSyncExecutionStatus`) before frontend sync-state tests to keep backend/frontend sync semantics aligned.
- `scripts/review.sh` now includes `tests/sync-run-activity-panel.test.tsx` alongside diagnostics policy tests so rendered sync activity copy/chips remain aligned with diagnostic semantics.

## Frontend Excellence Checklist (No-Slowdown Backlog)

Use this as the master frontend refinement backlog. Keep improvements aligned
with the no-slowdown rules above.

ABRA checklist intake note (May 17, 2026):

- This section is checklist-first by default.
- Treat unchecked items as planning gates until explicitly promoted into implementation.
- Checked items require file-level evidence plus verification commands.
- Do not mark items complete without file-level evidence and verification steps.

Baseline references for this section:

- `frontend/docs/frontend-excellence.md`
- `frontend/docs/ux-changelog.md`
- `frontend/docs/performance-and-observability.md`
- https://nextjs.org/docs/app/guides/production-checklist
- https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
- https://web.dev/articles/defining-core-web-vitals-thresholds
- https://web.dev/articles/vitals
- https://web.dev/articles/optimize-cls
- https://owasp.org/www-project-secure-headers/
- https://almanac.httparchive.org/en/2025/performance

Cyberpunk inspiration references (style direction only, no copy-paste):

- https://github.com/cyberpunk-ui
- https://gist.github.com/bo0ts/3723433

Inspiration usage rule:

- Extract palette/mood/layout language only (contrast, hierarchy, accent strategy, typography vibe).
- Re-implement with GitRank tokens/components and accessibility/performance rules.
- Do not copy source CSS/theme files or component markup verbatim.

### A. Product Direction and UX

- [x] Define 3 primary user journeys (new user onboarding, returning contributor, profile sharing).
- [x] For each journey, define one clear success moment (for example: first synced PR shown, first badge earned, public profile shared).
- [x] Remove dead-end screens; every page should have a clear next action.
- [x] Ensure empty states always show recovery paths (sync, retry, navigate, docs).
- [x] Ensure stale states are visible and understandable (last refresh time + what to do next).
- [x] Use bounded automatic authenticated-route sync instead of a manual "Sync now" button dependency; surface stale/partial states while auto-refresh runs.

### B. Design System and Visual Consistency

- [x] Create a single design token layer (color, spacing, radius, shadow, motion, z-index).
- [x] Standardize typography scale (display, heading, body, caption) and line-height rules.
- [x] Standardize corner radius scale across all surfaces (cards, buttons, modals, inputs).
- [x] Standardize glow/neon intensity levels (subtle, medium, hero) to avoid visual noise.
- [x] Standardize icon sizes and stroke weight.
- [x] Ensure all components support light-content-on-dark contrast without readability loss.
- [x] Create component-state spec: default, hover, focus, active, disabled, loading, error.

### C. Information Architecture and Navigation

- [x] Validate sidebar and mobile nav use identical route semantics.
- [x] Ensure route naming is user-language, not backend-language.
- [x] Add consistent page header structure: title, purpose sentence, key action(s).
- [x] Ensure deep links work for shareable views (profile, PR report, leaderboard states).
- [x] Add route-level 404 and global not-found UX consistency.

### D. Accessibility (WCAG 2.2 aligned)

- [x] Ensure keyboard focus is always visible on interactive elements.
- [x] Ensure pointer targets are at least 24x24 CSS px where required.
- [x] Validate color contrast for text and non-text UI indicators.
- [x] Ensure meaningful accessible names/labels on all controls.
- [x] Ensure form errors are announced clearly and linked to specific inputs.
- [x] Ensure auth flows avoid cognitive-only challenges where possible.
- [x] Respect reduced-motion preferences (`prefers-reduced-motion`) globally.
- [x] Use ARIA APG patterns for tabs, dialogs, menus, and custom widgets.

### E. Motion, Interactions, and Gamification Polish

- [x] Keep motion purposeful: state change, hierarchy reveal, feedback.
- [x] Remove decorative motion that does not communicate state.
- [x] Cap animation duration and easing consistency across the app.
- [x] Ensure animated progress (XP bars, streaks) has static text equivalent.
- [x] Ensure leaderboard/badge effects degrade cleanly when reduced motion is on.
- [x] Add micro-feedback on meaningful actions (sync complete, badge unlocked, share copied).

### F. Performance and Core Web Vitals

- [x] Set CWV budgets: p75 LCP <= 2.5s, INP <= 200ms, CLS <= 0.1.
- [x] Track field CWV (not lab-only) and report by route group.
- [x] Add width/height or aspect-ratio for all media to prevent CLS.
- [x] Audit fonts for layout-shift risk and loading behavior.
- [x] Defer non-critical scripts and reduce third-party JS overhead.
- [x] Avoid long main-thread tasks that hurt INP.
- [x] Keep heavy interactions smooth on secondary pages, not only homepage.

### G. Next.js Production Hardening

- [x] Use `next build` + `next start` as pre-release baseline checks.
- [x] Run Lighthouse in incognito and compare with field data.
- [x] Use `next/image`, `next/font`, and `next/script` best practices consistently.
- [x] Add or maintain global error UI and global 404 UI.
- [x] Confirm caching strategy per route/data fetch (avoid accidental dynamic overuse).
- [x] Run bundle analysis and trim oversized dependencies/chunks.
- [x] Keep server-only boundaries strict for sensitive code/data.

### H. Security and Privacy UX Layer

- [x] Enforce CSP with report-only rollout first, then enforce.
- [x] Add or verify secure browser headers policy for frontend responses.
- [x] Ensure no secrets leak through client payloads or public env vars.
- [x] Ensure auth/session actions have explicit user feedback and safe failure states.
- [x] Ensure analytics payloads are bounded and exclude sensitive data.

### I. SEO, Social, and Shareability

- [x] Use Metadata API on all major routes.
- [x] Ensure OG/Twitter image coverage for profile and marketing routes.
- [x] Ensure sitemap and robots are valid and current.
- [x] Ensure share cards are visually consistent with in-app identity framing.
- [x] Validate canonical URLs for public profile and PR report pages.

### J. Quality Engineering and Regression Safety

- [x] Add route-level visual regression checks for key pages.
- [x] Add accessibility CI checks (axe/Pa11y/Lighthouse accessibility).
- [x] Expand smoke tests to include sync/stale/error state transitions.
- [x] Add contract tests for BFF route mappings to backend endpoints.
- [x] Add performance CI budgets (bundle size plus selected Lighthouse/CWV guards).

### K. Observability for Frontend UX

- [x] Instrument key product events (onboarding, sync, score explanation, badge view, share).
- [x] Add route-level error-rate dashboards.
- [x] Track stale-profile incidence and sync retry outcomes.
- [x] Track no-data or empty-state frequency per page.

### L. Delivery Discipline

- [x] Create a prioritized 30/60/90 day roadmap (critical, important, polish).
- [x] Run a weekly refinement loop with before/after screenshots and metric diffs.
- [x] Keep a changelog of UX-impacting frontend decisions.

Verification snapshot (May 17, 2026):

- `cd frontend && npm run lint`
- `cd frontend && npm run typecheck`
- `cd frontend && npm run build`
- `cd frontend && npm run start -- --port 4111`
- `cd frontend && npm run test:smoke`
- `cd frontend && npm run test:visual`
- `cd frontend && npm run test:a11y`
- `cd frontend && npm run test:contracts`
- `cd frontend && npm run check:backend-gateway-route-parity`
- `cd frontend && npm run check:auth-service-route-parity`
- `cd frontend && npm run check:bff-route-contract-coverage`
- `cd frontend && npx vitest run tests/meta-services-route.test.ts tests/service-manifests-api.test.ts tests/meta-api.test.ts tests/public-profile-hero-card-link.test.ts`
- `cd frontend && npm run check:no-production-mocks`
- `cd frontend && npm run check:pr-category-policy`
- `cd frontend && npm run check:contribution-dedup-policy`
- `cd frontend && npm run check:jsx-ids`
- `cd frontend && npm run check:client-env-safety`
- `cd frontend && npm run check:server-boundaries`
- `cd frontend && npm run check:cache-strategy`
- `cd frontend && npm run check:route-state-primitives`
- `cd frontend && npm run check:contrast`
- `cd frontend && npm run check:radius-tokens`
- `cd frontend && npm run check:progress-names`
- `cd frontend && npm run check:image-alt`
- `cd frontend && npm run check:role-img-names`
- `cd frontend && npm run check:button-names`
- `cd frontend && npm run check:link-names`
- `cd frontend && npm run check:inline-notice-placeholders`
- `cd frontend && npm run check:focus-without-scroll`
- `cd frontend && npm run check:media-stability`
- `cd frontend && npm run check:native-button-type`
- `cd frontend && npm run check:input-names`
- `cd frontend && npm run check:main-landmark`
- `cd frontend && npm run check:navigation-landmarks`
- `cd frontend && npm run check:main-thread`
- `cd frontend && npm run check:scroll-jumps`
- `cd frontend && npm run check:stale-refresh-sync`
- `cd frontend && npm run check:perf-budgets`
- `cd frontend && npm run analyze:bundle`
- `mkdir -p ai_test/frontend-evidence/weekly-$(date +%F)`
- `cd frontend && npx lighthouse http://localhost:4113/ --chrome-flags='--headless --incognito --no-sandbox --disable-gpu --disable-software-rasterizer --disable-dev-shm-usage' --output=json --output-path=../ai_test/frontend-evidence/weekly-$(date +%F)/lighthouse-home.json`
- `cd frontend && npx playwright screenshot --full-page http://localhost:4113/dashboard ../ai_test/frontend-evidence/weekly-$(date +%F)/playwright-dashboard.png`
- Keep generated screenshot and Lighthouse JSON artifacts in `/ai_test`; track only durable scripts, tests, or summarized evidence such as `frontend/docs/evidence/weekly-2026-05-17/README.md`.
- Backend-to-frontend route parity matrix is tracked in `gitrank/docs/backend-frontend-coverage.md`.

### Review expectations

- Review for correctness first.
- Review for security second.
- Review for operability third.
- Review for maintainability fourth.
- Do not approve code you would not want to own in production.

## Branching and Commit Hygiene

- Use short-lived feature branches.
- Prefer atomic commits with meaningful messages.
- Rebase or merge main frequently enough to avoid stale branch drift.
- Do not mix refactors, infra changes, and product logic in one PR unless tightly coupled.

Recommended commit style:

- `feat: add GitHub installation token manager`
- `fix: prevent duplicate PR ingestion jobs`
- `docs: expand scoring design and threat model`
- `chore: add CodeQL and dependency review workflows`

## Development Workflow

1. Understand the target behavior first.
2. Read the relevant service and package boundaries before editing.
3. Design the change at the contract level.
4. Implement the smallest production-grade version of the change.
5. Add or update tests.
6. Update docs.
7. Run verification locally.
8. Self-review the diff.

## Local Development Expectations

The current project uses a Go workspace with multiple modules.

Contributors should be comfortable working with:

- `go.work`
- per-service `go.mod` files
- shared packages used across service boundaries

Useful commands from `gitrank/`:

```bash
go env GOWORK
go work sync
make -C gitrank test
```

When working on one module in isolation:

```bash
GOWORK=off go test ./...
```

## Definition of a Good First Production Contribution

A good early contribution is one that reduces ambiguity or adds a reusable foundation.

Examples:

- define shared API error envelopes
- add config loading and validation
- add structured logging primitives
- create base database migration tooling
- add webhook signature verification middleware
- define scoring event contracts
- add issue templates, PR templates, and security policy docs
- add CI with lint, tests, vuln scanning, and code scanning

Examples that are too early unless properly designed:

- leaderboard polish without score design
- badge UI without badge data model
- profile animations before profile contracts
- ranking formulas hidden inside prompt text

## Master Production Checklist

This is the main checklist for what remains to be done.

## 1. Community Health and Open Source Governance

- [x] Add a project license.
- [x] Add a `CODE_OF_CONDUCT.md`.
- [x] Add a `SECURITY.md`.
- [x] Add issue templates for bug reports, feature requests, architecture proposals, and scoring disputes.
- [x] Add a pull request template.
- [x] Add a `CODEOWNERS` file.
- [x] Define repository labels.
- [x] Define milestone strategy.
- [x] Define release versioning strategy.
- [x] Define support expectations for contributors and users.
- [x] Decide whether the project uses CLA, DCO, or neither.
- [x] Add a roadmap document under `gitrank/docs/`.
- [x] Add ADRs for major architecture decisions.
- [x] Add a maintainer guide for triage and release operations.

Why this matters:

- GitHub surfaces `CONTRIBUTING.md`, `SECURITY.md`, issue templates, PR templates, and code ownership directly in repository workflows.
- A public project without community health files looks unfinished and is harder to scale safely.

Settled v1 policy:

- GitRank uses DCO, not CLA.
- Maintainer operations are documented in `gitrank/docs/MAINTAINER_GUIDE.md`.

## 2. Product Definition and Scoring Credibility

- [x] Define the exact GitRank scoring thesis in one formal design doc.
- [x] Define the list of supported contribution categories.
- [x] Define what counts as meaningful work.
- [x] Define what counts as spam or low-signal work.
- [x] Define how merged, closed, draft, and abandoned PRs are treated.
- [x] Define how review quality affects score.
- [x] Define how repository significance affects score.
- [x] Define whether private repositories are in scope.
- [x] Define how organizations and team-owned repositories are handled.
- [x] Define how self-merged PRs are handled.
- [x] Define how bot-authored or bot-assisted PRs are handled.
- [x] Define how documentation-only work is scored fairly.
- [x] Define how test-only work is scored fairly.
- [x] Define how large churn with low value is discounted.
- [x] Define how contributor consistency is rewarded.
- [x] Define how score recalculation works when the formula changes.
- [x] Define whether users can appeal or dispute scores.
- [x] Define whether scores are versioned and reproducible.
- [x] Define fairness checks to reduce bias toward only popular repositories.

Required deliverables:

- [x] `gitrank/docs/scoring-model.md`
- [x] `gitrank/docs/anti-gaming.md`
- [x] `gitrank/docs/fairness-and-limitations.md`

Settled policy decisions:

- Private repositories are out of scope and do not count toward GitRank.
- Public organization-owned repositories are in scope and are treated like any other public repository.
- Self-merged pull requests do not count toward GitRank.
- Bot-authored and bot-assisted pull requests do not count toward GitRank.

## 3. Architecture Baseline

- [x] Decide whether the backend will be synchronous HTTP only, event-driven, or hybrid.
- [x] Define service-to-service communication style.
- [x] Define canonical API contracts.
- [x] Define event schemas.
- [x] Define idempotency strategy.
- [x] Define retry semantics.
- [x] Define correlation IDs and request IDs.
- [x] Define timeout budgets between services.
- [x] Define service ownership boundaries.
- [x] Define the canonical source of truth for user profile aggregates.
- [x] Define how recomputation jobs are triggered and replayed.
- [x] Define how historical re-scoring works.

Required output:

- [x] Architecture decision records.
- [x] A system context diagram.
- [x] A sequence diagram for sign-in, ingest, analyze, score, and profile refresh.
- [x] A failure-mode diagram for webhook retries and backfills.

## 4. Data Model and Persistence

- [x] Choose PostgreSQL version and baseline extensions.
- [x] Design relational schema for users, GitHub accounts, repositories, PRs, reviews, analyses, scores, badges, snapshots, jobs, and audits.
- [x] Define which data is immutable and which is recomputed.
- [x] Add a migration tool and migration directory.
- [x] Define primary keys and uniqueness constraints.
- [x] Define idempotent upsert behavior for GitHub entities.
- [x] Define soft-delete versus hard-delete policy.
- [x] Define audit logging for security-sensitive changes.
- [x] Define retention policy for raw ingestion payloads.
- [x] Define retention policy for AI prompts and outputs.
- [x] Define backup and restore procedures.
- [x] Define database indexing strategy.
- [x] Define partitioning strategy if high event volume is expected.
- [x] Define PII classification and storage rules.
- [x] Encrypt sensitive tokens and credentials at rest.

Required implementation work:

- [x] `gitrank/docs/data-model.md`
- [x] `gitrank/deployments/` database bootstrap assets
- [x] database migrations
- [x] seed data for local development only

Settled v1 policy docs:

- `gitrank/docs/data-model.md`
- `gitrank/docs/privacy-and-data-handling.md`
- `gitrank/docs/infrastructure-baseline.md`

## 5. API Gateway Checklist

Target directory:

- `gitrank/services/api-gateway`

Must be implemented:

- [x] HTTP server bootstrap
- [x] structured request logging
- [x] request ID middleware
- [x] panic recovery middleware
- [x] auth middleware
- [x] CORS policy
- [x] rate limiting
- [x] API versioning
- [x] input validation
- [x] consistent error envelopes
- [x] health endpoints
- [x] readiness endpoints
- [x] metrics endpoint or exporter integration
- [x] graceful shutdown
- [x] pagination conventions
- [x] caching headers where appropriate
- [x] public profile endpoints
- [x] authenticated user endpoints
- [x] sync trigger endpoints
- [x] no admin-only endpoints in v1 by policy

Production-grade expectations:

- [x] OpenAPI or equivalent contract doc exists.
- [x] Endpoint auth requirements are documented.
- [x] Error codes are documented.
- [x] Breaking change policy is documented.

## 6. Auth Service Checklist

Target directory:

- `gitrank/services/auth-service`

Must be implemented:

- [x] GitHub OAuth flow
- [x] CSRF-safe OAuth state handling
- [x] session or token issuance
- [x] token refresh or session rotation strategy
- [x] secure cookie policy if cookie-based
- [x] role model for admin or maintainer access
- [x] account linking and unlinking flows
- [x] logout and session invalidation
- [x] revoked or expired credential handling
- [x] least-privilege OAuth scopes
- [x] audit events for auth-sensitive actions

Security requirements:

- [x] no raw secrets in logs
- [x] encrypted secret storage
- [x] replay protection where relevant
- [x] session fixation protection
- [x] brute-force mitigation where relevant

## 7. GitHub Ingestor Checklist

Target directory:

- `gitrank/services/github-ingestor`

This service is one of the highest-risk parts of the system because reliability, cost, and trust depend on it.

Must be implemented:

- [x] GitHub OAuth support for sign-in/session identity only
- [x] GitHub App installation authentication is required for PR/repo extraction paths
- [x] installation token lifecycle handling is implemented for strict extraction routes
- [x] webhook receiver
- [x] webhook signature validation
- [x] webhook replay protection
- [x] webhook event deduplication
- [x] webhook retry safety
- [x] REST API client
- [x] GraphQL API client
- [x] pagination utilities
- [x] ETag or conditional request support where useful
- [x] rate limit tracking
- [x] secondary rate limit backoff
- [x] queue-based backfill jobs
- [x] repository sync logic
- [x] pull request sync logic
- [x] review sync logic
- [x] issue and label sync logic
- [x] commit metadata sync logic
- [x] normalized persistence layer
- [x] dead-letter handling for poison jobs

GitHub-specific requirements:

- [x] verify webhook payloads before processing
- [x] record GitHub delivery IDs for idempotency
- [x] document and request the minimum OAuth scopes needed in v1
- [x] support re-sync after missed webhooks
- [x] support historical backfill without double-counting
- [x] document REST versus GraphQL usage rules
- [x] document GitHub API rate-limit strategy

Operational requirements:

- [x] ingestion failures are visible in metrics and alerts
- [x] manual requeue exists
- [x] backfill jobs are cancelable
- [x] sync jobs are traceable per user and per repo

Current preview state:

- webhook delivery deduplication and requeue state persist in PostgreSQL when `DATABASE_URL` is configured
- webhook-driven repository, PR, review, issue, label, commit, installation, and sync-run entities persist idempotently in PostgreSQL when `DATABASE_URL` is configured
- `POST /v1/sync/repository/execute` now performs a bounded live repository sync against the public GitHub REST API and persists repository, pull request, review, issue, and commit data directly
- `POST /v1/sync/user/execute` now performs a bounded live user sync by walking recent public repositories owned by the requested GitHub login, discovering recent authored public PRs through GitHub issue/PR search, and delegating concrete repositories and PRs to the existing repository and PR executors
- `POST /v1/sync/installation/execute` now prefers live GitHub App installation repository inventory plus installation-token-authenticated repository sync when App credentials are configured, and falls back to persisted installation-repository associations when App auth is unavailable
- `POST /v1/sync/pull-request/execute` now performs a bounded live pull-request sync and persists the PR, bounded changed-file metadata, public patch excerpts, reviews, and review comments directly
- `POST /v1/sync/review/execute` now performs a bounded live review sync by refreshing the review surface for one PR number and persisting bounded changed-file metadata, public patch excerpts, reviews, and review comments directly
- `POST /v1/sync/issue/execute` now performs a bounded live issue sync and persists one standalone issue plus its labels directly
- `POST /v1/sync/commit/execute` now performs a bounded live commit sync and persists one public commit directly
- manual sync requests also persist queued sync-run records and are queryable by user, repository, subject, requester, correlation ID, and delivery ID
- scheduler-worker queue jobs, dead letters, recurring backfill plans, rate-limit windows, and scheduler counters now persist in dedicated PostgreSQL tables when `DATABASE_URL` is configured, survive process restarts, and serialize leases, ticks, plan updates, and queue mutations across scheduler instances
- the latest queued or leased recurring backfill run can now be canceled per plan via its recorded correlation ID, and worker completion preserves that canceled terminal state instead of silently marking it completed

## 8. PR Analyzer Checklist

Target directory:

- `gitrank/services/pr-analyzer`

This service should combine deterministic feature extraction with AI assistance.

Deterministic feature extraction:

- [x] file change classification
- [x] language detection
- [x] docs-only detection
- [x] test-change detection
- [x] config or infra change detection
- [x] refactor heuristics
- [x] code churn normalization
- [x] directory criticality tagging
- [x] issue linkage extraction
- [x] review cycle counting
- [x] requested-changes detection
- [x] maintainer interaction signals

AI-assisted analysis:

- [x] prompt design documented
- [x] structured JSON output format defined
- [x] prompt versioning implemented
- [x] model fallback behavior defined
- [x] output validation implemented
- [x] confidence or uncertainty handling defined
- [x] prompt and response retention policy defined
- [x] hallucination guardrails implemented
- [x] token and cost budgets defined

Quality bar:

- [x] representative evaluation dataset exists
- [x] regression tests for classification exist
- [x] false positive and false negative cases are tracked
- [x] model output is never trusted without schema validation
- [x] AI does not directly write final scores without deterministic scoring logic

## 9. Scoring Engine Checklist

Target directory:

- `gitrank/services/scoring-engine`

The scoring engine is the core product asset. It must be auditable.

Must be implemented:

- [x] deterministic scoring pipeline
- [x] versioned scoring formula
- [x] weighted factors defined in code and docs
- [x] explainability output for each scored contribution
- [x] user-level aggregate score computation
- [x] skill dimension computation
- [x] badge issuance logic
- [x] level progression logic
- [x] anti-spam penalties
- [x] diminishing returns rules
- [x] consistency multiplier rules
- [x] repository weighting rules
- [x] merge outcome weighting rules
- [x] re-score and replay jobs
- [x] score event ledger
- [x] historical score snapshots

Credibility requirements:

- [x] a user can see why a contribution was scored the way it was
- [x] formula changes are versioned
- [x] scores can be recomputed from stored evidence
- [x] hidden manual overrides are prohibited or tightly audited
- [x] score disputes have an operational path

## 10. Profile Service Checklist

Target directory:

- `gitrank/services/profile-service`

Must be implemented:

- [x] public profile read model
- [x] authenticated profile read model
- [x] contribution timeline
- [x] top repositories view
- [x] top skill areas view
- [x] level and XP view
- [x] badge listing
- [x] score history view
- [x] profile summary caching
- [x] privacy or visibility controls
- [x] shareable profile card data

Product requirements:

- [x] profile explains strengths without overstating certainty
- [x] trend lines clearly reflect time windows
- [x] profile data is refreshed predictably
- [x] stale profile states are visible or handled

## 11. Scheduler and Async Job System Checklist

Target directory:

- `gitrank/services/scheduler-worker`

Must be implemented:

- [x] job queue selection
- [x] cron scheduling
- [x] retry policy
- [x] exponential backoff
- [x] dead-letter queue
- [x] idempotent job handling
- [x] concurrency controls
- [x] per-user and per-installation rate controls
- [x] job cancellation or pausing support
- [x] manual replay support
- [x] backfill orchestration
- [x] observability for queue depth and failures

Current preview state:

- recurring backfill plans can be created, paused, resumed, canceled for their latest queued run, manually ticked, and deleted through `scheduler-worker`
- queue inspection supports filters for user, repository, installation, status, type, subject, and correlation ID
- the worker-mode scheduler process can execute bounded `sync.installation`, `sync.repository`, `sync.user_history`, `sync.pull_request`, `sync.review`, `sync.issue`, and `sync.commit` jobs through `github-ingestor`, with completion, retry, and dead-letter behavior surfaced on the scheduler queue
- bounded installation execution now supports live GitHub App installation repository discovery and installation-token-authenticated repository sync when App credentials are configured, with persisted installation repositories as fallback
- bounded user execution currently means recent public owned repositories plus recent public authored PRs discoverable through GitHub issue/PR search, not a full GitHub-wide historical contribution backfill
- bounded review execution currently means "refresh the reviews and review comments for one PR number", not a review-id-specific sync
- manual worker execution is exposed through `POST /v1/jobs/run-once`
- queue jobs, dead letters, recurring plans, rate-limit windows, and scheduler counters persist in dedicated PostgreSQL tables when `DATABASE_URL` is configured, and persistent mode serializes multi-instance leases, ticks, and control-plane mutations through the shared counters row
- the legacy `scheduler_runtime_states` JSONB snapshot table is now only a compatibility import path for pre-normalized scheduler state

## 12. Shared Packages Checklist

### `gitrank/packages/contracts`

- [x] define request and response DTOs
- [x] define event payloads
- [x] define versioning policy
- [x] avoid circular dependency traps

### `gitrank/packages/logger`

- [x] structured logger
- [x] log levels
- [x] correlation ID helpers
- [x] PII redaction helpers

### `gitrank/packages/config`

- [x] typed config structs
- [x] env parsing
- [x] config validation
- [x] sane defaults
- [x] fail-fast on invalid config

### `gitrank/packages/errors`

- [x] typed domain errors
- [x] transport-safe mapping
- [x] internal versus external error distinction

### `gitrank/packages/events`

- [x] event schemas
- [x] publisher interface
- [x] subscriber interface
- [x] versioning rules

### `gitrank/packages/authkit`

- [x] auth helpers
- [x] token helpers
- [x] middleware primitives
- [x] permission checks

## 13. Frontend and User Experience Checklist

The repo now contains a tracked Next.js frontend with root-level frontend CI plus repo-wide secret and Trivy scanning. Public profile reads plus authenticated dashboard, badge, contribution, leaderboard, settings, sync, disconnect, account-deletion, quest recommendation, and PR battle-report flows are live. The frontend also has season/rank progression presentation, player-card public profiles, quest recommendation evidence, badge rarity styling, PR battle-report explanation panels, and an account-backed reduced-gamification display preference for signed-in users. Production app routes no longer include demo preview modes; remaining sample data is isolated to marketing, tests, or fixtures.

Must be defined or built:

- [x] frontend technology choice
- [x] dashboard information architecture
- [x] public profile page
- [x] authenticated account settings
- [x] OAuth onboarding flow
- [x] sync status UI
- [x] contribution drill-down UI
- [x] score explanation UI
- [x] badge and level UI
- [x] season leaderboard and rank-progress UI
- [x] profile player-card UI
- [x] quest panel recommendation evidence
- [x] reduced-gamification display preference
- [x] privacy controls UI
- [x] empty, loading, error, and stale states
- [x] mobile-responsive layout
- [x] accessibility baseline
- [x] analytics and event tracking plan

UX quality requirements:

- [x] avoid overstating score confidence
- [x] clearly distinguish inferred versus deterministic information
- [x] do not shame low-score contributors
- [x] make score explanations legible to non-experts

## 14. API and Contract Documentation Checklist

- [x] publish OpenAPI specs or equivalent
- [x] define JSON error format
- [x] define pagination format
- [x] define filtering and sorting conventions
- [x] define auth scheme
- [x] define idempotency expectations
- [x] define rate-limit headers if exposed
- [x] define webhook receiver contract if externalized
- [x] publish examples for main endpoints

## 15. Testing Strategy Checklist

Testing cannot be an afterthought in a scoring product.

Unit tests:

- [x] scoring helpers
- [x] config validation
- [x] auth flows
- [x] GitHub signature verification
- [x] parsing and normalization
- [x] AI output validation

Integration tests:

- [x] DB repositories
- [x] service HTTP handlers
- [x] queue workers
- [x] GitHub API client adapters
- [x] migration safety

Contract tests:

- [x] internal service contracts
- [x] API response compatibility
- [x] event schema compatibility

End-to-end tests:

- [x] GitHub sign-in
- [x] initial sync
- [x] PR ingestion
- [x] analysis
- [x] score generation
- [x] profile rendering

These are covered by local critical-path flow tests, not a live browser test against GitHub production OAuth. `make test-critical-path-flows` starts a temporary PostgreSQL container, applies migrations, and runs the targeted OAuth, sync, ingestion, analysis, scoring, and profile tests used by the CI release gate.

Specialized tests:

- [x] fuzz tests for parsers and webhook validation paths
- [x] regression tests for scoring edge cases
- [x] load tests for sync bursts
- [x] race detection in concurrent components
- [x] failure injection for retries and backoffs

Release gate:

- [x] no production release without automated tests on critical paths

## 16. Security Checklist

GitRank handles auth, user profile data, API integrations, and potentially sensitive contribution metadata. Security has to be built in from the start.

Repository security:

- [ ] enable dependency graph
- [ ] enable Dependabot alerts
- [x] add `dependabot.yml`
- [x] enable dependency review in pull requests
- [x] enable CodeQL code scanning
- [x] enable secret scanning where available
- [ ] protect the default branch or apply repository rulesets
- [ ] require pull request review before merge
- [ ] require status checks before merge
- [x] keep `CODEOWNERS`, but do not require CODEOWNERS approval in v1

Apply live GitHub repository-admin controls with `gitrank/docs/runbooks/github-repository-controls.md`, either through GitHub settings or `make apply-github-repository-controls`, then verify them with `make verify-github-repository-controls`. Use `make discover-github-required-status-checks` to fetch current check names before applying branch rules. The verifier proves either branch-protection or branch-ruleset enforcement, and these boxes must stay unchecked until the live GitHub settings are applied and verified against the actual repository.
When no static admin token or GitHub App credentials are available, opt in to
OAuth web-flow token bootstrap by setting
`GITRANK_ALLOW_OAUTH_WEB_TOKEN_BOOTSTRAP=yes` on apply/verify commands.
Once credentials and observability endpoints are available, `make -C gitrank verify-and-mark-live-external-gates` can run both live verifiers and mark the related external-live checklist items in this file automatically.

Application security:

- [x] threat model the full system
- [x] validate all external input
- [x] constrain outbound network behavior where possible
- [x] protect against SSRF in webhook or callback flows
- [x] encrypt secrets at rest
- [x] rotate secrets safely
- [x] separate prod and non-prod credentials
- [x] redact secrets from logs
- [x] define incident response flow
- [x] define vulnerability disclosure flow
- [x] define abuse and fraud response flow

Staging and production ExternalSecret examples use distinct remote secret-manager paths and are checked by `make verify-secret-policy`. Auth/session and GitHub OAuth token-encryption material now support current-plus-previous key rings through `GITRANK_PREVIOUS_SESSION_SECRETS` and `GITHUB_PREVIOUS_TOKEN_ENCRYPTION_KEYS`; live rotation rehearsals still need to be recorded in maintainer operations notes before production launch.

Go-specific security:

- [x] run `govulncheck`
- [x] audit unsafe or reflection-heavy code paths
- [x] avoid insecure random sources for secrets or nonces
- [x] use timeouts on network clients
- [x] avoid unbounded request bodies

Container and artifact security:

- [x] minimal runtime images
- [x] non-root containers
- [x] image scanning in CI
- [x] SBOM generation
- [x] artifact signing deferred until post-v1 hardening
- [x] provenance attestations deferred until post-v1 hardening

## 17. Supply Chain and Release Integrity Checklist

- [x] define build reproducibility goals
- [x] use an unsigned v1 release flow and defer signing
- [x] generate SBOMs for release artifacts
- [x] publish artifact checksums
- [x] do not require provenance metadata in v1
- [x] document trusted builders and release workflow
- [x] tag releases consistently
- [x] avoid manual untracked release steps

Target maturity:

- [x] align production release decisions with two-person review expectations
- [x] defer Sigstore or equivalent signing workflow until post-v1 hardening
- [x] measure repo hygiene with OpenSSF Scorecard or equivalent

## 18. Observability Checklist

Observability is required for trust and operations.

Logging:

- [x] structured logs
- [x] log correlation IDs
- [x] no raw secrets or tokens
- [x] clear service and component names

Metrics:

- [x] HTTP request counts and latency
- [x] queue depth
- [x] job retries
- [x] GitHub API rate-limit usage
- [x] sync duration
- [x] analysis cost and token usage
- [x] score computation duration
- [x] cache hit rate
- [x] error rate by service

Tracing:

- [x] distributed traces across gateway, ingestion, analysis, scoring, and profile services
- [x] trace async job boundaries
- [x] trace external GitHub and AI provider calls

Dashboards and alerts:

- [x] service health dashboards
- [x] error budget or SLO dashboards
- [x] alerts for sync backlog
- [x] alerts for webhook failures
- [x] alerts for auth failures
- [x] alerts for elevated AI cost
- [x] alerts for scoring job failures

Prometheus and Grafana Kubernetes manifests are rendered by `kubectl kustomize gitrank/deployments/observability` and verified by `make verify-observability-manifests`. The Makefile verification targets pass `TMPDIR` through to avoid relying on small system `/tmp` mounts. Production observability remains unchecked until the stack is actually deployed and connected to production traffic.

## 19. Reliability and SRE Checklist

- [x] define SLOs and SLIs
- [x] define RTO and RPO expectations
- [x] add graceful shutdown to all services
- [x] ensure idempotent retries
- [x] define backpressure behavior
- [x] add circuit breaker or equivalent protections where needed
- [x] define degraded-mode behavior if AI provider is unavailable
- [x] define degraded-mode behavior if GitHub API is rate-limited
- [x] create runbooks for common failure modes
- [x] add chaos or fault-injection tests for critical paths

## 20. Performance and Scalability Checklist

- [x] benchmark ingestion throughput
- [x] benchmark scoring throughput
- [x] benchmark profile read latency
- [x] batch GitHub API calls where possible
- [x] cache stable repository metadata
- [x] avoid N+1 query patterns
- [x] tune DB indexes against real query shapes
- [x] plan for backfills at scale
- [x] plan for horizontal worker scaling
- [x] cap AI cost per PR or per sync run

Repository/PR/review execute routes now run through strict installation-token-authenticated sync runtime. OAuth-linked GraphQL hydration is disabled in that strict path so extraction remains GitHub-App-only end to end.

## 21. Privacy, Data Handling, and Compliance Checklist

GitRank may expose reputational data about real people. That increases the standard.

- [x] define exactly what user data is stored
- [x] define legal basis and privacy posture for public GitHub data usage
- [x] define deletion and account removal flow
- [x] define retention windows
- [x] define whether raw PR diffs are stored or re-fetched
- [x] define whether AI providers receive raw code snippets or summaries only
- [x] minimize transmitted and retained data
- [x] let users understand what data powers their score
- [x] let users request re-sync or deletion
- [x] document privacy limitations clearly
- [x] document known fairness limitations clearly

## 22. Deployment and Infrastructure Checklist

- [x] choose cloud or self-host baseline
- [x] choose runtime packaging strategy
- [x] add IaC
- [x] define dev, staging, and prod environments
- [x] define environment promotion process
- [x] define secret management system
- [x] define database backup automation
- [x] define restore drills
- [x] define TLS termination model
- [x] define DNS and domain ownership
- [x] define rollout strategy
- [x] define rollback strategy
- [x] define zero-downtime migration strategy
- [x] define cost monitoring and budget alerts

Kubernetes rollback wiring is locally verified by `make verify-rollback-procedure`, which renders staging and production overlays using the configured `TMPDIR` and checks the manual deploy workflow contains rollout history, undo, and status gates. A live production rollback drill is still required before checking the final production-readiness rollback gate.
Use `gitrank/docs/runbooks/production-rollback-drill.md` for the live drill, record evidence with `gitrank/docs/evidence/rollback-drill-*.txt`, and validate the filled record via `make verify-rollback-drill-evidence`.

Deployment assets to add:

- [x] `gitrank/deployments/compose/` for local stack
- [x] `gitrank/deployments/k8s/` or equivalent if Kubernetes is chosen
- [x] CI deployment workflows
- [x] environment sample files

## 23. CI/CD Checklist

- [x] run formatting checks
- [x] run linting
- [x] run unit tests
- [x] run integration tests
- [x] run `go test -race` where feasible
- [x] run `govulncheck`
- [x] run dependency review
- [x] run CodeQL
- [x] run secret scanning or equivalent checks
- [x] run container or filesystem vulnerability scans
- [x] build artifacts in CI
- [x] use an unsigned v1 release flow and defer signing
- [ ] enforce required checks before merge
- [ ] prevent direct pushes to protected branches

Required-check enforcement is a live GitHub branch-protection or ruleset setting. Use `gitrank/docs/runbooks/github-repository-controls.md`, `make apply-github-repository-controls`, and `make verify-github-repository-controls` (supports branch protection and rulesets) before checking these items.
The same flow supports on-demand OAuth web-flow bootstrap with
`GITRANK_ALLOW_OAUTH_WEB_TOKEN_BOOTSTRAP=yes`.

## 24. Documentation Checklist

- [x] keep `README.md` current
- [x] keep this file current
- [x] add architecture docs
- [x] add data model docs
- [x] add scoring docs
- [x] add threat model docs
- [x] add runbooks
- [x] add onboarding guide
- [x] add local setup guide
- [x] add release guide
- [x] add troubleshooting guide
- [x] add glossary for product and scoring terms

## 25. Product Analytics and Feedback Checklist

- [x] define what usage analytics are collected
- [x] define opt-in or opt-out policy where needed
- [x] track onboarding completion
- [x] track sync success rate
- [x] track profile view behavior
- [x] track score explanation usage
- [x] track badge engagement carefully
- [x] avoid collecting more analytics than needed
- [x] define feedback loop for incorrect scores or classifications

## 26. Abuse Prevention Checklist

GitRank must assume users will try to optimize for score.

- [x] define anti-spam detection rules
- [x] detect micro-PR farming
- [x] detect cosmetic change inflation
- [x] detect mass low-value repository targeting
- [x] discount repetitive low-signal contribution patterns
- [x] monitor suspicious self-merge patterns
- [x] decide how to treat bot-generated contributions
- [x] decide how to treat organization-internal review loops
- [x] decide how to treat repository ownership conflicts of interest
- [x] create moderation paths for abuse cases

## 27. Open Questions That Must Be Settled Before Production

- [x] Should GitRank use GitHub App installation auth, OAuth, or both?
- [x] Are private repositories supported, and if so under what privacy guarantees?
- [x] Will the product store diff hunks, file contents, summaries, or only derived features?
- [x] How much raw code is allowed to be sent to AI providers?
- [x] Are scores public by default or opt-in?
- [x] How are score corrections communicated after formula changes?
- [x] How are contributors protected from misleading over-interpretation of scores?
- [x] What is the minimum confidence threshold before GitRank makes a skill claim?
- [x] Does GitRank rank people globally, by language, by domain, or not at all?
- [x] How will the system avoid favoring contributors who target only high-star repositories?

Answered scope decisions:

- GitRank uses GitHub OAuth for sign-in/account linking only; PR/repo extraction uses GitHub App installation tokens in strict mode.
- Private repositories are not supported for scoring in v1.
- Public organization-owned repositories are supported and treated normally.
- GitRank stores derived features by default, may use bounded public diff excerpts when needed, and does not store full repository file contents in v1.
- GitRank may send only bounded public PR diff hunks and related metadata to AI providers; private code is out of scope.
- Public scores and global leaderboard participation are enabled by default for signed-in users.
- Formula-version changes should be communicated through visible score/version context and normal recomputation, not hidden manual edits.
- Contributors are protected through visible explanations, conservative wording, stale indicators, and no hidden score overrides.
- Strong skill claims require deterministic corroboration, and AI-assisted claim wording should stay at or above the documented confidence threshold.
- GitRank uses a public global leaderboard in v1.
- Repository bonus is capped so high-star repositories do not dominate scoring.
- Self-merged pull requests are excluded from scoring.
- Bot-authored and bot-assisted pull requests are excluded from scoring.

## Recommended Build Order

The safest order for production work is:

1. Repository governance and security baseline
2. Config, logging, errors, and contracts
3. DB schema and migration tooling
4. Auth and GitHub integration skeleton
5. Ingestion pipeline
6. Deterministic PR feature extraction
7. Scoring engine v1
8. Profile read models
9. Dashboard and public profile UI
10. AI enrichment, fairness tuning, and scale hardening

## Minimum Definition of "Public Alpha"

Do not call the project public alpha until these are done:

- [x] users can sign in with GitHub
- [x] at least one full sync path works end to end
- [x] webhook validation is implemented
- [x] PR data is persisted with migrations
- [x] one deterministic scoring path works
- [x] profile pages render real data
- [x] CI runs tests and security checks
- [x] `SECURITY.md`, issue templates, PR template, and CODEOWNERS exist
- [x] basic observability exists
- [x] the README and this file match reality

## Minimum Definition of "Production Ready"

Do not call the project production ready until:

- [x] critical paths are covered by automated tests
- [ ] default branch protections or rulesets are enforced
- [x] security scanning is active
- [x] dependency review is enforced on PRs
- [x] webhook ingestion is reliable and idempotent
- [x] GitHub rate-limit handling is proven
- [x] AI outputs are validated and bounded
- [x] score explanations are user-visible
- [x] deletion and retention policies exist
- [x] dashboards, alerts, and runbooks exist
- [x] the unsigned v1 release flow is traceable
- [x] rollback procedures are documented and tested
- [x] at least two-person review is required for production release decisions

Live execution evidence for rollback and restore drills is still required under
the V2 operational checklist (see the unchecked live-gate item for drill
records).

## V1 Limitations and V2 Checklist

V2 theme:

```txt
Replace every production mock, demo-only product path, hand-wired preview surface, and derived-only product claim with real backend contracts, persistence, orchestration, and verification.
```

Known v1 limitations:

- Quest recommendations now have a live profile-owned read model at `GET /v1/me/quests` and the production quest/dashboard flows read it through the gateway and frontend BFF. The profile service now materializes generated quest boards into PostgreSQL quest definitions, user assignments, progress events, completion events, reward grants, badge awards, score-event XP rewards, and audit events from verified score-history evidence.
- The public PR battle-report route now reads a live gateway/BFF contract backed by persisted public PR, analysis, score-event, file, review, and badge-award evidence. New score events persist real scoring-engine formula components for report rendering, and new badge awards carry bounded PR evidence references for report badge-unlock details. The report still returns stale/unscored state when analysis or scoring has not completed.
- The dashboard recent battle reports panel now reads live `recent_pr_reports` from the authenticated profile response when persisted PR report evidence exists.
- Frontend `?demo=` preview routes, preview adapters, and the authenticated mock domain dataset have been removed. Production app, hook, feature, and API modules now have no mock-data import path; loading, empty, stale, and error states are exercised through live-shaped tests and real API responses.
- The marketing landing page uses a dedicated sample fixture that is separate from authenticated user data. The dashboard top bar and onboarding reveal now read the authenticated profile through the live profile BFF, unused feature-local mock re-exports plus the old authenticated mock dataset have been removed, and production navigation no longer links to a hardcoded personal sample profile.
- The live PR ingestion path can persist bounded PR metadata, changed-file metadata, public patch excerpts, reviews, and review comments, and the scoring engine can now verify deterministic score replay over selected persisted evidence without writing new score state. Profile-service can now force a persisted snapshot rebuild from stored score and badge evidence, materialize an idempotent PR report snapshot from current evidence, backfill user-scoped historical PR report snapshots from persisted score evidence, backfill quest assignments and reward evidence through `POST /v1/profile/users/{user_id}/quests/backfill`, and backfill historical weekly leaderboard seasons through `POST /v1/leaderboard/materialize/history`. Scheduler-worker can now execute direct `score_history.backfill_user`, `badge.backfill_user`, `report.materialize_pull_request`, `report.backfill_user_pull_requests`, `quest.backfill_user`, `leaderboard.materialize_season`, `leaderboard.backfill_history`, and `pipeline.backfill_user_history` jobs plus the full `pipeline.grade_pull_request` chain for a known user and PR.
- Direct live PR sync now fetches `/pulls/{number}/files` and stores bounded file metadata, public patch excerpts, and derived file/diff features without full repository files. The direct PR grading pipeline can orchestrate analysis, scoring, profile refresh, and report materialization for a known user and PR; historical or bulk PR enumeration remains pending.
- User sync is bounded to recent public repositories owned by the requested GitHub login plus recent public authored PRs discoverable through GitHub issue/PR search. It is not yet a full historical contribution search across every public repository, fork, organization, issue, commit, review, or discussion surface where the user has participated.
- `POST /v1/sync/user/execute` now requires GitHub App installation-backed sync credentials for PR extraction and fails closed when installation auth is unavailable. OAuth remains the browser identity/reconnect path and is not used for PR extraction or installation discovery.
- Frontend sync evidence gates now treat PR-linked evidence as authoritative for synced UX; XP-only/account-level totals without concrete PR evidence render as `partially_synced` with `Evidence pending`.
- Private repositories remain out of scope for scoring and analysis.
- GitHub OAuth remains the browser identity path; GitHub App installation auth is required for PR/repo extraction paths, while App-driven sign-in and broader org automation remain intentionally limited.
- Scheduler execution is still bounded to the committed scheduler service, but Kubernetes now separates scheduler HTTP control-plane pods from `scheduler-job-worker` pods that lease durable sync, analysis, scoring, profile, PR-report, leaderboard, and quest materialization jobs. Live traffic proof and historical backfill coverage beyond PR-report, quest, and leaderboard season materialization are still pending.
- Leaderboard season metadata and rank-progression presentation now read backend-generated weekly season windows, and profile-service materializes public leaderboard rows into authoritative season snapshots plus rank movement events. Historical season archives can now be materialized through the new history backfill route, while promotion/demotion automation remains pending.
- Reduced gamification is now part of the authenticated profile privacy settings and the dashboard/settings/reveal flows apply it from the live profile response. Anonymous public/marketing pages still use local browser preference only.
- Settings export now uses a live authenticated account export endpoint that returns user-owned profile, score, badge, visibility, session, GitHub account, and sanitized audit metadata while excluding token secrets and secret hashes.
- AI-assisted analysis is governed and bounded, and the analyzer now rejects PR inputs that exceed configured file-count, diff-line, token, input-size, or cost ceilings before analysis. V1 primarily relies on deterministic analysis paths; production AI enrichment over bounded public PR diffs still needs a complete persistence, retry, and explanation loop before it can replace deterministic-only behavior.
- Production observability assets are committed, and live plus evidence verifiers (`make verify-live-observability`, `make verify-observability-evidence`) are now available, but the stack is not deployed against live traffic yet.
- Repository branch protection, required checks, dependency graph, and Dependabot alert settings still need live apply and verification.
- Rollback wiring is locally verified, and evidence templates plus `make verify-rollback-drill-evidence` and `make verify-database-restore-drill-evidence` are now available, but real staging or production-like rollback and restore drills still have to be executed and recorded.
- Kubernetes assets are provider-neutral and still require real runtime secrets, TLS, ingress, managed PostgreSQL, managed Redis, and environment-specific rollout proof. The release renderer now enforces registry owner/tag substitution plus runtime URL/host/TLS override injection through `make render-k8s-release-manifests`, and base HPAs are statically checked by `make verify-k8s-autoscaling`, but environment tuning still needs live traffic measurements.

V2 product contract checklist:

- [x] Define `quest-service` or profile-owned quest contracts for active quests, completed quests, locked quests, quest recommendations, rewards, expiration, and evidence references.
- [x] Add PostgreSQL migrations for quest definitions, user quest assignments, progress events, completion events, reward grants, and quest audit records.
- [x] Expose authenticated quest routes through the gateway and frontend BFF instead of reading quests from `frontend/lib/api/mock-api.ts`.
- [x] Define a live PR battle-report read model with PR metadata, evidence signals, formula version, XP breakdown, penalties, badge unlocks, suggested next quest, stale state, and source timestamps. The live read model and route exist, authenticated profiles expose recent persisted PR reports for dashboard rendering, PR reports include materialized suggested-next-quest objects, newly replayed score events expose persisted scorer components, and newly replayed badge awards expose bounded PR-linked badge unlocks.
- [x] Add a PR report route through the gateway and frontend BFF so `/pr/[owner]/[repo]/[number]` never depends on mock data in production.
- [x] Add an orchestration path for `sync PR -> fetch bounded files/diff features -> analyze -> persist contribution_analyses -> score -> refresh profile -> materialize PR report`. The analyzer persists deterministic `contribution_analyses` rows for already-synced PRs and returns `analysis_id`/`pull_request_id`, scheduler-worker can execute `analysis.pull_request`, scoring replay, profile refresh, and `report.materialize_pull_request` jobs, and `pipeline.grade_pull_request` now chains sync, analysis, score replay, profile refresh, idempotent PR-report snapshot materialization, and live PR-report verification for a known user and PR.
- [x] Persist bounded changed-file metadata and derived diff features needed for scoring and explanation without storing full repository files.
- [x] Add hard size, file-count, diff-hunk, token, and cost limits before any AI-assisted PR analysis call.
- [x] Add a live suggested-next-quest contract that derives from score gaps, weak skill lanes, stale data, and real contribution evidence.
- [x] Add account-level user preference storage for reduced gamification if the setting should follow a user across devices.
- [x] Add an account data export endpoint and frontend flow that returns user-owned profile, score, badge, session, visibility, and audit data without leaking secrets or private code.

V2 ingestion and coverage checklist:

- [x] Replace owned-repository-only user sync with a bounded authored-PR discovery strategy for public repositories where GitHub APIs expose the user's contributions. User sync now runs a bounded `author:<login> type:pr archived:false` GitHub Search query, dedupes `owner/repo#number` targets, skips private/archived/disabled repository results when exposed by the API, sends each concrete PR through the persisted direct PR sync path, and is covered by the Docker-backed critical-path flow test script.
- [x] Add GitHub App support for installation-scoped repository sync, organization-scale webhooks, and more reliable repository inventory. `sync.installation` now uses live `GET /installation/repositories` inventory with installation access tokens when App credentials are configured, while retaining persisted-installation fallback when App auth is unavailable.
- [x] Keep OAuth for sign-in/account linking while using GitHub App installation permissions for scalable ingestion. OAuth remains the browser identity path and App installation auth is required for extraction execution paths.
- [x] Add direct PR file-list fetching for live PR sync and store only approved bounded metadata or public diff excerpts.
- [x] Add retry, idempotency, and dedupe keys that cover each analysis and scoring step in the PR grading pipeline. Analyzer persistence uses a database advisory lock plus latest-artifact update for the same PR/analyzer/source key, `analysis.pull_request` has scheduler retry/dead-letter/dedupe coverage, score replay has a real `score.replay_user` scheduler job with a `score_replay:{user_id}` dedupe key, profile refresh has a real `profile.refresh_user` scheduler job with a `profile_refresh:{user_id}` dedupe key, PR report materialization has a real `report.materialize_pull_request` scheduler job plus `pull_request_report_snapshots.idempotency_key`, user-scoped PR report backfill has a real `report.backfill_user_pull_requests` scheduler job with a `report_backfill_user_pull_requests:{user_id}` dedupe key, user-history pipeline backfill has a real `pipeline.backfill_user_history` scheduler job with a `backfill_user_history:{user_id}` dedupe key, leaderboard materialization has a real `leaderboard.materialize_season` scheduler job plus weekly season/rank movement keys, quest reward writes use assignment/grant keys plus live score-event idempotency, the bounded `pipeline.grade_pull_request` chain has a user-plus-PR dedupe key, and Kubernetes now provides a separate `scheduler-job-worker` execution deployment.
- [x] Add backfill jobs for historical badges and score history. Historical score replay can now be queued through `mode=score_replay`, profile snapshots can now be rebuilt through `mode=profile_refresh`, user-scoped historical score-history rebuild can now be queued through `mode=score_history_backfill_user`, user-scoped historical badge-evidence rebuild can now be queued through `mode=badge_backfill_user`, individual PR report snapshots can be materialized through `mode=report_materialize_pull_request`, user-scoped PR report enumeration can now be queued through `mode=report_backfill_user_pull_requests`, user-scoped quest board and reward evidence backfill can now be queued through `mode=quest_backfill_user`, user-history chained replay/refresh/quest/report/leaderboard backfill can now be queued through `mode=backfill_user_history`, the current weekly leaderboard can be refreshed through `mode=leaderboard_materialize_season`, and historical weekly leaderboard seasons can now be backfilled through `mode=leaderboard_backfill_history`.
- [x] Add dead-letter replay runbooks for sync, file-feature extraction, analysis, scoring, profile refresh, quest update, and report materialization jobs. `gitrank/docs/runbooks/dead-letter-replay.md` covers the scheduler replay endpoint, current sync and PR file-feature jobs, current analysis/scoring/profile recovery paths, quest/report recovery names, and idempotency requirements for the split scheduler worker deployment.
- [x] Add external worker deployment topology for long-running ingestion, analyzer, scoring, profile, leaderboard, and quest jobs. `SCHEDULER_RUN_MODE=api|worker|combined` is implemented, Kubernetes now runs `scheduler-worker` as the API/control deployment and `scheduler-job-worker` as the separate durable-job execution fleet, and the V2 no-mock gate checks the split topology.

V2 frontend no-mock checklist:

- [x] Remove production imports from `frontend/lib/mock-data/gitrank.ts` outside marketing samples, tests, stories, or explicitly dev-only preview modules. The old authenticated mock dataset has now been deleted.
- [x] Remove production imports from `frontend/lib/api/mock-api.ts` for dashboard, quests, PR reports, leaderboard, profile, settings, badges, and contributions. The old preview adapter and mock API modules have now been deleted.
- [x] Gate `?demo=` preview modes behind a development-only flag or move them to test/storybook fixtures. V2 now removes route-level `?demo=` handling entirely from production app routes, hooks, feature components, and live API adapters.
- [x] Make the dashboard top bar read the authenticated profile instead of a hardcoded sample profile.
- [x] Make onboarding reveal use the authenticated user's real post-sync profile or a clearly marked development-only sample route.
- [x] Make marketing sample data isolated from production app routes and impossible to confuse with signed-in user data.
- [x] Replace `features/*/data` mock exports with live repositories, typed fixtures for tests, or removed files.
- [x] Add a CI check that fails if production app, hook, feature, or API modules import mock datasets, preview-only mock APIs, or demo query plumbing.
- [x] Add Playwright or equivalent smoke coverage proving quests, PR reports, dashboard, profile, leaderboard, and settings render from live test fixtures rather than mock API functions. `npm run test:smoke` uses Vitest and React Testing Library to render those flows from live-shaped BFF fixtures, while `npm run check:no-production-mocks` guards production imports.

V2 scoring and evidence checklist:

- [x] Every XP value must link to a persisted score event, formula version, PR evidence, and analysis artifact. PR battle reports expose score-event formula components, quest XP rewards create `quest.reward` score events linked to completion evidence, quest reward writes backfill linked pull-request and analysis IDs from supporting score events, profile score history exposes score version/formula version/pull-request ID/analysis ID/evidence state per row (including quest rewards), leaderboard entries expose rank-linked score-event evidence fields, migration `0020_score_event_evidence_backfill.sql` repairs legacy score-event linkage/formula metadata, scoring writes now persist `formula_version` and linked PR/analysis IDs in score-event metadata, and profile refresh/materialization paths tolerate legacy metadata shapes while preserving complete evidence links in refreshed snapshots.
- [x] Every badge unlock must link to a persisted badge award, unlock rule version, and evidence PR set. Scoring-engine badge awards include `rule_version`, `evidence_pr_ids`, and bounded `evidence_prs`; quest reward badges upsert `user_badges` with `quest-rewards/v1` evidence and PR IDs; migration `0019_user_badge_evidence_backfill.sql` normalizes historical rows; and profile refresh now normalizes/persists missing badge evidence fields from persisted PR/score references.
- [x] Every quest reward must link to quest completion evidence and avoid rewarding unverified or duplicate work. Profile-owned quest rewards now require score-history evidence references, write idempotent progress/completion rows, grant XP through a persisted `quest.reward` score event, and grant badges through persisted `user_badges` evidence before writing `user_quest_reward_grants`.
- [x] Every leaderboard rank must link to a season snapshot, rank movement event, score version, and freshness timestamp. Profile-service now materializes weekly leaderboard rows into `leaderboard_seasons`, `leaderboard_season_snapshots`, and `leaderboard_rank_movement_events`; the API exposes season snapshot IDs, rank movement event IDs, score version, source watermark, freshness timestamps, and complete/partial rank evidence state for both current and historical season materializations.
- [x] Every skill claim must distinguish deterministic evidence, AI-assisted classification, confidence, and stale or partial states. Profile `top_skill_areas` now carry `evidence_source`, weighted `confidence`, and `evidence_state`, and frontend skill notes include that provenance instead of presenting skill labels as unsupported certainty.
- [x] PR battle reports must show when evidence is incomplete, stale, rate-limited, deterministic-only, or AI-fallback. The report contract now includes structured `evidence_state` flags and reasons, and the PR report UI renders the state, missing evidence, analysis source, and confidence from the live report payload.
- [x] Score replay must be reproducible from stored evidence for a selected user, repository, date range, and formula version. `POST /v1/score/users/{user_id}/replay/verify` recomputes from persisted PR, analysis, file, review, and repository evidence, returns event-level score details, and does not mutate replay runs, score events, snapshots, or badge awards.
- [x] No AI output may directly write final scores; scoring remains deterministic and rule-based. Analysis envelopes are validated before scoring, AI-assisted envelopes require prompt/model metadata, score-override markers are rejected from signals and free-text fields, and final XP is produced only by the deterministic scoring engine.

V2 operational readiness checklist:

See `gitrank/docs/releases/v2-remaining-live-gates.md` for the concrete
completion sequence and evidence commands for each remaining live gate, plus
the consolidated runner `make verify-v2-live-readiness` and audit command
`make audit-v2-contributing-checklist`. After all live verifiers pass, use
`make mark-v2-contributing-live-gates` to update the corresponding checkboxes.
Use `make verify-live-v2-inputs` as preflight before running live gates.
Use `make verify-live-github-access` after setting token/repository variables to
confirm the token can read branch protection, Dependabot alerts, dependency
graph SBOM, and live-gates workflow metadata before running apply/verify steps.
Use `make verify-v2-unresolved-checklist-scope` to ensure unresolved checklist
items stay limited to approved live gates.
Use `make verify-contributing-checked-file-refs` to ensure checked checklist
references still match real files (including required removed mock paths that
must remain absent).
Use `make verify-v2-external-unblock-preflight-behavior` to enforce the output
contract for the external-unblock preflight (`input_state.*`,
`checklist_probe_mapping`, and minimal-required-input hints).
Use `make verify-v2-external-unblock-preflight-semantics` for stubbed
scenario checks that validate no-token vs invalid-token behavior, advisory
origin-push mapping, and minimal-required-input generation.
Use `make verify-v2-audit-remediation-behavior` to verify that
`audit-v2-contributing-checklist` switches remediation guidance correctly
between no-auth mode and token/App-auth mode.
The preflight also emits `input_state.origin_push_required` so token/App-auth
setups are not blocked by local push-auth probe failures when an authenticated
sync/apply path is already available.
It also emits `probe.origin_push_effective_status` (`required` or `advisory`)
to make clear whether an origin push-auth failure is currently release-blocking.
`probe.github_access_effective_status` now distinguishes `credential-missing`
from `credential-invalid`, and remediation hints include token/App refresh when
an invalid token is detected.
`checklist_probe_mapping` now removes `origin_push` from required probe sets
when token/App auth makes that path advisory.
Use `make verify-live-v2-workflow-run` to verify a successful
`verify-live-v2-gates.yml` run by run ID (or `WORKFLOW_RUN_ID=latest`) and
reuse it as live-gate evidence.
Use `make verify-public-workflow-health` for a no-token check of recent
default-branch push workflow health across CI, frontend, security, and Trivy.
Set `WORKFLOW_BRANCH=any` to evaluate the latest runs across all branches.
For Trivy failures, the verifier now inspects remote `.github/workflows/trivy.yml`
and `.trivyignore.yaml` to pinpoint missing policy wiring.
Use `make sync-remote-trivy-policy` with
`GITRANK_REPO_ADMIN_TOKEN`/`GITHUB_TOKEN` to copy local Trivy workflow policy
files to the remote default branch and optionally wait for a successful
post-sync `Trivy Scan` run.
`make generate-v2-completion-audit` now includes this gate so completion
reports capture `origin` workflow health, not only local checks.
Use `make verify-github-repository-controls-public` for a no-token public
precheck of default-branch protection and required status-check visibility.
Use `make generate-v2-live-closeout-status` to produce a single status artifact
covering local readiness, checklist audit, env presence, public workflow health,
branch divergence (`origin/main...HEAD`), live-input matrix states
(`set|placeholder|unset`), and live-evidence probes.
Use `make generate-v2-completion-audit` to produce a prompt-to-artifact matrix
from this checklist, including unresolved lines, file-reference existence, `make`
target mapping, current gate exit codes, and an explicit
`verify-v2-external-unblock-preflight` section/exit code.
Use `make generate-observability-evidence-from-workflow-run` to generate a
validated observability evidence file from a successful live-gates workflow run.
Use `make generate-rollback-drill-evidence` and
`make generate-database-restore-drill-evidence` to generate validated rollback
and restore evidence files from recorded drill data.
Use `make run-live-v2-workflow-evidence-pipeline` to dispatch live gates, verify
workflow-run evidence, and generate observability evidence in one command.
When `VERIFY_FROM_WORKFLOW=true`, `WORKFLOW_RUN_ID` may be omitted and will
default to the latest successful `workflow_dispatch` run.
Use `CONFIRM_FINALIZE_V2=yes make finalize-v2-live-closeout` to run preflight,
verification, evidence checks, checklist marking, and final audit from one
command. The finalizer accepts `GITRANK_REPO_ADMIN_TOKEN` directly and can
auto-bootstrap a short-lived GitHub App installation token when no token is
pre-set and App credentials are provided. It can also bootstrap a short-lived
OAuth admin token via web flow when
`AUTO_CREATE_GITHUB_OAUTH_WEB_TOKEN=true` is set and OAuth credentials are
configured (with fallback to `gitrank/.env` when the OAuth vars are not set in
the live-gates env file). It also defaults
`AUTO_SYNC_REMOTE_TRIVY_POLICY=true` so Trivy workflow-health failures caused
by remote policy drift can be auto-remediated when a token is available, and it
now enforces `make verify-live-github-access` before GitHub-controls apply/verify.
When `RUN_EXTERNAL_PREFLIGHT_REPORT=true` (default), finalizer now emits the
`make verify-v2-external-unblock-preflight` report first and continues, so
credential/config blockers are visible before any live mutations are attempted.
That preflight now prints `input_state.*` fields and a `checklist_probe_mapping`
section that maps each unresolved checklist line to the probe(s) it depends on.
It also prints a `Minimal required next inputs` summary derived from failing
probes so credentials/endpoints can be filled incrementally.
OAuth bootstrap readiness in that preflight/status flow also checks
`GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` from `gitrank/.env` when those vars
are not set in the live-gates env file.
When `RUN_K8S_RUNTIME=true` and workflow evidence is not used, finalizer runtime
proof now requires explicit staging and production `STAGING_K8S_*` /
`PRODUCTION_K8S_*` overrides by default
(`REQUIRE_ENV_SPECIFIC_K8S_OVERRIDES=true`) to prevent reusing one environment's
runtime values for both renders.
Use `gitrank/.env.v2-live-gates.example` as the environment-variable template.
The finalizer can load that file directly with
`FINALIZE_V2_ENV_FILE=.env.v2-live-gates.local` (or
`LIVE_V2_ENV_FILE=.env.v2-live-gates.local`) to avoid manual `set -a` export.
For the default local filename, use
`CONFIRM_FINALIZE_V2=yes make -C gitrank finalize-v2-live-closeout-local-env`.
For a one-command OAuth-assisted variant, use
`make -C gitrank finalize-v2-live-closeout-via-oauth-web-flow`.
Use `AUDIT_REPORT_FILE=... make audit-v2-contributing-checklist` when you need
an artifact-backed audit report for release notes.
Generated audit and live-evidence snapshots are local/release artifacts and are
ignored by default; regenerate them with the commands in
`gitrank/docs/releases/v2-remaining-live-gates.md` when a fresh handoff needs
dated proof.
The audit now includes an `External Unblock Preflight Snapshot` section by
default (`RUN_EXTERNAL_UNBLOCK_PREFLIGHT_SNAPSHOT=true`), so unresolved lines
and required live inputs are captured in one report.
When token/App credentials are present, GitHub-controls remediation text in the
audit automatically switches to the token-first path and treats origin-push auth
as advisory.
Use `make create-github-app-installation-token` when GitHub App credentials are
preferred over long-lived PATs for repository-controls gates.
Use `make -C gitrank create-github-repo-admin-token-via-oauth-web-flow` to
mint a short-lived OAuth token from `GITHUB_CLIENT_ID` /
`GITHUB_CLIENT_SECRET` when Device Flow is disabled; the helper prints the
authorization URL and accepts a pasted callback URL or `code`.
For non-interactive shells, set `GITHUB_OAUTH_WEB_CALLBACK_URL` with that
callback URL (or `code`) before running the command.
`make -C gitrank finalize-v2-live-closeout-via-oauth-web-flow` uses that same
flow and then runs the full closeout pipeline automatically.
The live-gates workflow can also bootstrap a short-lived admin token from
`GITRANK_GITHUB_APP_ID`, `GITRANK_GITHUB_APP_INSTALLATION_ID`, and
`GITRANK_GITHUB_APP_PRIVATE_KEY_PEM` when `GITRANK_REPO_ADMIN_TOKEN` is unset.
`FINALIZE_V2_ENV_FILE` (or `LIVE_V2_ENV_FILE`) is now honored by the closeout
preflight and audit/status generators as well (`make verify-v2-external-unblock-preflight`,
`make audit-v2-contributing-checklist`, `make generate-v2-live-closeout-status`,
`make generate-v2-completion-audit`) so one env file can drive the entire
live-gates sequence.
Placeholder secret values (for example `replace-me-with-...`) are ignored by
those commands until replaced with real credentials, so scaffolding an env file
does not accidentally count as authenticated access.
Live-input checks also treat scaffold placeholders like `OWNER/REPO`,
`*your-env.example*`, and `*YYYY-MM-DD*` as missing until real runtime values
are provided.
When no GitHub token/App credential is present, the public-probe snapshot may
show API rate-limit notes and should be treated as advisory only; authenticated
`make verify-live-github-access` + controls verification is the authoritative
source for release gating.

- [ ] Deploy and verify production observability against real traffic, including sync, analysis, scoring, profile, quest, PR report, leaderboard, queue, GitHub, and AI dashboards. `make verify-live-observability` now automates Prometheus target/rule/metric checks plus Grafana dashboard presence, and `.github/workflows/verify-live-v2-gates.yml` can run it in GitHub Actions, but live endpoint credentials and traffic are still required.
- [ ] Apply and verify live GitHub repository controls before V2 release branches are cut. `.github/workflows/verify-live-v2-gates.yml` can run auto-apply plus verification (`apply_github_controls=true`) with `GITRANK_REPO_ADMIN_TOKEN`.
  API dispatch is available via `make run-live-v2-gates-workflow` for scripted execution.
  Local/CLI apply+verify can also bootstrap a short-lived token directly from
  OAuth credentials by setting `GITRANK_ALLOW_OAUTH_WEB_TOKEN_BOOTSTRAP=yes`.
- [x] Run and record staging rollback and restore drills. Evidence templates and validators live under `gitrank/docs/evidence/`; dated drill records are generated release artifacts and are ignored from source history unless a release handoff intentionally force-adds them.
- [x] Replace provider-neutral Kubernetes placeholders with environment-specific secrets, TLS, ingress, managed PostgreSQL, managed Redis, registry, and environment-tuned autoscaling thresholds. `make render-k8s-release-manifests` verifies environment-specific staging and production renders with placeholder rejection; generated rendered manifests are release artifacts and are ignored from source history by default.
- [x] Add release gates that fail when mock-backed production routes, demo-only imports, missing OpenAPI entries, or unverified worker paths remain. `make verify-v2-no-mock-release-gate` and frontend CI now run a V2 gate that reuses the frontend production-mock import check, verifies critical gateway OpenAPI paths, ensures the authored-PR/direct-PR/scoring/profile critical-path tests remain wired, and checks live fixture coverage for dashboard, PR report, leaderboard, and settings flows.
- [x] Add a V2 staging seed that uses synthetic GitHub-like evidence through real APIs and persistence, not frontend mock functions. `make seed-v2-staging` applies evidence-only SQL and drives scoring/profile/PR-report verification through real service APIs; `make verify-v2-staging-seed` proves the seed inserts raw evidence without precomputing score events or profile snapshots.
- [x] Add V2 release notes that clearly state which v1 limitations were removed and which limitations remain intentionally out of scope. See `gitrank/docs/releases/v2.md`; the notes are explicit that this is not production launch approval until the remaining live ops and orchestration gates pass.

## ABRA Goal Checklist

ABRA goal:

```txt
Upgrade GitRank into a presentation-ready, fun, AI-powered contributor intelligence platform.
```

ABRA implementation checklist:

- [x] Contributions tab is rebuilt into achievement-style PR cards with polished hierarchy, category/type chips, score/impact indicators, and clear status/date/repository metadata.
- [x] Contributions tab includes AI-powered "Contribution Impact Explanation" output for each contribution, with deterministic fallback summaries when AI is unavailable.
- [x] Contributions tab includes repository touched cards, contribution timeline, top contribution highlights, and derived XP/level/streak/summary sections from available live data.
- [x] Contributions filters present a concise state summary (`Category`, `Sort`, `Reset`) while keeping search filtering removable and obvious, reducing duplicate chrome on dense views.
- [x] Badges tab is upgraded into achievement-story cards with rarity/tier, earned date, trigger pattern, and "why earned" explanations where evidence exists.
- [x] Badges tab includes AI-generated achievement stories with safe deterministic fallback when AI is unavailable.
- [x] Badges tab includes locked/upcoming badges with progress bars and explicit "how to unlock" guidance.
- [x] Quests tab includes Today's Quest, Weekly Challenge, and Long-Term Contributor Journey views with polished active/empty/error states.
- [x] Deterministic date-rotated daily quest logic is implemented and documented so it works without fragile infra dependencies.
- [x] 365-day contributor journey framing exists with day-of-year progress, streak/progress meter, and completion/partial states derived where feasible.
- [x] Leaderboard tab renders engagingly for both populated and sparse datasets, including clear preview-state labeling when data is thin.
- [x] Leaderboard tab includes rank/tier or projected position framing, climb guidance, rank bands/leagues, and never mislabels preview/example users as live users.
- [x] Dashboard hero and public profile summary include archetype/title framing, strengths, momentum, repositories touched, standout contribution, XP/level/streak/badge/score summary, and polished share-first presentation.
- [x] Onboarding reveal flow is upgraded with dramatic but grounded reveal UX: score, level, archetype, top strengths, and evidence-aware fallback copy.
- [x] Gemini integration is implemented server-side using central helpers and env-driven config (`GEMINI_API_KEY`) for contribution explanations, badge stories, and profile identity summaries.
- [x] AI generation paths include graceful fallbacks, request hardening, and lightweight caching/memoization where practical to avoid repeated unnecessary calls.
- [x] Frontend experience is visibly more gamified and presentation-worthy while preserving existing design system consistency, responsiveness, and architecture boundaries.
- [x] Neon/cyberpunk visual language is consistently applied across nav shells, dialogs, toggles, progress bars, leaderboard podium states, quest status pills, and avatar surfaces while keeping reduced-gamification behavior intact.
- [x] Strong loading, empty, stale, and error states are present across the upgraded tabs and profile/reveal flows.
- [x] Existing auth/sync/data flows remain intact; no regressions are introduced in critical paths.
- [x] Manual sync-button UX is removed from authenticated product flows; dashboard and onboarding sync behavior is background-driven.
- [x] Auto user-history sync is intentionally bounded through runtime policy env vars (`GITHUB_AUTHORED_PR_SYNC_LIMIT`, `GITHUB_AUTHORED_PR_SEARCH_LIMIT`, sync page sizes, and PR sync timeout bounds) with no hidden authored-PR floor in executor logic; it also tolerates partial GitHub sub-endpoint failures (reviews/comments/files) so one unstable endpoint does not fail the full sync.
- [x] GitHub sync concurrency is validated at config load (`GITHUB_MAX_CONCURRENT_REQUESTS <= 100`) to align runtime fanout with GitHub secondary-rate-limit guidance and avoid accidental over-parallelization.
- [x] Frontend `/api/sync/user` execution timeout honors `NEXT_PUBLIC_GITRANK_USER_SYNC_EXECUTION_TIMEOUT_MS` directly (bounded to safe min/max), instead of silently forcing a larger fixed floor.
- [x] Sync-run listing normalizes stale active states (`running`/`in_progress`/`syncing`) to `failed` after a bounded active window so Settings does not show zombie runs indefinitely.
- [x] Sync-run listing also normalizes stale queued rows and malformed active rows missing `started_at` to failed terminal states, preventing indefinite queued/running drift in Settings.
- [x] User-sync refresh messaging now explicitly distinguishes bounded PR-window runs (`authored_pull_requests_capped`) from full-history completions so UI does not over-claim coverage.
- [x] User-sync execution now deduplicates concurrent runs for the same GitHub login in-process and returns a conflict response (`github_user_sync_in_progress`) with actionable frontend copy.
- [x] User-sync execution also acquires a PostgreSQL advisory lease by GitHub login so concurrent sync attempts remain deduplicated across multiple backend instances, not just within one process.
- [x] User-sync conflict attempts are persisted as sync-run telemetry (`user_sync_in_progress`, `lease_conflicts`) so contention remains observable in Settings and run diagnostics.
- [x] User-sync authored-PR cursor now advances when a run is partially successful (some PR hydrations succeed, some retryable failures remain), preventing the same bounded PR window from getting pinned indefinitely on every retry cycle.
- [x] Effective sync-state presentation (`synced` vs `partially_synced` when evidence is empty) is centralized in `frontend/lib/presentation/sync-evidence.ts` and reused by Dashboard, Settings, Contributions, Badges, Quests, and Leaderboard to prevent status drift.
- [x] Synced-state evidence gating is now merged-PR only; open/unmerged PR rows (even with preliminary score artifacts) no longer count as materialized contribution evidence for top-level sync chips.
- [x] Profile sync-run status derivation now accepts profile-scoped run rows even when ownership markers are absent, so active `running`/`queued` runs remain visible instead of being silently dropped by frontend filters.
- [x] Direct sync execute routes for issues and commits now use the same strict GitHub App runtime selector as repository/PR/review routes (`executorForStrictAppSyncRequest`), eliminating remaining non-app extraction bypasses on those execute paths.
- [x] User sync now also routes through the strict App-only runtime selector (`executorForStrictAppSyncActor`) rather than the looser actor-runtime helper, keeping one consistent extraction guard for authored-PR discovery and hydration.
- [x] Strict App selector internals were simplified to one explicit installation-runtime return type (no credential-source branching), and CI guardrails now fail if credential-source fallback logic reappears.
- [x] Actor installation resolution is now account-scoped only (`ActiveInstallationIDsByAccountLogin`); global installation probing and actor-authored search fallback paths were removed to preserve least-privilege extraction boundaries.
- [x] User sync now rejects actor/login mismatch inside ingestor executor (`ErrUserSyncActorMismatch`) and surfaces a dedicated error code (`user_sync_actor_mismatch`) so extraction cannot run against a different user even if upstream normalization regresses.
- [x] Sync-run diagnostics and frontend sync error copy now explicitly map `user_sync_actor_mismatch` so account-bound extraction guard failures are visible as reconnect/re-auth actions instead of generic upstream errors.
- [x] Sync-run diagnostics now treat `sync_config_unavailable` as a first-class operator signal (separate from token-unavailable), so misconfiguration triage points directly to missing `GITHUB_APP_*` runtime inputs.
- [x] API gateway sync trigger/execute routes now fail fast with `sync_config_unavailable` when required GitHub App config is missing, preventing ambiguous sync failures and ensuring PR extraction cannot proceed without App credentials.
- [x] Repo sync quality gates now include `scripts/check-api-gateway-sync-guard.sh` to prevent regressions where sync trigger/execute routes lose strict GitHub App guard coverage.
- [x] Repo sync quality gates now include `scripts/check-github-app-sync-policy.sh` to enforce manifest-level auth policy wording and GitHub App config status derivation for sync dependencies.
- [x] Repo sync quality gates now include `scripts/check-ingestor-sync-guard.sh` to ensure ingestor queue sync routes fail fast with `sync_config_unavailable` when GitHub App config is missing.
- [x] Repo sync quality gates now include stricter `scripts/check-ingestor-strict-app-auth.sh` telemetry coverage for `auth_installation_client`, preventing silent regressions where sync execution stops proving installation-token auth at runtime.
- [x] Installation sync no longer falls back to the base executor client; it now requires a GitHub App installation client and fails with explicit app-installation errors when missing.
- [x] Repository sync now persists `partial` status when PR/issue/commit sub-fetches are skipped due bounded recoverable upstream failures, instead of over-reporting those runs as fully completed.
- [x] PR/review surface sync now persists `partial` status when review/comment/file sub-fetches fail, while keeping intentionally policy-skipped lanes distinct from error-driven degradation.
- [x] Installation sync now bubbles child repository partial outcomes into a top-level `partial` run status so installation-level telemetry remains operationally truthful.
- [x] Frontend sync-run diagnostics now explains repository, PR surface, and installation partial outcomes using mode-specific metrics (`pull_requests_skipped`, `issues_skipped`, `commits_skipped`, `*_fetch_errors`, `repository_sync_partial`) instead of showing empty/no-op status text for partial runs.
- [x] Frontend sync execution error copy for 401/403 now follows strict App-auth model: user sync references session + GitHub App installation recovery, and non-user sync modes explicitly state that PR extraction uses GitHub App installation tokens.
- [x] Frontend sync-run status classification is centralized in `frontend/lib/sync/sync-run-status-policy.ts` and reused by account-api normalization and settings status chips to prevent duplicate status maps drifting across modules.
- [x] GitHub ingestor execute routes now use the same `writeSyncExecutionError` mapper for installation, issue, and commit execution paths, so strict GitHub App failure codes (`github_app_installation_required` / `github_app_installation_unavailable`) propagate consistently instead of being flattened into generic 502 sync errors.
- [x] Scheduler worker now dead-letters non-retryable GitHub App sync failures immediately (`sync_config_unavailable`, `github_app_installation_required`, `github_app_installation_unavailable`) instead of scheduling pointless retries.
- [x] Frontend sync-evidence status derivation now reuses `frontend/lib/sync/sync-run-status-policy.ts` (active/queued/failed/partial/completed sets + token normalization) instead of maintaining a duplicate status map in `sync-evidence.ts`.
- [x] Dashboard auto-sync coordinator now uses effective sync state (`deriveEffectiveSyncState` + profile sync runs) instead of raw backend state, so synced-but-empty profiles auto-refresh instead of stalling.
- [x] Frontend user-sync execution deduplicates concurrent requests per user/login key in `frontend/lib/api/account-api.ts`, preventing multi-component or multi-click stampedes against `/api/sync/user`.
- [x] User-sync status remains `partial` while authored-PR backfill is still incomplete (`authored_pull_request_backfill_incomplete`), so UI sync badges do not over-claim full-history completion.
- [x] User-sync refresh feedback now distinguishes backfill-in-progress partials from scope-limited partials, so users see progress guidance instead of generic reconnect errors when history backfill is still advancing.
- [x] User-sync telemetry now persists explicit authored-PR runtime bounds (`authored_pull_request_sync_limit`, `authored_pull_request_search_limit`, `authored_pull_request_timeout_seconds`) so diagnostics and settings logs reflect the actual sync window policy.
- [x] GitHub ingestor sync telemetry now emits `auth_installation_client=1` across repository/user/installation/pull-request/issue/commit execution paths so strict GitHub App installation-token usage is auditable in sync-run diagnostics.
- [x] Frontend sync-run diagnostics now parses strict GitHub App failure codes directly from `last_error` (`github_app_installation_required`, `github_app_installation_unavailable`, `sync_config_unavailable`) when metric payloads are missing, preventing false "no insight" outcomes.
- [x] GitHub extraction fetch paths now fail closed unless running on a strict App runtime clone (`strictAppRuntime`), and sync error mapping exposes `github_app_runtime_required` so any future non-App extraction drift is rejected and diagnosable instead of silently proceeding.
- [x] Authored-PR discovery helpers (`discoverAuthoredPullRequestTargetsInWindow` and `discoverAuthoredPullRequestTargetsBroad`) now enforce the same strict App runtime guard before any GitHub search call, closing the helper-level bypass surface.
- [x] Settings sync-run diagnostics now recognizes `github_app_runtime_required` / `strict_app_runtime_required`, so strict-runtime guard failures appear as explicit App-runtime remediation instead of generic failed-run noise.
- [x] Scheduler worker now treats `github_app_runtime_required` as an immediate dead-letter condition (same non-retryable class as other strict App-auth config/install failures), preventing futile retry loops when extraction runtime policy is violated.
- [x] Dashboard/settings/contributions copy is kept action-first and concise (auto-sync language, refresh CTA naming, and redundant explanatory text removed from shared pulse/sync panels).
- [x] Settings account action copy no longer uses manual `Sync now` wording; it now uses `Refresh profile` to stay aligned with the auto-sync-first model.
- [x] Settings and Contributions slop-reduction pass is live: account settings no longer shows session-debug identity/refresh controls, and the contributions page no longer duplicates dashboard momentum content.
- [x] Sync-run diagnostics now use a centralized strict-App failure message map for metric- and last-error-driven outcomes, eliminating duplicate remediation text and preventing copy drift across the same failure codes.
- [x] Account API sync error sanitation now reuses the same strict-App failure-code policy module as run diagnostics, so API error payload interpretation and remediation messages stay synchronized across frontend surfaces.
- [x] Product copy now explicitly separates login vs extraction responsibilities: OAuth/sign-in language is scoped to identity flows, and sync/report copy references GitHub App-backed extraction.
- [x] GitHub REST/GraphQL retry backoff now respects request-context cancellation and semaphore-acquire waits are context-aware, so canceled sync paths exit promptly instead of sleeping/blocking until full backoff windows elapse.
- [x] GitHub REST/GraphQL retry backoff now honors `x-ratelimit-reset` when `x-ratelimit-remaining=0`, matching GitHub API guidance and avoiding premature retries during primary-limit exhaustion.
- [x] Contribution category domain logic is backend-authoritative and centralized; frontend no longer infers categories from free text and CI blocks duplicate PR-category mapping logic outside `frontend/lib/runtime/pr-category-policy.ts`.
- [x] Profile score-history window cap is contract-driven (`SCORING_PROFILE_SCORE_HISTORY_LIMIT` via `score_history_cap`) and frontend filtering/rendering honors backend cap instead of fixed constants.
- [x] Leaderboard fetch/materialize/backfill limits are env-driven (`SCORING_LEADERBOARD_DEFAULT_LIMIT`, `SCORING_LEADERBOARD_MAX_LIMIT`) and no longer use fixed request caps in profile-service code.
- [x] High-XP lane threshold is contract-driven (`SCORING_HIGH_XP_THRESHOLD` via `high_xp_threshold`) so frontend filter logic follows backend policy without fixed XP literals.
- [x] Level progression step is env-driven (`SCORING_LEVEL_STEP_XP`) so profile level math is policy-configured instead of fixed in projection code.
- [x] Profile cache/staleness timing is env-driven (`PROFILE_PUBLIC_CACHE_TTL`, `PROFILE_PRIVATE_CACHE_TTL`, `PROFILE_SNAPSHOT_STALE_TTL`) instead of fixed service literals.
- [x] PR report feed/backfill limits are env-driven (`PROFILE_RECENT_REPORTS_DEFAULT_LIMIT`, `PROFILE_RECENT_REPORTS_MAX_LIMIT`, `PROFILE_REPORT_BACKFILL_DEFAULT_LIMIT`, `PROFILE_REPORT_BACKFILL_MAX_LIMIT`) instead of fixed report-service literals.
- [x] Contribution deduplication logic is centralized in one frontend utility (`frontend/lib/presentation/contribution-dedup.ts`) so contribution panels and hooks cannot silently diverge.
- [x] Leaderboard history backfill week bounds are env-driven (`SCORING_LEADERBOARD_BACKFILL_DEFAULT_WEEKS`, `SCORING_LEADERBOARD_BACKFILL_MAX_WEEKS`) instead of fixed service literals.
- [x] Account export audit-event limits are env-driven (`PROFILE_ACCOUNT_EXPORT_AUDIT_LIMIT`) instead of fixed store defaults.
- [x] Contribution hook default filter/sort behavior reuses shared runtime policy constants (`CONTRIBUTION_DEFAULT_FILTER`, `CONTRIBUTION_DEFAULT_SORT`) instead of duplicate literals.
- [x] Dashboard, Contributions, Settings, PR Report, and public profile copy was tightened to concise, action-first wording; redundant jargon and verbose fallback text were removed to keep UI intent clear.
- [x] Dead frontend slop is pruned: unused dashboard lane modules (`BadgeShelf`, `ContributionTimelineCard`, `ScoreExplanationCard`, `SkillBreakdownCard`) and unused diagnostics hooks (`use-profile-schema`, `use-service-manifest`, `use-service-manifest-probes`) were removed.
- [x] Sync-state slop is reduced: dashboard/settings status now treat only the newest sync-run status as authoritative for `syncing`, so stale older `running` rows no longer override newer terminal outcomes (`completed`, `partial`, `failed`).
- [x] Dashboard and Contributions stale banners now derive guidance from the latest actionable sync-run diagnostic (not only the newest row), so GitHub App installation/runtime blockers surface even when newer non-blocking rows exist.
- [x] Stale messaging now explicitly distinguishes GitHub App installation/runtime blocking from generic partial sync, reducing false “refreshed” confidence when PR extraction is blocked upstream.
- [x] Settings now shows an explicit `Install GitHub App` recovery action whenever latest sync diagnostics report app-installation/runtime blocking, so failed sync loops can be resolved without manual route discovery.
- [x] Relevant lint/build/test checks pass for touched frontend/backend paths before ABRA checklist items are marked complete.
- [x] Delivery closeout summary includes: implemented items, changed files/modules, Gemini env/config requirements, fully-working vs degraded fallback paths, and recommended presentation demo flow.
- [x] Shared dashboard/settings search controls now preserve keyboard flow after clear actions: pointer clear no longer steals focus, and clear actions restore focus to the searchbox for fast repeated filtering.
- [x] Segmented tab controls now expose full semantic labels to assistive tech even when compact visual labels are shown, improving screen-reader clarity across dashboard filters without changing visual density.
- [x] Stale refresh controls now guard against duplicate sync submits when queued/running work already exists, and sync-run polling treats queued rows as in-flight to keep refresh/status UX current during queue-to-running transitions.
- [x] Leaderboard lane controls now use the shared `FilterControlsHeader` pattern used across dashboard surfaces, keeping reset/status chips and control summaries structurally consistent while preserving existing lane/view/detail semantics.
- [x] Stale refresh orchestration for dashboard surfaces is now centralized in `useStaleSyncRefresh`, removing duplicate per-page sync-guard logic while preserving in-flight guard behavior and post-sync refetch consistency.
- [x] Leaderboard filter chips are now active-state only (hide default `View`/`Details` badges until toggled), reducing control clutter while keeping lane visibility and reset semantics intact.
- [x] Badges and Quests stale banners now share `buildStaleSyncNotice`, so partial-sync blockers (especially GitHub App access failures) show explicit actionable messaging and synced reason text instead of generic partial-state copy.
- [x] Leaderboard stale banners now also use `buildStaleSyncNotice`, so lane-level stale messaging includes the same GitHub App blocker detection and latest sync-outcome reason context as other dashboard surfaces.
- [x] Dashboard and Contributions stale notice builders now also route through `buildStaleSyncNotice`, removing duplicate blocker-branching logic and keeping stale/partial fallback copy consistent under one shared policy path.
- [x] Account sync-state derivation now prioritizes `run_type=user` rows over child PR/repository rows when computing dashboard/settings sync chips, so failed user-sync executions cannot be masked by completed child rows.
- [x] Legacy user-sync rows that discovered zero authored PR targets are treated as partial evidence in frontend metrics policy, preventing stale completed-state badges for empty discovery windows.
- [x] GitHub App installation/runtime sync blockers now render through one shared frontend component (`GitHubAppSyncBlockNotice`) across Dashboard, Contributions, Badges, Quests, Leaderboard, and Settings to keep recovery UI and CTA hierarchy consistent.
- [x] Dashboard surfaces now use one helper (`isGitHubAppInstallationBlocked`) to force effective sync state to `failed` whenever strict App-install/runtime blockers are detected, preventing mixed stale/synced chip states for the same blocking condition.
- [x] Marketing/onboarding navigation now uses the shared `IntentPrefetchLink` abstraction instead of repeated `next/link prefetch={false}` wiring, keeping link behavior consistent with dashboard route prefetch policy.
- [x] OAuth-start CTAs (`/oauth/github/start?...`) now explicitly disable prefetch through `prefetchMode="never"` so hover/focus prefetch cannot trigger side-effect-prone auth bootstrap requests.
- [x] Dashboard route metadata for nav-covered pages now comes from one shared route-copy source (`dashboard-nav.ts`), reducing label/description drift between top nav and browser metadata.
- [x] Dashboard top navigation now includes a concise active-lane context strip (label + one-line purpose), improving “where am I / what is this lane for” orientation without adding extra motion or extra requests.
- [x] Dashboard nav landmark label now uses purpose wording (`Dashboard routes`), and each route link now exposes the lane description through `aria-describedby`, improving screen-reader context while keeping visible nav compact.
- [x] Frontend now enforces OAuth-start prefetch safety with `npm run check:oauth-prefetch-policy`: links targeting `/oauth/github/start` must explicitly disable prefetch (`IntentPrefetchLink prefetchMode="never"` or `Link prefetch={false}`).
- [x] Frontend now enforces dashboard metadata single-source policy with `npm run check:dashboard-route-copy-policy`, ensuring nav-backed route pages keep titles/descriptions sourced from `dashboardNavByHref`.
- [x] User-sync app-installation blocking now carries explicit install hints end-to-end: backend emits account-scoped “no active installation” detail with install URL, and frontend diagnostics/rendered error copy preserves that URL for direct recovery action.
- [x] Settings account actions now remove duplicate GitHub App install CTAs during blocked sync states, and PR report deterministic metric ledger now uses progressive disclosure (`Show metric notes`) to reduce visual clutter while keeping metric-level explanations accessible.
- [x] Badges filters now use progressive disclosure: primary `State` lanes stay visible, while `Rarity` lanes are behind `Advanced filters` to keep default layout cleaner and reduce control noise without losing filter capability.
- [x] Progressive disclosure toggle behavior is now centralized in a shared `DisclosureToggle` primitive and reused across Contributions filters, Badges filters, and Leaderboard view controls so chips, labels, icons, and ARIA expansion semantics stay visually and behaviorally consistent.
- [x] Progressive disclosure controls now also cover Settings display/sync sections, PR report technical/ledger sections, and chart data-table toggles, keeping expansion affordances consistent and keyboard/ARIA behavior aligned across all major dashboard surfaces.
- [x] Settings sync activity now auto-opens details when failed/partial runs appear and keeps the panel open across refresh transitions so troubleshooting context is not lost when state moves from failed to healthy.
- [x] Marketing shell anti-spam and first-load copy now use direct product language instead of exaggerated arena/power phrasing, while preserving the established neon visual treatment and report/quest vocabulary.
- [x] Marketing header navigation now uses a separate horizontally scrollable route rail on narrow screens with the same 44px target baseline as dashboard navigation, preventing brand/nav wrapping from degrading scan order or touch usability.
- [x] Shared in-page section rails now use 40px chips and the established touch-scroll rail treatment across Dashboard, Contributions, Badges, Quests, Leaderboard, Settings, public profiles, and PR reports.
- [x] Shared inline status notices now expose a 32px dismiss target across contribution, badge, PR-report, onboarding, and settings feedback lanes, improving touch usability without expanding the surrounding notice shell.
- [x] Shared progressive-disclosure toggles now use 40px targets and decorative chevrons, improving repeated touch interactions and screen-reader output across filters, settings, reports, badges, and chart detail panels.
- [x] Removable search-filter chips now share one 40px control primitive across contribution and repository-privacy filters, eliminating duplicated markup while keeping compact filter summaries touch-friendly.
- [x] Shared search fields now expose a 40px clear action inside the 44px input lane and mark visual search/clear icons as decorative, keeping contribution, repository, and sync-log filtering touch-friendly and screen-reader concise.
- [x] Public profiles no longer repeat score, merged-PR, and consistency metrics immediately below the hero card; the share-facing overview now moves directly from identity context into evidence lanes.
- [x] Dashboard header summary chips now keep only rank and sync orientation; merged-PR and streak values remain in the richer signal cards below instead of being repeated in the header rail.
- [x] Contributions, Badges, Quests, Leaderboard, and Settings header rails now keep route orientation plus sync state instead of repeating detailed counts already shown in filters and overview cards; PR reports retain identity-critical metadata.
- [x] Shared decorative icons in summary cards, status pills, freshness chips, notices, copy/share controls, theme controls, rank badges, and marketing actions are now explicitly hidden from assistive technology so visible text remains the accessible authority.
- [x] Shared sync-status pills now restore the exact last-sync timestamp on wider layouts while retaining the compact relative-time label on mobile and the full semantic timestamp for assistive technology.
- [x] Dashboard and public-profile hero cards now explicitly hide decorative action, metric, trophy, next-move, and signal icons from assistive technology while preserving their visible cyberpunk styling.
- [x] Dashboard league, streak, quest, and recent-report cards now explicitly hide decorative status, movement, action, and evidence icons from assistive technology while preserving visible lane styling.
- [x] Lazy-rendered lanes no longer read `NODE_ENV` from client-exposed code, and GitHub App blocker guidance now follows the automatic-refresh model instead of telling users to rerun sync manually.
- [x] Expandable-text toggles, filter reset actions, sync-log resets, and dialog close buttons now follow the shared 40px compact-control baseline instead of collapsing into undersized touch targets.
- [x] Feature-route Lucide icons now declare decorative semantics explicitly, and `npm run check:decorative-icons` prevents visual-only SVGs from leaking repeated labels into assistive output.
- [x] New-tab actions now share an explicit assistive hint, and `npm run check:new-tab-links` enforces both the hint and `rel="noopener noreferrer"` for every `target="_blank"` link.
- [x] Focusable scroll regions now add one shared assistive instruction so keyboard and screen-reader users know the focused area can be scrolled without adding visible UI noise.
- [x] Polymorphic button links no longer use fake disabled states; `npm run check:polymorphic-buttons` prevents `disabled` on `<Button asChild>` so links only render when they are operable.

ABRA closeout artifact:

- `gitrank/docs/releases/abra-closeout.md`

ABRA gate:

- `make -C gitrank verify-abra-checklist` validates that ABRA checklist items remain fully checked and that the closeout artifact still contains scope, module, Gemini config, degraded-mode, and demo-flow coverage. This gate is also included in `make -C gitrank verify-v2-live-readiness`.
- `make -C gitrank generate-v2-live-closeout-status` now includes an explicit ABRA checklist probe so live closeout reports show both V2 and ABRA readiness.

## Suggested Early Issues

High-value issues to open next:

- [x] Add `LICENSE`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, issue templates, PR template, and `CODEOWNERS`
- [x] Add shared config and logging packages
- [x] Add API error envelope contract
- [x] Add database migration framework
- [x] Add GitHub webhook signature verification middleware
- [x] Add GitHub client package with retry and rate-limit helpers
- [x] Add first schema for users, GitHub accounts, repositories, and pull requests
- [x] Add queue abstraction and worker bootstrap
- [x] Add CI for tests, `govulncheck`, CodeQL, dependency review, and secret scanning
- [x] Add `docs/scoring-model.md`

## Maintainer Rule

If reality changes, update this file in the same PR.

That includes:

- architecture changes
- production readiness changes
- new shortcuts or temporary compromises
- new required contributor workflows

## External References

These official references were checked while preparing this document on May 5, 2026:

- GitHub contributor guidelines: https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/setting-guidelines-for-repository-contributors
- GitHub issue and PR templates: https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/about-issue-and-pull-request-templates
- GitHub CODEOWNERS: https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners
- GitHub security policy: https://docs.github.com/en/enterprise-cloud@latest/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/adding-a-security-policy-to-your-repository
- GitHub dependency review: https://docs.github.com/en/code-security/concepts/supply-chain-security/about-dependency-review
- GitHub CodeQL default setup: https://docs.github.com/en/code-security/how-tos/find-and-fix-code-vulnerabilities/configure-code-scanning/configuring-default-setup-for-code-scanning
- GitHub secret scanning: https://docs.github.com/en/code-security/secret-scanning/introduction/about-secret-scanning
- GitHub webhook validation: https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries
- GitHub GraphQL rate limits: https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api
- Go workspaces and modules: https://go.dev/ref/mod
- Go `govulncheck`: https://go.dev/doc/tutorial/govulncheck
- Go fuzzing: https://go.dev/doc/security/fuzz/
- OpenTelemetry Go instrumentation: https://opentelemetry.io/docs/languages/go/instrumentation/
- Sigstore: https://docs.sigstore.dev/
- SLSA source requirements: https://slsa.dev/spec/v1.2/source-requirements
- OpenSSF Scorecard: https://github.com/ossf/scorecard
