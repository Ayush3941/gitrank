# Analytics Plan

Last reviewed: May 5, 2026

GitRank uses broad product analytics in v1, but the analytics scope is still bounded.

## Default Policy

- analytics are enabled by default for signed-in product usage in v1
- private code, secrets, raw tokens, and private repository content must never be captured
- event names should be versioned and documented before rollout

## Event Families

Track product behavior for:

- onboarding start and completion
- sync request, success, failure, and staleness outcomes
- dashboard visits and section engagement
- public profile views and share-card actions
- leaderboard visits and ranking filters
- contribution drill-down and PR report views
- score explanation openings and dwell behavior
- badge, quest, and progression engagement
- dispute or report submission flows

## Required Guardrails

- avoid storing raw code, PR patches, or prompt bodies in analytics
- avoid storing access tokens, session values, or secret-derived identifiers
- avoid collecting more personal data than the event actually needs
- tie analytics review to product decisions, not curiosity

## Feedback Loop

- disputes and correction requests should be measurable
- onboarding drop-off and sync-failure funnels should be reviewed regularly
- analytics should be used to improve explanation clarity, not just engagement
