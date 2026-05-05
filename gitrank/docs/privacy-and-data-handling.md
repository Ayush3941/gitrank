# Privacy and Data Handling

Last reviewed: May 5, 2026

This document defines the v1 privacy, data-retention, deletion, and AI data-exposure baseline.

## Core Posture

- GitRank uses only public GitHub repository activity for scoring in v1.
- Private repositories are out of scope in v1.
- Public profiles and leaderboard participation are enabled by default for signed-in users.
- Users must still be able to hide their profile, hide specific repositories, request re-sync, and request account deletion.

Public GitHub data usage posture:

- GitRank evaluates only data that is already public on GitHub and connected by the signed-in user
- GitRank republishes derived reputation views and evidence links, not private repository content
- GitRank should not claim legal certainty beyond this product posture and should keep the privacy policy aligned before public production launch

## Data Minimization

GitRank should retain only what is needed for:

- sign-in and session security
- GitHub sync and replay safety
- evidence-backed scoring and explanation
- abuse review and operational debugging

GitRank should not retain:

- private repository code
- full repository file contents in v1
- secrets or raw credentials in logs or analytics
- unbounded public diff payloads when derived features or bounded excerpts are enough

## Data Classes

| Class | Examples | Storage rule |
| --- | --- | --- |
| Public contribution evidence | public repository names, PR links, labels, review state, bounded public diff excerpts | may be stored when needed for scoring, explanation, replay safety, or audit |
| Account-identifying data | GitHub login, GitHub user ID, public handle, avatar URL, email returned from OAuth | store only where needed for identity, profile rendering, and support flows |
| Sensitive credentials | OAuth access tokens, refresh tokens, session secrets, encryption keys | encrypt at rest, never log raw values, restrict access by service purpose |
| Derived reputation data | scores, badges, levels, leaderboard entries, profile snapshots | treat as user-impacting data that must stay explainable and deletable |
| Operational telemetry | request IDs, error codes, queue metrics, audit logs, analytics events | avoid secrets and raw code; retain only according to documented windows |

## AI Data Exposure Rules

AI inputs may include:

- bounded public PR diff hunks
- PR title and description
- changed file names
- labels
- review metadata
- derived deterministic features

AI inputs must not include:

- full repository files
- private repository code
- unbounded raw diff payloads

Storage posture for diff evidence:

- prefer derived features and summaries for long-term storage
- re-fetch public diffs when possible instead of storing entire diff bodies
- if bounded public diff excerpts must be stored for explanation or debugging, keep them narrow and subject to the same retention rules

If a PR diff is too large:

- summarize or reduce the diff first
- prefer deterministic features over raw text

## Default Retention Windows

These windows are the v1 baseline and should be tightened rather than expanded by default.

| Data class | Retention target |
| --- | --- |
| OAuth states | until used or expired, then purge within 7 days |
| Active sessions | until expiry or logout |
| Invalidated sessions | 30 days |
| Webhook deliveries and replay metadata | 30 days unless a live incident requires longer retention |
| GitHub HTTP cache entries | 30 days |
| AI prompt and response metadata | 30 days |
| Analytics event data | 180 days |
| Audit logs for auth-sensitive actions | 365 days |

User-visible profile, score, and evidence data remain until:

- the user requests deletion
- the account is disabled for abuse handling
- or a narrower legal or operational retention rule replaces the default

## Deletion and Account Removal

When a user requests deletion:

1. public profile visibility is disabled immediately
2. active sessions and linked OAuth tokens are invalidated immediately
3. user-linked derived profile views, scores, badges, sessions, and ranking presence are removed from GitRank immediately
4. v1 currently performs immediate hard deletion of user-owned GitRank records after confirmed self-service deletion
5. contribution evidence that is retained for repository-level history may remain detached from the deleted user account when foreign-key relationships are defined as `ON DELETE SET NULL`

GitRank v1 should prefer:

- immediate public hiding
- fast credential invalidation
- immediate hard deletion of user-owned records once the request is confirmed

## Provenance and User Understanding

GitRank should let users inspect:

- why a score exists
- which public contributions contributed to it
- which formula version was used
- whether data is stale or partial

## Re-sync and Visibility Controls

V1 baseline:

- users can request re-sync
- users can hide individual repositories from public profile views
- users can disable public profile visibility
- users can request account or data deletion
