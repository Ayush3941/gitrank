# ADR 0003: Idempotent At-Least-Once Processing

## Status

Accepted

## Context

GitRank depends on GitHub webhooks, paginated API fetches, queue workers, and batch recomputation. These flows are naturally at-least-once. Without an explicit idempotency contract, retries and redeliveries would produce duplicate rows, duplicate scores, and unstable profile aggregates.

## Decision

Adopt at-least-once delivery with idempotent logical effects.

- use `X-GitHub-Delivery` as the idempotency key for GitHub webhooks
- require a stable idempotency key or deterministic dedupe key for every mutating command and background job
- record the idempotency key atomically with the durable mutation
- return semantically equivalent success responses for duplicate requests whenever the original request already succeeded
- bound retries with exponential backoff and jitter, then dead-letter poison jobs
- treat historical re-scoring as append-only replay, not in-place mutation

## Consequences

Positive:

- safe webhook redelivery and manual replay
- simpler retry behavior in workers and operators
- cleaner audit history for score-version rollouts
- better failure recovery after partial outages

Negative:

- more schema and queue complexity
- more careful transaction design
- stricter requirements on natural keys, UPSERTs, and dedupe windows
