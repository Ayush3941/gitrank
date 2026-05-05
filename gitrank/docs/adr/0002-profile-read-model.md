# ADR 0002: Profile Snapshot Read Model

## Status

Accepted

## Context

GitRank needs fast profile reads, but the scoring evidence behind a profile is derived from many normalized GitHub rows, analyses, and score events. Computing the full profile aggregate on every request would make latency unpredictable and would complicate rollback after re-scoring.

## Decision

Use a rebuildable profile snapshot as the canonical read model for current profile views.

- normalized GitHub entities remain the source of truth for raw evidence
- contribution analyses remain the source of truth for classifier output
- score events remain the source of truth for versioned scoring decisions
- the latest successful `profile_snapshot` is the canonical object served by profile reads

## Consequences

Positive:

- low-latency profile reads
- explicit separation between durable history and derived read state
- easier batch rebuilds after formula or analyzer changes
- safer rollback by regenerating snapshots from an older score version

Negative:

- one more derived data layer to operate
- snapshot freshness must be monitored explicitly
- operators need repair and replay tooling for stale or missing snapshots
