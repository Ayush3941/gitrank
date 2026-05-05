# Anti-Gaming

GitRank only works if contributors cannot cheaply inflate their reputation with low-value activity.

## Abuse Patterns To Resist

- micro-PR farming
- cosmetic change inflation
- duplicated low-value documentation edits
- mass typo sweeps across repositories
- self-merge loops without meaningful review
- review rings in low-trust repositories
- AI-generated churn with little engineering value

## Defensive Rules

### Diminishing returns

Repeated tiny contributions in a narrow window should score progressively less unless review and technical depth indicate real value.

### Review-aware weighting

Maintainer-reviewed and merged work should count more than unreviewed or self-merged work.

Self-merged pull requests should be excluded from score-bearing reputation events entirely.

### Noise discounting

Heuristics should discount:

- rename-only churn
- whitespace-only edits
- generated file churn
- vendor or lockfile-only drift unless materially important

### Repository diversity

Sustained meaningful work in one serious project can matter. Mass low-signal activity across many repositories should not be rewarded automatically.

### AI suspicion handling

GitRank should not attempt attribution of authorship quality with certainty, but it should avoid blindly rewarding large, generic changes that lack review depth or technical signals.

If a pull request is bot-authored or explicitly bot-assisted, it should be excluded from scoring rather than lightly discounted.

### Repository visibility and ownership

Only public repositories are eligible for GitRank scoring.

Public organization-owned repositories should be treated normally. Ownership by a company, foundation, or team should not automatically increase or reduce score.

Private repositories should be excluded so GitRank remains grounded in verifiable public evidence and avoids turning private code access into a scoring prerequisite.

## Operational Controls

- scoring disputes should exist
- scoring formulas should be versioned
- suspicious patterns should be reviewable
- emergency penalties or exclusions should be auditable
