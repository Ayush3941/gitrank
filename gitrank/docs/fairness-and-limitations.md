# Fairness and Limitations

GitRank is a decision-support system, not a truth machine.

## What GitRank Can Do Reasonably Well

- compare a user's contribution history against itself over time
- distinguish some low-signal work from some higher-signal work
- surface areas where a contributor appears to do more complex or reviewed work

## What GitRank Cannot Prove

- absolute engineering ability
- job performance in closed-source environments
- authorship quality from diff size alone
- intent behind a change

## Known Bias Risks

- bias toward repositories with richer review processes
- bias against contributors who do valuable work in quiet or niche projects
- bias toward languages or ecosystems with better observable metadata
- bias against contributors whose work is mostly discussion, mentoring, or triage
- bias against engineers whose strongest work is in private repositories, because private repositories are intentionally out of scope

## Mitigations

- expose score explanations
- version scoring formulas
- avoid using stars as a dominant signal
- allow dispute and correction workflows
- include uncertainty language in profiles
- treat public organization-owned repositories the same as other public repositories instead of assigning automatic prestige

## Product Language Rules

GitRank should say:

- "appears strongest in backend contributions"
- "recently did more test-heavy work"
- "contributions were frequently reviewed and merged"

GitRank should avoid saying:

- "is an expert"
- "is better than"
- "is definitely senior"

## AI Usage Limits

AI classification should be treated as probabilistic and bounded. Deterministic features and human-readable explanations should remain primary.

## Scope Decisions

- Private repositories are out of scope for GitRank scoring.
- Public organization-owned repositories are in scope and treated normally.
- Self-merged pull requests are excluded from score-bearing reputation events.
- Bot-authored and bot-assisted pull requests are excluded from score-bearing reputation events.
