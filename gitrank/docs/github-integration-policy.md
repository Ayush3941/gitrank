# GitHub Integration Policy

Last reviewed: May 5, 2026

This document freezes the v1 GitHub integration baseline.

## Auth Model

- GitHub OAuth is the v1 sign-in and account-linking path
- GitHub App installation is not required for v1 production
- existing GitHub App code paths remain optional future-upgrade scaffolding

## Minimum OAuth Scope Baseline

GitRank requests only:

- `read:user`
- `user:email`

V1 does not request repository write access.

V1 scoring uses only public repository activity.

## Source Data Posture

- only public repositories are eligible for scoring
- private repositories are out of scope in v1
- public organization-owned repositories are treated like other public repositories

## REST and GraphQL Usage Rules

Use GitHub REST when:

- webhook payloads map directly to REST resource identities
- pagination over resource collections is straightforward
- bounded user sync needs a public authored-PR discovery pass through issue/PR search before hydrating concrete PRs
- conditional requests or ETag support are useful

Use GitHub GraphQL when:

- a single request can replace many REST round-trips
- review, repository, and user relationships are expensive to hydrate piecemeal
- the data shape is naturally graph-oriented

Avoid mixing both within the same hot path unless there is a measured reason.

## Rate-Limit Policy

- track remaining REST and GraphQL budget in metrics
- back off on secondary rate-limit responses
- pause lower-priority backfills before user-initiated syncs
- prefer incremental syncs over broad refreshes when headroom is low
- expose stale and partial indicators rather than pretending data is fresh

## Historical Backfill Rules

- re-sync and backfill must key writes by stable GitHub identifiers
- replay must be idempotent
- duplicate webhook deliveries must not create duplicate evidence or scores
- user-history sync may discover concrete `owner/repo#number` targets through GitHub issue/PR search, but hydration and scoring evidence still flow through the normal PR persistence path

## Future Upgrade Boundary

If GitHub App support becomes a production requirement later, add:

- a new decision record
- explicit permission and event lists
- webhook public endpoint hardening review
- updated retention and threat-model notes
