

## Hard Rules
0. Make a commit after every session
1. Minimize AI slop.
   - No generic filler copy.
   - No duplicate patterns when a shared abstraction is the right fix.
   - No vague comments, dead UI, fake interactivity, or speculative code paths.
2. Double-check every change.
   - Review the touched flow before editing.
   - Run verification after editing.
   - Review the diff before considering the task complete.
3. Keep temporary AI-generated verification assets isolated.
   - Temporary test harnesses, smoke scripts, fixtures, and debug scaffolds may be created only under `/ai_test`.
   - They must not be mixed into production directories.
   - Promote them into `test/` only if they become real long-term coverage.
4. Design quality and consistency are top-level requirements.
   - Reuse theme tokens, spacing, typography, interaction patterns, and shared widgets.
   - If a new visual pattern is introduced more than once, extract it.
   - Avoid one-off styling that makes the app feel stitched together.
5. Ship production-grade work by default.
   - No stubs, fake success states, mock save buttons, placeholder handlers, or hardcoded business logic unless unavoidable for a clearly documented reason.
   - If any stub, hardcode, test ID, demo data path, or temporary fallback remains, disclose it in `README.md` and `CONTRIBUTING.md` in the same change set.
6. Prefer large-project structure.
   - New work should move toward feature-oriented modules that are easy to debug and extend.
   - Favor `lib/features/<feature>/{data,domain,application,presentation}` when adding or restructuring substantial functionality.
   - Keep shared primitives in `lib/core` or another clearly shared layer.
   - Do not add more oversized god files when a split is justified.
7. Keep docs in sync.
   - Every meaningful change must update `CONTRIBUTING.md`.
   - Architecture or production-readiness changes must also update `README.md` when user-facing expectations shift.

## Change Workflow

1. Read the affected flow end to end.
2. Identify routing, persistence, state, analytics, and UI consistency impact.
3. Make the smallest correct production-grade change.
4. Verify with the best available checks.
5. Update `CONTRIBUTING.md`.
6. If any temporary hardcode/stub remains, disclose it in `README.md`.
7. Self-review the diff for correctness, regressions, and polish.

## Verification Standard

- Prefer real tests over inspection-only claims.
- If a temporary agent-authored test suite is needed, place it under `/ai_test`.
- When touching persistence or data shape:
  - verify both writers and readers
  - verify migration compatibility where relevant
- When touching UI:
  - check desktop-sized and narrow mobile layouts
  - check loading, empty, error, and success states
- When touching production config:
  - verify there are no leftover test IDs, placeholder package names, or debug-only settings unless explicitly documented

## Directory Guidance

- `lib/core/`
  App-wide infrastructure, theme, base services, shared models, and cross-feature primitives.
- `lib/features/<feature>/data/`
  DTOs, repositories, persistence adapters, remote/local data access.
- `lib/features/<feature>/domain/`
  Entities, use cases, domain rules, validation, business contracts.
- `lib/features/<feature>/application/`
  Controllers, notifiers, orchestration, feature state transitions.
- `lib/features/<feature>/presentation/`
  Screens, widgets, view models, UI-only mapping logic.
- `test/`
  Long-lived automated coverage.
- `ai_test/`
  Temporary agent-created verification assets only.

## Explicit Anti-Patterns

- Monolithic screens that combine UI, persistence, and business logic when the touched area can be split cleanly.
- Silent fallbacks that hide broken production behavior.
- Hardcoded identifiers or credentials without README disclosure.
- UI buttons that imply persistence or navigation but do not perform the promised action.
- Adding new architectural debt to avoid reading the existing flow.
