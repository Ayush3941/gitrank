# ADR 0001: Hybrid Service Architecture

## Status

Accepted

## Context

GitRank has both user-facing request flows and long-running sync, analysis, and scoring workflows. A purely synchronous architecture would create slow request chains and fragile retries. A purely async architecture would overcomplicate simple reads and explicit user actions.

## Decision

Use a hybrid architecture:

- synchronous HTTP for reads and user-triggered commands
- asynchronous jobs and events for ingestion, analysis, and re-scoring

## Consequences

Positive:

- cleaner user-facing latency
- safer retries for GitHub and AI integrations
- better fit for replay and backfill workflows

Negative:

- more operational moving parts
- more need for idempotency, observability, and queue discipline
