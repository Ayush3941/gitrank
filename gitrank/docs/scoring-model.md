# Scoring Model

This document defines the intended shape of GitRank scoring v1.

## Product Requirement

The score must answer:

- what kind of work happened
- how substantial it was
- whether it was reviewed and accepted
- what engineering dimensions it likely exercised

The score must not answer:

- whether a person has an absolute or final measure of engineering worth
- whether a contribution was perfect
- whether repository popularity alone implies skill

V1 product note:

- the score does feed a public global leaderboard
- leaderboard position should be presented as a casual, formula-versioned product surface rather than objective truth

## Eligibility Gates

Before GitRank scores a pull request, it must pass basic eligibility checks.

Included:

- pull requests in public repositories
- pull requests in public organization-owned repositories

Excluded:

- pull requests from private repositories
- pull requests merged by the same contributor who opened them
- bot-authored pull requests
- bot-assisted pull requests

Repository owner type does not create a bonus or penalty by itself. A public repository is eligible whether it is owned by an individual or an organization.

## Scoring Pipeline

1. Ingest normalized PR evidence.
2. Extract deterministic features.
3. Optionally enrich with AI classification.
4. Validate the analysis artifact.
5. Apply a versioned deterministic formula.
6. Store the score event and explanation.
7. Recompute user aggregates.

## Feature Groups

### Contribution category

Examples:

- documentation
- tests
- bug_fix
- feature
- refactor
- performance
- infrastructure
- security
- maintainer_design

### Technical depth

Examples:

- cross-package impact
- changed file mix
- code versus docs ratio
- logic-bearing files changed
- complexity-sensitive directories
- tests added or modified

### Review strength

Examples:

- review count
- requested-changes cycles
- maintainer participation
- unresolved concern count

### Outcome

Examples:

- merged
- closed_unmerged
- draft_only
- abandoned

### Consistency

Examples:

- sustained accepted contributions
- breadth across repositories
- repeated meaningful work over time

## Directional Formula

```text
ContributionScore =
  CategoryWeight
  * TechnicalDepth
  * ReviewStrength
  * RepositoryContext
  * OutcomeWeight
  * ConsistencyModifier
  - SpamPenalty
```

## Explainability Requirement

Every score event must expose:

- score version
- major factors used
- major positive factors
- penalties applied
- confidence or uncertainty notes where relevant

## Repository Context

Repository context should influence trust, not dominate the result.

Allowed signals:

- activity level
- maintainer count
- issue and PR throughput
- archival or inactivity state

Weak secondary signals:

- stars
- forks

Repository context guardrail:

- repository bonus must be capped so famous repositories do not dominate the score

## Outcome Weights

Directional expectations:

- merged: strongest
- closed_unmerged after serious review: low but non-zero in some cases
- abandoned or draft-only: near zero

## Skill Dimensions

Score events should also map to skill dimensions, for example:

- backend
- debugging
- testing
- api_design
- systems
- performance
- security
- documentation
- tooling

## Guardrails

- AI output cannot directly set the final score.
- Large diff size alone cannot imply high value.
- Small but high-signal fixes must still be able to score well.
- Repeated near-identical PR patterns should receive diminishing returns.
- The formula must be versioned.
- Re-scoring must be replayable after model or formula changes.
- Excluded work should be filtered before scoring, not merely penalized after scoring.
