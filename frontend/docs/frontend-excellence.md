# Frontend Excellence Baseline

Last updated: May 16, 2026

This document defines the current production baseline for frontend UX direction,
design consistency, and delivery rhythm.

## Primary Journeys and Success Moments

### 1) New user onboarding

- Entry: `/login` -> `/onboarding/connect-github` -> `/onboarding/analyzing` -> `/onboarding/reveal`
- Success moment: first non-empty profile snapshot is visible on `/dashboard`
  with sync state `synced` and at least one score signal card.

### 2) Returning contributor

- Entry: `/dashboard`
- Path: dashboard hero -> contributions/badges/quests drill-down
- Success moment: user can explain current score movement and open at least one
  evidence-linked contribution or PR report from live data.

### 3) Public profile sharing

- Entry: `/u/[username]`
- Path: profile summary -> contribution highlights -> shareable identity signal
- Success moment: profile route resolves publicly with contributor title, score,
  and contribution evidence sections (without requiring session-only UI).

## Design Token Baseline

Source of truth: `frontend/app/globals.css`.

### Color and surface tokens

- `--background`, `--foreground`, `--muted`
- `--card`, `--card-2`
- `--primary`, `--primary-2`, `--success`, `--warning`, `--danger`
- Utility visual tokens: `--line`, `--neon-accent`, `--neon-hot`

### Radius policy

- Global radius baseline is enforced at `0.1rem` via universal selector.
- Component-specific radius overrides should only be used when a functional
  affordance requires a larger interactive silhouette.
- Non-pill surfaces should spell `rounded-[var(--radius-universal)]` directly
  instead of using large-radius classes that the global token layer overrides.
- `npm run check:radius-tokens` enforces the policy across production frontend
  source.

### Typography baseline

- Display: `font-display` (Orbitron), `text-4xl` to `text-6xl`
- Section headers: `font-display`/`cyber-title`, `text-2xl` to `text-3xl`
- Body: `font-sans` (Space Grotesk), `text-sm` to `text-base`
- Caption/readout: `font-mono` (IBM Plex Mono), `text-xs` or smaller

### Glow intensity levels

- Subtle: `neon-surface`, `neon-tile`
- Medium: `glass-panel`, `neon-outline`, `neon-metric`
- Hero: `glass-panel-strong`, `cyber-hero-shell`

### Icon sizing baseline

- Dense list controls: `h-4 w-4`
- Standard status/value chips: `h-5 w-5`
- Hero/spotlight markers: `h-6 w-6` max

## Component State Baseline

All interactive primitives should expose and visually distinguish:

- default
- hover
- focus-visible
- active/selected
- disabled
- loading (if async action exists)
- error (if mutation or fetch can fail)

Current primitives implementing this baseline:

- `components/ui/button.tsx`
- `components/ui/switch.tsx`
- `components/ui/tabs.tsx`
- Native `<select>` controls in feature-level filters (contributions, badges,
  leaderboard mobile lane filter, settings repository filter)

## 30 / 60 / 90 Day Plan

### 0-30 days (critical)

- Finish accessibility CI gates (axe + Lighthouse accessibility).
- Add route-level error-rate dashboards and stale-state telemetry.
- Add Lighthouse + CWV budget enforcement in CI.

### 31-60 days (important)

- Add OG/Twitter image generation for profile and PR report routes.
- Add contract tests for BFF-to-backend endpoint mapping.
- Add bundle analysis budget reporting and dependency trimming.

### 61-90 days (polish)

- Expand visual regression coverage for key dashboard and public profile routes.
- Iterate neon density and spacing using weekly refinement metrics.
- Consolidate UX decision history into release-ready design notes.

## Weekly Refinement Loop (Required)

Every week:

1. Capture before/after screenshots for dashboard, contributions, badges, quests,
   settings, leaderboard, and public profile routes.
2. Record metric deltas:
   - build size and chunk deltas
   - Lighthouse (Perf + A11y) deltas
   - field freshness/error counters
3. Update `frontend/docs/ux-changelog.md` with decisions and measurable impact.

Latest retained evidence summary:

- `frontend/docs/evidence/weekly-2026-05-17/README.md`
