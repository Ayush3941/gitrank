# GitHub Integration Policy

Last reviewed: November 19, 2026

This document freezes the v1 GitHub integration baseline.

## Auth Model

- GitHub OAuth is the v1 sign-in and account-linking path
- GitHub App installation tokens are required for contribution sync extraction
- extraction fails closed when installation auth is unavailable; OAuth user tokens are not a fallback

This follows the frozen [GitHub auth decision](./production-decision-register.md#4-github-auth-model).

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

Current extraction paths use REST. GraphQL clients remain available for future
bounded read optimizations, but are not wired into sync extraction. Any new
GraphQL path must demonstrate a measured benefit and preserve installation-token
auth, bounded reads, and evidence persistence.

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

## Configuration

See the [runtime configuration reference](./configuration.md) for App credentials,
webhook validation, and optional operating limits. Webhook-delivery verification
is a separate boundary from manual sync extraction auth.
