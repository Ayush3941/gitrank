# Analytics Plan

Last reviewed: May 5, 2026

GitRank uses broad product analytics in v1, but the analytics scope is still bounded.

## Default Policy

- analytics are enabled by default for signed-in product usage in v1
- private code, secrets, raw tokens, and private repository content must never be captured
- event names should be versioned and documented before rollout

## Event Families

Track product behavior for:

- onboarding completion through `onboarding.completed`
- sync success and failure outcomes through API-gateway server-side `sync.succeeded` and `sync.failed`
- dashboard visits and section engagement
- public and authenticated profile views through API-gateway server-side `profile.viewed`
- share-card actions as a future client event after the tracked frontend adds a share interaction contract
- leaderboard visits and ranking filters
- contribution drill-down and PR report views
- score explanation openings through `score_explanation.opened`
- badge engagement through `badge.viewed`
- quest and progression engagement as future client events after live quest and progression contracts exist
- dispute or report submission flows

## API Gateway Tracking Surface

The API gateway exposes `POST /v1/analytics/events` for bounded client-side product events and exports accepted counters through `gitrank_product_analytics_events_total`.

Accepted event names:

- `onboarding.completed`
- `score_explanation.opened`
- `badge.viewed`

Server-side events emitted by the gateway:

- `sync.succeeded`
- `sync.failed`
- `profile.viewed`

## Required Guardrails

- avoid storing raw code, PR patches, or prompt bodies in analytics
- avoid storing access tokens, session values, or secret-derived identifiers
- avoid collecting more personal data than the event actually needs
- keep accepted analytics payloads to event name, source, target, and success/failure status
- tie analytics review to product decisions, not curiosity

## Feedback Loop

- disputes and correction requests should be measurable
- onboarding drop-off and sync-failure funnels should be reviewed regularly
- analytics should be used to improve explanation clarity, not just engagement
